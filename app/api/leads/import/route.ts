import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/api-auth";
import { mergeLeadsInDB } from "@/lib/db";
import { stableLeadId } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";
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

function apifyItemToLead(item: Record<string, unknown>): Lead {
  const email    = extractEmail(item).toLowerCase().trim();
  const linkedin = String(item.linkedin_url || "").trim();
  const name     = String(item.full_name || item.name || "").trim();
  const company  = String(item.job_company_name || item.company || "").trim();

  const rawStatus = String(item.email_status || "");
  const emailStatus: Lead["emailStatus"] = (
    ["verified", "risky", "not_found"].includes(rawStatus) ? rawStatus : "not_found"
  ) as Lead["emailStatus"];

  return {
    // Stable deterministic ID — prevents duplicates across repeated imports
    id:          stableLeadId(email, linkedin, name, company),
    name,
    title:       String(item.job_title            || item.title    || "").trim(),
    company,
    industry:    String(item.job_company_industry || item.industry || "").trim(),
    location:    String(item.location_name        || item.location || "").trim(),
    email,
    emailStatus,
    linkedin,
    website:     String(item.job_company_website  || "").trim(),
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

    // Fetch approximate lead count for each run
    const runList = await Promise.all(
      runs.map(async (run) => {
        try {
          const countRes = await fetch(
            `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?limit=100`,
            { headers: APIFY_HEADERS },
          );
          if (!countRes.ok) return null;
          const items = await countRes.json() as Record<string, unknown>[];
          const count = Array.isArray(items) ? items.length : 0;
          return {
            runId: run.id,
            finishedAt: run.finishedAt || "",
            leadCount: count,
            datasetId: run.defaultDatasetId,
            hasMore: count >= 100,
          };
        } catch {
          return null;
        }
      })
    );

    const validRuns = runList.filter(Boolean).sort(
      (a, b) => new Date(b!.finishedAt).getTime() - new Date(a!.finishedAt).getTime()
    );

    // Fetch import history so frontend can mark already-imported runs
    const { data: imported } = await supabaseAdmin
      .from("apify_imports")
      .select("run_id, lead_count, imported_at");

    const importedRunIds = (imported || []).map(r => r.run_id);

    return NextResponse.json({ runs: validRuns, importedRunIds });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAllDatasetItems(datasetId: string): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = [];
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50; // safety cap: 50,000 leads max per run
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: APIFY_HEADERS },
    );
    if (!res.ok) {
      console.error(`fetchAllDatasetItems: page ${page} failed HTTP ${res.status} for dataset ${datasetId}`);
      break;
    }
    const items = await res.json() as Record<string, unknown>[];
    if (!Array.isArray(items) || items.length === 0) break;
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    // Small delay between pages to avoid Apify rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  return allItems;
}

// ─── POST — Import leads from selected Apify run ──────────────────────────────

export async function POST(req: NextRequest) {
  const authError = validateApiAuth(req);
  if (authError) return authError;

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  try {
    let body: { runId?: string; runIds?: string[] } = {};
    try { body = await req.json(); } catch { /* no body */ }

    // Support both single runId and legacy runIds array
    const targetRunIds = body.runId ? [body.runId] : body.runIds ?? [];
    if (targetRunIds.length === 0) {
      return NextResponse.json({ error: "No runId provided" }, { status: 400 });
    }

    const runIdSet = new Set(targetRunIds);

    // Check which runs are already imported
    const { data: alreadyImported } = await supabaseAdmin
      .from("apify_imports")
      .select("run_id")
      .in("run_id", targetRunIds);

    const alreadySet = new Set((alreadyImported || []).map(r => r.run_id));
    const freshRunIds = targetRunIds.filter(id => !alreadySet.has(id));

    if (freshRunIds.length === 0) {
      return NextResponse.json({
        message: "All selected runs have already been imported",
        alreadyImported: true,
        importedRunIds: targetRunIds,
        added: 0, updated: 0, total: 0,
      });
    }

    // 1. Find the target run(s) from the run history
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
    const runs = allRuns.filter(r => runIdSet.has(r.id));

    if (runs.length === 0) {
      return NextResponse.json({
        message: "No matching runs found",
        added: 0, updated: 0, total: 0,
      });
    }

    // 2. Fetch ALL leads from selected run(s) with pagination
    const allLeads: Lead[] = [];
    const runSummary: Array<{ runId: string; count: number }> = [];

    for (const run of runs) {
      if (!run.defaultDatasetId) continue;
      try {
        const items = await fetchAllDatasetItems(run.defaultDatasetId);
        if (items.length === 0) continue;

        const leads = items.map(apifyItemToLead);
        allLeads.push(...leads);
        runSummary.push({ runId: run.id, count: leads.length });
      } catch { /* skip single dataset failure */ }
    }

    if (allLeads.length === 0) {
      return NextResponse.json({
        message: `Found ${runs.length} run(s) but all datasets were empty`,
        added: 0, updated: 0, total: 0,
      });
    }

    // 3. Pre-deduplicate across runs using stable ID
    const seen = new Map<string, Lead>();
    for (const lead of allLeads) {
      if (!seen.has(lead.id)) seen.set(lead.id, lead);
    }
    const deduped = Array.from(seen.values());

    // 4. Merge into DB (mergeLeadsInDB handles dedup against existing leads)
    const { stored, added, updated } = await mergeLeadsInDB(deduped);

    // 5. Record import history to prevent future duplicate imports
    const importRows = targetRunIds.map(rid => ({
      run_id: rid,
      lead_count: added + updated,
      status: "completed",
    }));
    await supabaseAdmin.from("apify_imports").upsert(importRows, { onConflict: "run_id" });

    // Return the imported leads so the frontend can show them in "Latest Run"
    return NextResponse.json({
      message: `${added + updated} leads imported successfully`,
      added,
      updated,
      total: added + updated,
      leads: deduped,
      importedRunIds: targetRunIds,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error
      ? err.message
      : typeof err === "object" ? JSON.stringify(err) : String(err ?? "");
    console.error("import route error:", detail);
    return NextResponse.json({ error: detail || "Failed to import leads" }, { status: 500 });
  }
}
