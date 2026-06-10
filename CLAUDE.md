# Prospecting OS — lead-engine

Next.js 14.2.5 App Router · TypeScript 5 strict · Tailwind CSS 3 + CSS vars · Supabase (shared) · Anthropic Claude API · npm
Live: `app.flow-forges.com/prospecting-os` | basePath: `/prospecting-os`

## Critical Rules

- TypeScript strict ON — never suppress TS errors
- `apiKey` in React state ONLY — never persisted to localStorage, Supabase, or logs
- No ORM — all DB via `lib/db.ts` (supabaseAdmin, bypasses RLS)
- No new state libraries — React Context + useReducer only (`lib/AppContext.tsx`)
- `<Link href="...">` stay short (e.g. `/leads`) — Next.js auto-prefixes basePath
- Lucide icons only: outline variants, `size={16}` or `size={18}`, no emojis
- `display_name` not `full_name` throughout (profiles table)
- Middleware deletes all `x-user-*` headers before profile lookup (security — never skip)

## RBAC (quick ref)

| Role | Access |
|------|--------|
| `super_admin` | Everything |
| `client` | `/client-portal` only, plan-gated |
| `qa_agent` | Both surfaces, bypasses PlanGate |
| `user` | Redirect to `/login` |

## Modules

`/leads` · `/dashboard` · `/message-lab` · `/scorer` · `/sequences` · `/kanban` · `/analytics` · `/clients` · `/client-portal`

## Dev

```bash
npm run dev     # http://localhost:3001 (avoid port conflict with mark1)
npm run build   # must pass with 0 errors
```

## Deployment

Push to `main` → Vercel auto-deploys. Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APIFY_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.

## Implementation Notes

- Gemini 2.5 Flash: `thinkingConfig: { thinkingBudget: 0 }`, extract with `parts.find(p => !p.thought)`
- Icebreaker: direct `fetch` to Anthropic API — SDK NOT installed. Headers: `x-api-key`, `anthropic-version: 2023-06-01`
- Rate-limit records inserted BEFORE external API calls (fail-safe pattern)
- `motion(Link)` for basePath-safe animated links

## Onboarding Flow (key patterns)

- **Token-based**: `/onboarding?token=<uuid>` — no auth required. Appointment lookup via `GET /api/appointments?token=`. Name auto-populated from booking.
- **Auth-based**: `/onboarding?plan=micro` — logged-in user. Name auto-fetched from `/api/me` profile `display_name`.
- **ICP validation**: ALL 4 fields required (industries, companySizes, seniority, countries). Continue button `disabled` + `cursor: not-allowed` until valid.
- **No skip buttons** — removed from all 3 steps. No way to bypass ICP capture.
- **Fade transitions**: `animate-fadeIn` CSS class on each step div (0.3s ease, translateY 8px → 0).
- **Micro plan**: skips Welcome → goes straight to ICP step (`?plan=micro`). Checkout goes direct to payment URL (no `/checkout` review screen).

## Lead Generation (key patterns)

- `/api/leads/generate` supports dual auth: `x-user-id` header (portal) OR `Authorization: Bearer <CRON_SECRET>` + `?workspace_id=` (webhook/cron).
- Apify query built from ICP: `buildSearchKeywords()` combines industries + seniority titles → `searchTerms` array. `buildApifyInput()` adds location, employee count range, seniority filter.
- Fetches 3x plan quantity, filters to score ≥ 8.0, falls back to ≥ 7.0 if < 50% of target met.
- Dodo webhook MUST trigger lead gen async via fetch with CRON_SECRET after workspace creation.
- Webhook MUST create Supabase Auth user (`supabaseAdmin.auth.admin.createUser()`) for new Dodo clients — profile alone won't let them login.

## Client Portal / Dashboard

- Dashboard uses `client_leads` table (NOT global `leads`). Query by `workspace_id`, exclude `email` column.
- `client_leads` has NO `status` or `industry` columns — derive from score (≥8.0 = hot, else new), use `icp_match_reason` for industry display.
- `client_icebreakers` table for workspace-scoped icebreakers (NOT global `messages`).
- `micro_deliveries` table tracks micro plan fulfillment. Created separately from the migration scripts.

## UI Gotchas

- `<Link href>` stays SHORT (e.g. `/dashboard`, `/`). Next.js auto-prefixes basePath. Never put `/prospecting-os` in a Link href — becomes `/prospecting-os/prospecting-os`.
- `<img src>` needs the FULL basePath prefix (`/prospecting-os/assets/...`). `assetPrefix` in next.config handles this for next/image but NOT raw `<img>`.
- Sidebar logo must be a clickable `<Link>` to `/dashboard`.
- Booking page logo Link goes to `/` (Home), not `/prospecting-os`.

## Full Reference

See `lead-engine/.claude/ref.md` — full directory tree, RBAC tables, AppContext, DB schema, CSS vars, types, env vars, security audit notes.
