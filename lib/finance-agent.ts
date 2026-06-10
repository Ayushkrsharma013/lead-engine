import { supabaseAdmin } from "./supabase";
import { sendEmail } from "./resend";
import { tgSend, tgEdit, fmt, fmtDate, isConfigured, InlineKeyboard } from "./telegram-bot";
import { PLANS, getPlanSetupAmount, type PlanKey } from "./stripe";
import { convertINR, formatCurrency, ALL_CURRENCIES } from "./currency";

const supabase = supabaseAdmin;

// ─── JOB 1: PAYMENT REQUEST WATCHER ────────────────────────────────────────

export async function jobPaymentRequestWatcher(): Promise<number> {
  const { data: pending } = await supabase
    .from("profiles")
    .select("id, email, plan, payment_ref, payment_method, created_at")
    .eq("subscription_status", "pending_payment")
    .not("payment_ref", "is", null);

  if (!pending?.length) return 0;

  let alerted = 0;
  for (const profile of pending as Array<Record<string, unknown>>) {
    const { data: existing } = await supabase
      .from("finance_agent_log")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("event_type", "payment_request")
      .eq("status", "pending")
      .maybeSingle();

    if (existing) continue;

    const planKey = (profile.plan as PlanKey) || "pilot";
    const plan = PLANS[planKey] || PLANS.pilot;
    const planLabel = plan ? `${plan.name} — ${fmt(plan.setupAmount)}${plan.monthlyAmount > 0 ? "/mo" : " one-time"}` : String(profile.plan);

    const text = [
      `💰 <b>New Payment Request</b>`,
      ``,
      `👤 <b>Client:</b> ${profile.email}`,
      `📦 <b>Plan:</b> ${planLabel}`,
      `🔑 <b>Ref:</b> <code>${profile.payment_ref}</code>`,
      `🏦 <b>Method:</b> ${(String(profile.payment_method || "ach")).toUpperCase()}`,
      `📅 <b>Requested:</b> ${fmtDate(String(profile.created_at || ""))}`,
    ].join("\n");

    const keyboard: InlineKeyboard = [
      [
        { text: "✅ Invoice Sent", callback_data: `invoice_sent:${profile.id}` },
        { text: "⏰ Remind 2hrs", callback_data: `snooze:${profile.id}:120` },
      ],
      [
        { text: "🚀 Activate Now", callback_data: `activate:${profile.id}` },
        { text: "❌ Dismiss", callback_data: `dismiss:${profile.id}` },
      ],
    ];

    const msgId = await tgSend(text, keyboard);

    await supabase.from("finance_agent_log").insert({
      event_type: "payment_request",
      profile_id: profile.id,
      payload: { plan: profile.plan, payment_ref: profile.payment_ref, email: profile.email },
      telegram_msg_id: msgId,
      status: "pending",
    });

    alerted++;
  }

  return alerted;
}

// ─── JOB 2: INVOICE REMINDER ESCALATION ────────────────────────────────────

export async function jobInvoiceReminderEscalation(): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("finance_agent_log")
    .select("id, profile_id, payload, telegram_msg_id, created_at")
    .eq("event_type", "payment_request")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (!stale?.length) return 0;

  let reminded = 0;
  for (const log of stale as Array<Record<string, unknown>>) {
    const { data: alreadySent } = await supabase
      .from("finance_agent_log")
      .select("id")
      .eq("event_type", "reminder_sent")
      .eq("profile_id", log.profile_id)
      .maybeSingle();

    if (alreadySent) continue;

    const payload = (log.payload || {}) as { email?: string; plan?: string; payment_ref?: string };
    const planKey = (payload.plan as PlanKey) || "pilot";
    const plan = PLANS[planKey] || PLANS.pilot;
    const hoursAgo = Math.round((Date.now() - new Date(String(log.created_at)).getTime()) / 3600000);

    const text = [
      `⚠️ <b>Invoice Reminder — ${hoursAgo}hrs overdue</b>`,
      ``,
      `👤 ${payload.email || "Unknown"}`,
      `📦 ${plan.name}`,
      `🔑 Ref: <code>${payload.payment_ref || "N/A"}</code>`,
      ``,
      `<i>Has the invoice been sent? Client hasn't activated yet.</i>`,
    ].join("\n");

    const keyboard: InlineKeyboard = [
      [
        { text: "✅ Invoice Sent", callback_data: `invoice_sent:${log.profile_id}` },
        { text: "🚀 Activate Now", callback_data: `activate:${log.profile_id}` },
      ],
    ];

    const msgId = await tgSend(text, keyboard);

    await supabase.from("finance_agent_log").insert({
      event_type: "reminder_sent",
      profile_id: log.profile_id,
      payload,
      telegram_msg_id: msgId,
      status: "pending",
    });

    reminded++;
  }

  return reminded;
}

