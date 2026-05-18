# Autonomous Blog Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully automated, voice-trained blog engine at `/prospecting-os/blog` with Gemini-powered daily content generation, extracted tone-of-voice profiles, and public SEO-optimized pages.

**Architecture:** Vercel Cron at 3 AM UTC triggers a 4-step pipeline (keyword gap → content strategist → content writer → publisher) all driven by Gemini 2.5 Flash with voice profiles injected. Public SSR pages with ISR (60s). Admin UI at `/admin/blog` for voice profile management and manual generation.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (tbsqpnqzpbnilifhwvgr), Gemini 2.5 Flash, Tailwind CSS + CSS variables, Lucide React, Framer Motion, Resend (notify)

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260518_blog_engine.sql`

- [ ] **Step 1: Apply migration via Supabase MCP**

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  excerpt TEXT,
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('lead-gen','outbound','ai-sales','agency')) NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  voice_profile_id UUID,
  read_time INTEGER DEFAULT 5,
  status TEXT CHECK (status IN ('draft','published')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  extracted_guide JSONB,
  sample_texts TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT UNIQUE NOT NULL,
  category TEXT,
  volume_estimate INTEGER DEFAULT 0,
  difficulty TEXT CHECK (difficulty IN ('low','medium','high')) DEFAULT 'medium',
  posts_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for blog_posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published posts" ON blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Super admin full access blog_posts" ON blog_posts USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

-- RLS for voice_profiles (admin only)
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin full access voice_profiles" ON voice_profiles USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

-- RLS for blog_keywords (admin only)
ALTER TABLE blog_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin full access blog_keywords" ON blog_keywords USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);
```

Use: `mcp__plugin_supabase_supabase__apply_migration` with `project_id: "tbsqpnqzpbnilifhwvgr"`

- [ ] **Step 2: Save migration file locally**

```bash
Write the above SQL to supabase/migrations/20260518_blog_engine.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260518_blog_engine.sql
git commit -m "feat: add blog engine database tables — blog_posts, voice_profiles, blog_keywords"
```

---

### Task 2: Add Blog Types to lib/types.ts

**Files:**
- Modify: `lib/types.ts` (append to end of file)

- [ ] **Step 1: Add type interfaces**

Append to `lib/types.ts`:

```typescript
// ─── Blog Engine ───────────────────────────────────────────────

export type BlogCategory = 'lead-gen' | 'outbound' | 'ai-sales' | 'agency';
export type BlogPostStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  content: string;
  category: BlogCategory;
  keywords: string[];
  voice_profile_id: string | null;
  read_time: number;
  status: BlogPostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  extracted_guide: Record<string, unknown> | null;
  sample_texts: string[];
  is_active: boolean;
  extracted_at: string | null;
  created_at: string;
}

export interface BlogKeyword {
  id: string;
  keyword: string;
  category: string | null;
  volume_estimate: number;
  difficulty: 'low' | 'medium' | 'high';
  posts_count: number;
  last_used_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add BlogPost, VoiceProfile, BlogKeyword types"
```

---

### Task 3: Voice Profile Extractor

**Files:**
- Create: `lib/blog/voice-extractor.ts`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p lib/blog
```

- [ ] **Step 2: Write voice-extractor.ts**

```typescript
// lib/blog/voice-extractor.ts
// Gemini-powered voice profile extraction from writing samples

