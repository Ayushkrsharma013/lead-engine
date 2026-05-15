export interface BookingDetails {
  name: string;
  email: string;
  company?: string;
  notes?: string;
  date: string;
  time: string;
  timezone?: string;
  calendarLink?: string;
}

// ─── Telegram ────────────────────────────────────────────────────────────────

export async function sendTelegramNotification(b: BookingDetails): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const tz = b.timezone || "UTC";
  const lines = [
    `📅 <b>New Demo Booked!</b>`,
    ``,
    `👤 <b>Name:</b> ${b.name}`,
    `📧 <b>Email:</b> ${b.email}`,
    b.company ? `🏢 <b>Company:</b> ${b.company}` : null,
    ``,
    `🗓 <b>Date:</b> ${b.date}`,
    `⏰ <b>Time:</b> ${b.time} (${tz})`,
    b.notes ? `📝 <b>Notes:</b> ${b.notes}` : null,
    b.calendarLink ? `\n🔗 <a href="${b.calendarLink}">View in Google Calendar</a>` : null,
  ].filter(Boolean).join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.warn("[notify] Telegram send failed:", err);
  }
}

// ─── Email (Resend) ───────────────────────────────────────────────────────────

export async function sendEmailNotification(b: BookingDetails): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFY_EMAIL || "ayushkumarsharma013@gmail.com";
  if (!apiKey) return;

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
            <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">New Demo Booked 🎉</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">

            <!-- Prospect Details -->
            <p style="margin:0 0 20px;color:#b0aeaa;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Prospect Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;">
              ${row("👤 Name", b.name)}
              ${row("📧 Email", `<a href="mailto:${b.email}" style="color:#e8420a;text-decoration:none;">${b.email}</a>`)}
              ${b.company ? row("🏢 Company", b.company) : ""}
              ${b.notes ? row("📝 Notes", b.notes) : ""}
            </table>

            <!-- Meeting Time -->
            <p style="margin:28px 0 12px;color:#b0aeaa;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Meeting Time</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141310;border-radius:12px;overflow:hidden;">
              ${row("🗓 Date", b.date)}
              ${row("⏰ Time", `${b.time} <span style="color:#7a7875;font-size:12px;">(${tz})</span>`)}
            </table>

            <!-- CTA -->
            ${b.calendarLink ? `
            <div style="text-align:center;margin-top:32px;">
              <a href="${b.calendarLink}" style="display:inline-block;background:#e8420a;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">
                View in Google Calendar →
              </a>
            </div>` : ""}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#7a7875;font-size:12px;text-align:center;">
              This notification was sent by Prospecting OS · <a href="https://app.flow-forges.com/prospecting-os" style="color:#e8420a;text-decoration:none;">app.flow-forges.com</a>
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

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#7a7875;font-size:13px;width:140px;white-space:nowrap;">${label}</td>
      <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);color:#f5f4f1;font-size:13px;font-weight:500;">${value}</td>
    </tr>`;
}
