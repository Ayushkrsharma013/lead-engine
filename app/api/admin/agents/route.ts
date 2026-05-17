import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const [agentsRes, actionsRes, runsRes] = await Promise.all([
      supabaseAdmin.from("agents").select("*").order("display_name"),
      supabaseAdmin.from("agent_actions").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    if (agentsRes.error || actionsRes.error || runsRes.error) {
      const errMsg = agentsRes.error?.message || actionsRes.error?.message || runsRes.error?.message;
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    return NextResponse.json({
      agents: agentsRes.data || [],
      actions: actionsRes.data || [],
      runs: runsRes.data || [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
