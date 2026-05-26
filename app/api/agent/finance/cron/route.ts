import { NextRequest, NextResponse } from "next/server";
import {
  jobPaymentRequestWatcher,
  jobInvoiceReminderEscalation,
  jobFiveDayFollowUp,
  jobMonthlySummary,
} from "@/lib/finance-agent";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, string | number> = {};

  try {
    const count = await jobPaymentRequestWatcher();
    results.paymentWatcher = count;
  } catch (e) {
    results.paymentWatcher = `error: ${e}`;
  }

  try {
    const count = await jobInvoiceReminderEscalation();
    results.reminderEscalation = count;
  } catch (e) {
    results.reminderEscalation = `error: ${e}`;
  }

  try {
    const count = await jobFiveDayFollowUp();
    results.fiveDayFollowUp = count;
  } catch (e) {
    results.fiveDayFollowUp = `error: ${e}`;
  }

  try {
    const sent = await jobMonthlySummary();
    results.monthlySummary = sent ? "sent" : "skipped";
  } catch (e) {
    results.monthlySummary = `error: ${e}`;
  }

  // Write to agent_runs so Finance Watcher appears in the command center
  const hasErrors = Object.values(results).some(v => String(v).startsWith("error:"));
  const logLines = Object.entries(results)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  try {
    await supabaseAdmin.from("agent_runs").insert({
      agent_name: "finance-watcher",
      batch_run_id: crypto.randomUUID(),
      started_at: new Date(Date.now() - 60_000).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: null,
      outcome: hasErrors ? "partial" : "success",
      safe_actions_count: 0,
      risky_actions_queued: 0,
      log: logLines,
      error: null,
    });
  } catch (e) { console.warn(e); }

  try {
    await supabaseAdmin.from("agents").update({
      last_run_at: new Date().toISOString(),
      last_run_status: hasErrors ? "partial" : "success",
    }).eq("name", "finance-watcher");
  } catch (e) { console.warn(e); }

  return NextResponse.json({ ok: true, results, ts: new Date().toISOString() });
}
