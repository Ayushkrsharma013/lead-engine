# Autonomous Blog Engine — Design Spec

**Date:** 2026-05-18
**Status:** Approved — ready for implementation plan
**Location:** lead-engine, under `/prospecting-os/blog`

---

## Summary

Add a fully automated, voice-trained blog engine inside lead-engine at `app.flow-forges.com/prospecting-os/blog`. The blog serves a dual audience (B2B sales leaders + agency owners) with dual goals (SEO lead generation + thought leadership). Content is generated daily by Gemini 2.5 Flash, fine-tuned to the user's specific tone of voice via an extracted style guide stored as JSONB. Zero human involvement unless the user chooses hybrid review mode.

---

## Architecture

```
Vercel Cron (daily 3 AM UTC / 8:30 AM IST)
    │
    ▼
/api/cron/blog-writer
    │
    ├─► Keyword Gap Analyzer (Gemini)
    │   Reads: blog_keywords table + existing blog_posts.slug
    │   Output: best uncovered keyword + search intent
    │
    ├─► Content Strategist (Gemini + Voice Profile)
    │   Input: keyword + voice_profile.extracted_guide + existing posts
    │   Output: outline (H2/H3 structure), target word count, internal links
    │
    ├─► Content Writer (Gemini + Voice Profile + Outline)
    │   Input: outline + style_guide + keyword
    │   Output: full markdown post (title, subtitle, body, excerpt, category)
    │
    └─► Publisher
        Insert → blog_posts (status: 'published')
        Upsert → blog_keywords (increment posts_count, set last_used_at)
        Revalidate → GET /blog (ISR tag)
        Notify → Telegram
```

**Routes:**

| Route | Auth | Purpose |
|-------|------|---------|
| `/blog` | Public | SSR listing page with ISR, category filters, email CTA |
| `/blog/[slug]` | Public | SSR post page, tool CTAs, next-post navigation |
| `/admin/blog` | super_admin | Voice profile, post list, generate/publish |
| `/admin/blog/voice` | super_admin | Voice profile extraction UI |
| `/admin/blog/new` | super_admin | Manual write + publish |
| `/api/blog` | Public GET, Admin POST | List posts, create |
| `/api/blog/[slug]` | Public GET, Admin PATCH/DELETE | Single post CRUD |
| `/api/blog/generate` | super_admin POST | Manual trigger: generate a post on demand |
| `/api/blog/voice` | super_admin GET/POST | Extract and store voice profile |
| `/api/cron/blog-writer` | CRON_SECRET GET | Daily autonomous writer |

---

## Database

### `blog_posts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | TEXT UNIQUE | Auto-generated from title |
| title | TEXT | |
| subtitle | TEXT | |
| excerpt | TEXT | 1-2 sentence preview for cards |
| content | TEXT | Markdown body |
| category | TEXT | 'lead-gen', 'outbound', 'ai-sales', 'agency' |
| keywords | TEXT[] | Target keywords for this post |
| voice_profile_id | UUID FK | → voice_profiles.id |
| read_time | INTEGER | Minutes, auto-calculated |
| status | TEXT | 'draft' or 'published' |
| published_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `voice_profiles`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | e.g. "Ayush Default" |
| extracted_guide | JSONB | Structured style guide (see Section: Voice Profile) |
| sample_texts | TEXT[] | Raw writing samples provided by user |
| is_active | BOOLEAN | Which profile the writer uses |
| extracted_at | TIMESTAMPTZ | Last extraction timestamp |
| created_at | TIMESTAMPTZ | |

### `blog_keywords`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| keyword | TEXT UNIQUE | The target search term |
| category | TEXT | Which content pillar |
| volume_estimate | INTEGER | Rough search volume |
| difficulty | TEXT | 'low', 'medium', 'high' |
| posts_count | INTEGER | How many posts have targeted this |
| last_used_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

All tables: RLS enabled, service role only (supabaseAdmin) for writes, public SELECT for published blog_posts.

---

## Voice Profile System

### Extraction Flow

1. User pastes 2-4 writing samples (existing articles, LinkedIn posts, client emails) into `/admin/blog/voice`
2. `POST /api/blog/voice` triggers Gemini with a structured extraction prompt
3. Gemini returns a JSON voice profile identifying:
   - Sentence rhythm (avg length, variation pattern)
   - Hook signatures (how the writer opens)
   - Tone markers (confidence level, humor style, persona)
   - Formatting conventions (paragraph density, bullet usage, bold patterns)
   - Transition vocabulary (words/phrases the writer uses to connect ideas)
   - CTA style (how calls-to-action are framed)
   - Anti-patterns (things to never do — clichés, emojis, specific phrases)
4. Profile stored in `voice_profiles.extracted_guide` as JSONB
5. Previous profiles versioned; one marked `is_active`

### Injection

Every generation prompt includes a `style_guide` block:

```
## YOUR WRITING VOICE

You write like this:
- [extracted_guide.sentence_profile.rule]
- Hook pattern: [extracted_guide.hooks.primary]
- Baseline tone: [extracted_guide.tone.baseline]
- Transitions to use: [extracted_guide.transitions]
- CTA style: [extracted_guide.cta_style]

Never do this:
- [extracted_guide.anti_patterns]
```

### Sample JSONB Shape

```json
{
  "voice_name": "Ayush Default",
  "sentence_profile": { "avg_length": "14-22 words", "style": "varied", "rule": "..." },
  "hooks": { "primary": "...", "avoid": "...", "example": "..." },
  "tone": { "baseline": "...", "humor": "...", "persona": "..." },
  "formatting": { "paragraph_density": "...", "bullets": "...", "bold_usage": "..." },
  "transitions": ["...", "..."],
  "cta_style": "...",
  "anti_patterns": ["...", "..."]
}
```

