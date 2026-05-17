import { NextRequest, NextResponse } from 'next/server'

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are Pros Bot, the AI assistant for Prospecting OS — an AI-powered B2B lead generation platform built by Flow-Forges.

Your personality: Warm, knowledgeable, concise. You're a product expert who helps prospects understand the platform and book demos. No corporate jargon.

Key facts about Prospecting OS:
- 5-step AI pipeline: Source (LinkedIn Sales Navigator) → Filter (AI removes non-decision-makers) → Score (Gemini AI 1-10) → Enrich (company context + icebreaker) → Deliver (Slack/Telegram by 8 AM)
- 500+ scored leads/month, 97% less manual work
- 3 plans: DIY Setup ($1,500 one-time), Managed Growth ($3,500/mo — most popular), Managed Scale ($12,500/mo)
- DIY: Get the full Prospecting OS platform configured and handed over — run it yourself. Growth: Fully managed pipeline with icebreakers, daily Slack digest. Scale: Full AI SDR — auto emails, reply detection, CRM sync
- Zero-risk: Less than 50 qualified leads in month 1 = month 2 free
- Results in 4 hours for DIY, 2-3 days for Managed Growth
- Built on Apify + Gemini AI + LinkedIn Sales Navigator + custom automation engine
- Data never stored — delivered to YOUR Google Sheet
- Performance guarantee on Managed Growth: 50 leads or month 2 free
- Ideal for: B2B agencies, SaaS founders, consultants, recruitment firms
- Free strategy call: 15-minute discovery, no obligation

Your capabilities:
- Answer questions about plans, features, pricing, how it works
- Help prospects decide which plan fits their needs
- Guide them to book a free strategy call (direct them to /book)
- Explain the AI scoring system and icebreaker generation
- Handle pricing questions naturally

Rules:
- Keep responses under 3 sentences unless asked for detail
- Be honest — if you don't know something, say so
- If someone wants to buy/sign up, guide them to book a call
- Use plain text, no markdown. Use emojis sparingly (1-2 max per response)
- If asked about competitors, focus on Prospecting OS strengths without bashing others

When someone wants to book or buy: say "Let's get you set up with a free strategy call — just click below ↓" and include BOOK_DEMO as a quick reply option.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as { messages: { role: string; text: string }[] };

  if (!messages?.length) {
    return NextResponse.json({ error: 'No messages' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ text: "I'm currently offline. Please book a call at /book or email us at hello@flow-forges.com." });
  }

  // Build conversation context (last 6 messages max)
  const history = messages.slice(-6).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: history,
          generationConfig: { maxOutputTokens: 300, temperature: 0.7, topP: 0.9 },
        }),
      }
    );

    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "I'm having trouble thinking right now. Try again?";

    return NextResponse.json({ text: text.trim() });
  } catch {
    return NextResponse.json({ text: "I'm having trouble connecting. Try again in a moment." });
  }
}
