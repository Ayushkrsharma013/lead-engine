# 🚀 Prospecting OS — Full-Stack System Audit & Capacity Planning

**Date:** 2026-06-11  
**Auditor:** Claude (automated)  
**Scope:** Frontend, Backend (95 API routes), Database (Supabase Postgres), External Integrations, Infrastructure

---

## 1. Executive Summary

### Overall Health Score: **48/100** 🔴 (Critical Issues Found)

| Category | Score | Status |
|----------|-------|--------|
| Security (RLS) | 45/100 | 🔴 Critical Gaps |
| Security (API) | 55/100 | 🔴 Critical Vulnerabilities Found |
| Database Performance | 80/100 | 🟢 Good (at current scale) |
| External Resilience | 40/100 | 🔴 Multiple SPOFs, No Circuit Breakers |
| Frontend Performance | 70/100 | 🟡 Acceptable |
| Infrastructure Scaling | 65/100 | 🟡 Bottleneck at 60 DB Connections |

### Top 5 Critical Risks

1. **🔴 Telegram webhook has NO signature verification** (`api/agent/telegram`) — attacker can forge agent approve/reject actions, triggering lead enrollment and finance operations.
2. **🔴 `api/appointments` PATCH has NO authentication** — attacker can mark any appointment as "won," accessing single-use onboarding tokens.
3. **🔴 RLS disabled on `gmaps_outreach_queue`** — table is publicly writable via PostgREST. Data exfiltration or tampering possible with just the anon key.
4. **🔴 `paddle_subscriptions` and `paddle_transactions` policies use `roles: {public}` with `USING (true)`** — financial data exposed to anyone with the anon key.
5. **🔴 `GMAPS_RUNNER_SECRET` falls back to hardcoded `"gmaps-runner-v1"`** in 5 routes — if env var is unset, anyone with source code access can authenticate.

---

## 2. Security Audit

### 2.1 API-Level Authentication Vulnerabilities

#### 🔴 CRITICAL: Telegram Webhook — No Signature Verification

**File:** `app/api/agent/telegram/route.ts`  
**Impact:** An attacker can POST forged callback data to approve/reject agent actions including lead enrollment, finance operations, and sequence launches. Telegram provides HMAC-SHA256 verification using the bot token — this is **not implemented**.

**Fix:**
```typescript
// Add to the POST handler before parsing the body:
const secret = crypto.createHmac("sha256", process.env.TELEGRAM_BOT_TOKEN!)
  .update(await req.clone().text())
  .digest("hex");
// Compare against req.headers.get("x-telegram-bot-api-secret-token")
```

#### 🔴 CRITICAL: `api/appointments` PATCH — No Authentication

**File:** `app/api/appointments/route.ts` (PATCH handler, ~line 308)  
**Impact:** Anyone can PATCH any appointment by ID — cancel it, reschedule it, or **mark it as "won"**. The "won" path generates a single-use `onboardingToken` and returns it in the response, granting the attacker access to the onboarding flow.

**Fix:** Add token-based or session-based authentication to PATCH. Restrict "won" status changes to authenticated users or require the appointment's verification token.

#### 🔴 CRITICAL: `GMAPS_RUNNER_SECRET` Hardcoded Fallback

**Files:** 5 routes under `app/api/gmaps-outreach/`  
**Impact:** All gmaps-outreach routes use:
```js
const runnerSecret = process.env.GMAPS_RUNNER_SECRET || "gmaps-runner-v1";
```
If `GMAPS_RUNNER_SECRET` is not set in production, anyone who reads this source code can authenticate as the runner, reading and modifying the outreach queue.

**Fix:** Remove the fallback. Return 500 if env var is unset:
```typescript
const runnerSecret = process.env.GMAPS_RUNNER_SECRET;
if (!runnerSecret) return NextResponse.json({ error: "Runner not configured" }, { status: 500 });
```

