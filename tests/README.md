# Prospecting OS — Test Suite

Comprehensive testing suite for the Flow Forges Prospecting OS (lead-engine). Covers E2E flows, security vulnerability scanning, and predictive monitoring — all runnable locally and via CI/CD.

## Directory Structure

```
tests/
├── e2e/                          # End-to-end flow tests
│   ├── features/
│   │   └── onboarding_flow.feature  # Gherkin feature: booking → onboarding → leads
│   ├── steps/
│   │   └── onboarding_steps.ts      # Playwright step definitions
│   └── playwright.config.ts        # Playwright configuration
├── security/                     # Security vulnerability tests
│   ├── rls_policy_tester.spec.ts    # Row-Level Security policy validation
│   ├── api_injection_tester.ts      # SQL/command injection, parameter pollution
│   └── payment_bypass_tester.ts     # Webhook signature, idempotency, tampering
├── monitoring/                   # Predictive monitoring & anomaly detection
│   ├── performance_tracker.ts       # API latency tracking with SQLite + anomaly detection
│   ├── anomaly_detector.py          # Vercel log analysis + error spike detection
│   └── metrics_alerter.ts           # Daily business metrics: MRR, clients, lead gen
├── utils/                        # Shared test utilities
│   ├── supabase_client.ts           # Supabase client factory (anon, admin, auth)
│   ├── test_data_generator.ts       # Random realistic test data generators
│   └── mock_payment_server.ts       # Lightweight Dodo webhook simulator
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

GitHub Actions workflow: `.github/workflows/test.yml`

## Prerequisites

### 1. Install Dependencies

```bash
cd tests

# Node.js dependencies
npm install

# Playwright browsers (for E2E tests)
npx playwright install --with-deps chromium

# Python dependencies (for anomaly detector)
pip install requests python-telegram-bot
```

### 2. Environment Variables

Create a `.env` file in the `tests/` directory (or set in your shell):

```bash
# Required for all tests
export NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Required for E2E tests
export APP_URL="http://localhost:3000"  # or "https://app.flow-forges.com"
export TEST_SUPERADMIN_EMAIL="admin@flow-forges.com"
export TEST_SUPERADMIN_PASSWORD="<admin-password>"

# Required for security tests
export DODO_WEBHOOK_SECRET="<dodo-secret>"
export CRON_SECRET="<cron-secret>"

# Optional: Monitoring & alerts
export VERCEL_TOKEN="<vercel-api-token>"
export TELEGRAM_BOT_TOKEN="<telegram-bot-token>"
export TELEGRAM_CHAT_ID="<telegram-chat-id>"
```

## Running Tests

### Quick Start

```bash
# Run all security + E2E tests
npm run test:ci
```

### Individual Suites

```bash
# ── Security ───────────────────────────────────────────
npm run test:security              # All security tests
npm run test:security:rls          # RLS policy validation only
npm run test:security:injection    # API injection scan only
npm run test:security:payment      # Payment bypass tests only

# ── E2E ───────────────────────────────────────────────
npm run test:e2e:playwright        # Playwright E2E (Chromium)
npm run test:e2e                   # Cucumber feature + step defs

# ── Monitoring ────────────────────────────────────────
npm run test:monitoring:performance  # API latency + anomaly detection
npm run test:monitoring:metrics      # Business metrics day-over-day
npm run test:monitoring:anomaly      # Vercel log spike detection
```

### Mock Payment Server

```bash
# Start mock server (for offline payment bypass testing)
npx ts-node utils/mock_payment_server.ts

