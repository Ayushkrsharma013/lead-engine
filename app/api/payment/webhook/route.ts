import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { sendClientCredentialsEmail, notifyTelegram } from "@/lib/notify";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const PORTAL_LOGIN_URL =
  "https://app.flow-forges.com/prospecting-os/client-portal/login";
const N8N_WELCOME_HOOK =
  "https://automate.flow-forges.com/webhook/welcome-sequence";

// 12-char alphanumeric, crypto-random, no ambiguous chars (l, 1, o, 0, I, O)
function generateTempPassword(): string {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = crypto.randomBytes(12);
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[buf[i] % chars.length];
  return pw;
}

function generateUsername(seed: string): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9\s@.-]/g, "")
    .split(/[@\s]/)[0]
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return slug || `client_${Math.floor(Math.random() * 1000)}`;
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "[no-email]";
  const at = email.indexOf("@");
  if (at < 2) return "[masked]";
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Support Easebuzz, Skydo, Stripe webhook formats
    const txnid =
      body.txnid || body.client_reference_id || body.metadata?.txnid;
    const status = body.status || body.payment_status;

    if (!txnid) return NextResponse.json({ received: true });

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

    const userId = txn.user_id as string | null;
    const plan = (txn.plan as PlanKey) || "pilot";
    const planAmount =
      (PLANS[plan]?.setupAmount ?? Number(txn.amount) ?? 0) | 0;

    if (!userId) {
      console.warn("[payment-webhook] txn has no user_id:", txnid);
      return NextResponse.json({ received: true });
    }

    // ── Idempotency: if already active, do nothing ─────────────────────────
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, full_name, subscription_status, role, plan, onboarding_complete, icp_preferences",
      )
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      console.warn("[payment-webhook] Profile not found:", userId.slice(0, 8));
      return NextResponse.json({ received: true });
    }

    if (existing.subscription_status === "active") {
      console.log(
        "[payment-webhook] Already active, skipping:",
        userId.slice(0, 8),
      );
      // Still safe to clean up the txn row so we never re-fire.
      await supabaseAdmin
        .from("pending_transactions")
        .delete()
        .eq("txnid", txnid);
      return NextResponse.json({ received: true, alreadyActive: true });
    }

    // ── Provision client ───────────────────────────────────────────────────
    const tempPassword = generateTempPassword();
    const username = generateUsername(existing.email || existing.full_name || userId);

    // 1) Update profile: role=client, plan, active, onboarding_complete
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "client",
        plan,
        subscription_status: "active",
        onboarding_complete: true,
        subscription_activated_at: new Date().toISOString(),
        xflow_transaction_id: txnid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      console.error("[payment-webhook] Profile update failed:", profileError);
      return NextResponse.json(
        { error: "Profile update failed" },
        { status: 500 },
      );
    }

    // 2) Reset auth password to the new temp password (so user can log in)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    // 3) Insert clients row (idempotent — skip if user_id already present)
    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let clientId: string;
    if (existingClient) {
      clientId = existingClient.id as string;
      // Update existing client row with portal credentials + plan
      await supabaseAdmin
        .from("clients")
        .update({
          portal_username: username,
          portal_password: tempPassword,
          plan,
          status: "active",
          monthly_retainer: PLANS[plan]?.monthlyAmount ?? 0,
        })
        .eq("id", clientId);
    } else {
      const { data: newClient, error: clientError } = await supabaseAdmin
        .from("clients")
        .insert({
          name: existing.full_name || existing.email?.split("@")[0] || "Client",
          company: "",
          industry: "",
          monthly_retainer: PLANS[plan]?.monthlyAmount ?? 0,
          status: "active",
          email: existing.email,
          portal_username: username,
          // TODO(security): plaintext for first-login flow; rotate via
          // verify_portal_password RPC + change-on-first-login UI.
          portal_password: tempPassword,
          plan,
          user_id: userId,
        })
        .select("id")
        .single();

      if (clientError || !newClient) {
        console.error(
          "[payment-webhook] Client insert failed:",
          clientError?.message,
        );
        return NextResponse.json(
          { error: "Client provisioning failed" },
          { status: 500 },
        );
      }
      clientId = newClient.id as string;
    }

    // 4) Insert client_workspaces (idempotent — skip if exists)
    const { data: existingWorkspace } = await supabaseAdmin
      .from("client_workspaces")
      .select("id")
      .eq("client_user_id", userId)
      .maybeSingle();

    if (!existingWorkspace) {
      const icpConfig =
        (existing.icp_preferences as Record<string, unknown> | null) || {};
      await supabaseAdmin.from("client_workspaces").insert({
        client_user_id: userId,
        plan,
        icp_config: icpConfig,
      });
    }

    // 5) Send credentials email
    if (existing.email) {
      try {
        await sendClientCredentialsEmail({
          to: existing.email,
          clientName: existing.full_name || "there",
          clientId,
          username: existing.email,
          tempPassword,
          loginUrl: PORTAL_LOGIN_URL,
        });
      } catch (err) {
        console.warn("[payment-webhook] Credentials email failed:", err);
      }

      // 6) Send activation email with invoice link
      const invoiceUrl = `https://app.flow-forges.com/prospecting-os/api/invoice?txnid=${encodeURIComponent(txnid)}`;
      try {
        await sendEmail({
          to: existing.email,
          subject: `Payment received — Your ${PLANS[plan]?.name || plan} plan is active`,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <td style="background:#e8420a;padding:28px 36px;">
            <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">Payment Received</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;color:#f5f4f1;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Hi ${existing.full_name || "there"},</p>
            <p style="margin:0 0 16px;">Thank you for your purchase. Your <strong>${PLANS[plan]?.name || plan}</strong> plan ($${planAmount}) is now active.</p>
            <p style="margin:0 0 24px;">Your client portal credentials have been sent in a separate email. Sign in to view your pipeline.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${PORTAL_LOGIN_URL}" style="display:inline-block;background:#e8420a;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Open Client Portal</a>
            </div>
            <p style="margin:24px 0 0;font-size:13px;color:#b0aeaa;">
              <a href="${invoiceUrl}" style="color:#e8420a;text-decoration:none;">View / print receipt</a>
              &middot;
              Reference: <code style="color:#f5f4f1;">${txnid}</code>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#7a7875;font-size:12px;text-align:center;">
              Prospecting OS &middot; <a href="https://app.flow-forges.com/prospecting-os" style="color:#e8420a;text-decoration:none;">app.flow-forges.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        });
      } catch (err) {
        console.warn("[payment-webhook] Activation email failed:", err);
      }
    }

    // 7) Telegram alert (plain text — no emoji)
    const planName = PLANS[plan]?.name || plan;
    const deliveryNote =
      plan === "micro"
        ? "Auto-activated. Deliver in 5 days."
        : "Auto-activated.";
    await notifyTelegram(
      `NEW CLIENT — ${existing.email || "[no-email]"} paid $${planAmount} for ${planName}. ${deliveryNote}`,
    ).catch(() => undefined);

    // 8) n8n welcome-sequence webhook (fire-and-forget)
    fetch(N8N_WELCOME_HOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "payment_activated",
        userId,
        email: existing.email,
        full_name: existing.full_name,
        plan,
        amount: planAmount,
        txnid,
        activated_at: new Date().toISOString(),
      }),
    }).catch(() => undefined);

    // 9) Clean up pending transaction
    await supabaseAdmin
      .from("pending_transactions")
      .delete()
      .eq("txnid", txnid);

    console.log(
      "[payment-webhook] Activated:",
      maskEmail(existing.email),
      "plan:",
      plan,
    );

    return NextResponse.json({ received: true, activated: true });
  } catch (err) {
    console.error("[payment-webhook] Error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
