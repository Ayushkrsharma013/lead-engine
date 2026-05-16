import { NextRequest, NextResponse } from "next/server";
import {
  jobPaymentRequestWatcher,
  jobInvoiceReminderEscalation,
  jobFiveDayFollowUp,
  jobMonthlySummary,
} from "@/lib/finance-agent";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

  return NextResponse.json({ ok: true, results, ts: new Date().toISOString() });
}
