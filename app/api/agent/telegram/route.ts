import { NextResponse } from "next/server";

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
    };

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
    const webhookUrl = `${protocol}://${baseUrl}/api/agent/telegram`;

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
