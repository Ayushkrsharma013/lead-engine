import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface RunnerConfig {
  maxConnectionsPerDay: number;
  maxDmsPerDay: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  breakEveryNActions: number;
  breakDurationMinutes: number;
}

const DEFAULTS: RunnerConfig = {
  maxConnectionsPerDay: 10,
  maxDmsPerDay: 20,
  minDelaySeconds: 30,
  maxDelaySeconds: 120,
  activeHoursStart: 8,
  activeHoursEnd: 20,
  breakEveryNActions: 5,
  breakDurationMinutes: 15,
};

async function getConfig(): Promise<RunnerConfig> {
  const { data } = await supabaseAdmin
    .from("knowledge_store")
    .select("value")
    .eq("key", "runner.config")
    .maybeSingle();

  if (!data?.value || typeof data.value !== "object") return DEFAULTS;
  return { ...DEFAULTS, ...(data.value as Partial<RunnerConfig>) };
}

export async function GET(request: Request) {
  const role = request.headers.get("x-user-role") ?? "";
  if (role !== "super_admin" && role !== "qa_agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getConfig());
}

export async function POST(request: Request) {
  const role = request.headers.get("x-user-role") ?? "";
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as Partial<RunnerConfig>;
  const current = await getConfig();
  const updated: RunnerConfig = {
    maxConnectionsPerDay:  clamp(body.maxConnectionsPerDay  ?? current.maxConnectionsPerDay,  1,  20),
    maxDmsPerDay:          clamp(body.maxDmsPerDay          ?? current.maxDmsPerDay,          1,  50),
    minDelaySeconds:       clamp(body.minDelaySeconds       ?? current.minDelaySeconds,       10, 300),
    maxDelaySeconds:       clamp(body.maxDelaySeconds       ?? current.maxDelaySeconds,       30, 600),
    activeHoursStart:      clamp(body.activeHoursStart      ?? current.activeHoursStart,      6,  12),
    activeHoursEnd:        clamp(body.activeHoursEnd        ?? current.activeHoursEnd,        14, 23),
    breakEveryNActions:    clamp(body.breakEveryNActions    ?? current.breakEveryNActions,    2,  20),
    breakDurationMinutes:  clamp(body.breakDurationMinutes  ?? current.breakDurationMinutes,  5,  60),
  };

  await supabaseAdmin.from("knowledge_store").upsert(
    { key: "runner.config", value: updated, agent: "runner", updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  return NextResponse.json(updated);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}