---

## Public Blog Pages

### Listing Page (`/blog`)

- Uses marketing shell (no sidebar, same as landing page)
- Category filter pills: All, Lead Gen, Outbound, AI & Sales, Agency
- 3-column card grid with: category chip, title, excerpt (2 lines), read time, date
- Email capture CTA row between cards
- ISR: revalidate every 60s
- SEO metadata: title "Prospecting OS Blog — B2B Lead Generation Insights", OG image

### Post Page (`/blog/[slug]`)

- Marketing shell
- Category · read time · date header
- Title + subtitle
- Rendered markdown body with proper heading hierarchy
- Inline tool CTAs at natural break points ("Try our free Icebreaker Generator")
- Bottom: email capture CTA ("Get 5 free AI-scored leads")
- Next post navigation
- OpenGraph per-post (title, description, image)
- ISR: revalidate every 60s

### Sitemap Integration

On publish, the cron inserts the new slug into `public/sitemap.xml` (or a dynamic sitemap route at `/blog/sitemap.xml`).

---

## Admin Pages

### `/admin/blog` — Blog Dashboard

- Voice profile card: active profile name, extraction date, "Manage Voice" link
- Quick stats: total posts, published this week, keyword coverage %
- Post list: title, category chip, status badge, keyword, date
- "Generate New Post" button → triggers `/api/blog/generate`, shows loading state
- Per-post: Edit, Publish (if draft), Delete actions

### `/admin/blog/voice` — Voice Profile Manager

- Paste area for writing samples (textarea, 2-4 samples)
- Current active profile display (rendered JSONB guide)
- "Extract Voice Profile" button → calls `/api/blog/voice`
- Sample history: which texts were used for the last extraction
- "Re-extract" with new samples

---

## Content Strategy

### Pillar Categories

| Category | Primary Audience | Example Topics |
|----------|-----------------|----------------|
| Lead Gen | Sales leaders | ICP building, scraper comparison, email verification, reply rates |
| Outbound | SDR managers | Sequence design, multi-channel cadence, LinkedIn vs email, A/B testing |
| AI & Sales | Both | Gemini for prospecting, AI scoring, automation ROI, prompt engineering |
| Agency | Agency owners | Adding lead gen as a service, pricing models, client reporting, scaling |

### Internal Linking Rules

Every generated post must:
- Link to at least 1 free tool (icebreaker generator, pipeline audit, ROI calculator)
- End with the email capture CTA
- Cross-link to 1-2 related blog posts if they exist

---

## Cron — Autonomous Writer

**Schedule:** Daily at 0 3 * * * UTC (8:30 AM IST, after agents finish)

**Flow:**
1. Read `voice_profiles` WHERE `is_active = true` → get style guide
2. Read `blog_posts` → existing slugs (avoid duplicates)
3. Read `blog_keywords` → find uncovered keywords
4. If table `blog_keywords` is empty, run gap analysis first:
   - Gemini: "Given the blog is about B2B lead generation, AI sales prospecting, and agency growth, list 20 high-intent keywords we should target. Include rough volume and difficulty."
   - Insert into `blog_keywords`
5. Pick best keyword: NOT already covered, lowest difficulty, not used recently
6. Generate outline (Content Strategist prompt)
7. Generate full post (Content Writer prompt, 800-1500 words)
8. Auto-publish with status 'published'
9. Update keyword stats
10. Telegram notify: "New blog post published: [title] — [slug]"

**Safety:** If the writer fails 3 consecutive days, disable and alert via Telegram.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260518_blog_engine.sql` | blog_posts, voice_profiles, blog_keywords tables |
| `lib/types.ts` (modify) | Add BlogPost, VoiceProfile, BlogKeyword interfaces |
| `lib/blog/voice-extractor.ts` | Gemini voice profile extraction |
| `lib/blog/content-writer.ts` | Post generation with voice injection |
| `lib/blog/keyword-gap.ts` | Keyword gap analysis |
| `app/blog/page.tsx` | Public listing page |
| `app/blog/[slug]/page.tsx` | Public post page |
| `app/admin/blog/page.tsx` | Admin dashboard |
| `app/admin/blog/voice/page.tsx` | Voice profile manager |
| `app/api/blog/route.ts` | Blog CRUD API |
| `app/api/blog/[slug]/route.ts` | Single post API |
| `app/api/blog/generate/route.ts` | Manual generation trigger |
| `app/api/blog/voice/route.ts` | Voice profile extraction API |
| `app/api/cron/blog-writer/route.ts` | Daily autonomous writer cron |

## Files to Modify

| File | Change |
|------|--------|
| `lib/types.ts` | Add BlogPost, VoiceProfile, BlogKeyword types (or in lib/blog/types.ts) |
| `components/layout/Sidebar.tsx` | Add "Blog" link in Operations |
| `middleware.ts` | Add `/blog` to publicRoutes |
| `public/sitemap.xml` | Add blog URLs (or dynamic sitemap route) |
| `vercel.json` | Add `0 3 * * *` cron for blog-writer |
| `app/page.tsx` (landing) | Add "Read the Blog" nav link |
| `components/Navbar.tsx` | Blog link in marketing nav |

---

## Constraints

1. All Gemini calls: `thinkingConfig: { thinkingBudget: 0 }`, response via `parts.find(p => !p.thought) ?? parts[0]`
2. All DB writes: supabaseAdmin (service role)
3. All `<Link href>`: no basePath prefix (Next.js auto-prepends)
4. All fetch calls: `/prospecting-os/api/blog/...` prefix
5. Lucide icons only, outline variants, size={16} or {18}
6. CSS variables from design system only
7. No emojis in body text (per user's design rule)
8. No ul/li in dropdowns (per current pattern — use div+button)
