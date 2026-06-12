import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { processInboundReply } from "@/lib/sequence-engine";
import { supabaseAdmin } from "@/lib/supabase";
import { logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// Resend webhook handler — handles inbound replies + engagement events (open, click).
// Resend uses Svix-compatible webhook signatures.

interface ResendInboundBody {
  type?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

interface ResendEngagementBody {
  type: "email.opened" | "email.clicked" | "email.bounced" | "email.delivered" | "email.complained";
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    click?: { link?: string };
  };
}

type ResendWebhookBody = ResendInboundBody | ResendEngagementBody;

function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return fromHeader.trim().toLowerCase();
}

function stripBrackets(headerValue: string | undefined): string | undefined {
  if (!headerValue) return undefined;
  return headerValue.replace(/^<|>$/g, "");
}

function verifyWebhookSignature(body: string, headers: Headers, secret: string): boolean {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

  try {
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    const secretParts = secret.split("_");
    const rawSecret = secretParts[secretParts.length - 1];

    for (const key of [rawSecret, secret]) {
      const hmac = createHmac("sha256", Buffer.from(key, "base64"));
      hmac.update(signedContent);
      const expected = hmac.digest("hex");

      const signatures = svixSignature.split(" ");
      for (const sig of signatures) {
        const sigParts = sig.split(",");
        for (const part of sigParts) {
          const [version, value] = part.split("=");
          if (version === "v1" && timingSafeEqual(
            Buffer.from(value || ""),
            Buffer.from(expected)
          )) {
            return true;
          }
        }
      }
    }
    return false;
  } catch (err) {
    console.error("[inbound-email] Webhook verification failed:", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  let body: ResendWebhookBody;
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers, webhookSecret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }
  body = JSON.parse(rawBody) as ResendWebhookBody;

  // Route by event type
  const eventType = (body as ResendEngagementBody).type;

  if (eventType === "email.opened" || eventType === "email.clicked") {
    return processEngagementEvent(body as ResendEngagementBody);
  }

  if (eventType === "email.bounced") {
    return processBounceEvent(body as ResendEngagementBody);
  }

  // Default: inbound reply (no type field)
  return processReply(body as ResendInboundBody);
}

async function processEngagementEvent(body: ResendEngagementBody) {
  try {
    const emailId = body.data?.email_id;
    if (!emailId) return NextResponse.json({ ok: true, skipped: "no email_id" });

    const isClick = body.type === "email.clicked";
    const scoreBoost = isClick ? 5 : 3;
    const eventLabel = isClick ? "clicked" : "opened";

    // Find sequence message by resend_id
    const { data: seqMsg } = await supabaseAdmin
      .from("sequence_messages")
      .select("id, lead_id")
      .eq("resend_id", emailId)
      .maybeSingle();

    if (!seqMsg?.lead_id) return NextResponse.json({ ok: true, skipped: "no sequence message" });

    // Boost lead score
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, score")
      .eq("id", seqMsg.lead_id)
      .maybeSingle();

    if (!lead) return NextResponse.json({ ok: true, skipped: "lead not found" });

    const currentScore = typeof lead.score === "number" ? lead.score : 0;
    const newScore = Math.min(100, currentScore + scoreBoost);
    if (newScore > currentScore) {
      await supabaseAdmin
        .from("leads")
        .update({ score: newScore, last_touched: new Date().toISOString() })
        .eq("id", lead.id);
    }

    await logActivity({
      type: "notification",
      text: `${lead.name || "Lead"} ${eventLabel} your email (+${scoreBoost} score)`,
      leadId: lead.id,
    });

    console.log(`[inbound-email] ${body.type} for lead ${lead.id} — score ${currentScore}→${newScore}`);
    return NextResponse.json({ ok: true, event: body.type, leadId: lead.id, newScore });
  } catch (err) {
    console.error("[inbound-email] Engagement event error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function processBounceEvent(body: ResendEngagementBody) {
  try {
    const emailId = body.data?.email_id;
    if (!emailId) return NextResponse.json({ ok: true, skipped: "no email_id" });

    // Update sequence_message to bounced
    await supabaseAdmin
      .from("sequence_messages")
      .update({ status: "bounced" })
      .eq("resend_id", emailId);

    return NextResponse.json({ ok: true, event: "email.bounced" });
  } catch (err) {
    console.error("[inbound-email] Bounce event error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function processReply(body: ResendInboundBody) {
  try {
    const fromHeader = body.from || "";
    const fromEmail = extractEmail(fromHeader);
    const inReplyTo = stripBrackets(body.headers?.["in-reply-to"]);

    if (!fromEmail) {
      return NextResponse.json({ ok: false, error: "No from email" }, { status: 400 });
    }

    console.log(`[inbound-email] Reply from ${fromEmail} — "${(body.subject || "").slice(0, 80)}"`);

    const result = await processInboundReply({
      fromEmail,
      subject: body.subject || "(no subject)",
      bodyText: body.text || body.html || "",
      inReplyTo,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[inbound-email] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