#### 🔴 CRITICAL: `api/agents/run` and `api/agents/digest` Skip Auth When CRON_SECRET Unset

**Files:** `app/api/agents/run/route.ts`, `app/api/agents/digest/route.ts`  
**Impact:** Both endpoints wrap CRON_SECRET auth in `if (cronSecret) { ... }` — if the env var is empty, auth is **completely bypassed**. Anyone can trigger any agent.

**Fix:** Always require CRON_SECRET. Return 500 if unset.

#### 🟠 HIGH: Payment Webhook Legacy Path — No Signature Verification

**File:** `app/api/payment/webhook/route.ts` (lines 400-706)  
**Impact:** The Dodo path has proper HMAC-SHA256 verification, but the "legacy path" (Easebuzz/Skydo/Stripe) reads `txnid` and `status` from the body with **no origin verification**. An attacker who knows a valid `txnid` (stored in `pending_transactions`) could trigger account activation.

**Fix:** Add signature verification for all payment providers, or deprecate legacy providers in favor of Dodo-only.

#### 🟠 HIGH: Resend Webhook — Falls Back to Unauthenticated Mode

**File:** `app/api/inbound-email/route.ts` (line 87-98)  
**Impact:** If `RESEND_WEBHOOK_SECRET` is not set, the Svix signature check is skipped and all inbound email data is parsed without verification.

#### 🟠 HIGH: `onboarding/save` Accepts `apifyKey` and `anthropicKey` from Client Body

**File:** `app/api/onboarding/save/route.ts` (lines 36-37)  
**Impact:** Client-submitted API keys are stored in the `profiles` table. If these are ever used as API keys for other operations, an attacker could inject their own keys.

### 2.2 RLS Policy Deep Dive

#### CRITICAL Findings

| # | Table | Issue | Risk | Fix |
|---|-------|-------|------|-----|
| 1 | `gmaps_outreach_queue` | **RLS DISABLED** (rowsecurity: false) | 🔴 CRITICAL | `ALTER TABLE gmaps_outreach_queue ENABLE ROW LEVEL SECURITY;` Add service_role-only policy |
| 2 | `paddle_subscriptions` | Policy `service_role_all_subs` uses `roles: {public}` + `USING (true)` | 🔴 CRITICAL | Change `roles` to `{service_role}` |
| 3 | `paddle_transactions` | Policy `service_role_all_txns` uses `roles: {public}` + `USING (true)` | 🔴 CRITICAL | Change `roles` to `{service_role}` |
| 4 | `client_leads` | RLS enabled, **NO policies** | 🔴 CRITICAL | Add policies: workspace-scoped SELECT for client_user_id, service_role ALL |
| 5 | `client_icebreakers` | RLS enabled, **NO policies** | 🔴 CRITICAL | Add policies: SELECT via workspace join, service_role ALL |
| 6 | `pending_transactions` | RLS enabled, **NO policies** | 🔴 CRITICAL | Add service_role-only policy |
| 7 | `micro_deliveries` | RLS enabled, **NO policies** | 🔴 CRITICAL | Add workspace-scoped policies |

#### HIGH Findings

| # | Table | Issue | Risk | Fix |
|---|-------|-------|------|-----|
| 8 | `appointments` | `anon_update_appointments` — USING + WITH CHECK both `true` | 🟠 HIGH | Tighten to `user_id = auth.uid()` OR token-based lookup |
| 9 | `appointments` | `anon_insert_appointments` — WITH CHECK `true` | 🟠 HIGH | Add rate limiting at API level (already partially done, but RLS bypass possible) |
| 10 | `email_captures` | `anon_select_email_captures` — USING `true` | 🟠 HIGH | Anyone can dump all captured emails. Consider removing public SELECT or masking emails |
| 11 | `get_user_role()` | SECURITY DEFINER, executable by `anon` role | 🟠 HIGH | Revoke anon EXECUTE: `REVOKE EXECUTE ON FUNCTION get_user_role() FROM anon;` |
| 12 | Auth: Leaked password protection | **DISABLED** in Supabase Auth settings | 🟠 HIGH | Enable in Supabase dashboard → Authentication → Settings |

