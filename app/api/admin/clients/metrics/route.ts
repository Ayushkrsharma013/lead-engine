import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PLAN_MRR: Record<string, number> = {
  micro: 0,
  pilot: 499,
  growth: 999,
  scale: 1999,
};

export async function GET(req: NextRequest) {
  const userRole = req.headers.get("x-user-role");
  if (userRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Total clients
  const { count: totalClients } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("role", "client");

  // Active subscriptions
  const { count: activeSubscriptions } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact" })
    .eq("role", "client")
    .eq("subscription_status", "active");

  // Active clients with plans for MRR calc
  const { data: activeClients } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("role", "client")
    .eq("subscription_status", "active");

  const mrr = (activeClients || []).reduce((sum, c) => {
    return sum + (PLAN_MRR[c.plan as string] || 0);
  }, 0);

  // Total leads managed (sum of leads_count from all client_workspaces)
  const { data: workspaces } = await supabaseAdmin
    .from("client_workspaces")
    .select("leads_count");

  const totalLeadsManaged = (workspaces || []).reduce((sum, w) => sum + (w.leads_count || 0), 0);

  return NextResponse.json({
    totalClients: totalClients || 0,
    activeSubscriptions: activeSubscriptions || 0,
    mrr,
    totalLeadsManaged,
  });
}
