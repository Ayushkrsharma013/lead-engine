import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { processInboundReply } from "@/lib/sequence-engine";

export const dynamic = "force-dynamic";

// Resend inbound webhook — called when a lead replies to a sequence email.
// Resend uses Svix-compatible webhook signatures.
// Verify the signature before processing the payload.

interface ResendWebhookBody {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return fromHeader.trim().toLowerCase();
}

function stripBrackets(headerValue: string | undefined): string | undefined {
  if (!headerValue) return undefined;
  return headerValue.replace(/^<|>$/g, "");
}

function verifyWebhookSignature(
  body: string,
  headers: Headers,
  secret: string
): boolean {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

  try {
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    const secretParts = secret.split("_");
    const rawSecret = secretParts[secretParts.length - 1];

    // Resend secret format: whsec_<base64> — try with and without prefix
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
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const rawBody = await req.text();
    if (!verifyWebhookSignature(rawBody, req.headers, webhookSecret)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
    // Re-parse the verified body
    const body = JSON.parse(rawBody) as ResendWebhookBody;
    return processReply(body);
  }

  // Fallback: no secret configured, process without verification
  try {
    const body = await req.json() as ResendWebhookBody;
    return processReply(body);
  } catch {
    // Body already consumed — try to read again
    return NextResponse.json({ ok: false, error: "Cannot parse body" }, { status: 400 });
  }
}

async function processReply(body: ResendWebhookBody) {
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
