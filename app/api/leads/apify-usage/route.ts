import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const APIFY_HEADERS = { Authorization: `Bearer ${APIFY_TOKEN}` };

export async function GET(req: NextRequest) {
  const session = await requireApiSession(req);
  if (!("userId" in session)) return session;

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Fetch Apify account usage
    const [usageRes, actorRes, logsRes] = await Promise.all([
      fetch("https://api.apify.com/v2/users/me/usage", { headers: APIFY_HEADERS }),
      fetch("https://api.apify.com/v2/acts/x_guru~Leads-Scraper-apollo-zoominfo", { headers: APIFY_HEADERS }),
      supabaseAdmin.from("scrape_logs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    let monthlyCredits = 0;
    let usedCredits = 0;
    let remainingCredits = 0;

    if (usageRes.ok) {
      const usage = await usageRes.json() as Record<string, unknown>;
      const data = (usage.data || usage) as Record<string, unknown>;
      const monthly = (data.monthlyComputeUnits || data.computeUnits || data) as Record<string, unknown>;
      monthlyCredits = Number(monthly.limit || monthly.monthlyLimit || 0);
      usedCredits = Number(monthly.used || monthly.monthlyUsed || 0);
      remainingCredits = monthlyCredits - usedCredits;
    }

    let actorStatus = "unknown";
    if (actorRes.ok) {
      const actor = await actorRes.json() as Record<string, unknown>;
      const actorData = (actor.data || actor) as Record<string, unknown>;
      actorStatus = actorData?.isPublic === false && actorData?.isDeprecated === false ? "healthy" : "unknown";
    }

    // Today's usage from scrape_logs
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayLogs } = await supabaseAdmin
      .from("scrape_logs")
      .select("credits_consumed")
      .gte("created_at", today);

    const todayCredits = (todayLogs || []).reduce((sum, r) => sum + (r.credits_consumed || 0), 0);

    return NextResponse.json({
      monthlyCredits,
      usedCredits,
      remainingCredits: Math.max(0, remainingCredits),
      todayCredits,
      actorStatus,
      lastLog: logsRes || null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