# Custom port
MOCK_PAYMENT_PORT=4567 npx ts-node utils/mock_payment_server.ts
```

## Test Suites Explained

### 🔒 Security Tests

| Test | What It Checks | Exit Code |
|------|---------------|-----------|
| **RLS Policy Tester** | Anonymous can't read protected tables; non-admin can't modify others' data; cross-tenant isolation | 1 if any policy allows unauthorized access |
| **API Injection Tester** | SQL injection, command injection, parameter pollution across all API routes | 1 if any endpoint returns 500 or leaks data |
| **Payment Bypass Tester** | Dodo webhook signature verification, replay/idempotency, tampered payloads, malformed JSON | 1 if any bypass is successful |

### 🧪 E2E Tests

Covers the complete business flow:
1. **Public booking** → prospect books a meeting
2. **Admin processing** → super admin marks appointment as Won
3. **Onboarding** → ICP config + payment via test card (4242...)
4. **Lead generation** → polls until status `ready` (max 120s)
5. **Portal verification** → leads visible, no email column, right-click disabled
6. **Admin verification** → client appears in admin list, metrics update

### 📊 Monitoring

| Script | Frequency | What It Does |
|--------|-----------|-------------|
| **Performance Tracker** | Every CI run / cron | Probes 4 key API endpoints, records latency in SQLite, alerts if >2σ deviation |
| **Anomaly Detector** | Every CI run / cron | Fetches Vercel logs, buckets errors by 5-min intervals, flags spikes |
| **Metrics Alerter** | Daily 09:00 UTC | Queries Supabase for MRR, new clients, lead gen success, payment activations |

## Interpreting Output

### Success
```
✅ PASS: Anonymous cannot read profiles
✅ All RLS policies are properly configured.
```

### Vulnerability Found
```
🚨 VULNERABILITY [CRITICAL] — anon-read-profiles
   Anonymous user should not be able to read profiles table
   Expected: Error or empty result
   Actual: Returned 15 profile(s)
```

### Performance Anomaly
```
⚠️  ANOMALY: api_admin_clients_latency: 3420ms vs avg 245ms (±180ms)
```

### Business Metric Alert
```
⚠️ New Clients: -66.7% day-over-day
Yesterday: 3 → Today: 1
```

## Adding New Tests

### New E2E Scenario
1. Add a scenario to `e2e/features/onboarding_flow.feature`
2. Implement step definitions in `e2e/steps/onboarding_steps.ts`
3. Run: `npm run test:e2e`

### New Security Test
1. Create `security/my_new_tester.ts`
2. Add `assert`-based checks and use `process.exitCode = 1` for failures
3. Add script to `package.json`: `"test:security:my-test": "npx ts-node tests/security/my_new_tester.ts"`
4. Run: `npm run test:security:my-test`

### New API Route for Injection Testing
Add the route to the `API_ROUTES` array in `security/api_injection_tester.ts`:

```typescript
{ method: "GET", path: "/api/my-new-endpoint", requiresAuth: true },
```

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/test.yml`) runs:
- **On push to `main`**: Security + E2E tests
- **On PR to `main`**: Security + E2E tests + PR comment on failure
- **Daily at 03:00 UTC**: Security + Monitoring (performance, anomaly, metrics)
- **Manual dispatch**: Select specific suite to run

Required GitHub Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DODO_WEBHOOK_SECRET`, `CRON_SECRET`, `TEST_SUPERADMIN_EMAIL`, `TEST_SUPERADMIN_PASSWORD`, `VERCEL_TOKEN` (optional), `TELEGRAM_BOT_TOKEN` (optional), `TELEGRAM_CHAT_ID` (optional).

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ts-node` not found | Run `npm install` in `tests/` directory |
| Playwright browser not found | Run `npx playwright install --with-deps chromium` |
| Supabase connection refused | Check env vars: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| E2E tests timeout | Increase timeout in `playwright.config.ts` or check `APP_URL` is reachable |
| Python `ModuleNotFoundError` | Run `pip install requests python-telegram-bot` |
| Payment bypass tests all fail | Verify `DODO_WEBHOOK_SECRET` matches the production secret |

## Architecture Notes

- **All DB operations in tests use supabaseAdmin** (service role) — tests bypass RLS by design to set up/tear down data, then use anon/authenticated clients for actual security assertions
- **Test data isolation**: All generated emails use `@flow-forges-test.com` domain. After each scenario, cleanup removes all test data
- **No real payments**: The payment bypass tester forges Dodo webhook payloads; the mock payment server captures without processing
- **SQLite for metrics**: Performance tracker uses local SQLite (`monitoring/metrics.db`) to avoid polluting production Supabase
