// app/api/gmaps-outreach/health/route.ts
// Returns runner live status based on heartbeat in knowledge_store
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("knowledge_store")
      .select("value")
      .eq("key", "gmaps_runner.heartbeat")
      .maybeSingle();

    if (!data?.value || typeof data.value !== "object") {
      return NextResponse.json({ runnerLive: false, lastBeat: null, activeHours: false });
    }

    const val = data.value as { lastBeat?: string; activeHours?: boolean };
    const lastBeat = val.lastBeat ?? null;
    const activeHours = val.activeHours ?? false;

    // Runner is live if heartbeat was within the last 10 minutes
    const runnerLive = lastBeat
      ? Date.now() - new Date(lastBeat).getTime() < 10 * 60 * 1000
      : false;

    return NextResponse.json({ runnerLive, lastBeat, activeHours });
  } catch {
    return NextResponse.json({ runnerLive: false, lastBeat: null, activeHours: false });
  }
}
