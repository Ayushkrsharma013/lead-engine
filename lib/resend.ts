const RESEND_API = "https://api.resend.com/emails";
const FROM = "Prospecting OS <notifications@flow-forges.com>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  resendId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] No RESEND_API_KEY configured");
    return { ok: false, error: "No API key" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const data = await res.json() as { id?: string; message?: string };

    if (res.ok && data.id) {
      return { ok: true, resendId: data.id };
    }
    return { ok: false, error: data.message || `HTTP ${res.status}` };
  } catch (err) {
    console.warn("[resend] Send failed:", err);
    return { ok: false, error: String(err) };
  }
}

export function buildProspectingEmailHtml(params: {
  leadName: string;
  subject: string;
  body: string;
}): string {
  const bodyHtml = params.body.replace(/\n/g, "<br>");
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td>
      <div style="background:#1a1917;border-radius:12px;padding:24px;border:1px solid rgba(255,255,255,0.06);max-width:560px;margin:0 auto;">
        <p style="color:#7a7875;font-size:12px;margin:0 0 16px;">Hi ${params.leadName},</p>
        <div style="color:#f5f4f1;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      </div>
      <p style="color:#4a4845;font-size:11px;text-align:center;margin-top:16px;">
        Sent by Prospecting OS &middot; <a href="https://app.flow-forges.com/prospecting-os" style="color:#e8420a;text-decoration:none;">app.flow-forges.com</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
