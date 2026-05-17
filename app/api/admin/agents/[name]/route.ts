import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const name = params.name;

  const [agentRes, runsRes, actionsRes] = await Promise.all([
    supabaseAdmin.from("agents").select("*").eq("name", name).maybeSingle(),
    supabaseAdmin
      .from("agent_runs")
      .select("*")
      .eq("agent_name", name)
      .order("started_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("agent_actions")
      .select("*")
      .eq("agent_name", name)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (agentRes.error) {
    return NextResponse.json({ error: agentRes.error.message }, { status: 500 });
  }
  if (!agentRes.data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({
    agent: agentRes.data,
    runs: runsRes.data ?? [],
    actions: actionsRes.data ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { enabled?: boolean; config?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (body.config && typeof body.config === "object") updates.config = body.config;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update(updates)
    .eq("name", params.name)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json({ agent: data });
}
