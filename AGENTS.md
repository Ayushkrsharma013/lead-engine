# Prospecting OS — lead-engine

Next.js 14.2.5 App Router · TypeScript 5 strict · Tailwind CSS 3 + CSS vars · Supabase (shared) · Anthropic Codex API · npm
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

## Full Reference

See `lead-engine/.Codex/ref.md` — full directory tree, RBAC tables, AppContext, DB schema, CSS vars, types, env vars, security audit notes.
