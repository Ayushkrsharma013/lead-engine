import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — read lead_quota_target + budget_cap_cents for the current user
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("lead_quota_target, budget_cap_cents")
    .eq("id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    leadQuotaTarget: data?.lead_quota_target ?? 100,
    budgetCapCents: data?.budget_cap_cents ?? 500,
  });
}

// POST — update lead_quota_target + budget_cap_cents
export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { leadQuotaTarget?: number; budgetCapCents?: number };

  const updates: Record<string, number> = {};
  if (body.leadQuotaTarget !== undefined) {
    const v = Math.max(10, Math.min(1000, Math.round(Number(body.leadQuotaTarget))));
    updates.lead_quota_target = v;
  }
  if (body.budgetCapCents !== undefined) {
    const v = Math.max(100, Math.min(50000, Math.round(Number(body.budgetCapCents))));
    updates.budget_cap_cents = v;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...updates });
}
