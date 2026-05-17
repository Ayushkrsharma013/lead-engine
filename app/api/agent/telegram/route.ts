import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAgentAction } from "@/lib/agents/resolver";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// ─── Telegram helpers ──────────────────────────────────────────────────────

async function sendMessage(chatId: number, text: string, opts?: { reply_markup?: unknown }) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...opts }),
  });
}

async function answerCallback(cbId: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cbId }),
  });
}

// ─── Gemini ────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) return "Gemini API key not configured.";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: `You are the ProOS Bot — a personal assistant for Prospecting OS, a B2B lead generation platform. You have direct access to the platform database and can answer questions about leads, pipeline, agents, bookings, clients, and analytics. You chat via Telegram. Be concise, insightful, and helpful. Use 1-3 sentences unless the user asks for detail. Suggest relevant slash commands when appropriate: /stats, /leads, /agents, /pipeline, /bookings, /help.`,
          }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    },
  );

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I didn't get that. Try /help for available commands.";
}

// ─── Command handlers ──────────────────────────────────────────────────────

async function cmdStart(chatId: number) {
  await sendMessage(chatId,
    `*ProOS Bot* — Your Prospecting OS Personal Assistant\n\n` +
    `I can pull live data from your pipeline anytime.\n\n` +
    `*Commands:*\n` +
    `/stats — Lead & pipeline overview\n` +
    `/leads — Latest hot leads\n` +
    `/agents — Agent workforce status\n` +
    `/pipeline — Kanban distribution\n` +
    `/bookings — Upcoming appointments\n` +
    `/clients — Active client list\n` +
    `/help — Show this message\n\n` +
    `Or just ask me anything about your prospecting.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Stats", callback_data: "cmd:stats" }, { text: "Hot Leads", callback_data: "cmd:leads" }],
          [{ text: "Agents", callback_data: "cmd:agents" }, { text: "Pipeline", callback_data: "cmd:pipeline" }],
          [{ text: "Bookings", callback_data: "cmd:bookings" }, { text: "Clients", callback_data: "cmd:clients" }],
        ],
      },
    },
  );
}

async function cmdStats(chatId: number) {
  const { count: total } = await supabaseAdmin.from("leads").select("*", { count: "exact", head: true });
  const { count: hot } = await supabaseAdmin.from("leads").select("*", { count: "exact", head: true }).gt("score", 80);
  const { count: withEmail } = await supabaseAdmin.from("leads").select("*", { count: "exact", head: true }).eq("email_status", "verified");
  const { data: avgRow } = await supabaseAdmin.from("leads").select("score").neq("score", 0);
  const scores = (avgRow || []).map((r: { score: number }) => r.score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const { data: srcRows } = await supabaseAdmin.from("leads").select("source");
  const sources: Record<string, number> = {};
  (srcRows || []).forEach((r: { source: string }) => { sources[r.source] = (sources[r.source] || 0) + 1; });

  const srcLines = Object.entries(sources)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const { count: bookings } = await supabaseAdmin.from("appointments").select("*", { count: "exact", head: true });

  await sendMessage(chatId,
    `*Pipeline Overview*\n\n` +
    `Total Leads: *${total}*\n` +
    `Hot Leads (>80): *${hot}*\n` +
    `Avg Score: *${avgScore}*\n` +
    `Verified Emails: *${withEmail}*\n` +
    `Upcoming Bookings: *${bookings}*\n\n` +
    `*By Source:*\n${srcLines || "  No data"}`,
  );
}

async function cmdLeads(chatId: number, count = 5) {
  const { data } = await supabaseAdmin.from("leads").select("name, company, score, status, email_status")
    .order("score", { ascending: false }).limit(Math.min(count, 10));
  if (!data?.length) {
    await sendMessage(chatId, "No leads found.");
    return;
  }
  const lines = (data as Array<{ name: string; company: string; score: number; status: string | null; email_status: string }>)
    .map((l, i) =>
      `${i + 1}. *${l.name}* — ${l.company}\n` +
      `   Score: ${l.score} | Status: ${l.status || "new"} | Email: ${l.email_status}`,
    ).join("\n\n");

  await sendMessage(chatId, `*Top ${data.length} Leads*\n\n${lines}`);
}

async function cmdAgents(chatId: number) {
  const { data } = await supabaseAdmin.from("agents").select("display_name, enabled, health_score, last_run_status, schedule")
    .order("display_name");
  if (!data?.length) {
    await sendMessage(chatId, "No agents configured.");
    return;
  }
  const lines = (data as Array<{ display_name: string; enabled: boolean; health_score: number; last_run_status: string | null; schedule: string }>)
    .map((a) => {
      const icon = a.health_score >= 90 ? "O" : a.health_score >= 60 ? "O" : "X";
      const status = a.enabled ? "Online" : "Offline";
      const last = a.last_run_status || "never";
      return `${icon} *${a.display_name}* [${a.health_score}] — ${status}\n   ${a.schedule} | Last: ${last}`;
    }).join("\n");

  const online = data.filter((a: { enabled: boolean }) => a.enabled).length;
  await sendMessage(chatId, `*Agent Workforce* (${online}/${data.length} online)\n\n${lines}`);
}

async function cmdPipeline(chatId: number) {
  const { data } = await supabaseAdmin.from("leads").select("kanban_column");
  const cols: Record<string, number> = {};
  (data || []).forEach((r: { kanban_column: string | null }) => {
    const c = r.kanban_column || "Uncategorized";
    cols[c] = (cols[c] || 0) + 1;
  });

  const order = ["New", "Contacted", "Replied", "Hot Lead", "Meeting Booked", "Won", "Lost"];
  const lines = order
    .filter((c) => cols[c])
    .map((c) => {
      const bar = "O".repeat(Math.min(cols[c], 20));
      return `*${c}*: ${cols[c]}\n${bar}`;
    })
    .join("\n");

  await sendMessage(chatId, `*Kanban Pipeline*\n\n${lines || "No leads in pipeline."}`);
}

async function cmdBookings(chatId: number) {
  const now = new Date().toISOString().split("T")[0];
  const { data } = await supabaseAdmin.from("appointments").select("name, email, date, time, type, company")
    .gte("date", now).order("date").order("time").limit(10);

  if (!data?.length) {
    await sendMessage(chatId, "No upcoming bookings.");
    return;
  }
  const lines = (data as Array<{ name: string; email: string; date: string; time: string; type: string; company: string | null }>)
    .map((b, i) =>
      `${i + 1}. *${b.name}*${b.company ? ` (${b.company})` : ""}\n` +
      `   ${b.date} at ${b.time} | ${b.type} | ${b.email}`,
    ).join("\n\n");

  await sendMessage(chatId, `*Upcoming Bookings* (${data.length})\n\n${lines}`);
}

async function cmdClients(chatId: number) {
  const { data } = await supabaseAdmin.from("clients").select("name, company, industry, monthly_retainer, status")
    .order("name");
  if (!data?.length) {
    await sendMessage(chatId, "No clients yet.");
    return;
  }
  const lines = (data as Array<{ name: string; company: string; industry: string; monthly_retainer: number; status: string }>)
    .map((c, i) =>
      `${i + 1}. *${c.name}* — ${c.company}\n` +
      `   ${c.industry} | $${c.monthly_retainer}/mo | ${c.status}`,
    ).join("\n\n");

  await sendMessage(chatId, `*Clients* (${data.length})\n\n${lines}`);
}

// ─── Command router ────────────────────────────────────────────────────────

async function handleCommand(chatId: number, text: string) {
  const t = text.trim();

  if (t === "/start") return cmdStart(chatId);
  if (t === "/help") return cmdStart(chatId);
  if (t === "/stats" || t === "/overview") return cmdStats(chatId);
  if (t === "/agents") return cmdAgents(chatId);
  if (t === "/pipeline" || t === "/kanban") return cmdPipeline(chatId);
  if (t === "/bookings") return cmdBookings(chatId);
  if (t === "/clients") return cmdClients(chatId);

  if (t.startsWith("/leads")) {
    const m = t.match(/^\/leads\s+(\d+)/);
    return cmdLeads(chatId, m ? parseInt(m[1]) : 5);
  }

  // Free text → Gemini
  const reply = await callGemini(t);
  await sendMessage(chatId, reply);
}

// ─── Callback router ───────────────────────────────────────────────────────

async function handleCallback(chatId: number, data: string) {
  if (data.startsWith("cmd:")) {
    const cmd = "/" + data.slice(4); // "cmd:stats" → "/stats"
    return handleCommand(chatId, cmd);
  }
  // Legacy agent approve/reject
  const match = data.match(/^(approve_agent|reject_agent):(.+)$/);
  if (match) return; // handled by caller
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  try {
    const body = await req.json() as {
      message?: { chat?: { id: number }; text?: string; from?: { first_name?: string } };
      callback_query?: {
        id: string;
        data: string;
        from: { username?: string; first_name?: string };
        message?: { chat?: { id: number }; message_id?: number };
      };
    };

    // ── Inline keyboard callback ──
    if (body.callback_query) {
      const cb = body.callback_query;
      await answerCallback(cb.id);

      const chatId = cb.message?.chat?.id;
      if (chatId) await handleCallback(chatId, cb.data);

      // Agent approve/reject
      const m = cb.data.match(/^(approve_agent|reject_agent):(.+)$/);
      if (m) {
        const approved = m[1] === "approve_agent";
        const actionId = m[2];
        const approvedBy = cb.from.username ?? cb.from.first_name ?? "telegram-user";
        try {
          await resolveAgentAction(actionId, approved, approvedBy);
          if (chatId) await sendMessage(chatId, `${approved ? "Approved" : "Rejected"} action ${actionId.slice(0, 8)}...`);
        } catch (err) {
          console.error("[telegram] resolveAgentAction failed:", err);
        }
      }

      return NextResponse.json({ ok: true });
    }

    const msg = body.message;
    if (!msg?.text || !msg.chat?.id) return NextResponse.json({ ok: true });

    await handleCommand(msg.chat.id, msg.text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── GET: webhook registration ────────────────────────────────────────────

export async function GET(req: Request) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "set") {
    const baseUrl = req.headers.get("host") || "";
    const protocol = baseUrl.includes("localhost") ? "http" : "https";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${baseUrl}`;
    const webhookUrl = `${siteUrl}/prospecting-os/api/agent/telegram`;

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
    );
    const data = await res.json();
    return NextResponse.json({ webhookUrl, result: data });
  }

  if (action === "setup") {
    // Auto-set bot commands in Telegram menu
    const commands = [
      { command: "stats", description: "Pipeline overview & stats" },
      { command: "leads", description: "Latest hot leads" },
      { command: "agents", description: "Agent workforce status" },
      { command: "pipeline", description: "Kanban distribution" },
      { command: "bookings", description: "Upcoming appointments" },
      { command: "clients", description: "Active client list" },
      { command: "help", description: "Show all commands" },
    ];
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
    const d = await r.json();
    return NextResponse.json({ commands, result: d });
  }

  return NextResponse.json({
    usage: "POST: receive webhook | GET ?action=set: register webhook | GET ?action=setup: set bot commands",
  });
}
