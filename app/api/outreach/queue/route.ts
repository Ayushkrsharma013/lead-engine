// app/api/outreach/queue/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getQueueStatus,
  getPendingActions,
  getTodayStats,
  enqueueLinkedInAction,
} from "@/lib/linkedin-queue";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "super_admin" && role !== "qa_agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [status, pending, todayStats] = await Promise.all([
      getQueueStatus(),
      getPendingActions(10),
      getTodayStats(),
    ]);

    // Runner heartbeat: last_run_at from linkedin_daily_stats tells us if runner is alive
    const today = new Date().toISOString().split("T")[0];
    const { data: statsRow } = await supabaseAdmin
      .from("linkedin_daily_stats")
      .select("last_run_at")
      .eq("date", today)
      .maybeSingle();

    const lastRunAt = (statsRow as { last_run_at?: string } | null)?.last_run_at ?? null;
    const runnerLive = lastRunAt
      ? Date.now() - new Date(lastRunAt).getTime() < 10 * 60 * 1000
      : false;

    return NextResponse.json({
      status,
      pending,
      todayStats,
      runnerLive,
      lastRunAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin" && role !== "qa_agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      leadId: string;
      actionType: "connection_request" | "dm" | "follow_up";
      message?: string;
      scheduledFor?: string;
    };

    if (!body.leadId || !body.actionType) {
      return NextResponse.json({ error: "leadId and actionType required" }, { status: 400 });
    }

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, linkedin")
      .eq("id", body.leadId)
      .single();

    if (!lead || !(lead as { linkedin?: string }).linkedin) {
      return NextResponse.json({ error: "Lead not found or has no LinkedIn URL" }, { status: 404 });
    }

    const l = lead as { id: string; name: string; linkedin: string };
    const item = await enqueueLinkedInAction({
      leadId: l.id,
      linkedinProfileUrl: l.linkedin,
      actionType: body.actionType,
      message: body.message,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    });

    return NextResponse.json({ item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
