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

// Map Dodo product IDs to plan keys
// Product IDs from Dodo dashboard → internal plan keys
const DODO_PRODUCT_MAP: Record<string, PlanKey> = {
  // These will be updated with actual Dodo product IDs once available
  prod_micro: "micro",
  prod_pilot_setup: "pilot",
  prod_pilot_monthly: "pilot",
  prod_growth_setup: "growth",
  prod_growth_monthly: "growth",
  prod_scale_setup: "scale",
  prod_scale_monthly: "scale",
};

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

// Verify Dodo webhook signature using HMAC-SHA256
function verifyDodoSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    // ── Dodo webhook path ──────────────────────────────────────────────────
    const dodoSignature = req.headers.get("dodo-signature")
      || req.headers.get("x-dodo-signature");
    const dodoSecret = process.env.DODO_WEBHOOK_SECRET;

    // Require signature for all Dodo-format requests when secret is configured.
    // Dodo format is identified by the presence of an "event" field (e.g., "payment.succeeded").
    // Without this check, unsigned Dodo-format requests fall through to the legacy path and return 200.
    const isDodoEvent = typeof body.event === "string";
    if (dodoSecret && (isDodoEvent || dodoSignature)) {
      if (!dodoSignature) {
        console.warn("[payment-webhook] Missing Dodo signature");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      if (!verifyDodoSignature(rawBody, dodoSignature, dodoSecret)) {
        console.warn("[payment-webhook] Invalid Dodo signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }

      // Dodo sends: { event: "payment.succeeded", data: { payment: { id, email, amount, product_id, status } } }
      const event = body.event || body.type;
      const payment = body.data?.payment || body.data || body;

      if (event !== "payment.succeeded" && payment?.status !== "succeeded") {
        // Log other events but don't process
        console.log("[payment-webhook] Dodo event ignored:", event || payment?.status);
        return NextResponse.json({ received: true });
      }

      const email = payment.email || payment.customer_email;
      const amount = Number(payment.amount) || 0;
      const productId = payment.product_id || body.data?.product_id || "";
      const paymentId = payment.id || payment.payment_id || "";

      // Map Dodo product ID to internal plan key
      const plan = DODO_PRODUCT_MAP[productId] || "micro";

      if (!email) {
        console.warn("[payment-webhook] Dodo payment has no email:", paymentId);
        return NextResponse.json({ received: true });
      }

      // Find or create user by email
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, subscription_status, role, plan, icp_preferences")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      let userId: string;
      const tempPassword = generateTempPassword();
      const username = generateUsername(email);

      if (existingProfile) {
        userId = existingProfile.id as string;

        // Skip if already active (idempotent)
        if (existingProfile.subscription_status === "active") {
          console.log("[payment-webhook] Dodo: already active, skipping:", maskEmail(email));
          return NextResponse.json({ received: true, alreadyActive: true });
        }

        // Update existing profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({
            role: "client",
            plan,
            subscription_status: "active",
            onboarding_complete: true,
            subscription_activated_at: new Date().toISOString(),
            payment_ref: paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (profileError) {
          console.error("[payment-webhook] Dodo profile update failed:", profileError);
          return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
        }
      } else {
        // Create new auth user + profile for Dodo payments
        // Step 1: Create auth user so client can log in
        const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase(),
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: "client", plan },
        });

        if (authError || !newAuthUser?.user) {
          console.error("[payment-webhook] Dodo auth user creation failed:", authError?.message);
          return NextResponse.json({ error: "User creation failed" }, { status: 500 });
        }

        userId = newAuthUser.user.id;

        // Step 2: Create profile entry linked to auth user
        const { error: createError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: userId,
            email: email.toLowerCase(),
            display_name: (email.split("@")[0] || "Client").slice(0, 50),
            role: "client",
            plan,
            subscription_status: "active",
            onboarding_complete: true,
            subscription_activated_at: new Date().toISOString(),
            payment_ref: paymentId,
            is_active: true,
          });

        if (createError) {
          console.error("[payment-webhook] Dodo profile creation failed:", createError.message);
          // Don't fail — auth user is created, profile can be fixed
        }
      }

      // Provision client row
      const { data: existingClient } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      let clientId: string;
      if (existingClient) {
        clientId = existingClient.id as string;
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
        const { data: newClient } = await supabaseAdmin
          .from("clients")
          .insert({
            name: email.split("@")[0] || "Client",
            company: "",
            industry: "",
            monthly_retainer: PLANS[plan]?.monthlyAmount ?? 0,
            status: "active",
            email: email.toLowerCase(),
            portal_username: username,
            portal_password: tempPassword,
            plan,
            user_id: userId,
          })
          .select("id")
          .single();

        clientId = newClient?.id as string || "";
      }

      // Create workspace — try to pull ICP from appointment first
      let icpConfig: Record<string, unknown> = {};

      if (email) {
        const { data: appointment } = await supabaseAdmin
          .from("appointments")
          .select("icp_config, plan")
          .eq("email", email.toLowerCase())
          .eq("status", "won")
          .maybeSingle();

        if (appointment?.icp_config && typeof appointment.icp_config === "object") {
          icpConfig = appointment.icp_config as Record<string, unknown>;
        }
      }

      let workspaceId: string | undefined;

      const { data: existingWorkspace } = await supabaseAdmin
        .from("client_workspaces")
        .select("id")
        .eq("client_user_id", userId)
        .maybeSingle();

      if (existingWorkspace) {
        workspaceId = (existingWorkspace as any).id;
        // Update existing workspace ICP if it's empty
        const existingIcp = (existingWorkspace as any).icp_config;
        const needRegen = !existingIcp || Object.keys(existingIcp).length === 0;
        if (needRegen) {
          await supabaseAdmin
            .from("client_workspaces")
            .update({ icp_config: icpConfig, leads_generation_status: "processing" })
            .eq("id", workspaceId);
        }
      } else {
        const { data: newWs } = await supabaseAdmin.from("client_workspaces").insert({
          client_user_id: userId,
          plan,
          icp_config: icpConfig,
          leads_generation_status: "processing",
        }).select("id").single();
        workspaceId = (newWs as any)?.id;
      }

      // Trigger lead generation asynchronously (fire-and-forget)
      if (workspaceId) {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          fetch(
            `https://app.flow-forges.com/prospecting-os/api/leads/generate?workspace_id=${workspaceId}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cronSecret}`,
              },
            }
          ).catch((err) => console.warn("[payment-webhook] Lead gen trigger failed:", err));
        }
      }

      // Send credentials email
      try {
        await sendClientCredentialsEmail({
          to: email,
          clientName: email.split("@")[0] || "there",
          clientId: clientId || userId,
          username: email,
          tempPassword,
          loginUrl: PORTAL_LOGIN_URL,
        });
      } catch (err) {
        console.warn("[payment-webhook] Dodo credentials email failed:", err);
      }

      // Send activation email
      const planName = PLANS[plan]?.name || plan;
      try {
        await sendEmail({
          to: email,
          subject: `Payment received — Your ${planName} plan is active`,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <td style="background:#E8A840;padding:28px 36px;">
            <p style="margin:0;color:#1a1917;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#1a1917;font-size:24px;font-weight:800;">Payment Received</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;color:#f5f4f1;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Hi there,</p>
            <p style="margin:0 0 16px;">Thank you for your purchase. Your <strong>${planName}</strong> plan ($${amount}) is now active.</p>
            <p style="margin:0 0 24px;">Your client portal credentials have been sent in a separate email. Sign in to view your pipeline.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${PORTAL_LOGIN_URL}" style="display:inline-block;background:#E8A840;color:#1a1917;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Open Client Portal</a>
            </div>
            <p style="margin:24px 0 0;font-size:13px;color:#b0aeaa;">
              Reference: <code style="color:#f5f4f1;">${paymentId}</code>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        });
      } catch (err) {
        console.warn("[payment-webhook] Dodo activation email failed:", err);
      }

      // Telegram alert
      const deliveryNote =
        plan === "micro"
          ? "Auto-activated. Deliver in 5 days."
          : "Auto-activated.";
      await notifyTelegram(
        `NEW CLIENT — ${maskEmail(email)} paid $${amount} for ${planName}. ${deliveryNote}`
      ).catch(() => undefined);

      // n8n welcome-sequence webhook
      fetch(N8N_WELCOME_HOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "payment_activated",
          source: "dodo",
          userId,
          email,
          plan,
          amount,
          paymentId,
          activated_at: new Date().toISOString(),
        }),
      }).catch(() => undefined);

      console.log("[payment-webhook] Dodo activated:", maskEmail(email), "plan:", plan);
      return NextResponse.json({ received: true, activated: true });
    }

    // ── Legacy path: Easebuzz, Skydo, Stripe webhook formats ────────────
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

    // Idempotency
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
      await supabaseAdmin
        .from("pending_transactions")
        .delete()
        .eq("txnid", txnid);
      return NextResponse.json({ received: true, alreadyActive: true });
    }

    // Provision client
    const tempPassword = generateTempPassword();
    const username = generateUsername(existing.email || existing.full_name || userId);

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

    // Reset auth password
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    // Insert/update clients row
    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let clientId: string;
    if (existingClient) {
      clientId = existingClient.id as string;
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

    // Insert client_workspaces — try appointment ICP first
    const { data: existingWorkspace } = await supabaseAdmin
      .from("client_workspaces")
      .select("id, icp_config")
      .eq("client_user_id", userId)
      .maybeSingle();

    let icpConfig =
      (existing.icp_preferences as Record<string, unknown> | null) || {};

    // Try to pull ICP from a "won" appointment if workspace ICP is empty
    if (Object.keys(icpConfig).length === 0 && existing.email) {
      const { data: appointment } = await supabaseAdmin
        .from("appointments")
        .select("icp_config, plan")
        .eq("email", existing.email.toLowerCase())
        .eq("status", "won")
        .maybeSingle();

      if (appointment?.icp_config && typeof appointment.icp_config === "object") {
        icpConfig = appointment.icp_config as Record<string, unknown>;
      }
    }

    let workspaceId: string | undefined;

    if (existingWorkspace) {
      workspaceId = (existingWorkspace as any).id;
      const existingIcp = (existingWorkspace as any).icp_config;
      if (!existingIcp || Object.keys(existingIcp).length === 0) {
        await supabaseAdmin
          .from("client_workspaces")
          .update({ icp_config: icpConfig, leads_generation_status: "processing" })
          .eq("id", workspaceId);
      }
    } else {
      const { data: newWs } = await supabaseAdmin.from("client_workspaces").insert({
        client_user_id: userId,
        plan,
        icp_config: icpConfig,
        leads_generation_status: "processing",
      }).select("id").single();
      workspaceId = (newWs as any)?.id;
    }

    // Trigger lead generation asynchronously (fire-and-forget)
    if (workspaceId) {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret) {
        fetch(
          `https://app.flow-forges.com/prospecting-os/api/leads/generate?workspace_id=${workspaceId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cronSecret}`,
            },
          }
        ).catch((err) => console.warn("[payment-webhook] Lead gen trigger failed:", err));
      }
    }

    // Send credentials email
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

      // Send activation email
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

    // Telegram alert
    const planName = PLANS[plan]?.name || plan;
    const deliveryNote =
      plan === "micro"
        ? "Auto-activated. Deliver in 5 days."
        : "Auto-activated.";
    await notifyTelegram(
      `NEW CLIENT — ${existing.email || "[no-email]"} paid $${planAmount} for ${planName}. ${deliveryNote}`,
    ).catch(() => undefined);

    // n8n welcome-sequence webhook
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

    // Clean up pending transaction
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
