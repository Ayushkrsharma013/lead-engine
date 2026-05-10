import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/api-auth";
import { mergeLeadsInDB } from "@/lib/db";
import type { Lead } from "@/lib/types";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";
const APIFY_HEADERS = { Authorization: `Bearer ${APIFY_TOKEN}` };

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

// ─── GET — List past Apify runs with lead counts ──────────────────────────────

export async function GET(req: NextRequest) {
  const authError = validateApiAuth(req);
  if (authError) return authError;

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  try {
    const runsRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?status=SUCCEEDED&limit=50`,
      { headers: APIFY_HEADERS },
    );
    if (!runsRes.ok) {
      throw new Error(`Apify list-runs failed: HTTP ${runsRes.status}`);
    }

    const runsData = await runsRes.json() as {
      data?: { items?: Array<{ id: string; defaultDatasetId: string; finishedAt: string }> };
    };
    const runs = runsData?.data?.items ?? [];

    if (runs.length === 0) {
      return NextResponse.json({ runs: [] });
    }

    // Fetch item count for each run (just count, not full data)
    const runList = await Promise.all(
      runs.map(async (run) => {
        try {
          const countRes = await fetch(
            `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?limit=1`,
            { headers: APIFY_HEADERS },
          );
          if (!countRes.ok) return null;
          const items = await countRes.json() as Record<string, unknown>[];
          return {
            runId: run.id,
            finishedAt: run.finishedAt || "",
            leadCount: Array.isArray(items) ? items.length : 0,
            datasetId: run.defaultDatasetId,
          };
        } catch {
          return null;
        }
      })
    );

    const validRuns = runList.filter(Boolean).sort(
      (a, b) => new Date(b!.finishedAt).getTime() - new Date(a!.finishedAt).getTime()
    );

    return NextResponse.json({ runs: validRuns });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST — Import leads from selected Apify runs ─────────────────────────────

export async function POST(req: NextRequest) {
  const authError = validateApiAuth(req);
  if (authError) return authError;

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Accept optional body to filter runs + limit
    let body: { runIds?: string[]; limit?: number } = {};
    try { body = await req.json(); } catch { /* no body = import all */ }

    const selectedRunIds = body.runIds?.length ? new Set(body.runIds) : null;
    const itemLimit = typeof body.limit === "number" ? Math.min(Math.max(1, body.limit), 2000) : 200;

    // 1. List all SUCCEEDED runs
    const runsRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?status=SUCCEEDED&limit=50`,
      { headers: APIFY_HEADERS },
    );
    if (!runsRes.ok) {
      throw new Error(`Apify list-runs failed: HTTP ${runsRes.status}`);
    }

    const runsData = await runsRes.json() as {
      data?: { items?: Array<{ id: string; defaultDatasetId: string; finishedAt: string }> };
    };
    const allRuns = runsData?.data?.items ?? [];

    // Filter to selected runs if specified
    const runs = selectedRunIds
      ? allRuns.filter(r => selectedRunIds.has(r.id))
      : allRuns;

    if (runs.length === 0) {
      return NextResponse.json({
        message: "No matching runs found",
        added: 0, updated: 0, total: 0,
        runs: [],
      });
    }

    // 2. Fetch leads from selected runs
    const allPartialLeads: Partial<Lead>[] = [];
    const runSummary: Array<{ runId: string; count: number }> = [];

    for (const run of runs) {
      if (!run.defaultDatasetId) continue;
      try {
        const dataRes = await fetch(
          `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?limit=${itemLimit}`,
          { headers: APIFY_HEADERS },
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
      return NextResponse.json({
        message: `Found ${runs.length} run(s) but all datasets were empty`,
        added: 0, updated: 0, total: 0,
        runs: runSummary,
      });
    }

    // 3. Deduplicate
    const seen = new Map<string, Partial<Lead>>();
    for (const lead of allPartialLeads) {
      const key = lead.email || lead.linkedin || lead.name;
      if (key && !seen.has(key)) seen.set(key, lead);
    }
    const deduped = Array.from(seen.values());

    // 4. Merge into DB
    const { added, updated } = await mergeLeadsInDB(deduped as Lead[]);

    return NextResponse.json({
      message: `Imported ${added + updated} leads (${added} new, ${updated} updated) from ${runs.length} run(s)`,
      added,
      updated,
      total: added + updated,
      runs: runSummary,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error
      ? err.message
      : typeof err === "object" ? JSON.stringify(err) : String(err ?? "");
    console.error("import route error:", detail);
    return NextResponse.json({ error: detail || "Unknown error" }, { status: 500 });
  }
}
