import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Support both Easebuzz and Skydo webhook formats
    const txnid = body.txnid || body.client_reference_id || body.metadata?.txnid;
    const status = body.status || body.payment_status;
    const email = body.email || body.customer_email;

    if (!txnid) {
      return NextResponse.json({ received: true });
    }

    if (status !== "success" && status !== "completed" && status !== "paid") {
      return NextResponse.json({ received: true });
    }

    // Look up pending transaction
    const { data: txn } = await supabaseAdmin
      .from("pending_transactions")
      .select("*")
      .eq("txnid", txnid)
      .maybeSingle();

    if (!txn) {
      console.warn("[payment-webhook] Unknown txnid:", txnid);
      return NextResponse.json({ received: true });
    }

    const userId = txn.user_id;

    // Activate the user's subscription
    await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "active",
        plan: txn.plan,
        subscription_activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // Send activation email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (profile?.email) {
      await sendEmail({
        to: profile.email,
        subject: "Your Prospecting OS account is active!",
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0e0d0a;color:#f5f4f1;padding:40px;border-radius:12px;border:1px solid rgba(232,66,10,0.2)">
          <h1 style="color:#e8420a">You're live.</h1>
          <p>Your <strong>${txn.plan}</strong> plan is now active. Head to your dashboard to get started.</p>
          <a href="https://app.flow-forges.com/prospecting-os/dashboard" style="display:inline-block;background:#e8420a;color:#fff;padding:12px 28px;border-radius:9999px;text-decoration:none;font-weight:600;margin-top:16px">
            Open Dashboard
          </a>
          <p style="margin-top:24px;font-size:12px;color:#808080">Questions? Reply to this email or book a call at flow-forges.com/book</p>
        </div>`,
      });
    }

    // Clean up pending transaction
    await supabaseAdmin.from("pending_transactions").delete().eq("txnid", txnid);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[payment-webhook] Error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