#### MEDIUM Findings

| # | Table | Issue | Risk | Fix |
|---|-------|-------|------|-----|
| 13 | `contact_messages` | WITH CHECK `true` for INSERT | 🟡 MEDIUM | Add per-IP rate limiting; consider reCAPTCHA |
| 14 | `quote_requests` | WITH CHECK `true` for INSERT | 🟡 MEDIUM | Rate limit per IP |
| 15 | `blog_posts` | `Anyone can view published posts` — correct behavior but ensure no unpublished leak via API | 🟡 MEDIUM | Verify API routes check `published = true` filter |
| 16 | `api_keys` | RLS OK but API key in DB could be exposed if RLS misconfigured | 🟡 MEDIUM | Encrypt API key values at rest |

#### LOW / Informational

| # | Table | Issue |
|---|-------|-------|
| 17-32 | `agent_actions`, `agent_runs`, `apify_imports`, `audit_requests`, `blog_keywords`, `client_sequences`, `knowledge_store`, `saved_filters`, `scrape_logs`, `team_members`, `tool_rate_limits`, `voice_profiles` | RLS enabled, no policies — data inaccessible via PostgREST (by design, since accessed via service_role API routes). Acceptable if API routes properly authorize. |
| 33 | `aadi.*` schema (18 tables) | RLS disabled on all tables — separate schema, not exposed to PostgREST. Acceptable if `aadi` schema is not in the API exposure list. |
| 34 | `realtime.messages_*` (7 tables) | RLS disabled — daily partition tables. Should enable RLS or ensure they're not in the publication. |

### 2.3 API Authentication Patterns (Summary)

**Strong patterns:**
- ✅ Dodo webhook: HMAC-SHA256 + `timingSafeEqual` — robust
- ✅ Resend inbound webhook: Svix-compatible HMAC-SHA256 — robust
- ✅ Cron endpoints: Bearer `CRON_SECRET` token — good
- ✅ Middleware strips all `x-user-*` headers from incoming requests — prevents spoofing
- ✅ Lead generation: dual auth (CRON_SECRET or x-user-id from middleware)

**Weak patterns:**
- ⚠️ `POST /api/payment/create-checkout` — no auth check. Anyone can create a checkout session (but needs userId for pending_transaction storage)
- ⚠️ `lib/api-auth.ts` — uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Bearer token. File comments admit this is "light obfuscation only"
- ⚠️ Login rate limiting: documented as "deferred to Vercel + Cloudflare WAF" — no in-app throttle
- ⚠️ 17 of 95 API routes covered by injection tester — 78 routes untested for injection vulnerabilities

### 2.4 Dodo Webhook Bypass Assessment

**Verdict: NOT easily bypassable** ✅

The webhook handler (`app/api/payment/webhook/route.ts`) properly:
1. Reads raw body via `req.text()` (not pre-parsed JSON)
2. Verifies HMAC-SHA256 with `crypto.timingSafeEqual()`
3. Checks for `dodo-signature` or `x-dodo-signature` headers
4. Rejects requests with 401 if signature missing when secret configured
5. Uses `isDodoEvent` detection (checks for `event` field) to prevent unsigned Dodo-format requests from falling through to legacy path

**Recommendation:** No changes needed. This is well-implemented.

---

## 3. Database Performance

### 3.1 Current State

| Metric | Value | Assessment |
|--------|-------|------------|
| Max Connections | **60** (Supabase free/startup tier) | ⚠️ Bottleneck at scale |
| Statement Timeout | 120,000ms (2 min) | OK for lead gen, high for normal queries |
| Idle in Transaction Timeout | 0 (disabled) | ⚠️ Risk of connection leaks |
| Current Row Count (all tables) | < 100 rows | 🟢 Tiny — no performance concerns |
| Largest Table | `digests` (52 rows, 32 KB) | 🟢 Trivial |
| Dead Rows | `profiles` (26 dead / 4 live) | ⚠️ Needs VACUUM |

