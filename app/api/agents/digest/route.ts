// app/api/agents/digest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { generateApproveToken } from "@/lib/agents/tokens";
import type { AgentRunRow, AgentActionRow } from "@/lib/agents/types";
import { checkMinuteLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const rateLimitId = req.headers.get("x-forwarded-for") || "digest-cron";
  const rl = checkMinuteLimit("agents-digest", rateLimitId, 20);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    return NextResponse.json({ error: "NOTIFY_EMAIL not set" }, { status: 500 });
  }

  // Yesterday's runs
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const { data: runs } = await supabaseAdmin
    .from("agent_runs")
    .select("*")
    .gte("created_at", yesterday.toISOString())
    .order("created_at", { ascending: true })
    .returns<AgentRunRow[]>();

  const { data: pending } = await supabaseAdmin
    .from("agent_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<AgentActionRow[]>();

  const runRows     = runs    ?? [];
  const pendingRows = pending ?? [];

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.flow-forges.com")
    + "/prospecting-os";

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  const outcomeColor = (o: string) =>
    o === "success" ? "#6BCB77" : o === "failed" ? "#E06060" : "#E8A840";

  const agentRows = runRows.map(r =>
    `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:13px;color:#ddd;">${r.agent_name}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:13px;color:${outcomeColor(r.outcome)};font-weight:600;">${r.outcome}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:12px;color:#888;">${r.log.split("\n")[0] ?? ""}</td>
    </tr>`
  ).join("");

  const approvalRows = pendingRows.map(a => {
    const token      = generateApproveToken(a.id);
    const approveUrl = `${base}/api/agents/approve?id=${a.id}&token=${token}&decision=approve`;
    const rejectUrl  = `${base}/api/agents/approve?id=${a.id}&token=${token}&decision=reject`;
    return `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:12px;color:#a78bfa;">${a.agent_name}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:13px;color:#ddd;">${a.description}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;white-space:nowrap;">
        <a href="${approveUrl}" style="color:#6BCB77;font-size:12px;font-weight:600;margin-right:12px;text-decoration:none;">Approve</a>
        <a href="${rejectUrl}"  style="color:#E06060;font-size:12px;font-weight:600;text-decoration:none;">Reject</a>
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#0a0a0a;border-radius:12px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#E8A840;padding:24px 32px;">
            <p style="margin:0;color:#000;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">
              Prospecting OS
            </p>
            <h1 style="margin:6px 0 0;color:#000;font-size:22px;font-weight:800;">
              Agent Report &middot; ${date}
            </h1>
          </td>
        </tr>

        <!-- Summary stats -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:#ddd;">${runRows.length}</div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Agents Ran</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:#6BCB77;">
                    ${runRows.filter(r => r.outcome === "success").length}
                  </div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Succeeded</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:${pendingRows.length > 0 ? "#E8A840" : "#ddd"};">
                    ${pendingRows.length}
                  </div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">
                    Pending${pendingRows.length > 0 ? " &mdash; action needed" : ""}
                  </div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:#ddd;">
                    ${runRows.reduce((s, r) => s + r.safe_actions_count, 0)}
                  </div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Safe Actions</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Agent run table -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;">
              Yesterday's Runs
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#111;border-radius:8px;overflow:hidden;">
              ${agentRows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#555;font-size:13px;">No runs recorded</td></tr>'}
            </table>
          </td>
        </tr>

        ${pendingRows.length > 0 ? `
        <!-- Pending approvals -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#E8A840;text-transform:uppercase;letter-spacing:1px;">
              Pending Approvals &mdash; ${pendingRows.length} action${pendingRows.length !== 1 ? "s" : ""} waiting
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#111;border-radius:8px;overflow:hidden;">
              ${approvalRows}
            </table>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#444;text-align:center;">
              Prospecting OS &middot; Agent Command Center &middot;
              <a href="${base}/admin/agents" style="color:#E8A840;text-decoration:none;">View Dashboard &rarr;</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const subject = `Agent Report · ${date}${pendingRows.length > 0 ? ` · ${pendingRows.length} pending` : " · All clear"}`;

  await sendEmail({ to: notifyEmail, subject, html });

  // Phase 7: Hot lead Telegram digest — top 10 by score
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat  = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChat) {
    const { data: hotLeads } = await supabaseAdmin
      .from("leads")
      .select("name, title, company, score")
      .gte("score", 80)
      .order("score", { ascending: false })
      .limit(10)
      .returns<Array<{ name: string; title: string; company: string; score: number }>>();

    if (hotLeads?.length) {
      const lines = hotLeads.map(
        (l, i) => `${i + 1}. ${l.name} — ${l.title} @ ${l.company} (${l.score})`
      );
      const tgText = `Hot Leads — ${date}\n\n${lines.join("\n")}\n\nView: ${base}/leads`;
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text: tgText }),
      }).catch(err => console.error("[agents/digest] Telegram send failed:", err));
    }
  }

  return NextResponse.json({
    ok: true,
    runs: runRows.length,
    pending: pendingRows.length,
  });
}
