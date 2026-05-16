import { NextRequest, NextResponse } from "next/server";
import { processInboundReply } from "@/lib/sequence-engine";

export const dynamic = "force-dynamic";

// Resend inbound webhook — called when a lead replies to a sequence email.
// Resend POSTs: { from: "Name <email>", to, subject, text, html, headers: { "in-reply-to": "<msg-id>" } }

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ResendWebhookBody;

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
