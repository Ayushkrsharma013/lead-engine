import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PLANS } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, plan, subscription_status, payment_ref, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const allowedRoles = ["client", "qa_agent", "super_admin"];
  if (!allowedRoles.includes(profile.role ?? "user")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawPlan = profile.plan as string | null;
  const planKey = (rawPlan && rawPlan in PLANS ? rawPlan : "pilot") as keyof typeof PLANS;
  const planDef = PLANS[planKey] ?? PLANS.pilot;

  // Workspace is optional — new clients may not have one yet
  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("client_user_id", userId)
    .maybeSingle();

  // Leads this month — only if workspace exists
  let leadsThisMonth = 0;
  if (workspace) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("client_leads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .gte("created_at", monthStart.toISOString());
    leadsThisMonth = count ?? 0;
  }

  const leadQuota: Record<string, number> = {
    micro: 50, pilot: 100, growth: 200, scale: 500,
  };
  const quota = leadQuota[planKey] ?? 100;

  // Billing history — pending_transactions are cleaned up after webhook confirms payment,
  // so this will be empty for active clients. Shown as-is.
  const { data: transactions } = await supabaseAdmin
    .from("pending_transactions")
    .select("txnid, plan, amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const limits = [
    { label: "ICP-Verified Leads", used: leadsThisMonth, total: quota, unit: "leads" },
    {
      label: "Outreach Sequences",
      used: planKey === "micro" ? 5 : planKey === "pilot" ? 3 : planKey === "growth" ? 5 : 10,
      total: planKey === "micro" ? 5 : planKey === "pilot" ? 3 : planKey === "growth" ? 5 : 10,
      unit: "sequences",
    },
    {
      label: "Strategy Calls",
      used: 0,
      total: planKey === "micro" ? 1 : planKey === "pilot" ? 1 : planKey === "growth" ? 2 : 4,
      unit: "calls/month",
    },
    {
      label: "Slack Channel",
      used: planKey === "growth" || planKey === "scale" ? 1 : 0,
      total: planKey === "growth" || planKey === "scale" ? 1 : 0,
      unit: "channels",
    },
    {
      label: "CRM Sync",
      used: planKey === "scale" ? 1 : 0,
      total: planKey === "scale" ? 1 : 0,
      unit: "connections",
    },
  ];

  const nextBilling = planDef.monthlyAmount > 0
    ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
    : null;

  return NextResponse.json({
    profile: {
      plan: planKey,
      planName: planDef.name,
      subscriptionStatus: profile.subscription_status ?? "inactive",
      paymentRef: profile.payment_ref ?? null,
      memberSince: profile.created_at ?? null,
    },
    plan: {
      key: planKey,
      name: planDef.name,
      setupAmount: planDef.setupAmount,
      monthlyAmount: planDef.monthlyAmount,
      features: planDef.features,
      isOneTime: planDef.monthlyAmount === 0,
    },
    usage: {
      leadsThisMonth,
      leadQuota: quota,
      percentUsed: Math.round((leadsThisMonth / quota) * 100),
    },
    limits,
    transactions: (transactions ?? []).map(t => ({
      id: t.txnid,
      plan: t.plan,
      amount: Number(t.amount),
      date: t.created_at,
      status: "completed" as const,
    })),
    nextBilling,
  });
}
