import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkMinuteLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin" && role !== "qa_agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimitId = req.headers.get("x-user-id") || req.headers.get("x-forwarded-for") || "anonymous";
  const rl = checkMinuteLimit("admin-agents", rateLimitId, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  try {
    const [agentsRes, actionsRes, runsRes, knowledgeRes] = await Promise.all([
      supabaseAdmin.from("agents").select("*").order("display_name"),
      supabaseAdmin.from("agent_actions").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("knowledge_store").select("key, value, agent, updated_at").order("updated_at", { ascending: false }).limit(100),
    ]);

    if (agentsRes.error || actionsRes.error || runsRes.error) {
      const errMsg = agentsRes.error?.message || actionsRes.error?.message || runsRes.error?.message;
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    return NextResponse.json({
      agents: agentsRes.data || [],
      actions: actionsRes.data || [],
      runs: runsRes.data || [],
      knowledge: knowledgeRes.data || [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
