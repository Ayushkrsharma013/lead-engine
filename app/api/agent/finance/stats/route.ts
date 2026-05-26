import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";
import { PLANS, type PlanKey } from "@/lib/stripe";
import { fmt } from "@/lib/telegram-bot";

const supabase = supabaseAdmin;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabaseSSR = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabaseSSR.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (ownProfile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, plan, subscription_status, subscription_activated_at, payment_ref, payment_method, created_at, updated_at")
    .not("plan", "is", null)
    .order("created_at", { ascending: false });

  const allProfiles = (profiles || []) as Array<{
    id: string; email: string; plan: string;
    subscription_status: string; subscription_activated_at: string | null;
    payment_ref: string | null; payment_method: string | null;
    created_at: string; updated_at: string;
  }>;

  const active = allProfiles.filter(p => p.subscription_status === "active");
  const pending = allProfiles.filter(p => p.subscription_status === "pending_payment");
  const now = new Date();
  const thisMonthNew = active.filter(p => {
    if (!p.subscription_activated_at) return false;
    const d = new Date(p.subscription_activated_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const mrr = active.reduce((sum, p) => {
    const plan = PLANS[p.plan as PlanKey];
    if (!plan || !plan.monthlyAmount) return sum;
    return sum + plan.monthlyAmount;
  }, 0);

  // MRR trend (last 6 months from monthly_summary logs)
  const { data: summaries } = await supabase
    .from("finance_agent_log")
    .select("payload")
    .eq("event_type", "monthly_summary")
    .order("created_at", { ascending: true })
    .limit(6);

  const mrrTrend = (summaries || []).map((s: Record<string, unknown>) => {
    const payload = (s.payload || {}) as { month?: string; mrr?: number };
    return { month: payload.month || "?", mrr: payload.mrr || 0 };
  });

  const { data: recentLogs } = await supabase
    .from("finance_agent_log")
    .select("id, event_type, profile_id, status, payload, telegram_msg_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    mrr: fmt(mrr),
    mrrRaw: mrr,
    activeCount: active.length,
    pendingCount: pending.length,
    newThisMonth: thisMonthNew.length,
    mrrTrend,
    activeClients: active.map(p => ({
      id: p.id,
      email: p.email,
      plan: PLANS[p.plan as PlanKey]?.name || p.plan,
      activatedAt: p.subscription_activated_at,
    })),
    pendingClients: pending.map(p => ({
      id: p.id,
      email: p.email,
      plan: PLANS[p.plan as PlanKey]?.name || p.plan,
      paymentRef: p.payment_ref,
      daysPending: Math.round((Date.now() - new Date(p.updated_at || p.created_at).getTime()) / 86400000),
    })),
    recentLogs: (recentLogs || []).map(l => ({
      id: l.id,
      eventType: l.event_type,
      profileId: l.profile_id,
      status: l.status,
      payload: l.payload,
      telegramMsgId: l.telegram_msg_id,
      createdAt: l.created_at,
    })),
  });
}
