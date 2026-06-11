// app/api/agents/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runAgentBatch } from "@/lib/agents/dispatcher";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentName = req.nextUrl.searchParams.get("agent") ?? undefined;

  try {
    await runAgentBatch(agentName);
    return NextResponse.json({ ok: true, agent: agentName ?? "all", ts: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agents/run] Batch failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
