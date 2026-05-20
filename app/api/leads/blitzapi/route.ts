import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mergeLeadsInDB } from "@/lib/db";
import { sanitizeLead, stableLeadId } from "@/lib/storage";
import type { Lead } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";
const APIFY_HEADERS = {
  Authorization: `Bearer ${APIFY_TOKEN}`,
  "Content-Type": "application/json",
};

const COST_PER_LEAD = 0.001; // $0.001 per lead
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

// ─── Map x_guru actor item → Lead ────────────────────────────────────────────

function blitzItemToLead(item: Record<string, unknown>): Lead | null {
  // x_guru actor response fields
  const email    = String(item.email || (Array.isArray(item.emails) ? (item.emails as {address: string}[])[0]?.address || "" : "") || "").trim().toLowerCase();
  const linkedin = String(item.linkedin_url || item.person_linkedin_url || "").trim();
  const name     = String(item.full_name || item.name || "").trim();
  const company  = String(item.job_company_name || item.company || item.organization_name || "").trim();
  const title    = String(item.job_title || item.title || "").trim();

  if (!name || !company) return null;
  if (!email && !linkedin) return null;

  const id = stableLeadId(email, linkedin, name, company);
  const hasEmail    = !!email;
  const hasLinkedin = !!linkedin;
  const hasPhone    = !!(item.phone_numbers || item.mobile_phone || item.phone);

  let score = 70;
  if (hasEmail)    score += 15;
  if (hasLinkedin) score += 10;
  if (hasPhone)    score += 5;
  score = Math.min(100, score);

  const raw: Record<string, unknown> = {
    id,
    name,
    title,
    company,
    industry: String(item.industry || item.job_company_industry || "").trim(),
    location: String(item.location || item.person_location_name || item.city || "").trim(),
    email,
    emailStatus: hasEmail ? "verified" : "not_found",
    linkedin,
    website: String(item.job_company_website || item.company_website || "").trim(),
    companySize: String(item.job_company_size || item.company_size || "").trim(),
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

  // ─── Seniority mapping ────────────────────────────────────────────────────
  const SENIORITY_MAP: Record<string, string> = {
    "Owner / Founder": "owner", "C-Suite": "cxo", "VP": "vp",
    "Director": "director", "Manager": "manager", "Senior / Head": "senior",
  };
  const FUNCTION_MAP: Record<string, string> = {
    "Sales": "sales", "Marketing": "marketing", "Engineering": "engineering",
    "Product": "product", "Operations": "operations", "Finance": "finance",
    "HR / People": "human_resources", "Business Dev": "business_development",
  };

  const countries     = Array.isArray(filters.countries)    ? filters.countries    as string[] : [];
  const regions       = Array.isArray(filters.regions)      ? filters.regions      as string[] : [];
  const industries    = Array.isArray(filters.industries)   ? filters.industries   as string[] : [];
  const seniority     = Array.isArray(filters.seniority)    ? filters.seniority    as string[] : [];
  const jobFunction   = Array.isArray(filters.jobFunction)  ? filters.jobFunction  as string[] : [];
  const sizes         = Array.isArray(filters.companySizes) ? filters.companySizes as string[] : [];
  const salary        = Array.isArray(filters.salary)       ? filters.salary       as string[] : [];
  const emailStatus   = Array.isArray(filters.emailStatus)  ? filters.emailStatus  as string[] : [];
  const companyDomains = typeof filters.companyDomains === "string" ? filters.companyDomains as string : "";
  const keyword        = typeof filters.keyword === "string" ? filters.keyword as string : "";

  const titleKeywords = [
    ...(keyword ? keyword.split(",").map((t: string) => t.trim()).filter(Boolean) : []),
    ...includeKeywords,
  ];

  const mappedSeniority = seniority.map(s => SENIORITY_MAP[s]).filter(Boolean);
  const mappedDepts     = jobFunction.map(fn => FUNCTION_MAP[fn]).filter(Boolean);

  const emailStatusActor = emailStatus.includes("verified") ? "verified"
    : emailStatus.includes("risky") ? "likely" : "all";

  const baseInput: Record<string, unknown> = {
    max_results:   Math.min(100, targetCount),
    include_emails: true,
    include_phones: false,
    email_status:   emailStatusActor,
    ACTOR_MAX_TOTAL_CHARGE_USD: budgetDollars,
    job_title_seniority: mappedSeniority.length > 0
      ? mappedSeniority
      : ["owner", "cxo", "vp", "director", "manager"],
    job_departments: mappedDepts.length > 0
      ? mappedDepts
      : ["sales", "marketing", "engineering", "product", "business_development"],
  };

  if (countries.length > 0)      baseInput.person_location_country = countries;
  if (regions.length > 0)        baseInput.person_location_region  = regions;
  if (industries.length > 0)     baseInput.search_terms = industries.join(" OR ");
  if (sizes.length > 0)          baseInput.employee_size = sizes;
  if (salary.length > 0)         baseInput.inferred_salary = salary;
  if (titleKeywords.length > 0)  baseInput.job_titles = titleKeywords;
  if (excludeKeywords.length > 0) baseInput.exclude_keywords = excludeKeywords;
  if (companyDomains.trim()) {
    const domainArr = companyDomains.split(",").map(d => d.trim()).filter(Boolean);
    if (domainArr.length > 0) baseInput.company_website = domainArr;
  }

  // Single run — ACTOR_MAX_TOTAL_CHARGE_USD enforces budget cap automatically
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?waitForFinish=0`,
    { method: "POST", headers: APIFY_HEADERS, body: JSON.stringify(baseInput) }
  );

  if (!startRes.ok) {
    let errText = "";
    try { errText = await startRes.text(); } catch { /* empty */ }
    if (startRes.status === 404) {
      return NextResponse.json(
        { error: `Apify actor '${ACTOR}' not found. Check your Apify account.` },
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
    return NextResponse.json({ error: `Actor run ${status}` }, { status: 502 });
  }

  // Fetch results
  const rawItems = await fetchDataset(datasetId, targetCount, 0);
  const totalFetched = rawItems.length;

  const mapped: Lead[] = [];
  for (const item of rawItems) {
    const lead = blitzItemToLead(item as Record<string, unknown>);
    if (lead) mapped.push(lead);
  }

  const { added: totalNew } = await mergeLeadsInDB(mapped);
  const totalCost = Math.round(totalFetched * COST_PER_LEAD * 1000) / 1000;

  return NextResponse.json({
    ok: true,
    totalFetched,
    totalNew,
    totalCost,
    remainingBudget: Math.max(0, Math.round((budgetDollars - totalCost) * 100) / 100),
    reachedTarget: totalNew >= targetCount,
    batches: 1,
  });
}
