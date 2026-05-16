import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    icp?: Record<string, string[]>;
    apifyKey?: string;
    anthropicKey?: string;
    plan?: string;
    subscriptionStatus?: string;
    onboardingComplete?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.full_name = body.name;
  if (body.icp !== undefined) updates.icp_preferences = body.icp;
  if (body.apifyKey !== undefined) updates.apify_key = body.apifyKey;
  if (body.plan !== undefined) updates.plan = body.plan;
  if (body.subscriptionStatus !== undefined) updates.subscription_status = body.subscriptionStatus;
  if (body.onboardingComplete !== undefined) updates.onboarding_complete = body.onboardingComplete;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    console.error("[onboarding/save]", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