### 3.2 Index Usage Analysis

**Well-indexed tables:**
- `profiles_pkey` — 6,487 scans (heavily used by middleware — expected)
- `idx_leads_user_id` — 845 scans
- `idx_agent_tasks_status`, `idx_agents_status` — 742 scans each
- `idx_leads_status` — 229 scans

**Unused or rarely used indexes:**
- Many `*_pkey` indexes have 1-3 scans — tables are nearly empty
- `idx_lead_activity_log_user_id` — 433 scans but 0 tuples fetched (no data in table)

**Missing indexes (FK columns without covering indexes):**
The FK-to-index comparison was approximate. The following FK columns should be verified for index coverage:
- `client_leads.workspace_id` — critical for dashboard queries
- `client_icebreakers.lead_id` — critical for icebreaker lookups
- `client_icebreakers.workspace_id`
- `micro_deliveries.workspace_id`
- `sequence_executions.lead_id`
- `messages.lead_id` (likely indexed via `idx_messages_user_id` but verify)

### 3.3 Scaling Projection

| Scale | Rows | Bottleneck | Mitigation |
|-------|------|------------|------------|
| **Current** | ~100 rows | None | — |
| **100 clients** | ~10K leads | Index scans fine | — |
| **1,000 clients** | ~100K leads | `client_leads` sequential scan risk | Add composite index on `(workspace_id, score DESC)` |
| **10,000 clients** | ~1M leads | Connection pool exhaustion (60 max) | Upgrade Supabase plan (pool 200-300 connections) |
| **50,000 clients** | ~5M+ leads | Table partitioning needed | Partition `client_leads` by `workspace_id` hash |

### 3.4 Recommended Indexes

```sql
-- Critical: Client dashboard (most frequent query)
CREATE INDEX idx_client_leads_workspace_score 
  ON client_leads (workspace_id, score DESC);

-- Critical: Icebreaker lookups
CREATE INDEX idx_client_icebreakers_lead 
  ON client_icebreakers (lead_id);

-- Important: Workspace-scoped queries
CREATE INDEX idx_micro_deliveries_workspace 
  ON micro_deliveries (workspace_id);

-- Important: Admin client search
CREATE INDEX idx_clients_status_plan 
  ON clients (status, plan);

-- Enable pg_stat_statements for production monitoring
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

---

## 4. API & Load Test Results

### 4.1 Vercel Function Limits (Current Plan)

| Limit | Hobby | Pro | Current |
|-------|-------|-----|---------|
| Execution Timeout | 10s | 60s | Hobby assumed |
| Memory | 1024 MB | 3008 MB | — |
| Concurrent Executions | ~100 (soft) | 1000 | — |
| Max Duration (configured) | — | — | 120s (`maxDuration` in lead gen) |

⚠️ **Note:** `maxDuration: 120` is set in lead generation but Hobby plan caps at 10s. This implies either a Pro plan or the function will be killed mid-execution on Hobby.

### 4.2 Load Test Simulation (Manual Instructions)

Since automated load testing couldn't run from this environment, here's a manual test script:

```bash
# Install Artillery
npm install -g artillery

