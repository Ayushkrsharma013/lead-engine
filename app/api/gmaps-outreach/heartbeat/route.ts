// app/api/gmaps-outreach/heartbeat/route.ts
// Called by the local runner via HTTP POST to signal it's alive.
// Stores heartbeat as a sentinel row in gmaps_outreach_queue (table guaranteed to exist).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const RUNNER_SECRET = process.env.GMAPS_RUNNER_SECRET || process.env.CRON_SECRET || "gmaps-runner-v1";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token !== RUNNER_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { activeHours?: boolean };
  const now = new Date().toISOString();

  // Upsert heartbeat sentinel into gmaps_outreach_queue
  const { error } = await supabaseAdmin.from("gmaps_outreach_queue").upsert(
    {
      lead_id: "__heartbeat__",
      action_type: "heartbeat",
      status: "done",
      step_number: 0,
      scheduled_for: now,
      executed_at: now,
      message: JSON.stringify({ activeHours: body.activeHours ?? false }),
    },
    { onConflict: "lead_id, action_type" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
