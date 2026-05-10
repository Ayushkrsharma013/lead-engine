import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

function mapToLead(item: Record<string, unknown>, idx: number, runId: string) {
  const email = extractEmail(item);
  const rawStatus = String(item.email_status || "");
  const emailStatus = (["verified", "risky", "not_found"].includes(rawStatus)
    ? rawStatus
    : email ? "not_found" : "not_found") as "verified" | "risky" | "not_found";

  return {
    id: String(item.id || item.linkedin_url || `apify-${runId}-${idx}`).slice(0, 255),
    name: String(item.full_name || item.name || "").trim().slice(0, 200),
    title: String(item.job_title || item.title || "").trim().slice(0, 200),
    company: String(item.job_company_name || item.company || "").trim().slice(0, 200),
    industry: String(item.job_company_industry || item.industry || "").trim().slice(0, 100),
    location: String(item.location_name || item.location || "").trim().slice(0, 200),
    email: email.toLowerCase().slice(0, 254),
    email_status: emailStatus,
    linkedin: String(item.linkedin_url || "").trim().slice(0, 500),
    website: String(item.job_company_website || "").trim().slice(0, 500),
    company_size: String(item.job_company_size || "").trim().slice(0, 50),
    score: Math.floor(70 + Math.random() * 28),
    source: "linkedin",
    tags: [],
    kanban_column: "New",
    status: null,
    notes: null,
    last_touched: new Date().toISOString(),
    saved_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function POST() {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // 1. List all SUCCEEDED runs for this actor (up to 50)
    const runsRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&status=SUCCEEDED&limit=50`,
    );
    if (!runsRes.ok) {
      throw new Error(`Failed to list runs: HTTP ${runsRes.status}`);
    }
    const runsData = await runsRes.json() as {
      data?: { items?: Array<{ id: string; defaultDatasetId: string; finishedAt: string }> };
    };
    const runs = runsData?.data?.items || [];

    if (runs.length === 0) {
      return NextResponse.json({ message: "No past successful runs found", added: 0, updated: 0, total: 0 });
    }

    // 2. Fetch leads from each run's dataset
    const allLeads: ReturnType<typeof mapToLead>[] = [];
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

        const leads = items.map((item, idx) => mapToLead(item, idx, run.id));
        allLeads.push(...leads);
        runSummary.push({ runId: run.id, count: leads.length });
      } catch {
        // Skip failed dataset fetches
      }
    }

    if (allLeads.length === 0) {
      return NextResponse.json({
        message: `Found ${runs.length} run(s) but no leads in datasets`,
        added: 0,
        updated: 0,
        total: 0,
        runs: runSummary,
      });
    }

    // 3. Deduplicate by linkedin URL, then by email
    const seen = new Map<string, ReturnType<typeof mapToLead>>();
    for (const lead of allLeads) {
      const key = lead.linkedin || lead.email || lead.id;
      if (!seen.has(key)) seen.set(key, lead);
    }
    const deduped = Array.from(seen.values());

    // 4. Fetch existing lead keys from Supabase to count added vs updated
    const { data: existing } = await supabase
      .from("leads")
      .select("id, email, linkedin");
    const existingIds = new Set((existing || []).map((r: { id: string }) => r.id));
    const existingEmails = new Set((existing || []).map((r: { email: string }) => r.email).filter(Boolean));
    const existingLinkedins = new Set((existing || []).map((r: { linkedin: string }) => r.linkedin).filter(Boolean));

    let added = 0, updated = 0;
    for (const lead of deduped) {
      if (
        existingIds.has(lead.id) ||
        (lead.email && existingEmails.has(lead.email)) ||
        (lead.linkedin && existingLinkedins.has(lead.linkedin))
      ) {
        updated++;
      } else {
        added++;
      }
    }

    // 5. Upsert all into Supabase in batches of 50
    const BATCH = 50;
    for (let i = 0; i < deduped.length; i += BATCH) {
      const batch = deduped.slice(i, i + BATCH);
      const { error } = await supabase
        .from("leads")
        .upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`Supabase upsert error: ${error.message}`);
    }

    // 6. Log to activity_log
    await supabase.from("activity_log").insert({
      type: "lead_added",
      text: `Imported ${added} new + ${updated} updated leads from ${runs.length} Apify run(s)`,
      lead_id: null,
    });

    return NextResponse.json({
      message: `Imported ${deduped.length} leads (${added} new, ${updated} updated) from ${runs.length} run(s)`,
      added,
      updated,
      total: deduped.length,
      runs: runSummary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
