export interface BookingDetails {
  name: string;
  email: string;
  company?: string;
  notes?: string;
  date: string;
  time: string;
  phone?: string;
  type?: string;
  duration?: number;
  timezone?: string;
  calendarLink?: string;
  plan?: string;
}

// ─── Telegram ────────────────────────────────────────────────────────────────

export async function sendTelegramNotification(b: BookingDetails): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[notify] Telegram skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
    return;
  }

  const tz = b.timezone || "UTC";
  const lines = [
    `📅 <b>New Demo Booked!</b>`,
    ``,
    `👤 <b>Name:</b> ${b.name}`,
    `📧 <b>Email:</b> ${b.email}`,
    b.company ? `🏢 <b>Company:</b> ${b.company}` : null,
    b.phone ? `📞 <b>Phone:</b> ${b.phone}` : null,
    b.type ? `🏷 <b>Type:</b> ${b.type}` : null,
    b.plan ? `📋 <b>Plan:</b> ${b.plan}` : null,
    ``,
    `🗓 <b>Date:</b> ${b.date}`,
    `⏰ <b>Time:</b> ${b.time} (${tz})`,
    b.notes ? `📝 <b>Notes:</b> ${b.notes}` : null,
    b.calendarLink ? `\n🔗 <a href="${b.calendarLink}">View in Google Calendar</a>` : null,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      console.error("[notify] Telegram sendMessage failed:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("[notify] Telegram send exception:", err);
  }
}

// ─── Admin Email (Resend) ────────────────────────────────────────────────────

