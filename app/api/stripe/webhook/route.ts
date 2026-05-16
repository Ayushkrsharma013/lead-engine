import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.client_reference_id || session.metadata?.userId;
        const planKey = session.metadata?.planKey || "growth";
        const customerId = session.customer as string;

        if (userId) {
          await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: "active",
              stripe_customer_id: customerId,
              plan: planKey,
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        if (customerId) {
          await supabaseAdmin
            .from("profiles")
            .update({ subscription_status: status })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        if (customerId) {
          await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: "inactive",
              plan: null,
            })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook] error processing event:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
