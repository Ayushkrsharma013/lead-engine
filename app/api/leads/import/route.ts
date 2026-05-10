import { NextResponse } from "next/server";
import { mergeLeadsInDB } from "@/lib/db";
import type { Lead } from "@/lib/types";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";

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

/**
 * Map a raw Apify item into a partial Lead — intentionally omit `id` so that
 * sanitizeLead (called inside mergeLeadsInDB) generates a safe alphanumeric id.
 * Using the LinkedIn URL as the id causes "Invalid path specified in request URL"
 * because Supabase embeds the id in the REST URL path.
 */
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

export async function POST() {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  try {
    // 1. List all SUCCEEDED runs for this actor (up to 50)
    const runsRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&status=SUCCEEDED&limit=50`,
    );
    if (!runsRes.ok) {
      throw new Error(`Apify list-runs failed: HTTP ${runsRes.status}`);
    }

    const runsData = await runsRes.json() as {
      data?: { items?: Array<{ id: string; defaultDatasetId: string }> };
    };
    const runs = runsData?.data?.items ?? [];

    if (runs.length === 0) {
      return NextResponse.json({
        message: "No past successful runs found on Apify",
        added: 0, updated: 0, total: 0,
      });
    }

    // 2. Fetch leads from every run's dataset
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
      } catch {
        // Skip any single dataset failure silently
      }
    }

    if (allPartialLeads.length === 0) {
      return NextResponse.json({
        message: `Found ${runs.length} run(s) but all datasets were empty`,
        added: 0, updated: 0, total: 0,
        runs: runSummary,
      });
    }

    // 3. mergeLeadsInDB handles: sanitization (safe IDs), dedup, upsert into Supabase
    const { added, updated } = await mergeLeadsInDB(allPartialLeads as Lead[]);

    return NextResponse.json({
      message: `Imported ${added + updated} leads (${added} new, ${updated} updated) from ${runs.length} run(s)`,
      added,
      updated,
      total: added + updated,
      runs: runSummary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
