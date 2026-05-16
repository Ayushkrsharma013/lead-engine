import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS, PlanKey } from "@/lib/stripe";
import { requireAuthApi } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthApi();
    const { planKey, successUrl, cancelUrl } = await req.json();

    const plan = PLANS[planKey as PlanKey];
    if (!plan || !plan.priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
      `https://${process.env.VERCEL_URL}` ||
      "http://localhost:3000";

    const stripeSession = await stripe.checkout.sessions.create({
      customer_email: session.user.email,
      client_reference_id: session.user.id,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      mode: plan.interval === "one_time" ? "payment" : "subscription",
      success_url: successUrl || `${baseUrl}/prospecting-os/dashboard?checkout=success`,
      cancel_url: cancelUrl || `${baseUrl}/prospecting-os/onboarding?checkout=cancelled`,
      metadata: { userId: session.user.id, planKey },
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (err: any) {
    if (err.message === "Authentication required") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
