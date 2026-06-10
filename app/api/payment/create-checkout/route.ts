import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PLANS } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Payment provider URLs — set in Vercel env vars
// Easebuzz (primary):    EASEBUZZ_PILOT_URL, EASEBUZZ_GROWTH_URL, EASEBUZZ_SCALE_URL, EASEBUZZ_MICRO_URL
// Skydo (fallback):      SKYDO_PILOT_URL,    SKYDO_GROWTH_URL,    SKYDO_SCALE_URL,    SKYDO_MICRO_URL
// Stripe Payment Links:  STRIPE_PAYMENT_LINK_PILOT, STRIPE_PAYMENT_LINK_GROWTH, STRIPE_PAYMENT_LINK_SCALE, STRIPE_PAYMENT_LINK_MICRO
// XflowPay VBAN (manual): always available as ultimate backup

const PLAN_URLS: Record<string, { easebuzz?: string; skydo?: string; stripe?: string; dodo?: string }> = {
  pilot: {
    easebuzz: process.env.EASEBUZZ_PILOT_URL,
    skydo: process.env.SKYDO_PILOT_URL,
    stripe: process.env.STRIPE_PAYMENT_LINK_PILOT,
    dodo: process.env.DODO_PILOT_PAYMENT_LINK,
  },
  growth: {
    easebuzz: process.env.EASEBUZZ_GROWTH_URL,
    skydo: process.env.SKYDO_GROWTH_URL,
    stripe: process.env.STRIPE_PAYMENT_LINK_GROWTH,
    dodo: process.env.DODO_GROWTH_PAYMENT_LINK,
  },
  scale: {
    easebuzz: process.env.EASEBUZZ_SCALE_URL,
    skydo: process.env.SKYDO_SCALE_URL,
    stripe: process.env.STRIPE_PAYMENT_LINK_SCALE,
    dodo: process.env.DODO_SCALE_PAYMENT_LINK,
  },
  micro: {
    easebuzz: process.env.EASEBUZZ_MICRO_URL,
    skydo: process.env.SKYDO_MICRO_URL,
    stripe: process.env.STRIPE_PAYMENT_LINK_MICRO,
    dodo: process.env.DODO_MICRO_PAYMENT_LINK,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { plan, userId, email } = body;

    const selected = PLANS[plan as keyof typeof PLANS];
    if (!selected) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const txnid = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Store pending transaction for webhook reconciliation
    if (userId) {
      await supabaseAdmin.from("pending_transactions").insert({
        txnid,
        user_id: userId,
        plan,
        amount: selected.setupAmount,
        created_at: new Date().toISOString(),
      });
    }

    // Try Easebuzz → Dodo → Skydo → Stripe Payment Link → manual VBAN
    const urls = PLAN_URLS[plan] || {};
    const paymentUrl = urls.easebuzz || urls.dodo || urls.skydo || urls.stripe || null;

    if (paymentUrl) {
      // Stripe Payment Links don't accept arbitrary query params — pass only client_reference_id + prefilled_email
      if (urls.stripe && paymentUrl === urls.stripe) {
        const url = new URL(paymentUrl);
        url.searchParams.set("client_reference_id", txnid);
        if (email) url.searchParams.set("prefilled_email", email);
        return NextResponse.json({ url: url.toString(), method: "card", txnid });
      }

      // Easebuzz / Skydo: legacy query-param flow
      const url = new URL(paymentUrl);
      url.searchParams.set("txnid", txnid);
      url.searchParams.set("amount", String(selected.setupAmount));
      if (email) url.searchParams.set("email", email);
      if (userId) url.searchParams.set("client_reference_id", userId);
      return NextResponse.json({ url: url.toString(), method: "card", txnid });
    }

    // Fallback: return VBAN details for manual ACH/wire
    return NextResponse.json({
      method: "manual",
      txnid,
      plan: selected.name,
      amount: selected.setupAmount,
      vban: {
        bank: "JPMorgan Chase Bank, N.A",
        accountNumber: "20000045886271",
        routingNumber: "028000024",
        accountType: "Business",
      },
    });
  } catch (err) {
    console.error("[create-checkout] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