# Create test config: load-test.yml
# artillery run load-test.yml
```

**Predicted breaking points (modeled):**

| Endpoint | Est. Response | Breaks at (concurrent) | Bottleneck |
|----------|--------------|----------------------|------------|
| `GET /api/admin/clients` | 50-150ms | ~80-100 | DB connections + middleware profile lookup |
| `POST /api/leads/generate` | 60-120s (async) | ~5-10 concurrent runs | Apify rate limit + Vercel timeout |
| `GET /api/client-portal/leads` | 50-100ms | ~80-100 | DB connection pool |
| `POST /api/payment/webhook` | 200-500ms | ~200+ | Supabase write throughput |

**Expected degradation pattern:**
```
Concurrency:   10 → 50 → 100 → 150 → 200
Success Rate: 100%  99%   95%   80%   60%
p95 Latency:  150ms  300ms  800ms  3s   timeout
```

### 4.3 Critical Path: Lead Generation

The lead generation flow (`POST /api/leads/generate`) is the heaviest endpoint:
1. 🔍 Apify actor start (1-3s)
2. ⏳ Poll for completion (up to 90s, 18 intervals × 5s)
3. 📊 Fetch dataset (1-5s depending on size)
4. 🤖 Score + filter leads (in-memory, fast)
5. 💾 Insert into `client_leads` (batch insert, fast)
6. 🤖 Generate icebreakers via Gemini (batch of 5, ~2-5s per batch)
7. 💾 Insert icebreakers

**Total wall-clock:** 30-120 seconds. This MUST remain async (fire-and-forget from webhook). Current implementation is correct — webhook triggers via `fetch()` without `await`.

---

## 5. External Dependencies — Resilience Assessment

### 5.1 Apify (Lead Data Source)

| Concern | Status | Risk |
|---------|--------|------|
| API timeout | ⚠️ No explicit timeout set on fetch | MEDIUM — hangs could exhaust Vercel function time |
| Rate limit (429) | ❌ No retry logic | HIGH — lead gen fails immediately |
| Actor failure | ✅ Detected (FAILED/ABORTED/TIMED-OUT) | LOW — handled |
| Empty results | ✅ Throws descriptive error | LOW — handled |
| Fallback source | ❌ No fallback | MEDIUM — Blitz API exists but not auto-failover |

**Recommendation:** Add `AbortController` with 30s timeout on Apify fetch calls. Add 1 retry with exponential backoff. Consider auto-fallback to Blitz API.

### 5.2 Gemini (AI/Icebreakers)

| Concern | Status | Risk |
|---------|--------|------|
| API failure | ✅ Try/catch with fallback message | LOW — graceful degradation |
| Rate limit | ✅ Batch processing (5 at a time) | LOW |
| Invalid API key | ❌ No explicit check — returns 500 | MEDIUM — should return config error |
| Quota exceeded | ❌ Not handled distinctly | LOW — same as API failure |

**Recommendation:** Add distinct error for invalid/missing API key configuration.

### 5.3 Dodo Payments

| Concern | Status | Risk |
|---------|--------|------|
| Webhook signature bypass | ✅ HMAC-SHA256 + timingSafeEqual | LOW — robust |
| Dodo downtime | ❌ No monitoring/alerting | MEDIUM — missed payments |
| Payment ID collision | ✅ Idempotent (checks existing profile) | LOW |

### 5.4 Resend (Email)

| Concern | Status | Risk |
|---------|--------|------|
| Email send failure | ✅ All wrapped in try/catch | LOW — graceful |
| No backup delivery | ❌ Failed emails are lost | MEDIUM — log to `error_logs` but no retry |
| Inbound webhook | ✅ Svix HMAC verified | LOW |

### 5.5 Telegram (Alerting)

| Concern | Status | Risk |
|---------|--------|------|
| Notification failure | ✅ `.catch(() => undefined)` | LOW — never blocks main flow |
| Bot token invalid | ❌ No health check | LOW — alerts silently stop |
| Command processing errors | ✅ Handled in webhook try/catch | LOW |

### 5.6 Single Points of Failure (SPOFs)

| Component | SPOF? | Impact | Mitigation |
|-----------|-------|--------|------------|
| Apify | ✅ Yes | No leads generated | Add Blitz API fallback |
| Gemini | ❌ No | Degraded icebreakers (fallback text exists) | — |
| Dodo | ✅ Yes | Payments not processed | Set up Dodo status monitoring |
| Resend | ❌ No | Emails delayed (logged to DB for retry) | Add email retry queue |
| Supabase | ✅ Yes | Entire app down | Upgrade to higher plan with HA |
| Vercel | ✅ Yes | Entire app down | Acceptable (low probability) |
| Telegram | ❌ No | Alerts missed | Add periodic ping check |

---

## 6. Frontend Performance

### 6.1 Lighthouse Estimates (Manual Testing Required)

Based on codebase analysis (Next.js 14 App Router, Tailwind 3, SSR with Supabase):

| Page | Est. FCP | Est. LCP | Est. TTI | Est. Score | Notes |
|------|----------|----------|----------|------------|-------|
| Landing (`/prospecting-os`) | 0.8s | 1.5s | 2.0s | 85-90 | Static-ish, good |
| Client Portal (`/client-portal`) | 1.2s | 2.5s | 3.0s | 70-80 | Multiple API calls on load |
| Admin Clients (`/admin/clients`) | 1.0s | 2.0s | 2.5s | 75-85 | Data-heavy, paginated |

**Run manually:**
```bash
npx lighthouse https://app.flow-forges.com/prospecting-os --view
npx lighthouse https://app.flow-forges.com/prospecting-os/client-portal --view
npx lighthouse https://app.flow-forges.com/prospecting-os/admin/clients --view
```

### 6.2 Known Frontend Issues (from code review)

- ⚠️ `middleware.ts` runs `supabaseAdmin.from("profiles").select(...)` on EVERY request — adds 50-150ms to every page load
- ⚠️ No React Suspense boundaries visible — large client lists may block rendering
- ⚠️ RAW `<img>` tags require full basePath prefix (`/prospecting-os/assets/...`) — easy to miss
- ✅ Next.js `assetPrefix` configured for `next/image` — automatic optimization
- ✅ `<Link>` paths are short (auto-prefixed) — consistent pattern

### 6.3 Frontend Recommendations

1. **Cache profile lookup in middleware** — use `Cache-Control` or a lightweight session cookie to avoid DB lookup on every request
2. **Add Suspense boundaries** at page level for data-heavy routes
3. **Consider ISR** for semi-static pages like pricing, blog
4. **Audit bundle size** — run `ANALYZE=true npm run build` to check for unused JS

---

## 7. Capacity Estimate — Maximum Concurrent Users

### 7.1 Database Limit Calculation

```
Supabase free tier: 60 connections
Reserved for Supabase internal: ~10
Available for app: 50

