import { supabaseAdmin } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface GmapsRunnerConfig {
  maxFormFillsPerDay: number;
  maxSmsPerDay: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  breakEveryNActions: number;
  breakDurationMinutes: number;
}

const DEFAULTS: GmapsRunnerConfig = {
  maxFormFillsPerDay: 30,
  maxSmsPerDay: 20,
  minDelaySeconds: 30,
  maxDelaySeconds: 120,
  activeHoursStart: 9,
  activeHoursEnd: 18,
  breakEveryNActions: 5,
  breakDurationMinutes: 15,
};

async function getConfig(): Promise<GmapsRunnerConfig> {
  const { data } = await supabaseAdmin
    .from("knowledge_store")
    .select("value")
    .eq("key", "gmaps_runner.config")
    .maybeSingle();

  if (!data?.value || typeof data.value !== "object") return DEFAULTS;
  return { ...DEFAULTS, ...(data.value as Partial<GmapsRunnerConfig>) };
}

async function requireAdmin(): Promise<NextResponse | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();

    const role = profile?.role ?? "";
    if (role !== "super_admin" && role !== "qa_agent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authErr = await requireAdmin();
  if (authErr) return authErr;
  return NextResponse.json(await getConfig());
}

export async function POST(request: Request) {
  const authErr = await requireAdmin();
  if (authErr) return authErr;

  const body = await request.json() as Partial<GmapsRunnerConfig>;
  const current = await getConfig();
  const updated: GmapsRunnerConfig = {
    maxFormFillsPerDay:  clamp(body.maxFormFillsPerDay  ?? current.maxFormFillsPerDay,  1,  50),
    maxSmsPerDay:        clamp(body.maxSmsPerDay        ?? current.maxSmsPerDay,        1,  50),
    minDelaySeconds:     clamp(body.minDelaySeconds     ?? current.minDelaySeconds,     10, 300),
    maxDelaySeconds:     clamp(body.maxDelaySeconds     ?? current.maxDelaySeconds,     30, 600),
    activeHoursStart:    clamp(body.activeHoursStart    ?? current.activeHoursStart,    6,  12),
    activeHoursEnd:      clamp(body.activeHoursEnd      ?? current.activeHoursEnd,      14, 23),
    breakEveryNActions:  clamp(body.breakEveryNActions  ?? current.breakEveryNActions,  2,  20),
    breakDurationMinutes:clamp(body.breakDurationMinutes?? current.breakDurationMinutes,5,  60),
  };

  await supabaseAdmin.from("knowledge_store").upsert(
    { key: "gmaps_runner.config", value: updated, agent: "gmaps-runner", updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  return NextResponse.json(updated);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}
