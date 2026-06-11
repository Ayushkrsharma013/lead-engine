import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";
import { PLANS } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req, "billing");
  if (auth instanceof NextResponse) return auth;

  // Profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, subscription_status, payment_ref, created_at")
    .eq("id", auth.userId)
    .maybeSingle();

  const planKey = (profile?.plan || "pilot") as keyof typeof PLANS;
  const planDef = PLANS[planKey];

  // Usage metrics — leads this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: leadsThisMonth } = await supabaseAdmin
    .from("client_leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", auth.workspaceId)
    .gte("created_at", monthStart.toISOString());

  // Plan lead quotas
  const leadQuota: Record<string, number> = {
    micro: 50, pilot: 100, growth: 200, scale: 500,
  };
  const quota = leadQuota[planKey] || 100;

  // Billing history — last 10 transactions
  const { data: transactions } = await supabaseAdmin
    .from("pending_transactions")
    .select("txnid, plan, amount, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Plan limits breakdown
  const limits = [
    { label: "ICP-Verified Leads", used: leadsThisMonth || 0, total: quota, unit: "leads" },
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
      label: "Slack Channels",
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

  // Next billing estimate
  const nextBilling = planDef.monthlyAmount > 0
    ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
    : null;

  return NextResponse.json({
    profile: {
      plan: planKey,
      planName: planDef.name,
      subscriptionStatus: profile?.subscription_status || "inactive",
      paymentRef: profile?.payment_ref || null,
      memberSince: profile?.created_at || null,
    },
    plan: {
      key: planKey,
      name: planDef.name,
      setupAmount: planDef.setupAmount,
      monthlyAmount: planDef.monthlyAmount,
      features: planDef.features,
      isOneTime: planDef.monthlyAmount === 0,
    },
    usage: { leadsThisMonth: leadsThisMonth || 0, leadQuota: quota, percentUsed: Math.round(((leadsThisMonth || 0) / quota) * 100) },
    limits,
    transactions: (transactions || []).map(t => ({
      id: t.txnid,
      plan: t.plan,
      amount: Number(t.amount),
      date: t.created_at,
      status: "completed" as const,
    })),
    nextBilling,
  });
}
