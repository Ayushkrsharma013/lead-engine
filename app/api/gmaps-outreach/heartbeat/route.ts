// app/api/gmaps-outreach/heartbeat/route.ts
// Called by the local runner via HTTP POST to signal it's alive.
// Stores heartbeat as a sentinel row in gmaps_outreach_queue (table guaranteed to exist).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const RUNNER_SECRET = process.env.GMAPS_RUNNER_SECRET || "gmaps-runner-v1";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token !== RUNNER_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { activeHours?: boolean };
  const now = new Date().toISOString();

  // Store heartbeat in activity_log (no FK constraints, flexible schema)
  await supabaseAdmin
    .from("activity_log")
    .delete()
    .eq("type", "gmaps_runner_heartbeat");

  const { error } = await supabaseAdmin.from("activity_log").insert({
    type: "gmaps_runner_heartbeat",
    text: now,
    lead_id: null as any,
  });

  if (error) {
    // If activity_log also fails, try error_logs
    await supabaseAdmin.from("error_logs").delete().eq("message", "gmaps_runner_heartbeat");
    const { error: err2 } = await supabaseAdmin.from("error_logs").insert({
      message: "gmaps_runner_heartbeat",
      stack: now,
      source: "gmaps-runner",
      url: "",
      metadata: { activeHours: body.activeHours ?? false },
    });
    if (err2) {
      return NextResponse.json({ ok: false, error: err2.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
