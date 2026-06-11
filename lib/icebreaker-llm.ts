/**
 * Multi-model icebreaker generation with sequential fallback.
 *
 * Chain: Gemini 2.5 Flash → DeepSeek Chat → Claude Haiku 4.5 → Template
 * Each step has a 12s timeout. On failure, logs a warning and tries the next.
 * Returns { text, model } so callers can track which model was used.
 */

export interface IcebreakerOutput {
  text: string;
  model: string;
}

interface ModelConfig {
  name: string;
  getUrl: () => string | null;
  getHeaders: () => Record<string, string>;
  body: (prompt: string) => object;
  parse: (data: unknown) => string | null;
  enabled: () => boolean;
}

const TIMEOUT_MS = 12_000;

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

// ─── Model definitions ──────────────────────────────────────────────────────────

const models: ModelConfig[] = [
  // 1. Gemini 2.5 Flash
  {
    name: "gemini-2.5-flash",
    getUrl: () => {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return null;
      return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    },
    getHeaders: () => ({ "Content-Type": "application/json" }),
    body: (prompt) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.9, topP: 0.95 },
    }),
    parse: (data) => {
      const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    },
    enabled: () => !!process.env.GEMINI_API_KEY,
  },

  // 2. DeepSeek Chat
  {
    name: "deepseek-chat",
    getUrl: () => "https://api.deepseek.com/v1/chat/completions",
    getHeaders: () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ""}`,
    }),
    body: (prompt) => ({
      model: "deepseek-chat",
      max_tokens: 300,
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    }),
    parse: (data) => {
      const d = data as { choices?: Array<{ message?: { content?: string } }> };
      return d.choices?.[0]?.message?.content?.trim() || null;
    },
    enabled: () => !!process.env.DEEPSEEK_API_KEY,
  },

  // 3. Claude Haiku 4.5
  {
    name: "claude-haiku-4.5",
    getUrl: () => "https://api.anthropic.com/v1/messages",
    getHeaders: () => ({
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    }),
    body: (prompt) => ({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
    parse: (data) => {
      const d = data as { content?: Array<{ type: string; text: string }> };
      return d.content?.[0]?.text?.trim() || null;
    },
    enabled: () => !!process.env.ANTHROPIC_API_KEY,
  },
];

// ─── Template fallback (no API needed) ──────────────────────────────────────────

function templateIcebreaker(lead: {
  name: string;
  title: string;
  company: string;
  industry?: string;
}): string {
  const industry = lead.industry || "your space";
  const templates = [
    `Noticed ${lead.name} leads ${lead.title} at ${lead.company} — curious how you're approaching growth in ${industry} this quarter.`,
    `${lead.name}, your work as ${lead.title} at ${lead.company} caught my eye — would love to hear your take on the biggest challenge facing ${industry} teams right now.`,
    `Impressed by ${lead.company}'s recent moves in ${industry}, ${lead.name}. As ${lead.title}, what's been your top priority lately?`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ─── Main function ──────────────────────────────────────────────────────────────

export async function generateIcebreaker(
  prompt: string,
  leadInfo: { name: string; title: string; company: string; industry?: string }
): Promise<IcebreakerOutput> {
  for (const model of models) {
    if (!model.enabled()) {
      console.log(`[icebreaker-llm] ${model.name} skipped — no API key configured`);
      continue;
    }

    try {
      const url = model.getUrl();
      if (!url) continue;

      const res = await fetch(url, {
        method: "POST",
        headers: model.getHeaders(),
        body: JSON.stringify(model.body(prompt)),
        signal: timeoutSignal(TIMEOUT_MS),
      });

      if (!res.ok) {
        console.warn(`[icebreaker-llm] ${model.name} returned ${res.status} — trying next model`);
        continue;
      }

      const data = await res.json();
      const text = model.parse(data);

      if (text && text.length > 10) {
        console.log(`[icebreaker-llm] ✅ ${model.name} succeeded`);
        return { text, model: model.name };
      }

      console.warn(`[icebreaker-llm] ${model.name} returned empty/short response — trying next model`);
    } catch (err) {
      console.warn(`[icebreaker-llm] ${model.name} error — trying next model:`, (err as Error).message);
    }
  }

  // Last resort — template
  console.warn("[icebreaker-llm] ⚠️ All models failed — using template fallback");
  return {
    text: templateIcebreaker(leadInfo),
    model: "template-fallback",
  };
}

/**
 * Generate multiple icebreakers for a single lead.
 * Uses the same fallback chain per icebreaker.
 */
export async function generateMultipleIcebreakers(
  lead: { id: string; name: string; title: string; company: string; industry?: string },
  count: number = 5
): Promise<{ leadId: string; leadName: string; company: string; icebreakers: string[] }> {
  const prompt = `You are an expert B2B outreach specialist. Write ${count} short, personalized icebreaker opening lines for a LinkedIn DM. Each line must be 1-2 sentences, reference something specific about the prospect, and avoid generic flattery.

PROSPECT:
- Name: ${lead.name}
- Title: ${lead.title}
- Company: ${lead.company}
- Industry: ${lead.industry || "Not specified"}

Return exactly ${count} icebreakers, one per line, numbered 1-${count}. No introductions, no explanations.`;

  const result = await generateIcebreaker(prompt, lead);

  // Parse numbered lines
  const lines = result.text
    .split("\n")
    .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
    .filter((l) => l.length > 10);

  // If fallback gave us one line, pad it
  const finalLines = lines.length >= count
    ? lines.slice(0, count)
    : [...lines, ...Array.from({ length: count - lines.length }, (_, i) =>
        templateIcebreaker(lead)
      )];

  return {
    leadId: lead.id,
    leadName: lead.name,
    company: lead.company,
    icebreakers: finalLines,
  };
}

/**
 * Generate a single icebreaker — simpler interface used by lead generation.
 */
export async function generateOneIcebreaker(
  lead: { name: string; title: string; company: string; industry?: string }
): Promise<IcebreakerOutput> {
  const prompt = `You are an expert B2B outreach specialist. Write ONE short, personalized icebreaker opening line for a LinkedIn DM (1-2 sentences max). Reference something specific about the prospect's role or company. No generic flattery.

PROSPECT:
- Name: ${lead.name}
- Title: ${lead.title}
- Company: ${lead.company}
- Industry: ${lead.industry || "Not specified"}

Return ONLY the icebreaker text. No numbering, no introduction, no explanation.`;

  return generateIcebreaker(prompt, lead);
}
