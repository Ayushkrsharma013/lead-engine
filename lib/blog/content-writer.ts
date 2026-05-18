// lib/blog/content-writer.ts
// Gemini-powered blog post generation with voice profile injection

import { supabaseAdmin } from '@/lib/supabase';

function buildStyleBlock(guide: Record<string, unknown>): string {
  const s = guide.sentence_profile as Record<string, string> | undefined;
  const h = guide.hooks as Record<string, string> | undefined;
  const t = guide.tone as Record<string, string> | undefined;
  const f = guide.formatting as Record<string, string> | undefined;
  const transitions = (guide.transitions as string[]) || [];
  const anti = (guide.anti_patterns as string[]) || [];

  return `## YOUR WRITING VOICE

You write exactly like this voice profile:
- Sentence rhythm: ${s?.rule || 'Mix short and long sentences'}
- Hook pattern: ${h?.primary || 'Lead with a bold claim then back it up'}
- Baseline tone: ${t?.baseline || 'Confident but not arrogant'}
- Persona: ${t?.persona || 'Senior operator who has done the work'}
- Humor: ${t?.humor || 'Dry, sparing — once per ~400 words'}
- Paragraphs: ${f?.paragraph_density || '3-5 sentences each'}
- Bullets: ${f?.bullets || 'Use for lists of 3+ items only'}
- Bold: ${f?.bold_usage || 'Key numbers and conclusions only'}

Transitions to use: ${transitions.join(', ') || 'Here is why that matters, The reality is, What most people miss'}
CTA style: ${guide.cta_style || 'Single clear action, no urgency manipulation'}

NEVER do this:
${anti.map(a => `- ${a}`).join('\n')}
- Never use emojis in body text
- Never start with "In today's digital landscape..."
- Never use the word "unlock" as a verb`;
}

export async function generateBlogPost(
  keyword: string,
  category: string
): Promise<{
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  keywords: string[];
  read_time: number;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { data: profile } = await supabaseAdmin
    .from('voice_profiles')
    .select('extracted_guide')
    .eq('is_active', true)
    .maybeSingle();

  const styleBlock = profile?.extracted_guide
    ? buildStyleBlock(profile.extracted_guide as Record<string, unknown>)
    : 'Write in a confident, direct B2B SaaS voice. No fluff. No emojis.';

  const { data: existingPosts } = await supabaseAdmin
    .from('blog_posts')
    .select('title, slug, category')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(10);

  const existingContext = (existingPosts || [])
    .map((p: { title: string; slug: string }) => `- "${p.title}" (/blog/${p.slug})`)
    .join('\n');

  const prompt = `You are a B2B SaaS content writer for Prospecting OS — an AI-powered B2B lead generation platform.

## ASSIGNMENT
Write a blog post targeting the keyword: "${keyword}"
Category: ${category}
Target length: 800-1500 words

${styleBlock}

## EXISTING POSTS (for internal linking context)
${existingContext || 'No existing posts yet — this is the first one.'}

## CONTENT RULES
- SEO-optimized but reads naturally — write for humans first
- Include the target keyword in H1, first paragraph, and one H2
- Link to at least one free tool: Icebreaker Generator (/tools/icebreaker-generator), Pipeline Audit (/tools/free-audit), or ROI Calculator (#roi)
- End with a CTA: "Get 5 free AI-scored leads" linking to the email capture section
- Cross-link 1-2 related existing posts if relevant

## RESPONSE FORMAT
Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "SEO-optimized headline (50-65 chars)",
  "subtitle": "Compelling subhead (80-120 chars)",
  "slug": "url-friendly-slug",
  "excerpt": "1-2 sentence preview for listing cards (120-160 chars)",
  "content": "Full markdown body with H2/H3 headings, proper paragraphs, inline links to tools and other posts",
  "category": "${category}",
  "keywords": ["${keyword}", "other-relevant-keyword"],
  "read_time": N
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 3000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  const rawText = (parts?.find((p: any) => !p.thought) ?? parts?.[0])?.text ?? '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse blog post JSON from Gemini');
  return JSON.parse(jsonMatch[0]);
}

export function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
