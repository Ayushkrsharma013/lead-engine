// app/api/gmaps-outreach/health/route.ts
// Returns runner live status based on heartbeat sentinel row in gmaps_outreach_queue
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("executed_at, message")
      .eq("lead_id", "__heartbeat__")
      .eq("action_type", "heartbeat")
      .maybeSingle();

    if (!data?.executed_at) {
      return NextResponse.json({ runnerLive: false, lastBeat: null, activeHours: false });
    }

    const lastBeat = data.executed_at as string;
    const runnerLive = Date.now() - new Date(lastBeat).getTime() < 10 * 60 * 1000;

    let activeHours = false;
    try {
      const msg = typeof data.message === "string" ? JSON.parse(data.message) : data.message;
      activeHours = (msg as any)?.activeHours ?? false;
    } catch { /* ignore */ }

    return NextResponse.json({ runnerLive, lastBeat, activeHours });
  } catch {
    return NextResponse.json({ runnerLive: false, lastBeat: null, activeHours: false });
  }
}
