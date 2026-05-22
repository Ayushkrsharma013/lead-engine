// app/api/gmaps-outreach/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  const role = _req.headers.get("x-user-role") ?? "";
  if (role !== "super_admin" && role !== "qa_agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { count: pipelineSize } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true });

  const { count: formsQueuedToday } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 1)
    .gte("created_at", `${today}T00:00:00Z`);

  const { count: formsSentToday } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 1)
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);

  const { count: smsSentToday } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 2)
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);

  const { count: meetingsBooked } = await supabaseAdmin
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .ilike("notes", "%ref=gmaps%");

  const { count: totalFormsSent } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 1)
    .eq("status", "done");

  const conversionRate =
    totalFormsSent && meetingsBooked
      ? `${Math.round(((meetingsBooked ?? 0) / totalFormsSent) * 100)}%`
      : "0%";

  const { data: queueItems } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select(`
      id, lead_id, action_type, status, step_number,
      scheduled_for, executed_at, error, created_at,
      leads!inner(name, company, industry, location)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    pipelineSize: pipelineSize ?? 0,
    formsQueuedToday: formsQueuedToday ?? 0,
    formsSentToday: formsSentToday ?? 0,
    smsSentToday: smsSentToday ?? 0,
    meetingsBooked: meetingsBooked ?? 0,
    conversionRate,
    queue: queueItems ?? [],
  });
}