export async function extractVoiceProfile(
  samples: string[],
  profileName: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const prompt = `You are a writing style analyst. Analyze these ${samples.length} writing samples and extract a structured voice profile.

## Writing Samples
${samples.map((s, i) => `### Sample ${i + 1}\n${s}`).join('\n\n')}

## Instructions
Return ONLY valid JSON (no markdown, no backticks). Identify:

1. **sentence_profile**: avg word count range, rhythm style, a concrete rule for the writer to follow
2. **hooks**: primary hook pattern, what to avoid, an example hook in the writer's style
3. **tone**: baseline tone (confident/direct/warm/etc), humor style and frequency, persona description
4. **formatting**: paragraph density, bullet usage rules, bold/emphasis rules
5. **transitions**: 5-8 words or phrases this writer uses to connect ideas
6. **cta_style**: how the writer frames calls-to-action
7. **anti_patterns**: 3-5 things this writer should never do (clichés, specific phrases, emoji rules)

JSON shape:
{
  "voice_name": "${profileName}",
  "sentence_profile": { "avg_length": "...", "style": "...", "rule": "..." },
  "hooks": { "primary": "...", "avoid": "...", "example": "..." },
  "tone": { "baseline": "...", "humor": "...", "persona": "..." },
  "formatting": { "paragraph_density": "...", "bullets": "...", "bold_usage": "..." },
  "transitions": ["...", "..."],
  "cta_style": "...",
  "anti_patterns": ["...", "..."]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  const rawText = (parts?.find((p: any) => !p.thought) ?? parts?.[0])?.text ?? '';

  // Extract JSON from response (strip markdown code fences if present)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse voice profile JSON from Gemini response');
  return JSON.parse(jsonMatch[0]);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/blog/voice-extractor.ts
git commit -m "feat: add voice profile extractor — Gemini analyzes writing samples"
```

---

### Task 4: Keyword Gap Analyzer

**Files:**
- Create: `lib/blog/keyword-gap.ts`

- [ ] **Step 1: Write keyword-gap.ts**

```typescript
// lib/blog/keyword-gap.ts
// Gemini-powered keyword gap analysis for blog content strategy

import { supabaseAdmin } from '@/lib/supabase';

export async function runKeywordGapAnalysis(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // Get existing keywords to avoid duplicates
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

  // Insert into blog_keywords
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
  // Prefer uncovered, low-difficulty keywords not used recently
  const { data } = await supabaseAdmin
    .from('blog_keywords')
    .select('*')
    .order('posts_count', { ascending: true })
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(1);

  if (!data || data.length === 0) return null;
  return data[0] as { keyword: string; category: string; difficulty: string };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/blog/keyword-gap.ts
git commit -m "feat: add keyword gap analyzer — Gemini SEO keyword research"
```

---

### Task 5: Content Writer

**Files:**
- Create: `lib/blog/content-writer.ts`

- [ ] **Step 1: Write content-writer.ts**

```typescript
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

  // Get active voice profile
  const { data: profile } = await supabaseAdmin
    .from('voice_profiles')
    .select('extracted_guide')
    .eq('is_active', true)
    .maybeSingle();

  const styleBlock = profile?.extracted_guide
    ? buildStyleBlock(profile.extracted_guide as Record<string, unknown>)
    : 'Write in a confident, direct B2B SaaS voice. No fluff. No emojis.';

  // Get existing posts for context
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
- End with a CTA: "Get 5 free AI-scored leads →" linking to the email capture section
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/blog/content-writer.ts
git commit -m "feat: add content writer — Gemini blog post generation with voice profile"
```

---

### Task 6: Blog List + Create API

**Files:**
- Create: `app/api/blog/route.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p app/api/blog
```

- [ ] **Step 2: Write route.ts**

```typescript
// app/api/blog/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { captureError } from '@/lib/error-tracking';
import { estimateReadTime } from '@/lib/blog/content-writer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    let query = supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ posts: data });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const slug = body.slug || body.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const read_time = body.read_time || estimateReadTime(body.content || '');

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug,
        title: body.title,
        subtitle: body.subtitle || null,
        excerpt: body.excerpt || null,
        content: body.content,
        category: body.category || 'lead-gen',
        keywords: body.keywords || [],
        read_time,
        status: body.status || 'draft',
        published_at: body.status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/blog/route.ts
git commit -m "feat: add blog list + create API endpoint"
```

---

### Task 7: Single Post API

**Files:**
- Create: `app/api/blog/[slug]/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "app/api/blog/[slug]"
```

- [ ] **Step 2: Write route.ts**

```typescript
// app/api/blog/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { captureError } from '@/lib/error-tracking';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ post: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (body.status === 'published' && !body.published_at) {
      body.published_at = new Date().toISOString();
    }
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .update(body)
      .eq('slug', params.slug)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('blog_posts')
    .delete()
    .eq('slug', params.slug);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/blog/[slug]/route.ts"
git commit -m "feat: add single blog post API — GET/PATCH/DELETE by slug"
```

---

### Task 8: Blog Generate API

**Files:**
- Create: `app/api/blog/generate/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p app/api/blog/generate
```

- [ ] **Step 2: Write route.ts**

```typescript
// app/api/blog/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateBlogPost } from '@/lib/blog/content-writer';
import { pickBestKeyword } from '@/lib/blog/keyword-gap';
import { captureError } from '@/lib/error-tracking';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const keyword = body.keyword || (await pickBestKeyword());

    if (!keyword) {
      return NextResponse.json(
        { error: 'No keywords available. Run keyword gap analysis first.' },
        { status: 400 }
      );
    }

    const post = await generateBlogPost(
      typeof keyword === 'string' ? keyword : keyword.keyword,
      body.category || (typeof keyword === 'object' ? keyword.category : 'lead-gen')
    );

    // Publish immediately
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug: post.slug,
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        keywords: post.keywords,
        read_time: post.read_time,
        status: body.draft ? 'draft' : 'published',
        published_at: body.draft ? null : new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update keyword stats
    const kw = typeof keyword === 'string' ? keyword : keyword.keyword;
    const { data: kwData } = await supabaseAdmin.from('blog_keywords').select('posts_count').eq('keyword', kw).single();
    await supabaseAdmin
      .from('blog_keywords')
      .update({ posts_count: (kwData?.posts_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq('keyword', kw);

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/blog/generate/route.ts
git commit -m "feat: add blog generate API — manual trigger for post generation"
```

---

### Task 9: Voice Profile API

**Files:**
- Create: `app/api/blog/voice/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p app/api/blog/voice
```

- [ ] **Step 2: Write route.ts**

```typescript
// app/api/blog/voice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { extractVoiceProfile } from '@/lib/blog/voice-extractor';
import { captureError } from '@/lib/error-tracking';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('voice_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  return NextResponse.json({ profiles: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { samples, name } = await req.json();
    if (!samples || !Array.isArray(samples) || samples.length < 2) {
      return NextResponse.json({ error: 'At least 2 writing samples required' }, { status: 400 });
    }

    const guide = await extractVoiceProfile(samples, name || 'Default');

    // Deactivate existing profiles
    await supabaseAdmin
      .from('voice_profiles')
      .update({ is_active: false })
      .eq('is_active', true);

    // Create new active profile
    const { data, error } = await supabaseAdmin
      .from('voice_profiles')
      .insert({
        name: name || 'Default',
        extracted_guide: guide,
        sample_texts: samples,
        is_active: true,
        extracted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Voice extraction failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/blog/voice/route.ts
git commit -m "feat: add voice profile API — extract and manage writing voice profiles"
```

---

### Task 10: Cron — Daily Blog Writer

**Files:**
- Create: `app/api/cron/blog-writer/route.ts`

- [ ] **Step 1: Write route.ts**

```typescript
// app/api/cron/blog-writer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateBlogPost } from '@/lib/blog/content-writer';
import { pickBestKeyword, runKeywordGapAnalysis } from '@/lib/blog/keyword-gap';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if we have keywords
    const { count } = await supabaseAdmin
      .from('blog_keywords')
      .select('*', { count: 'exact', head: true });

    if ((count || 0) === 0) {
      await runKeywordGapAnalysis();
    }

    // Check for active voice profile
    const { data: profile } = await supabaseAdmin
      .from('voice_profiles')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({
        error: 'No active voice profile. Set one up at /admin/blog/voice',
      }, { status: 400 });
    }

    // Pick best keyword
    const kw = await pickBestKeyword();
    if (!kw) {
      return NextResponse.json({ message: 'No uncovered keywords available' });
    }

    // Generate post
    const post = await generateBlogPost(kw.keyword, kw.category);

    // Publish
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug: post.slug,
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        keywords: post.keywords,
        voice_profile_id: profile.id,
        read_time: post.read_time,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update keyword usage
    const { data: kwData } = await supabaseAdmin.from('blog_keywords').select('posts_count').eq('keyword', kw.keyword).single();
    await supabaseAdmin
      .from('blog_keywords')
      .update({
        posts_count: (kwData?.posts_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('keyword', kw.keyword);

    // Notify
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `<b>New Blog Post Published</b>\n\n<b>Title:</b> ${post.title}\n<b>Keyword:</b> ${kw.keyword}\n<b>URL:</b> /blog/${post.slug}`,
          parse_mode: 'HTML',
        }),
      }
    ).catch(() => {});

    return NextResponse.json({
      published: true,
      title: post.title,
      slug: post.slug,
      keyword: kw.keyword,
    });
  } catch (e) {
    console.error('[blog-writer] Error:', e);
    return NextResponse.json({ error: 'Blog writer failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/blog-writer/route.ts
git commit -m "feat: add daily blog writer cron — keyword gap → generate → publish"
```

---

### Task 11: Public Blog Listing Page

**Files:**
- Create: `app/blog/page.tsx`

- [ ] **Step 1: Write page.tsx**

This is a Server Component with ISR. Uses the marketing shell (same as landing page).

```typescript
// app/blog/page.tsx
import Link from 'next/link';
import type { BlogPost } from '@/lib/types';

export const revalidate = 60;

async function fetchPosts(category?: string): Promise<BlogPost[]> {
  try {
    const url = category && category !== 'all'
      ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.flow-forges.com'}/prospecting-os/api/blog?category=${category}&limit=20`
      : `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.flow-forges.com'}/prospecting-os/api/blog?limit=20`;

    const res = await fetch(url, { next: { revalidate: 60 } });
    const data = await res.json();
    return data.posts || [];
  } catch {
    return [];
  }
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'lead-gen', label: 'Lead Gen' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'ai-sales', label: 'AI & Sales' },
  { key: 'agency', label: 'Agency' },
] as const;

const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'lead-gen':  { color: 'var(--accent-blue)', bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.15)' },
  'outbound':  { color: 'var(--accent-purple)', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.15)' },
  'ai-sales':  { color: 'var(--accent-green)', bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.15)' },
  'agency':    { color: 'var(--accent-orange)', bg: 'rgba(255,107,53,0.08)', border: 'rgba(255,107,53,0.15)' },
};

export default async function BlogPage({ searchParams }: { searchParams: { category?: string } }) {
  const activeCategory = searchParams.category || 'all';
  const posts = await fetchPosts(activeCategory);

  return (
    <div className="min-h-screen bg-bg landing-page">
      {/* Nav */}
      <nav className="nav" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(6,6,8,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" width={24} height={24} style={{ borderRadius: 6 }} />
            Prospecting <span style={{ color: 'var(--accent)' }}>OS</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/tools/free-audit" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>Free Audit</Link>
            <Link href="/tools/icebreaker-generator" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>Icebreaker</Link>
            <Link href="/book" style={{ padding: '6px 16px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Book a Demo</Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            B2B Lead Generation Insights
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, maxWidth: 560, margin: '8px auto 0' }}>
            Strategies, tools, and real-world tactics for AI-powered prospecting — from pipeline math to agency scaling.
          </p>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 40, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <Link
              key={c.key}
              href={c.key === 'all' ? '/blog' : `/blog?category=${c.key}`}
              style={{
                padding: '6px 16px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: activeCategory === c.key ? 600 : 500,
                color: activeCategory === c.key ? 'var(--accent)' : 'var(--muted)',
                background: activeCategory === c.key ? 'rgba(232,168,64,0.10)' : 'transparent',
                border: activeCategory === c.key ? '1px solid rgba(232,168,64,0.20)' : '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'all 150ms ease',
              }}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* Posts grid */}
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <p style={{ fontSize: 14 }}>No posts yet. Check back soon.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {posts.map((post, i) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <article
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 24,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,168,64,0.2)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <span
                    style={{
                      ...(CATEGORY_STYLE[post.category] || CATEGORY_STYLE['lead-gen']),
                      fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 9999,
                      width: 'fit-content', marginBottom: 12,
                    }}
                  >
                    {CATEGORIES.find(c => c.key === post.category)?.label || post.category}
                  </span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.3 }}>
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, flex: 1, margin: 0 }}>
                      {post.excerpt}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, fontSize: 11, color: 'var(--muted)' }}>
                    <span>{post.read_time} min read</span>
                    {post.published_at && (
                      <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* Email CTA */}
        <div style={{ textAlign: 'center', marginTop: 60, padding: '40px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Get 5 free AI-scored leads</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>Enter your email + industry and we will send you a sample report — real leads, real scores.</p>
          <Link href="/#sample" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Get Free Leads
          </Link>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/blog/page.tsx
git commit -m "feat: add public blog listing page with category filters and ISR"
```

---

### Task 12: Public Blog Post Page

**Files:**
- Create: `app/blog/[slug]/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "app/blog/[slug]"
```

- [ ] **Step 2: Write page.tsx**

```typescript
// app/blog/[slug]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BlogPost } from '@/lib/types';
import type { Metadata } from 'next';

export const revalidate = 60;

async function fetchPost(slug: string): Promise<BlogPost | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.flow-forges.com'}/prospecting-os/api/blog/${slug}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.post || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: 'Post Not Found' };
  return {
    title: `${post.title} — Prospecting OS Blog`,
    description: post.excerpt || post.subtitle || '',
    openGraph: {
      title: post.title,
      description: post.excerpt || post.subtitle || '',
      type: 'article',
      publishedTime: post.published_at || undefined,
    },
  };
}

function renderContent(content: string): string {
  // Simple markdown → HTML conversion for blog rendering
  return content
    // Headings
    .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:700;color:var(--text);margin:28px 0 10px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:700;color:var(--text);margin:32px 0 12px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:26px;font-weight:800;color:var(--text);margin:36px 0 14px;">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text);">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent);text-decoration:underline;">$1</a>')
    // Paragraphs (double newlines)
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<ol')) return block;
      return `<p style="font-size:14px;line-height:1.75;color:var(--text);margin:0 0 16px;">${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-bg landing-page">
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(6,6,8,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/blog" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>
            ← Back to Blog
          </Link>
          <Link href="/book" style={{ padding: '6px 16px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Book a Demo</Link>
        </div>
      </nav>

      <article style={{ maxWidth: 720, margin: '0 auto', padding: '100px 24px 80px' }}>
        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
            color: 'var(--accent)', background: 'rgba(232,168,64,0.10)', border: '1px solid rgba(232,168,64,0.15)',
          }}>
            {post.category}
          </span>
          <span>{post.read_time} min read</span>
          {post.published_at && (
            <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 }}>
          {post.title}
        </h1>
        {post.subtitle && (
          <p style={{ fontSize: 15, color: 'var(--muted)', margin: '0 0 32px', lineHeight: 1.5 }}>{post.subtitle}</p>
        )}

        {/* Content */}
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          style={{ maxWidth: '100%', overflow: 'hidden' }}
        />

        {/* Bottom CTA */}
        <div style={{ marginTop: 48, padding: '32px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Ready to fill your pipeline?</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>Get 5 free AI-scored leads sent to your inbox — no credit card, no setup.</p>
          <Link href="/#sample" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Get Free Leads
          </Link>
        </div>

        {/* Back + Tools */}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/blog" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            ← All Posts
          </Link>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/tools/icebreaker-generator" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none' }}>Icebreaker Generator</Link>
            <Link href="/tools/free-audit" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none' }}>Pipeline Audit</Link>
          </div>
        </div>
      </article>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/blog/[slug]/page.tsx"
git commit -m "feat: add public blog post page — SSR with markdown rendering and ISR"
```

---

### Task 13: Admin Blog Dashboard

**Files:**
- Create: `app/admin/blog/page.tsx`

- [ ] **Step 1: Write page.tsx**

This is a `'use client'` page using the full admin shell. Fetches data from API routes.

```typescript
// app/admin/blog/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText, Plus, Sparkles, Loader2, Trash2,
  ExternalLink, Mic, ArrowRight, Eye,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import type { BlogPost, VoiceProfile } from "@/lib/types";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [postsRes, voiceRes] = await Promise.all([
        fetch("/prospecting-os/api/blog?limit=50"),
        fetch("/prospecting-os/api/blog/voice"),
      ]);
      const postsData = await postsRes.json();
      const voiceData = await voiceRes.json();
      setPosts(postsData.posts || []);
      setProfiles(voiceData.profiles || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/prospecting-os/api/blog/generate", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToast(`Generated: ${data.post.title}`);
      setTimeout(() => setToast(""), 4000);
      await fetchData();
    } catch (e) {
      setToast(`Error: ${String(e)}`);
    }
    setGenerating(false);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm("Delete this post?")) return;
    await fetch(`/prospecting-os/api/blog/${slug}`, { method: "DELETE" });
    setPosts(prev => prev.filter(p => p.slug !== slug));
  };

  const activeProfile = profiles.find(p => p.is_active);
  const publishedCount = posts.filter(p => p.status === 'published').length;

  return (
    <>
      <TopBar title="Blog Dashboard" subtitle="Autonomous blog engine management" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2.5 rounded-lg text-[12px] font-medium"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {toast}
          </motion.div>
        )}

        {/* Voice Profile Card */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mic size={14} style={{ color: "var(--accent-purple)" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Voice Profile</h3>
            </div>
            <Link href="/admin/blog/voice" className="text-[11px] font-medium transition-colors" style={{ color: "var(--accent)" }}>
              Manage Voice →
            </Link>
          </div>
          {activeProfile ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.20)" }}>
                <Mic size={13} style={{ color: "var(--accent-purple)" }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{activeProfile.name}</div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                  Extracted {activeProfile.extracted_at ? new Date(activeProfile.extracted_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-[12px]" style={{ color: "var(--accent-orange)" }}>No voice profile configured.</div>
              <Link href="/admin/blog/voice" className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>Set up now →</Link>
            </div>
          )}
        </div>

        {/* Stats + Generate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <StatBadge label="Total Posts" value={posts.length} />
            <StatBadge label="Published" value={publishedCount} />
            <StatBadge label="Drafts" value={posts.length - publishedCount} />
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-medium transition-all"
            style={{ background: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.18)" }}>
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generating ? "Generating..." : "Generate New Post"}
          </button>
        </div>

        {/* Posts Table */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "var(--muted)" }}>All Posts</h3>
          {loading ? (
            <div className="flex justify-center py-8"><span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" /></div>
          ) : posts.length === 0 ? (
            <p className="text-center py-8 text-[12px]" style={{ color: "var(--muted)" }}>No posts yet. Generate your first one.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Title</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Category</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Status</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Keywords</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2" style={{ color: "var(--muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} className="border-b transition-colors" style={{ borderColor: "var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(237,234,226,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td className="py-2.5 pr-4 text-[12px] font-medium truncate max-w-[300px]" style={{ color: "var(--text)" }}>{post.title}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: "var(--accent)", background: "rgba(232,168,64,0.08)", border: "1px solid rgba(232,168,64,0.12)" }}>
                        {post.category}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={
                        post.status === 'published'
                          ? { color: "var(--accent-green)", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" }
                          : { color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--border)" }
                      }>
                        {post.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-[11px] truncate max-w-[200px]" style={{ color: "var(--muted)" }}>
                      {post.keywords?.join(", ")}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1">
                        <Link href={`/blog/${post.slug}`} target="_blank"
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                          style={{ color: "var(--muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                          <Eye size={12} />
                        </Link>
                        <button onClick={() => handleDelete(post.slug)}
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                          style={{ color: "var(--muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ff4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/blog/page.tsx
git commit -m "feat: add admin blog dashboard — post list, generate, voice status"
```

---

### Task 14: Admin Voice Profile Manager

**Files:**
- Create: `app/admin/blog/voice/page.tsx`

- [ ] **Step 1: Write page.tsx**

```typescript
// app/admin/blog/voice/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import type { VoiceProfile } from "@/lib/types";

export default function VoiceProfilePage() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [samples, setSamples] = useState(["", "", ""]);
  const [profileName, setProfileName] = useState("Default");
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<"extract" | "view">("extract");
  const [toast, setToast] = useState("");

  const fetchProfiles = useCallback(async () => {
    const res = await fetch("/prospecting-os/api/blog/voice");
    const data = await res.json();
    setProfiles(data.profiles || []);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const activeProfile = profiles.find(p => p.is_active);

  const handleExtract = async () => {
    const filledSamples = samples.filter(s => s.trim());
    if (filledSamples.length < 2) {
      setToast("Please provide at least 2 writing samples");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/prospecting-os/api/blog/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: filledSamples, name: profileName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToast(`Voice profile "${profileName}" extracted!`);
      setTimeout(() => setToast(""), 4000);
      await fetchProfiles();
      setActiveTab("view");
    } catch (e) {
      setToast(`Error: ${String(e)}`);
      setTimeout(() => setToast(""), 4000);
    }
    setExtracting(false);
  };

  return (
    <>
      <TopBar title="Voice Profile Manager" subtitle="Extract and manage your writing voice" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="px-4 py-2.5 rounded-lg text-[12px] font-medium"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back link */}
        <div className="flex items-center gap-4">
          <Link href="/admin/blog" className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--muted)" }}>
            <ArrowLeft size={12} /> Back to Blog
          </Link>
          {/* Tab switcher */}
          <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            {(["extract", "view"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-3 py-1 rounded-md text-[11px] font-medium capitalize transition-all"
                style={{
                  color: activeTab === tab ? "var(--accent)" : "var(--muted)",
                  background: activeTab === tab ? "rgba(232,168,64,0.10)" : "transparent",
                }}>
                {tab === "extract" ? "Extract" : "Current Profile"}
              </button>
            ))}
          </div>
        </div>

        {/* Extract Tab */}
        {activeTab === "extract" && (
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Mic size={14} style={{ color: "var(--accent-purple)" }} />
              <h3 className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>Extract Voice Profile</h3>
            </div>

            <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>
              Paste 2-4 writing samples below. These can be LinkedIn posts, client emails, or previous articles you have written. Gemini will analyze them and extract your unique writing voice.
            </p>

            <div className="mb-4">
              <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--muted)" }}>Profile Name</label>
              <input value={profileName} onChange={e => setProfileName(e.target.value)}
                className="w-full h-9 rounded-lg px-3 text-[12px] outline-none"
                style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }} />
            </div>

            {samples.map((sample, idx) => (
              <div key={idx} className="mb-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--muted)" }}>
                  Sample {idx + 1} {idx < 2 ? "(required)" : "(optional)"}
                </label>
                <textarea
                  value={sample}
                  onChange={e => {
                    const next = [...samples];
                    next[idx] = e.target.value;
                    setSamples(next);
                  }}
                  rows={5}
                  placeholder={`Paste article, LinkedIn post, or email #${idx + 1} here...`}
                  className="w-full rounded-lg px-3 py-2 text-[12px] outline-none resize-y"
                  style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)", minHeight: 80 }}
                />
              </div>
            ))}

            <button onClick={handleExtract} disabled={extracting}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-medium transition-all"
              style={{ background: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.18)" }}>
              {extracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {extracting ? "Analyzing..." : "Extract Voice Profile"}
            </button>
          </div>
        )}

        {/* View Tab */}
        {activeTab === "view" && (
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="text-[12px] font-semibold mb-4" style={{ color: "var(--text)" }}>Current Active Profile</h3>

            {activeProfile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.20)" }}>
                    <Mic size={13} style={{ color: "var(--accent-purple)" }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{activeProfile.name}</div>
                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                      Extracted {activeProfile.extracted_at ? new Date(activeProfile.extracted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                </div>

                {/* Render extracted guide as formatted JSON */}
                <div className="rounded-lg p-4 overflow-auto" style={{ background: "var(--surface2)", border: "1px solid var(--border)", maxHeight: 400 }}>
                  <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                    {JSON.stringify(activeProfile.extracted_guide, null, 2)}
                  </pre>
                </div>

                {/* Samples used */}
                {activeProfile.sample_texts && activeProfile.sample_texts.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>Samples Used ({activeProfile.sample_texts.length})</h4>
                    {activeProfile.sample_texts.map((text, idx) => (
                      <div key={idx} className="rounded-lg p-3 mb-2 text-[11px] whitespace-pre-wrap" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", maxHeight: 120, overflow: 'hidden' }}>
                        {text.slice(0, 300)}{text.length > 300 ? '...' : ''}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <CheckCircle size={12} style={{ color: "var(--accent-green)" }} />
                  <span className="text-[11px]" style={{ color: "var(--accent-green)" }}>This profile is active — all generated posts will use it.</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-8 justify-center">
                <AlertCircle size={14} style={{ color: "var(--accent-orange)" }} />
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>No voice profile yet. Extract one to get started.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/blog/voice/page.tsx
git commit -m "feat: add voice profile manager UI — extract and view writing voice"
```

---

### Task 15: Sidebar + Middleware + vercel.json Patches

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `middleware.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Add Blog link to Sidebar**

In `components/layout/Sidebar.tsx`, find the Operations section dynamic items and add a Blog link:

```typescript
// Find this block in Sidebar.tsx (around line 331-340):
      const items: NavItem[] = [
        { id: "integrations", module: "settings", label: "Integrations", icon: Shield, href: "/integrations" },
        { id: "invoice-agent", module: "settings", label: "Invoice Agent", icon: FileText, href: "/invoice" },
      ];

// Add Blog after Invoice Agent:
      const items: NavItem[] = [
        { id: "integrations", module: "settings", label: "Integrations", icon: Shield, href: "/integrations" },
        { id: "invoice-agent", module: "settings", label: "Invoice Agent", icon: FileText, href: "/invoice" },
        { id: "blog", module: "settings", label: "Blog", icon: PenTool, href: "/admin/blog" },
      ];
```

Add `PenTool` to the lucide-react imports at the top of Sidebar.tsx.

- [ ] **Step 2: Add /blog to public routes in middleware**

In `middleware.ts`, add `/blog` to the `publicRoutes` array:

```typescript
const publicRoutes = [
  "/",
  "/book",
  "/book/admin",
  "/login",
  "/signup",
  "/onboarding",
  "/checkout",
  "/tools",
  "/progress",
  "/integrations",
  "/blog",          // <-- add this
];
```

- [ ] **Step 3: Add cron to vercel.json**

```json
{
  "path": "/prospecting-os/api/cron/blog-writer",
  "schedule": "0 3 * * *"
}
```

Add this to the `crons` array in `vercel.json`.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx middleware.ts vercel.json
git commit -m "feat: wire blog into sidebar, middleware, and cron"
```

---

### Task 16: Landing Page + Navbar + Sitemap Patches

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/Navbar.tsx`
- Modify: `public/sitemap.xml`

- [ ] **Step 1: Add Blog link to landing page nav**

In `app/page.tsx`, find the nav-links `<ul>` around line 630 and add a blog link:

```tsx
<li><a href="/blog" style={{ color: "var(--accent)", fontWeight: 500 }}>Blog</a></li>
```

Add this as a new `<li>` in the `<ul className="nav-links">` section, after the FAQ link and before the closing `</ul>`. Use a plain `<a>` tag (not `<Link>`) for consistency with the landing page's scroll-based navigation.

- [ ] **Step 2: Add Blog link to Navbar component**

In `components/Navbar.tsx`, find the nav links section (around line 55-70) and add:

```tsx
<a href="/blog" className="nav-link">Blog</a>
```

- [ ] **Step 3: Update sitemap.xml**

In `public/sitemap.xml`, add:

```xml
<url>
  <loc>https://app.flow-forges.com/prospecting-os/blog</loc>
  <changefreq>daily</changefreq>
  <priority>0.9</priority>
</url>
```

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/Navbar.tsx public/sitemap.xml
git commit -m "feat: add blog links to landing nav, navbar, and sitemap"
```

---

### Task 17: Build Check

**Files:** All

- [ ] **Step 1: Run build**

```bash
cd D:/Flow-Forges/lead-engine && npm run build
```

Expected: ✓ Compiled successfully, ✓ Generating static pages (76/76 — 70 existing + 6 new blog routes)

- [ ] **Step 2: Fix any TypeScript errors**

If errors appear, fix and rebuild until clean.

- [ ] **Step 3: Verify routes**

```bash
curl -s -o /dev/null -w "%{http_code}" "https://app.flow-forges.com/prospecting-os/blog"
curl -s -o /dev/null -w "%{http_code}" "https://app.flow-forges.com/prospecting-os/api/blog"
```

Expected: 200 for /blog, 200 for /api/blog

- [ ] **Step 4: Commit final fixes**

```bash
git add -A
git commit -m "fix: build fixes for blog engine"
```

---

## File Structure Summary

```
Created (13):
  supabase/migrations/20260518_blog_engine.sql     — 3 tables + RLS
  lib/blog/voice-extractor.ts                       — Gemini voice analysis
  lib/blog/keyword-gap.ts                           — SEO keyword research
  lib/blog/content-writer.ts                        — Post generation + voice injection
  app/blog/page.tsx                                 — Public listing (SSR + ISR)
  app/blog/[slug]/page.tsx                          — Public post page (SSR + ISR)
  app/admin/blog/page.tsx                           — Admin dashboard ('use client')
  app/admin/blog/voice/page.tsx                     — Voice profile manager ('use client')
  app/api/blog/route.ts                             — List + Create
  app/api/blog/[slug]/route.ts                      — GET/PATCH/DELETE by slug
  app/api/blog/generate/route.ts                    — Manual generation trigger
  app/api/blog/voice/route.ts                       — Voice extraction API
  app/api/cron/blog-writer/route.ts                 — Daily cron (3 AM UTC)

Modified (7):
  lib/types.ts                                      — BlogPost, VoiceProfile, BlogKeyword
  components/layout/Sidebar.tsx                     — Blog link in Operations
  middleware.ts                                     — /blog → publicRoutes
  vercel.json                                       — 0 3 * * * cron
  app/page.tsx                                      — Landing nav blog link
  components/Navbar.tsx                             — Navbar blog link
  public/sitemap.xml                                — Blog URL
```
