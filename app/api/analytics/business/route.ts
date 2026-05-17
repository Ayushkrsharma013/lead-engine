import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

const supabase = supabaseAdmin;

interface BusinessStats {
  mrr: number;
  activeSubscribers: number;
  churnedCount: number;
  churnRate: number;
  totalLeads: number;
  leadsWon: number;
  conversionRate: number;
  plans: Record<string, number>;
}

// Plan → monthly price mapping (matches lib/stripe.ts)
const PLAN_PRICES: Record<string, number> = {
  diy: 1500,
  growth: 3500,
  scale: 12500,
};

export async function GET(req: NextRequest) {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const supabaseSSR = createServerClient(
    rawUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabaseSSR.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Subscription stats
    const { data: profiles } = await supabase
      .from("profiles")
      .select("subscription_status, plan");

    const allProfiles = (profiles || []) as Array<{ subscription_status?: string; plan?: string }>;

    let mrr = 0;
    let activeSubscribers = 0;
    let churnedCount = 0;
    const plans: Record<string, number> = {};

    for (const p of allProfiles) {
      if (p.subscription_status === "active") {
        activeSubscribers++;
        const price = PLAN_PRICES[p.plan || ""] || 0;
        mrr += price;
        plans[p.plan || "unknown"] = (plans[p.plan || "unknown"] || 0) + 1;
      }
      if (p.subscription_status === "cancelled" || p.subscription_status === "inactive") {
        churnedCount++;
      }
    }

    const totalWithStatus = activeSubscribers + churnedCount;
    const churnRate = totalWithStatus > 0 ? Math.round((churnedCount / totalWithStatus) * 100) : 0;

    // Lead conversion stats
    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true });

    const { data: wonLeads } = await supabase
      .from("leads")
      .select("id")
      .or("status.eq.won,kanban_column.eq.Closed Won");

    const leadsWon = wonLeads?.length || 0;
    const leadTotal = totalLeads || 0;
    const conversionRate = leadTotal > 0 ? Math.round((leadsWon / leadTotal) * 100) : 0;

    const stats: BusinessStats = {
      mrr,
      activeSubscribers,
      churnedCount,
      churnRate,
      totalLeads: leadTotal,
      leadsWon,
      conversionRate,
      plans,
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
