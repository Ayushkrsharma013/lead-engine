import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mergeLeadsInDB } from "@/lib/db";
import { sanitizeLead, stableLeadId } from "@/lib/storage";
import type { Lead } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "blitzapi/linkedin-leads-finder";
const APIFY_HEADERS = {
  Authorization: `Bearer ${APIFY_TOKEN}`,
  "Content-Type": "application/json",
};

const COST_PER_LEAD = 0.008; // $0.008 per lead
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 4000;
const MIN_CONFIDENCE_SCORE = 70;

// ─── Fetch positive/negative keywords from user feedback ──────────────────────

async function getFeedbackKeywords(userId: string): Promise<{ include: string[]; exclude: string[] }> {
  const { data } = await supabaseAdmin
    .from("lead_feedback")
    .select("keyword, weight")
    .eq("user_id", userId);

  const aggregated: Record<string, number> = {};
  for (const row of data || []) {
    aggregated[row.keyword] = (aggregated[row.keyword] || 0) + (row.weight as number);
  }

  const include = Object.entries(aggregated)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  const exclude = Object.entries(aggregated)
    .filter(([, w]) => w < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .map(([k]) => k);

  return { include, exclude };
}

// ─── Poll Apify run until SUCCEEDED or terminal status ────────────────────────

async function pollRun(runId: string): Promise<{ status: string; datasetId?: string }> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, { headers: APIFY_HEADERS });
    if (!res.ok) continue;
    const json = await res.json();
    const status = json?.data?.status as string;
    if (status === "SUCCEEDED") return { status, datasetId: json.data.defaultDatasetId };
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) return { status };
  }
  return { status: "TIMED-OUT" };
}

// ─── Fetch dataset items ──────────────────────────────────────────────────────

