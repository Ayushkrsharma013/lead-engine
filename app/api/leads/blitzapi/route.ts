import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mergeLeadsInDB } from "@/lib/db";
import { sanitizeLead, stableLeadId } from "@/lib/storage";
import type { Lead } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";

// Stage 1: filter-based discovery (search by industry, country, seniority, etc.)
const SEARCH_ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";
const SEARCH_COST  = 0.001; // $0.001 per result

// Stage 2: deep enrichment (takes LinkedIn URLs → verified email, phone, full history)
const ENRICH_ACTOR = "dev_fusion~Linkedin-Profile-Scraper";
const ENRICH_COST  = 0.01;  // $0.01 per profile

const APIFY_HEADERS = {
  Authorization: `Bearer ${APIFY_TOKEN}`,
  "Content-Type": "application/json",
};

const MAX_POLL_ATTEMPTS = 70;  // 70 × 4s = 280s (under 300s maxDuration)
const POLL_INTERVAL_MS  = 4000;

// ─── Seniority + function maps ────────────────────────────────────────────────
const SENIORITY_MAP: Record<string, string> = {
  "Owner / Founder": "owner", "C-Suite": "cxo", "VP": "vp",
  "Director": "director", "Manager": "manager", "Senior / Head": "senior",
};
const FUNCTION_MAP: Record<string, string> = {
  "Sales": "sales", "Marketing": "marketing", "Engineering": "engineering",
  "Product": "product", "Operations": "operations", "Finance": "finance",
  "HR / People": "human_resources", "Business Dev": "business_development",
};

// ─── Fetch feedback keywords ──────────────────────────────────────────────────
async function getFeedbackKeywords(userId: string): Promise<{ include: string[]; exclude: string[] }> {
  const { data } = await supabaseAdmin
    .from("lead_feedback")
    .select("keyword, weight")
    .eq("user_id", userId);

  const agg: Record<string, number> = {};
  for (const row of data || []) {
    agg[row.keyword] = (agg[row.keyword] || 0) + (row.weight as number);
  }

  return {
    include: Object.entries(agg).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k),
    exclude: Object.entries(agg).filter(([, w]) => w < 0).sort((a, b) => a[1] - b[1]).slice(0, 10).map(([k]) => k),
  };
}

// ─── Poll until SUCCEEDED ─────────────────────────────────────────────────────
async function pollRun(runId: string): Promise<{ status: string; datasetId?: string }> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, { headers: APIFY_HEADERS });
      if (!res.ok) continue;
      const json = await res.json();
      const status = json?.data?.status as string;
      if (status === "SUCCEEDED") return { status, datasetId: json.data.defaultDatasetId };
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) return { status };
    } catch { /* retry */ }
  }
  return { status: "TIMED-OUT" };
}

// ─── Fetch dataset ────────────────────────────────────────────────────────────
async function fetchDataset(datasetId: string, limit: number): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${limit}`,
      { headers: APIFY_HEADERS }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  } catch { return []; }
}

// ─── Start an actor run ───────────────────────────────────────────────────────
async function startRun(actor: string, input: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/runs?waitForFinish=0`,
    { method: "POST", headers: APIFY_HEADERS, body: JSON.stringify(input) }
  );
  if (!res.ok) return null;
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { return null; }
  return ((data?.data as Record<string, unknown>)?.id as string) || null;
}

// ─── Map x_guru item to a raw lead object (pre-enrichment) ───────────────────
function xguruToRaw(item: Record<string, unknown>): Record<string, unknown> | null {
  const name    = String(item.full_name || item.name || "").trim();
  const company = String(item.job_company_name || item.company || item.organization_name || "").trim();
  if (!name || !company) return null;

  const email   = String(item.email || (Array.isArray(item.emails) ? (item.emails as { address: string }[])[0]?.address || "" : "") || "").trim().toLowerCase();
  const linkedin = String(item.linkedin_url || item.person_linkedin_url || "").trim();
  if (!email && !linkedin) return null;

  return {
    name,
    title:       String(item.job_title || item.title || "").trim(),
    company,
    industry:    String(item.industry || item.job_company_industry || "").trim(),
    location:    String(item.location || item.person_location_name || item.city || "").trim(),
    email,
    linkedin,
    website:     String(item.job_company_website || item.company_website || "").trim(),
    companySize: String(item.job_company_size || item.company_size || "").trim(),
    hasPhone:    !!(item.phone_numbers || item.mobile_phone || item.phone),
  };
}

