import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const [agentRes, runsRes, actionsRes, knowledgeRes, statsRes] =
      await Promise.all([
        supabaseAdmin.from("agents").select("*").eq("name", slug).single(),
        supabaseAdmin
          .from("agent_runs")
          .select("*")
          .eq("agent_name", slug)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("agent_actions")
          .select("*")
          .eq("agent_name", slug)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("knowledge_store")
          .select("*")
          .eq("agent", slug)
          .order("updated_at", { ascending: false })
          .limit(30),
        supabaseAdmin
          .from("agent_runs")
          .select("outcome, duration_ms, safe_actions_count, risky_actions_queued")
          .eq("agent_name", slug)
          .gte(
            "started_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          ),
      ]);

    if (agentRes.error) {
      return NextResponse.json(
        { error: agentRes.error.message },
        { status: agentRes.status || 404 }
      );
    }

    const runs = runsRes.data || [];
    const statsRuns = statsRes.data || [];

    const totalRuns = runs.length;
    const successCount = statsRuns.filter(
      (r) => r.outcome === "success" || r.outcome === "skipped"
    ).length;
    const failedCount = statsRuns.filter(
      (r) => r.outcome === "failed"
    ).length;
    const totalSafeActions = statsRuns.reduce(
      (sum, r) => sum + (r.safe_actions_count || 0),
      0
    );
    const totalRiskyQueued = statsRuns.reduce(
      (sum, r) => sum + (r.risky_actions_queued || 0),
      0
    );
    const avgDuration =
      statsRuns.length > 0
        ? statsRuns.reduce((sum, r) => sum + (r.duration_ms || 0), 0) /
          statsRuns.length
        : 0;

    const last7Days = statsRuns.length;
    const successRate =
      last7Days > 0 ? Math.round((successCount / last7Days) * 100) : 0;

    return NextResponse.json({
      agent: agentRes.data,
      runs,
      actions: actionsRes.data || [],
      knowledge: knowledgeRes.data || [],
      stats: {
        totalRuns,
        successRate,
        avgDurationMs: Math.round(avgDuration),
        totalSafeActions,
        totalRiskyQueued,
        last7Days,
        successCount,
        failedCount,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
