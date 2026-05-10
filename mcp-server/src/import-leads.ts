import type { Lead } from "./types.js";
import { mergeLeadsInDB } from "./db.js";

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";

interface ImportResult {
  message: string;
  added: number;
  updated: number;
  total: number;
  runs: Array<{ runId: string; count: number }>;
}

type ApifyEmailObj = { address?: string; [k: string]: unknown };

function extractEmail(item: Record<string, unknown>): string {
  if (Array.isArray(item.emails) && item.emails.length > 0) {
    const first = item.emails[0];
    if (first && typeof first === "object")
      return String((first as ApifyEmailObj).address || "");
    return String(first || "");
  }
  if (typeof item.emails === "string" && item.emails.trim()) return item.emails.trim();
  if (typeof item.work_email === "string" && item.work_email.trim()) return item.work_email.trim();
  if (typeof item.email === "string" && item.email.trim()) return item.email.trim();
  if (Array.isArray(item.personal_emails) && item.personal_emails.length > 0)
    return String(item.personal_emails[0]);
  return "";
}

function apifyItemToLead(item: Record<string, unknown>): Partial<Lead> {
  const email = extractEmail(item);
  const rawStatus = String(item.email_status || "");
  const emailStatus: Lead["emailStatus"] = (
    ["verified", "risky", "not_found"].includes(rawStatus) ? rawStatus : "not_found"
  ) as Lead["emailStatus"];

  return {
    name:        String(item.full_name            || item.name     || "").trim(),
    title:       String(item.job_title             || item.title    || "").trim(),
    company:     String(item.job_company_name      || item.company  || "").trim(),
    industry:    String(item.job_company_industry  || item.industry || "").trim(),
    location:    String(item.location_name         || item.location || "").trim(),
    email:       email.toLowerCase().trim(),
    emailStatus,
    linkedin:    String(item.linkedin_url          || "").trim(),
    website:     String(item.job_company_website   || "").trim(),
    companySize: String(item.job_company_size      || "").trim(),
    score:       Math.floor(70 + Math.random() * 28),
    source:      "linkedin" as Lead["source"],
    tags:        [],
  };
}

export async function importFromAllApifyRuns(): Promise<ImportResult> {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_KEY not configured");

  const runsRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&status=SUCCEEDED&limit=50`,
  );
  if (!runsRes.ok) throw new Error(`Apify list-runs failed: HTTP ${runsRes.status}`);

  const runsData = await runsRes.json() as {
    data?: { items?: Array<{ id: string; defaultDatasetId: string }> };
  };
  const runs = runsData?.data?.items ?? [];

  if (runs.length === 0) {
    return { message: "No past successful runs found", added: 0, updated: 0, total: 0, runs: [] };
  }

  const allPartialLeads: Partial<Lead>[] = [];
  const runSummary: Array<{ runId: string; count: number }> = [];

  for (const run of runs) {
    if (!run.defaultDatasetId) continue;
    try {
      const dataRes = await fetch(
        `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=200`,
      );
      if (!dataRes.ok) continue;
      const items = await dataRes.json() as Record<string, unknown>[];
      if (!Array.isArray(items) || items.length === 0) continue;

      const leads = items.map(apifyItemToLead);
      allPartialLeads.push(...leads);
      runSummary.push({ runId: run.id, count: leads.length });
    } catch { /* skip single dataset failure */ }
  }

  if (allPartialLeads.length === 0) {
    return {
      message: `Found ${runs.length} run(s) but all datasets were empty`,
      added: 0, updated: 0, total: 0,
      runs: runSummary,
    };
  }

  // Deduplicate within batch
  const seen = new Map<string, Partial<Lead>>();
  for (const lead of allPartialLeads) {
    const key = lead.email || lead.linkedin || lead.name;
    if (key && !seen.has(key)) seen.set(key, lead);
  }
  const deduped = Array.from(seen.values());

  const { added, updated } = await mergeLeadsInDB(deduped as Lead[]);

  return {
    message: `Imported ${added + updated} leads (${added} new, ${updated} updated) from ${runs.length} run(s)`,
    added,
    updated,
    total: added + updated,
    runs: runSummary,
  };
}

export async function importFromSingleApifyRun(runId: string): Promise<{ added: number; updated: number; total: number }> {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_KEY not configured");

  const statusRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`,
  );
  if (!statusRes.ok) throw new Error(`Apify run lookup failed: HTTP ${statusRes.status}`);

  const statusData = await statusRes.json() as {
    data?: { status: string; defaultDatasetId: string };
  };
  const status = statusData?.data?.status;

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run ${runId} is not SUCCEEDED (status: ${status || "UNKNOWN"})`);
  }

  const datasetId = statusData?.data?.defaultDatasetId;
  if (!datasetId) throw new Error("No dataset ID found for this run");

  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=2000`,
  );
  if (!dataRes.ok) throw new Error(`Dataset fetch failed: HTTP ${dataRes.status}`);

  const items = await dataRes.json() as Record<string, unknown>[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Dataset is empty");
  }

  const leads = items.map(apifyItemToLead);
  const { added, updated } = await mergeLeadsInDB(leads as Lead[]);

  return { added, updated, total: added + updated };
}
