import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireRoleApi } from "@/lib/auth";
import { mergeLeadsInDB, logActivity, insertApifySyncLog, updateApifySyncLog } from "@/lib/db";
import { getActorRuns, getDatasetItems, mapApifyItemToLead } from "@/lib/apify";
import { captureApiError } from "@/lib/error-tracking";
import type { Lead } from "@/lib/types";
import { APIFY_ACTOR_ID } from "@/lib/apify-config";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authCheck = await requireRoleApi(req, "super_admin");
  if (authCheck) return authCheck;

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  const userId = req.headers.get("x-user-id") || undefined;
  const logEntry = await insertApifySyncLog({ triggered_by: userId, status: "running" });

  const errors: string[] = [];
  let runsProcessed = 0;
  let leadsFound = 0;
  let leadsImported = 0;
  let leadsSkipped = 0;

  try {
    const runs = await getActorRuns(APIFY_ACTOR_ID, apiKey);
    const succeededRuns = runs.filter(r => r.status === "SUCCEEDED");

    for (const run of succeededRuns) {
      try {
        const items = await getDatasetItems(run.defaultDatasetId, apiKey);
        leadsFound += items.length;

        const mappedLeads: (Partial<Lead> & { apify_run_id: string; apify_dataset_id: string })[] =
          items
            .map(item => mapApifyItemToLead(item, run.id, run.defaultDatasetId, run.finishedAt))
            .filter(l => l.email && l.email.includes("@"));

        if (mappedLeads.length === 0) {
          runsProcessed++;
          continue;
        }

        // Batch insert with dedup via mergeLeadsInDB
        const leads = mappedLeads as Lead[];
        const result = await mergeLeadsInDB(leads);
        leadsImported += result.added;
        leadsSkipped += result.updated + result.rejected;

        // Track run IDs on newly added leads
        if (result.added > 0) {
          await supabaseAdmin
            .from("leads")
            .update({
              apify_run_id: run.id,
              apify_dataset_id: run.defaultDatasetId,
            })
            .eq("apify_run_id", run.id);
        }

        runsProcessed++;
      } catch (runErr) {
        const msg = runErr instanceof Error ? runErr.message : String(runErr);
        errors.push(`Run ${run.id}: ${msg}`);
      }
    }

    await logActivity({
      type: "lead_added",
      text: `Historical sync: imported ${leadsImported} leads from ${runsProcessed} Apify runs`,
    });

    await updateApifySyncLog(logEntry.id, {
      runs_processed: runsProcessed,
      leads_found: leadsFound,
      leads_imported: leadsImported,
      leads_skipped: leadsSkipped,
      status: "completed",
      error_log: errors,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      runs_processed: runsProcessed,
      leads_found: leadsFound,
      leads_imported: leadsImported,
      leads_skipped: leadsSkipped,
      errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    captureApiError(err, "api/leads/apify-sync");
    await updateApifySyncLog(logEntry.id, {
      status: "failed",
      error_log: [...errors, msg],
      completed_at: new Date().toISOString(),
    }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
