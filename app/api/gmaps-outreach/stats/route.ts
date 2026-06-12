// app/api/gmaps-outreach/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  // Verify session + role directly (SSR cookie auth — resilient to middleware header issues)
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "";
    if (role !== "super_admin" && role !== "qa_agent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    console.error("[gmaps-outreach/stats] Auth check failed:", err);
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
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
