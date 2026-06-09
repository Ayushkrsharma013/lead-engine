import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { notifyTelegram } from "@/lib/notify";

/**
 * Send the micro-offer delivery report via Resend.
 * Used when a micro client's 50 ICP-verified leads are ready.
 */
export interface MicroDeliveryParams {
  email: string;
  clientName: string;
  leadCount: number;
  reportUrl: string;
}

export async function sendMicroDeliveryReport(params: MicroDeliveryParams) {
  const { email, clientName, leadCount, reportUrl } = params;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#E8A840,#e8420a);padding:28px 36px;">
            <p style="margin:0;color:#1a1917;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#1a1917;font-size:24px;font-weight:800;">Your Leads Are Ready</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;color:#f5f4f1;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Hi ${clientName},</p>
            <p style="margin:0 0 16px;">
              Your <strong>${leadCount} ICP-verified leads</strong> with personalized outreach sequences are ready.
              Each lead includes a LinkedIn profile link, verified email, AI score, and a custom icebreaker message.
            </p>

            <!-- Stats -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#7a7875;font-size:13px;width:180px;">Leads Delivered</td>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#6BCB77;font-size:18px;font-weight:700;">${leadCount}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#7a7875;font-size:13px;">Avg AI Score</td>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#E8A840;font-size:18px;font-weight:700;">8.5 / 10</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;color:#7a7875;font-size:13px;">Outreach Sequences</td>
                <td style="padding:14px 20px;color:#f5f4f1;font-size:18px;font-weight:700;">5</td>
              </tr>
            </table>

            <p style="margin:0 0 16px;">
              Each outreach sequence includes a 4-step LinkedIn DM cadence: connection request, follow-up DM, value proposition, and breakup message.
            </p>

            <!-- CTA -->
            <div style="text-align:center;margin:32px 0;">
              <a href="${reportUrl}" style="display:inline-block;background:#E8A840;color:#1a1917;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">
                View Your Leads &rarr;
              </a>
            </div>

            <p style="margin:24px 0 0;font-size:13px;color:#7a7875;">
              Questions? Reply to this email or book a call at <a href="https://app.flow-forges.com/prospecting-os/book" style="color:#E8A840;text-decoration:none;">app.flow-forges.com/book</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#7a7875;font-size:12px;text-align:center;">
              Prospecting OS &middot; <a href="https://app.flow-forges.com/prospecting-os" style="color:#E8A840;text-decoration:none;">app.flow-forges.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: email,
    subject: `Your ${leadCount} ICP-Verified Leads Are Ready — Prospecting OS`,
    html,
  });
}

/**
 * Triggered from admin dashboard or webhook after micro client payment.
 * Creates a micro delivery record and notifies the founder to fulfill.
 */
export async function triggerMicroDelivery(userId: string, email: string) {
  // Insert micro_delivery record
  const { error } = await supabaseAdmin.from("micro_deliveries").insert({
    client_user_id: userId,
    email,
    status: "pending",
    leads_count: 50,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[micro-delivery] Insert failed:", error.message);
  }

  // Alert founder to fulfill
  await notifyTelegram(
    `MICRO DELIVERY — ${email} just paid for 50 leads. Fulfill within 5 business days.`
  ).catch(() => undefined);
}
