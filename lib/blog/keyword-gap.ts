// lib/blog/keyword-gap.ts
// Gemini-powered keyword gap analysis for blog content strategy

import { supabaseAdmin } from '@/lib/supabase';

export async function runKeywordGapAnalysis(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { data: existing } = await supabaseAdmin
    .from('blog_keywords')
    .select('keyword');

  const existingList = (existing || []).map((k: { keyword: string }) => k.keyword.toLowerCase());

  const prompt = `You are a B2B SaaS SEO strategist. The blog is about:
- AI-powered B2B lead generation
- LinkedIn prospecting and sales automation
- Email outreach and sequence design
- ICP scoring and lead qualification
- Running a lead generation agency

Target audience: B2B sales leaders AND agency owners who resell lead gen services.

List 25 high-intent, long-tail keywords we should target. For each, give:
- keyword (the search term)
- category: "lead-gen", "outbound", "ai-sales", or "agency"
- volume_estimate (rough monthly searches, integer)
- difficulty: "low", "medium", or "high"

Existing keywords to AVOID: ${existingList.join(', ') || 'none yet'}

Return ONLY valid JSON array (no markdown, no backticks):
[{"keyword": "...", "category": "...", "volume_estimate": N, "difficulty": "..."}, ...]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  const rawText = (parts?.find((p: any) => !p.thought) ?? parts?.[0])?.text ?? '';
  const arrMatch = rawText.match(/\[[\s\S]*\]/);
  if (!arrMatch) throw new Error('Failed to parse keywords JSON');
  const keywords = JSON.parse(arrMatch[0]);

  for (const kw of keywords) {
    await supabaseAdmin.from('blog_keywords').upsert(
      {
        keyword: kw.keyword,
        category: kw.category,
        volume_estimate: kw.volume_estimate,
        difficulty: kw.difficulty,
      },
      { onConflict: 'keyword' }
    );
  }

  return keywords.map((k: { keyword: string }) => k.keyword);
}

export async function pickBestKeyword(): Promise<{
  keyword: string;
  category: string;
  difficulty: string;
} | null> {
  const { data } = await supabaseAdmin
    .from('blog_keywords')
    .select('*')
    .order('posts_count', { ascending: true })
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(1);

  if (!data || data.length === 0) return null;
  return data[0] as { keyword: string; category: string; difficulty: string };
}
