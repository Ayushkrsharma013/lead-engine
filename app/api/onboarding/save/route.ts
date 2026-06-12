import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyTelegram } from "@/lib/notify";
import { triggerMicroDelivery } from "@/lib/micro-delivery";
import { fireWebhook } from "@/lib/webhook";

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
  } catch (err) { console.error("[onboarding/save] JSON parse failed:", err);
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

  // ── Save ICP to client_workspaces ─────────────────────────────────────
  if (body.icp && Object.keys(body.icp).length > 0) {
    const plan = body.plan || "pilot";
    const { data: existingWs } = await supabaseAdmin
      .from("client_workspaces")
      .select("id")
      .eq("client_user_id", user.id)
      .maybeSingle();

    if (existingWs) {
      await supabaseAdmin
        .from("client_workspaces")
        .update({ icp_config: body.icp, plan })
        .eq("client_user_id", user.id);
    } else {
      await supabaseAdmin
        .from("client_workspaces")
        .insert({
          client_user_id: user.id,
          plan,
          icp_config: body.icp,
        });
    }
  }

  // ── Fetch updated profile for downstream hooks ───────────────────────
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, plan, subscription_status, onboarding_complete, icp_preferences")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ ok: true });
  }

  // ── Micro plan: trigger delivery + Telegram alert ─────────────────────
  const isMicro = profile.plan === "micro";
  const justOnboarded = body.onboardingComplete === true;

  if (isMicro && justOnboarded) {
    const email = profile.email as string;
    // Fire-and-forget: trigger micro delivery
    triggerMicroDelivery(user.id, email).catch((err) =>
      console.error("[onboarding/save] micro delivery trigger failed:", err)
    );

    // Telegram alert to founder with ICP details
    const icp = body.icp || {};
    const icpSummary = Object.entries(icp)
      .map(([k, v]) => `${k}: ${(v as string[]).join(", ") || "none"}`)
      .join("\n");

    notifyTelegram(
      `NEW MICRO CLIENT ONBOARDED\n` +
      `Email: ${email}\n` +
      `Plan: Micro-Offer ($997)\n` +
      `ICP Config:\n${icpSummary || "Not provided"}`
    ).catch(err => console.error("[onboarding/save] Telegram notify failed:", err));
  }

  // ── Notify n8n welcome sequence (non-blocking, with retry) ──────────
  void fireWebhook("https://automate.flow-forges.com/webhook/welcome-sequence", profile as Record<string, unknown>, { label: "welcome-sequence" });

  return NextResponse.json({ ok: true });
}
