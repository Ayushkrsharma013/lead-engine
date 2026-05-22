// app/api/gmaps-outreach/health/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check heartbeat in activity_log first, fall back to error_logs
    let lastBeat: string | null = null;
    let activeHours = false;

    const { data: activityRow } = await supabaseAdmin
      .from("activity_log")
      .select("text, created_at")
      .eq("type", "gmaps_runner_heartbeat")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activityRow?.text) {
      lastBeat = activityRow.text;
    } else {
      // Try error_logs
      const { data: errorRow } = await supabaseAdmin
        .from("error_logs")
        .select("stack, metadata")
        .eq("message", "gmaps_runner_heartbeat")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorRow?.stack) {
        lastBeat = errorRow.stack;
        activeHours = (errorRow.metadata as any)?.activeHours ?? false;
      }
    }

    if (!lastBeat) {
      return NextResponse.json({ runnerLive: false, lastBeat: null, activeHours: false });
    }

    const runnerLive = Date.now() - new Date(lastBeat).getTime() < 10 * 60 * 1000;
    return NextResponse.json({ runnerLive, lastBeat, activeHours });
  } catch {
    return NextResponse.json({ runnerLive: false, lastBeat: null, activeHours: false });
  }
}