export async function sendEmailNotification(b: BookingDetails): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !toEmail) return;

  const tz = b.timezone || "UTC";
  const subject = `New Demo Booked — ${b.name}${b.company ? ` from ${b.company}` : ""}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#e8420a;padding:28px 36px;">
            <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">New Demo Booked</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">

            <!-- Prospect Details -->
            <p style="margin:0 0 20px;color:#b0aeaa;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Prospect Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;">
              ${row("Name", esc(b.name))}
              ${row("Email", `<a href="mailto:${esc(b.email)}" style="color:#e8420a;text-decoration:none;">${esc(b.email)}</a>`)}
              ${b.company ? row("Company", esc(b.company)) : ""}
              ${b.phone ? row("Phone", esc(b.phone)) : ""}
              ${b.type ? row("Type", esc(b.type)) : ""}
              ${b.notes ? row("Notes", esc(b.notes)) : ""}
            </table>

            <!-- Meeting Time -->
            <p style="margin:28px 0 12px;color:#b0aeaa;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Meeting Time</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;">
              ${row("Date", b.date)}
              ${row("Time", `${b.time} <span style="color:#7a7875;font-size:12px;">(${tz})</span>`)}
            </table>

            <!-- CTA -->
            ${b.calendarLink ? `
            <div style="text-align:center;margin-top:32px;">
              <a href="${b.calendarLink}" style="display:inline-block;background:#e8420a;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">
                View in Google Calendar &rarr;
              </a>
            </div>` : ""}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#7a7875;font-size:12px;text-align:center;">
              This notification was sent by Prospecting OS &middot; <a href="https://app.flow-forges.com/prospecting-os" style="color:#e8420a;text-decoration:none;">app.flow-forges.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Prospecting OS <notifications@flow-forges.com>",
        to: [toEmail],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.warn("[notify] Email send failed:", err);
  }
}

// ─── Attendee Confirmation Email ─────────────────────────────────────────────

export async function sendAttendeeConfirmation(b: BookingDetails): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const tz = b.timezone || "UTC";
  const meetingType = b.type || "demo";
  const subject = "Your Demo is Confirmed — Prospecting OS";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#e8420a;padding:28px 36px;">
            <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">Your Demo is Confirmed</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">

            <p style="margin:0 0 24px;color:#f5f4f1;font-size:15px;line-height:1.6;">
              Hi ${esc(b.name)},<br><br>
              Thank you for booking a demo with Prospecting OS. Your meeting has been confirmed for the following time:
            </p>

            <!-- Meeting Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;">
              ${row("Date", esc(b.date))}
              ${row("Time", `${esc(b.time)} <span style="color:#7a7875;font-size:12px;">(${esc(tz)})</span>`)}
              ${row("Type", esc(meetingType))}
              ${b.duration ? row("Duration", `${b.duration} minutes`) : ""}
              ${b.company ? row("Company", esc(b.company)) : ""}
            </table>

            <!-- Add to Calendar -->
            ${b.calendarLink ? `
            <div style="text-align:center;margin-top:32px;">
              <a href="${b.calendarLink}" style="display:inline-block;background:#e8420a;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">
                Add to Calendar &rarr;
              </a>
            </div>` : ""}

            <!-- Reschedule / Cancel -->
            <p style="margin:28px 0 0;color:#7a7875;font-size:13px;line-height:1.6;text-align:center;">
              Need to reschedule or cancel? Reply to this email and we will help you out.
            </p>

          </td>
        </tr>

        <!-- Footer -->
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
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Prospecting OS <notifications@flow-forges.com>",
        to: [b.email],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.warn("[notify] Attendee confirmation failed:", err);
  }
}

// ─── Cancellation Email ──────────────────────────────────────────────────────

export async function sendCancellationEmail(b: BookingDetails): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const subject = "Your Demo Has Been Cancelled — Prospecting OS";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#e8420a;padding:28px 36px;">
            <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">Demo Cancelled</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">

            <p style="margin:0 0 24px;color:#f5f4f1;font-size:15px;line-height:1.6;">
              Hi ${esc(b.name)},<br><br>
              Your demo with Prospecting OS has been cancelled as requested.
            </p>

            <!-- Cancelled Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;">
              ${row("Date", esc(b.date))}
              ${row("Time", esc(b.time))}
              ${b.type ? row("Type", esc(b.type)) : ""}
            </table>

            <!-- Book Again -->
            <div style="text-align:center;margin-top:32px;">
              <a href="https://app.flow-forges.com/prospecting-os/book" style="display:inline-block;background:#e8420a;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">
                Book Again &rarr;
              </a>
            </div>

          </td>
        </tr>

        <!-- Footer -->
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
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Prospecting OS <notifications@flow-forges.com>",
        to: [b.email],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.warn("[notify] Cancellation email failed:", err);
  }
}

// ─── Generic Telegram Text ───────────────────────────────────────────────────

export async function notifyTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[notify] notifyTelegram skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      console.error("[notify] notifyTelegram failed:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("[notify] notifyTelegram exception:", err);
  }
}

// ─── Client Portal Credentials Email ───────────────────────────────────────

export interface ClientCredentialsParams {
  to: string;
  clientName: string;
  clientId: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
}

export async function sendClientCredentialsEmail(p: ClientCredentialsParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const subject = `Your Prospecting OS Client Portal Access`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#E8A840;padding:28px 36px;">
            <p style="margin:0;color:#1a1917;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Prospecting OS</p>
            <h1 style="margin:8px 0 0;color:#1a1917;font-size:24px;font-weight:800;">Your Client Portal is Ready</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">

            <p style="margin:0 0 24px;color:#f5f4f1;font-size:15px;line-height:1.6;">
              Hi ${esc(p.clientName)},<br><br>
              Your Prospecting OS client portal has been set up. Use the credentials below to log in and access your lead pipeline, analytics, and reports.
            </p>

            <!-- Credentials Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <p style="margin:0;color:#7a7875;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Client ID</p>
                  <p style="margin:4px 0 0;color:#f5f4f1;font-size:14px;font-family:monospace;">${esc(p.clientId)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <p style="margin:0;color:#7a7875;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Username / Email</p>
                  <p style="margin:4px 0 0;color:#f5f4f1;font-size:14px;">${esc(p.username)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0;color:#7a7875;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Temporary Password</p>
                  <p style="margin:4px 0 0;color:#f5f4f1;font-size:14px;font-family:monospace;">${esc(p.tempPassword)}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin-top:32px;">
              <a href="${p.loginUrl}" style="display:inline-block;background:#E8A840;color:#1a1917;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">
                Open Client Portal &rarr;
              </a>
            </div>

            <p style="margin:28px 0 0;color:#7a7875;font-size:12px;line-height:1.5;text-align:center;">
              For security, you'll be prompted to change your password after logging in.
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

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Prospecting OS <notifications@flow-forges.com>",
        to: [p.to],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.warn("[notify] Client credentials email failed:", err);
  }
}

// ─── Invoice Agent Notifications ─────────────────────────────────────────────

export async function notifyInvoiceEvent(
  event: 'sent' | 'paid' | 'overdue' | 'reminder',
  inv: { invoice_number: string; client_name: string; total: number; due_date: string }
): Promise<void> {
  const formatUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const emoji = { sent: '📨', paid: '✅', overdue: '⚠️', reminder: '🔔' }[event];
  const label = { sent: 'Invoice Sent', paid: 'Invoice Paid', overdue: 'Invoice Overdue', reminder: 'Reminder Sent' }[event];

  await notifyTelegram(
    `${emoji} <b>${label}</b>\n` +
    `Invoice: <code>${inv.invoice_number}</code>\n` +
    `Client: ${inv.client_name}\n` +
    `Amount: ${formatUSD(inv.total)}\n` +
    `Due: ${inv.due_date}`
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#7a7875;font-size:13px;width:140px;white-space:nowrap;">${esc(label)}</td>
      <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#f5f4f1;font-size:13px;font-weight:500;">${value}</td>
    </tr>`;
}
