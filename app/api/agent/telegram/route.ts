import { NextResponse } from "next/server";
import { resolveAgentAction } from "@/lib/agents/resolver";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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
            text: `You are the ProOS Agent — an AI living inside LinkedIn ProOS, a B2B prospecting platform. You have full control over the platform: analyze leads, check pipeline, suggest actions, score leads, generate messages. Be concise, direct, and helpful. You're chatting via Telegram. Respond in 1-3 sentences.`,
          }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    },
  );

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I didn't get that. Try again?";
}

async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

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
        message?: { message_id?: number };
      };
    };

    // ── Handle inline keyboard callback (agent approve/reject) ──────────────
    if (body.callback_query) {
      const cb = body.callback_query;
      const match = cb.data.match(/^(approve_agent|reject_agent):(.+)$/);

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id }),
      });

      if (match) {
        const approved = match[1] === "approve_agent";
        const actionId = match[2];
        const approvedBy = cb.from.username ?? cb.from.first_name ?? "telegram-user";
        try {
          await resolveAgentAction(actionId, approved, approvedBy);
        } catch (err) {
          console.error("[telegram] resolveAgentAction failed:", err);
        }
      }

      return NextResponse.json({ ok: true });
    }

    const msg = body.message;
    if (!msg?.text) {
      return NextResponse.json({ ok: true });
    }

    const reply = await callGemini(msg.text);

    if (msg.chat?.id) {
      await sendTelegramMessage(msg.chat.id, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: used to set the webhook URL
export async function GET(req: Request) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "set") {
    const baseUrl = req.headers.get("host") || "";
    const protocol = baseUrl.includes("localhost") ? "http" : "https";
    // Use NEXT_PUBLIC_SITE_URL for production, fallback to host header
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${baseUrl}`;
    const webhookUrl = `${siteUrl}/prospecting-os/api/agent/telegram`;

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
    );
    const data = await res.json();
    return NextResponse.json({ webhookUrl, result: data });
  }

  return NextResponse.json({
    usage: "POST: receive webhook | GET ?action=set: register webhook",
  });
}