// ─── Map dev_fusion enrichment item → enrichment overlay ─────────────────────
function devFusionToOverlay(item: Record<string, unknown>): {
  linkedin: string;
  email?: string;
  phone?: string;
  location?: string;
  industry?: string;
  companySize?: string;
} | null {
  // dev_fusion returns various field names depending on version
  const linkedin = String(
    item.linkedInUrl || item.linkedin_url || item.profileUrl ||
    item.linkedinUrl || item.person_linkedin_url || ""
  ).trim();

  if (!linkedin) return null;

  const email = String(
    item.email || item.emailAddress || item.workEmail || item.work_email || ""
  ).trim().toLowerCase();

  const phone = String(
    item.mobilePhone || item.phone || item.phoneNumber ||
    (Array.isArray(item.phoneNumbers) ? (item.phoneNumbers as string[])[0] : "") || ""
  ).trim();

  return {
    linkedin,
    email:       email || undefined,
    phone:       phone || undefined,
    location:    String(item.location || item.geoLocation || "").trim() || undefined,
    industry:    String(item.industry || item.companyIndustry || "").trim() || undefined,
    companySize: String(item.companySize || item.employeeCount || "").trim() || undefined,
  };
}

// ─── Build final Lead from raw + optional enrichment overlay ─────────────────
function buildLead(raw: Record<string, unknown>, overlay?: ReturnType<typeof devFusionToOverlay>): Lead | null {
  const email   = String((overlay?.email ?? raw.email) || "").trim().toLowerCase();
  const linkedin = String(raw.linkedin || "").trim();
  const name    = String(raw.name || "").trim();
  const company = String(raw.company || "").trim();

  if (!name || !company) return null;
  if (!email && !linkedin) return null;

  const id = stableLeadId(email, linkedin, name, company);

  const hasEmail    = !!email;
  const hasLinkedin = !!linkedin;
  const hasPhone    = !!(overlay?.phone || raw.hasPhone);

  let score = 70;
  if (hasEmail)    score += 15;
  if (hasLinkedin) score += 10;
  if (hasPhone)    score += 5;
  score = Math.min(100, score);

  return sanitizeLead({
    id,
    name,
    title:       String(raw.title || "").trim(),
    company,
    industry:    String(overlay?.industry ?? raw.industry ?? "").trim(),
    location:    String(overlay?.location ?? raw.location ?? "").trim(),
    email,
    emailStatus: hasEmail ? "verified" : "not_found",
    linkedin,
    website:     String(raw.website || "").trim(),
    companySize: String(overlay?.companySize ?? raw.companySize ?? "").trim(),
    score,
    source: "linkedin",
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });

  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    filters?: Record<string, unknown>;
    targetCount?: number;
    budgetCapCents?: number;
    enrichOnly?: boolean;
  };

  const filters = (body.filters || {}) as Record<string, unknown>;
  let targetCount    = body.targetCount    || 100;
  let budgetCapCents = body.budgetCapCents || 500;

  if (!body.targetCount || !body.budgetCapCents) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("lead_quota_target, budget_cap_cents")
      .eq("id", userId)
      .maybeSingle();
    if (!body.targetCount    && profile?.lead_quota_target) targetCount    = profile.lead_quota_target;
    if (!body.budgetCapCents && profile?.budget_cap_cents)  budgetCapCents = profile.budget_cap_cents;
  }

  const totalBudget = budgetCapCents / 100;

  // Budget split: search is cheap ($0.001), enrichment is the main cost ($0.01)
  // At $0.011/lead total, max affordable leads = floor(budget / 0.011)
  const maxAffordable = Math.floor(totalBudget / (SEARCH_COST + ENRICH_COST));
  targetCount = Math.min(targetCount, maxAffordable, 500);

  if (targetCount <= 0) {
    return NextResponse.json({ error: `Budget too low — need at least $${(SEARCH_COST + ENRICH_COST).toFixed(3)} per lead` }, { status: 400 });
  }

  const { include: includeKw, exclude: excludeKw } = await getFeedbackKeywords(userId);

  // ─── Stage 1: x_guru — filter-based discovery ───────────────────────────────
  const countries      = Array.isArray(filters.countries)    ? filters.countries    as string[] : [];
  const regions        = Array.isArray(filters.regions)      ? filters.regions      as string[] : [];
  const industries     = Array.isArray(filters.industries)   ? filters.industries   as string[] : [];
  const seniority      = Array.isArray(filters.seniority)    ? filters.seniority    as string[] : [];
  const jobFunction    = Array.isArray(filters.jobFunction)  ? filters.jobFunction  as string[] : [];
  const sizes          = Array.isArray(filters.companySizes) ? filters.companySizes as string[] : [];
  const salary         = Array.isArray(filters.salary)       ? filters.salary       as string[] : [];
  const emailStatus    = Array.isArray(filters.emailStatus)  ? filters.emailStatus  as string[] : [];
  const companyDomains = typeof filters.companyDomains === "string" ? filters.companyDomains : "";
  const keyword        = typeof filters.keyword === "string" ? filters.keyword : "";

  const titleKeywords   = [...(keyword ? keyword.split(",").map(t => t.trim()).filter(Boolean) : []), ...includeKw];
  const mappedSeniority = seniority.map(s => SENIORITY_MAP[s]).filter(Boolean);
  const mappedDepts     = jobFunction.map(fn => FUNCTION_MAP[fn]).filter(Boolean);
  const emailStatusActor = emailStatus.includes("verified") ? "verified" : emailStatus.includes("risky") ? "likely" : "all";

  const searchInput: Record<string, unknown> = {
    max_results:   targetCount,
    include_emails: true,
    include_phones: false,
    email_status:   emailStatusActor,
    ACTOR_MAX_TOTAL_CHARGE_USD: Math.round(targetCount * SEARCH_COST * 100) / 100,
    job_title_seniority: mappedSeniority.length > 0 ? mappedSeniority : ["owner", "cxo", "vp", "director", "manager"],
    job_departments:     mappedDepts.length > 0     ? mappedDepts     : ["sales", "marketing", "engineering", "product", "business_development"],
  };

  if (countries.length > 0)       searchInput.person_location_country = countries;
  if (regions.length > 0)         searchInput.person_location_region  = regions;
  if (industries.length > 0)      searchInput.search_terms = industries.join(" OR ");
  if (sizes.length > 0)           searchInput.employee_size = sizes;
  if (salary.length > 0)          searchInput.inferred_salary = salary;
  if (titleKeywords.length > 0)   searchInput.job_titles = titleKeywords;
  if (excludeKw.length > 0)       searchInput.exclude_keywords = excludeKw;
  if (companyDomains.trim()) {
    const domainArr = companyDomains.split(",").map(d => d.trim()).filter(Boolean);
    if (domainArr.length > 0) searchInput.company_website = domainArr;
  }

  const searchRunId = await startRun(SEARCH_ACTOR, searchInput);
  if (!searchRunId) return NextResponse.json({ error: "Stage 1 (discovery) failed to start" }, { status: 502 });

  const { status: s1Status, datasetId: s1Dataset } = await pollRun(searchRunId);
  if (s1Status !== "SUCCEEDED" || !s1Dataset) {
    return NextResponse.json({ error: `Stage 1 (discovery) ${s1Status}` }, { status: 502 });
  }

  const rawItems = await fetchDataset(s1Dataset, targetCount);
  const totalFetched = rawItems.length;

  // Parse raw leads from Stage 1
  const rawLeads = rawItems.map(item => xguruToRaw(item)).filter(Boolean) as Record<string, unknown>[];
  const stage1Cost = Math.round(totalFetched * SEARCH_COST * 1000) / 1000;

  // Extract LinkedIn URLs for Stage 2
  const linkedinUrls = [...new Set(
    rawLeads
      .map(r => String(r.linkedin || "").trim())
      .filter(url => url && url.includes("linkedin.com/in/"))
  )];

  // ─── Stage 2: dev_fusion — deep enrichment via LinkedIn URLs ─────────────────
  const enrichMap = new Map<string, ReturnType<typeof devFusionToOverlay>>();
  let stage2Cost = 0;

  if (linkedinUrls.length > 0) {
    // dev_fusion accepts an array of LinkedIn profile URLs
    const enrichInput: Record<string, unknown> = {
      profileUrls: linkedinUrls,
      maxItems:    linkedinUrls.length,
    };

    const enrichRunId = await startRun(ENRICH_ACTOR, enrichInput);

    if (enrichRunId) {
      const { status: s2Status, datasetId: s2Dataset } = await pollRun(enrichRunId);

      if (s2Status === "SUCCEEDED" && s2Dataset) {
        const enrichedItems = await fetchDataset(s2Dataset, linkedinUrls.length);
        stage2Cost = Math.round(enrichedItems.length * ENRICH_COST * 1000) / 1000;

        for (const item of enrichedItems) {
          const overlay = devFusionToOverlay(item);
          if (overlay?.linkedin) {
            // Normalize URL for matching (remove trailing slash, www variations)
            const normalized = overlay.linkedin.replace(/\/$/, "").toLowerCase();
            enrichMap.set(normalized, overlay);
          }
        }
      }
      // Stage 2 failure is non-fatal — we still have Stage 1 data
    }
  }

  // ─── Merge Stage 1 + Stage 2 → final leads ──────────────────────────────────
  const leads: Lead[] = [];
  for (const raw of rawLeads) {
    const liUrl = String(raw.linkedin || "").trim().replace(/\/$/, "").toLowerCase();
    const overlay = enrichMap.get(liUrl);
    const lead = buildLead(raw, overlay);
    if (lead) leads.push(lead);
  }

  const { added: totalNew } = await mergeLeadsInDB(leads);
  const totalCost = stage1Cost + stage2Cost;
  const enrichedCount = enrichMap.size;

  return NextResponse.json({
    ok: true,
    totalFetched,
    totalNew,
    enrichedCount,
    stage1Cost,
    stage2Cost,
    totalCost: Math.round(totalCost * 1000) / 1000,
    remainingBudget: Math.max(0, Math.round((totalBudget - totalCost) * 100) / 100),
    reachedTarget: totalNew >= targetCount,
  });
}
