import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyTelegram } from "@/lib/notify";
import { triggerMicroDelivery } from "@/lib/micro-delivery";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Token-based onboarding save — no auth required.
 * Saves ICP config to the appointment record.
 * Called from /onboarding?token=XXX flow.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; icp?: Record<string, string[]>; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, icp, plan } = body;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Lookup appointment by token
  const { data: appointment, error: lookupError } = await supabaseAdmin
    .from("appointments")
    .select("id, email, name, company, plan, onboarding_token, icp_config, payment_status")
    .eq("onboarding_token", token)
    .single();

  if (lookupError || !appointment) {
    return NextResponse.json({ error: "Invalid or expired onboarding token" }, { status: 404 });
  }

  // Save ICP config to appointment
  if (icp && Object.keys(icp).length > 0) {
    await supabaseAdmin
      .from("appointments")
      .update({
        icp_config: icp,
        // If plan was changed during onboarding (unlikely but possible)
        ...(plan ? { plan } : {}),
      })
      .eq("id", appointment.id);
  }

  // If micro plan, trigger delivery alert
  const effectivePlan = (plan || appointment.plan || "pilot") as PlanKey;
  if (effectivePlan === "micro") {
    const email = appointment.email as string;
    triggerMicroDelivery(appointment.id, email).catch((err) =>
      console.error("[onboarding/token-save] micro delivery trigger failed:", err)
    );

    const icpSummary = icp
      ? Object.entries(icp)
          .map(([k, v]) => `${k}: ${(v as string[]).join(", ") || "none"}`)
          .join("\n")
      : "Not provided";

    notifyTelegram(
      `NEW MICRO CLIENT (Token Flow)\n` +
        `Email: ${email}\n` +
        `Name: ${appointment.name}\n` +
        `Plan: Micro-Offer ($997)\n` +
        `ICP Config:\n${icpSummary}`
    ).catch(err => console.error("[onboarding/token-save] Telegram notify failed:", err));
  }

  return NextResponse.json({ ok: true });
}