// ─── JOB 3: 5-DAY NO-PAYMENT FOLLOW-UP ─────────────────────────────────────

export async function jobFiveDayFollowUp(): Promise<number> {
  const cutoff5d = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: overdue } = await supabase
    .from("profiles")
    .select("id, email, plan, payment_ref, created_at")
    .eq("subscription_status", "pending_payment")
    .lt("updated_at", cutoff5d);

  if (!overdue?.length) return 0;

  let drafted = 0;
  for (const profile of overdue as Array<Record<string, unknown>>) {
    const { data: sent } = await supabase
      .from("finance_agent_log")
      .select("id")
      .eq("event_type", "followup_sent")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (sent) continue;

    const planKey = (profile.plan as PlanKey) || "pilot";
    const plan = PLANS[planKey] || PLANS.pilot;
    const daysAgo = Math.round((Date.now() - new Date(String(profile.created_at || Date.now())).getTime()) / 86400000);

    const emailDraft = await generateFollowUpEmail(String(profile.email), plan.name, daysAgo);

    const text = [
      `📧 <b>5-Day Follow-up Draft</b>`,
      ``,
      `👤 ${profile.email}`,
      `📦 ${plan.name}`,
      `📅 ${daysAgo} days since request`,
      ``,
      `<b>Draft:</b>`,
      `<i>${emailDraft.subject}</i>`,
      ``,
      emailDraft.preview,
      ``,
      `<i>Approve to send via Resend, or dismiss.</i>`,
    ].join("\n");

    const keyboard: InlineKeyboard = [
      [
        { text: "📤 Send Follow-up", callback_data: `send_followup:${profile.id}` },
        { text: "❌ Skip", callback_data: `dismiss_followup:${profile.id}` },
      ],
    ];

    const msgId = await tgSend(text, keyboard);

    await supabase.from("finance_agent_log").insert({
      event_type: "followup_sent",
      profile_id: profile.id,
      payload: {
        email: profile.email,
        subject: emailDraft.subject,
        html: emailDraft.html,
        plan: profile.plan,
      },
      telegram_msg_id: msgId,
      status: "pending",
    });

    drafted++;
  }

  return drafted;
}

async function generateFollowUpEmail(
  clientEmail: string,
  planName: string,
  daysAgo: number
): Promise<{ subject: string; preview: string; html: string }> {
  const fallback = {
    subject: `Still interested in Prospecting OS?`,
    preview: `Hi there — just checking in on your Prospecting OS payment request from ${daysAgo} days ago.`,
    html: `<p>Hi there,</p>
    <p>Just checking in — your payment request for the <strong>${planName}</strong> plan is still active.
    If you have questions or need the bank details resent, just reply here.</p>
    <p>Best,<br>Ayush<br>Prospecting OS</p>`,
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `You are a concise, professional B2B sales assistant for Prospecting OS, an AI lead generation platform. Write short, warm, non-pushy follow-up emails. Return ONLY a JSON object with keys: subject (string), preview (string — first 2 sentences), html (full email HTML body, dark themed, inline styles only). No markdown.` }],
          },
          contents: [{
            parts: [{ text: `Write a follow-up email for a prospect who requested payment info ${daysAgo} days ago but hasn't paid yet. Plan: ${planName}. Their email: ${clientEmail}. Be warm, brief (3 sentences max), mention the payment reference is still active, offer to answer questions. Sign off as "Ayush, Prospecting OS".` }],
          }],
          generationConfig: { maxOutputTokens: 600 },
        }),
      },
    );

    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as { subject: string; preview: string; html: string };
  } catch {
    return fallback;
  }
}

// ─── JOB 4: MANUAL ACTIVATION ─────────────────────────────────────────────