async function fetchDataset(datasetId: string, limit: number, offset: number): Promise<unknown[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${limit}&offset=${offset}`,
    { headers: APIFY_HEADERS }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

// ─── Map BlitzAPI item → Lead ─────────────────────────────────────────────────

function blitzItemToLead(item: Record<string, unknown>): Lead | null {
  const confidence = Number(item.confidence_score ?? item.confidenceScore ?? 0);
  if (confidence < MIN_CONFIDENCE_SCORE) return null;

  const email = String(item.email || item.work_email || "").trim().toLowerCase();
  const linkedin = String(item.linkedin_url || item.linkedinUrl || "").trim();
  const name = String(item.full_name || item.name || "").trim();
  const company = String(item.company_name || item.company || item.organization_name || "").trim();
  const title = String(item.job_title || item.title || "").trim();

  if (!name || !company) return null;
  if (!email && !linkedin) return null;

  const id = stableLeadId(email, linkedin, name, company);
  const hasEmail = !!email;
  const hasLinkedin = !!linkedin;
  const hasPhone = !!(item.phone || item.mobile_phone);

  let score = 70;
  if (hasEmail) score += 15;
  if (hasLinkedin) score += 10;
  if (hasPhone) score += 5;
  score = Math.min(100, score);

  const raw: Record<string, unknown> = {
    id,
    name,
    title,
    company,
    industry: String(item.industry || item.company_industry || "").trim(),
    location: String(item.location || item.city || "").trim(),
    email,
    emailStatus: hasEmail ? "verified" : "not_found",
    linkedin,
    website: String(item.company_website || item.website || "").trim(),
    companySize: String(item.company_size || item.employee_count || "").trim(),
    score,
    source: "linkedin",
  };

  return sanitizeLead(raw);
}

// ─── POST — multi-batch scrape with quota + budget cap ────────────────────────

export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    filters?: Record<string, unknown>;
    targetCount?: number;
    budgetCapCents?: number;
  };

  const filters = (body.filters || {}) as Record<string, unknown>;

  // Load quota + budget from profile if not passed in body
  let targetCount = body.targetCount || 100;
  let budgetCapCents = body.budgetCapCents || 500;

  if (!body.targetCount || !body.budgetCapCents) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("lead_quota_target, budget_cap_cents")
      .eq("id", userId)
      .maybeSingle();
    if (!body.targetCount && profile?.lead_quota_target) targetCount = profile.lead_quota_target;
    if (!body.budgetCapCents && profile?.budget_cap_cents) budgetCapCents = profile.budget_cap_cents;
  }

  const budgetDollars = budgetCapCents / 100;

  // Fetch feedback keywords
  const { include: includeKeywords, exclude: excludeKeywords } = await getFeedbackKeywords(userId);

  // Map filters to BlitzAPI input
  const countries = Array.isArray(filters.countries) ? filters.countries as string[] : [];
  const industries = Array.isArray(filters.industries) ? filters.industries as string[] : [];
  const sizes = Array.isArray(filters.companySizes) ? filters.companySizes as string[] : [];
  const keyword = typeof filters.keyword === "string" ? filters.keyword : "";

  const includeTitles = [
    ...(keyword ? keyword.split(",").map((t: string) => t.trim()).filter(Boolean) : []),
    ...includeKeywords,
  ];

  const baseInput: Record<string, unknown> = {
    max_results: Math.min(100, targetCount), // batch size capped at 100
    include_emails: true,
    confidence_score_min: MIN_CONFIDENCE_SCORE,
  };

  if (countries.length > 0) baseInput.locations = countries;
  if (industries.length > 0) baseInput.industries = industries;
  if (sizes.length > 0) baseInput.company_size = sizes;
  if (includeTitles.length > 0) baseInput.include_titles = includeTitles;
  if (excludeKeywords.length > 0) baseInput.exclude_titles = excludeKeywords;

  let totalFetched = 0;
  let totalNew = 0;
  let totalCost = 0;
  let offset = 0;
  let reachedTarget = false;
  let batchNum = 0;

  while (totalNew < targetCount && totalCost < budgetDollars) {
    batchNum++;
    const remaining = targetCount - totalNew;
    const affordable = Math.floor((budgetDollars - totalCost) / COST_PER_LEAD);
    const batchSize = Math.min(100, remaining, affordable);

    if (batchSize <= 0) break;

    const input = { ...baseInput, max_results: batchSize, offset };

    // Start actor run
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?waitForFinish=0`,
      { method: "POST", headers: APIFY_HEADERS, body: JSON.stringify(input) }
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      // If BlitzAPI actor not found, return a clear error
      if (startRes.status === 404) {
        return NextResponse.json(
          { error: `Apify actor '${ACTOR}' not found. Verify the actor ID in your Apify account.` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Apify HTTP ${startRes.status}: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    let startData: Record<string, unknown> = {};
    try { startData = await startRes.json(); } catch { /* empty */ }

    const runId = (startData?.data as Record<string, unknown>)?.id as string | undefined;
    if (!runId) {
      return NextResponse.json({ error: "Failed to start actor — no runId returned" }, { status: 502 });
    }

    // Poll until done
    const { status, datasetId } = await pollRun(runId);

    if (status !== "SUCCEEDED" || !datasetId) {
      // Non-fatal on later batches; fail on first
      if (batchNum === 1) {
        return NextResponse.json({ error: `Actor run ${status}` }, { status: 502 });
      }
      break;
    }

    // Fetch results
    const rawItems = await fetchDataset(datasetId, batchSize, 0);
    totalFetched += rawItems.length;

    const mapped: Lead[] = [];
    for (const item of rawItems) {
      const lead = blitzItemToLead(item as Record<string, unknown>);
      if (lead) mapped.push(lead);
    }

    if (mapped.length === 0) break; // Actor returned nothing useful — stop paging

    // Merge into DB
    const { added } = await mergeLeadsInDB(mapped);
    totalNew += added;
    totalCost += rawItems.length * COST_PER_LEAD;
    offset += rawItems.length;

    // Check if actor returned fewer than requested (end of results)
    if (rawItems.length < batchSize) break;
  }

  reachedTarget = totalNew >= targetCount;

  return NextResponse.json({
    ok: true,
    totalFetched,
    totalNew,
    totalCost: Math.round(totalCost * 1000) / 1000,
    remainingBudget: Math.max(0, Math.round((budgetDollars - totalCost) * 100) / 100),
    reachedTarget,
    batches: batchNum,
  });
}
