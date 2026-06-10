import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, leads_generation_status, leads_count, leads_generated_at, icp_locked")
    .eq("client_user_id", userId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ status: "pending", leadsCount: 0, icebreakersCount: 0, generatedAt: null, icpLocked: false });
  }

  // Count icebreakers linked to workspace leads
  let icebreakersCount = 0;
  const { data: leadIds } = await supabaseAdmin
    .from("client_leads")
    .select("id")
    .eq("workspace_id", workspace.id);

  if (leadIds && leadIds.length > 0) {
    const { count: ibCount } = await supabaseAdmin
      .from("client_icebreakers")
      .select("*", { count: "exact", head: true })
      .in("lead_id", leadIds.map(l => l.id));
    icebreakersCount = ibCount || 0;
  }

  return NextResponse.json({
    status: workspace.leads_generation_status || "pending",
    leadsCount: workspace.leads_count || 0,
    icebreakersCount,
    generatedAt: workspace.leads_generated_at || null,
    icpLocked: workspace.icp_locked || false,
  });
}