export async function jobActivateProfile(profileId: string): Promise<{ success: boolean; email?: string; error?: string }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, plan")
    .eq("id", profileId)
    .single();

  if (error || !profile) return { success: false, error: "Profile not found" };

  const now = new Date().toISOString();

  await supabase
    .from("profiles")
    .update({
      subscription_status: "active",
      subscription_activated_at: now,
      xflow_transaction_id: "manual_activation",
      updated_at: now,
    })
    .eq("id", profileId);

  await supabase.from("activity_log").insert({
    type: "notification",
    text: `Finance Agent: activated ${profile.email} on ${PLANS[(profile.plan as PlanKey) || "pilot"]?.name || "unknown"} plan`,
    created_at: now,
  });

  await supabase
    .from("finance_agent_log")
    .update({ status: "actioned", updated_at: now })
    .eq("profile_id", profileId)
    .eq("status", "pending");

  const plan = PLANS[(profile.plan as PlanKey) || "pilot"] || PLANS.pilot;
  await sendEmail({
    to: String(profile.email),
    subject: "🚀 Your Prospecting OS plan is now active!",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0e0d0a;color:#f5f4f1;padding:40px;border-radius:12px;">
        <h1 style="font-size:28px;font-weight:700;margin:0 0 8px;">You're live. 🚀</h1>
        <p style="color:#b0aeaa;margin:0 0 24px;">
          Your <strong style="color:#f5f4f1;">${plan.name}</strong> plan is now active.
        </p>
        <a href="https://app.flow-forges.com/prospecting-os/admin/dashboard"
           style="display:inline-block;background:#e8420a;color:white;padding:12px 28px;border-radius:9999px;text-decoration:none;font-weight:600;">
          Open Dashboard →
        </a>
        <p style="color:#7a7875;font-size:13px;margin-top:24px;">
          We'll message you on Slack to kick things off. Questions? Reply here.
        </p>
      </div>
    `,
  });

  return { success: true, email: String(profile.email) };
}

// ─── JOB 5: MONTHLY REVENUE SUMMARY ──────────────────────────────────────

export async function jobMonthlySummary(): Promise<boolean> {
  const now = new Date();
  if (now.getDate() !== 1) return false;

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: alreadySent } = await supabase
    .from("finance_agent_log")
    .select("id")
    .eq("event_type", "monthly_summary")
    .like("payload->>month", monthKey)
    .maybeSingle();

  if (alreadySent) return false;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("plan, subscription_status, subscription_activated_at, email")
    .not("plan", "is", null);

  if (!profiles?.length) return false;

  const allProfiles = profiles as Array<{ plan?: string; subscription_status?: string; subscription_activated_at?: string; email?: string }>;
  const active = allProfiles.filter(p => p.subscription_status === "active");
  const pending = allProfiles.filter(p => p.subscription_status === "pending_payment");
  const thisMonthNew = active.filter(p => {
    if (!p.subscription_activated_at) return false;
    const d = new Date(p.subscription_activated_at);
    return d.getMonth() === now.getMonth() - 1 && d.getFullYear() === now.getFullYear();
  });

  const mrr = active.reduce((sum, p) => {
    const plan = PLANS[(p.plan as PlanKey) || "pilot"];
    if (!plan || !plan.monthlyAmount) return sum;
    return sum + plan.monthlyAmount;
  }, 0);

  const mrrByCurrency = ALL_CURRENCIES.map(c => `${formatCurrency(convertINR(mrr, c), c)}`)
    .join(" · ");

  const planBreakdown = Object.entries(
    active.reduce((acc, p) => {
      const key = (p.plan as string) || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([plan, count]) => `${PLANS[plan as PlanKey]?.name ?? plan}: ${count}`).join(", ");

  const narrative = await generateMonthlyNarrative(mrr, active.length, thisMonthNew.length, pending.length, now);

  const text = [
    `📊 <b>Monthly Finance Summary — ${now.toLocaleString("en-IN", { month: "long", year: "numeric" })}</b>`,
    ``,
    `💰 <b>MRR:</b> ${fmt(mrr)}/mo`,
    `💱 <b>All currencies:</b> ${mrrByCurrency}`,
    `✅ <b>Active clients:</b> ${active.length}`,
    `🆕 <b>New this month:</b> ${thisMonthNew.length}`,
    `⏳ <b>Pending payment:</b> ${pending.length}`,
    `📦 <b>Plans:</b> ${planBreakdown || "None"}`,
    ``,
    `🤖 <b>Agent Analysis:</b>`,
    narrative,
  ].join("\n");

  const msgId = await tgSend(text);

  await supabase.from("finance_agent_log").insert({
    event_type: "monthly_summary",
    payload: { month: monthKey, mrr, activeClients: active.length },
    telegram_msg_id: msgId,
    status: "actioned",
  });

  return true;
}

async function generateMonthlyNarrative(
  mrr: number,
  activeCount: number,
  newCount: number,
  pendingCount: number,
  date: Date,
): Promise<string> {
  const fallback = `MRR is ${fmt(mrr)} with ${activeCount} active clients. ${pendingCount} pending payments need follow-up.`;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are a concise financial analyst. Give a 2-sentence business insight based on the metrics. Be specific, actionable, and direct. No fluff." }],
          },
          contents: [{
            parts: [{ text: `Month: ${date.toLocaleString("en-IN", { month: "long" })}. MRR: ${fmt(mrr)}. Active clients: ${activeCount}. New this month: ${newCount}. Pending payment: ${pendingCount}. Give me 2 sentences of insight.` }],
          }],
          generationConfig: { maxOutputTokens: 200 },
        }),
      },
    );
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? fallback;
  } catch {
    return fallback;
  }
}