Average API call duration: 100ms
Connection pool throughput: 50 / 0.1 = 500 requests/sec
Concurrent users (10 req/min each): 500 / (10/60) = ~3,000 theoretical

BUT: With pooling disabled (direct connections), each request ties up a connection
for the full duration. Sustained concurrency: 50 simultaneous API calls.

Realistic ceiling (80% utilization): ~40 concurrent requests
Concurrent users (dashboard): ~40 / 3 calls-per-page-load = ~13
```

### 7.2 Vercel Limit Calculation

```
Hobby plan soft limit: ~100 concurrent executions
Each user page load: 1-3 API calls
Concurrent users (API): ~100 / 2 = ~50

Pro plan: ~1000 concurrent executions → ~500 concurrent users
```

### 7.3 Final Estimate Table

| Component | Max Concurrent Users | Limiting Factor |
|-----------|---------------------|-----------------|
| Landing page (`/`) | **Unlimited** | CDN-cached static page |
| Blog pages | **Unlimited** | ISR/SSG cached |
| Client Portal Dashboard | **~40** | DB connections (60 max, ~3 queries/page) |
| Admin Dashboard | **~30** | DB connections + heavier queries |
| Lead Generation | **~5-10 concurrent runs** | Apify API rate limits + 120s function timeout |
| Booking Page | **~200** | Lightweight, mostly static + one API call |
| **Overall System (Hobby)** | **~40-50 concurrent active users** | DB connection pool (60 max) |
| **Overall System (Pro + pooled)** | **~200-500** | Vercel concurrent execution limit |

### 7.4 Upgrade Path

| Scale | What to Upgrade | Est. Monthly Cost |
|-------|----------------|-------------------|
| **0-50 users** | Current (Hobby + Free Supabase) | $0 |
| **50-200 users** | Vercel Pro ($20/mo) + Supabase Pro ($25/mo) | ~$45/mo |
| **200-1000 users** | Add pgBouncer/PgBoss queue | ~$100/mo |
| **1000+ users** | Dedicated Supabase + Vercel Team | ~$500+/mo |

---

## 8. Actionable Recommendations (Ordered by Urgency)

### 🔴 IMMEDIATE (This Week — Security Critical)

1. **Add Telegram webhook signature verification** — `api/agent/telegram` currently accepts any POST. Implement HMAC-SHA256 verification using the bot token as secret key.

2. **Add authentication to `api/appointments` PATCH** — currently unauthenticated. Anyone can mark appointments as "won" and receive onboarding tokens. Require session or token-based auth.

3. **Remove hardcoded `GMAPS_RUNNER_SECRET` fallback** — replace `|| "gmaps-runner-v1"` with a check that returns 500 if env var is unset. Apply to all 5 gmaps-outreach routes.

4. **Fix `api/agents/run` and `api/agents/digest` auth bypass** — always require CRON_SECRET. Return 500 if unset instead of skipping auth.

5. **Fix `paddle_subscriptions` and `paddle_transactions` RLS policies**
   ```sql
   ALTER POLICY service_role_all_subs ON paddle_subscriptions TO service_role;
   ALTER POLICY service_role_all_txns ON paddle_transactions TO service_role;
   ```

6. **Enable RLS on `gmaps_outreach_queue`**
   ```sql
   ALTER TABLE gmaps_outreach_queue ENABLE ROW LEVEL SECURITY;
   CREATE POLICY service_role_all ON gmaps_outreach_queue FOR ALL TO service_role USING (true);
   ```

7. **Add policies for `client_leads` and `client_icebreakers`**
   ```sql
   CREATE POLICY workspace_select ON client_leads FOR SELECT 
     USING (workspace_id IN (SELECT id FROM client_workspaces WHERE client_user_id = auth.uid()));
   CREATE POLICY service_role_all ON client_leads FOR ALL TO service_role USING (true);
   ```

8. **Revoke anon EXECUTE on `get_user_role()`**
   ```sql
   REVOKE EXECUTE ON FUNCTION get_user_role() FROM anon, authenticated;
   GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
   ```

9. **Enable leaked password protection** in Supabase Auth settings

### 🟠 HIGH (Next 2 Weeks)

10. **Add signature verification to payment webhook legacy path** — or deprecate legacy providers entirely.

11. **Fix Resend webhook unauthenticated fallback** — return 500 if `RESEND_WEBHOOK_SECRET` is not set.

12. **Remove `apifyKey`/`anthropicKey` from onboarding save** — don't accept API keys from client body if unused.

13. **Tighten `appointments` RLS** — restrict anon_update to token-based lookup only.

14. **Add rate limiting to `POST /api/payment/create-checkout`** — validate user session.

15. **Enable `idle_in_transaction_session_timeout`** — set to 30s to prevent connection leaks.
   ```sql
   ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '30s';
   ```
16. **Add missing indexes** (see Section 3.4)
17. **Extend injection tester** to cover all 95 API routes (currently covers 17)
18. **Add security headers** in `next.config.mjs` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options

### 🟡 MEDIUM (Next Month)

19. **Add circuit breaker for Apify** — retry with backoff, timeout via AbortController
20. **Add HTTP timeouts** on all external `fetch()` calls using AbortController
21. **Add Apify → Blitz API fallback** for lead generation
22. **Set up Telegram health check ping** — verify bot token validity daily
23. **Cache profile in middleware** — reduce DB lookup per request
24. **Add `EXPLAIN ANALYZE` monitoring** for slow query detection
25. **Enable `pg_stat_statements`** for production query profiling
26. **Add VACUUM scheduling** — `profiles` table has 6.5× dead-to-live ratio
27. **Add Dodo webhook replay protection** — validate timestamp/nonce in webhook payload

### 🔵 LOW (This Quarter)

28. **Upgrade to Vercel Pro** — for higher concurrent execution limits
29. **Upgrade Supabase plan** — for >60 connection pool
30. **Add ISR for semi-static pages** (pricing, blog listing)
31. **Implement email retry queue** — store failed emails for manual/automatic retry
32. **Set up Dodo status monitoring** — webhook to alert if Dodo is down
33. **Add Sentry/Logflare** for production error tracking at scale
34. **Consider Edge Functions** for middleware auth to reduce cold starts
35. **Add CORS policy** — restrict cross-origin access to public endpoints only

---

## Appendix A: Environment Variables Checklist

| Variable | Used In | Rotation Needed? |
|----------|---------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | ❌ Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server (also used as API "secret") | ⚠️ Rotate if exposed |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | ✅ Rotate quarterly |
| `APIFY_API_KEY` | Lead gen, scraping | ✅ Rotate quarterly |
| `ANTHROPIC_API_KEY` | Icebreakers, chat | ✅ Rotate quarterly |
| `GEMINI_API_KEY` | Lead gen, chat, blog | ✅ Rotate quarterly |
| `CRON_SECRET` | Cron endpoints | ✅ Rotate quarterly |
| `DODO_WEBHOOK_SECRET` | Payment webhook | ✅ Rotate quarterly |
| `RESEND_API_KEY` | Email sending | ✅ Rotate quarterly |
| `RESEND_WEBHOOK_SECRET` | Inbound email webhook | ✅ Rotate quarterly |
| `TELEGRAM_BOT_TOKEN` | Bot API | ✅ Rotate if compromised |

## Appendix B: Full Table Inventory with RLS Status

| Table | RLS | Policies | Risk |
|-------|-----|----------|------|
| `gmaps_outreach_queue` | ❌ OFF | N/A | 🔴 CRITICAL |
| `paddle_subscriptions` | ✅ ON | 1 (public!) | 🔴 CRITICAL |
| `paddle_transactions` | ✅ ON | 1 (public!) | 🔴 CRITICAL |
| `client_leads` | ✅ ON | 0 | 🔴 CRITICAL |
| `client_icebreakers` | ✅ ON | 0 | 🔴 CRITICAL |
| `pending_transactions` | ✅ ON | 0 | 🔴 CRITICAL |
| `appointments` | ✅ ON | 5 (2 overly permissive) | 🟠 HIGH |
| `email_captures` | ✅ ON | 4 (2 overly permissive) | 🟠 HIGH |
| `dodo_payments` | ✅ ON | 1 (service_role) | 🟢 GOOD |
| `dodo_subscriptions` | ✅ ON | 1 (service_role) | 🟢 GOOD |
| `linkedin_queue` | ✅ ON | 1 (service_role) | 🟢 GOOD |
| `profiles` | ✅ ON | 5 (proper) | 🟢 GOOD |
| `leads` | ✅ ON | 4 (proper) | 🟢 GOOD |
| `client_workspaces` | ✅ ON | 2 (proper) | 🟢 GOOD |
| 16 others | ✅ ON | 0 | 🟡 INFO (API-gated) |
| All `aadi.*` (18) | ❌ OFF | N/A | 🟡 INFO (separate schema) |

---

*Report generated autonomously by Claude Code using Supabase MCP, codebase analysis, and static reasoning. Some load test values are modeled estimates — actual testing recommended for production capacity planning.*
