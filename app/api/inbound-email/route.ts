import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Phase 2 — Resend inbound webhook handler
// Resend forwards replies here after domain configuration.
// Body: { from, to, subject, text, html, headers: { "message-id", "in-reply-to" } }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    console.log("[inbound-email] Received:", { from: body.from, subject: body.subject });

    // Phase 2 implementation:
    // 1. Parse body.from to extract reply-to email
    // 2. Match to lead via leads.email
    // 3. Match to sequence_messages via resend_id in headers
    // 4. Update lead kanban_column → "Replied", status → "replied"
    // 5. Log activity

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[inbound-email] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
