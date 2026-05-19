# LinkedIn Outreach Queue System — Design Spec
**Date:** 2026-05-20  
**Status:** Approved, ready for implementation  
**Replaces:** OpenOutreach Docker integration (which fails on datacenter IPs)

---

## Why We're Building This

OpenOutreach cannot run on the Hetzner CPX42 server. LinkedIn detects datacenter IPs
(Hetzner, AWS, DO, etc.) and immediately presents a CAPTCHA filter screen. OpenOutreach
fails silently — no error, no leads, no output.

The root cause is architectural: browser automation run from a cloud server is detectable
by LinkedIn's bot systems regardless of what software is used.

**Solution:** Move execution to the user's local machine (home residential IP, real
Chrome profile LinkedIn already trusts). The cloud handles intelligence and queue storage
only.

---

## Full System Flow

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         DAILY OUTREACH FLOW                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

  08:00 AM ──► OUTREACH AGENT (Vercel Cron)
               lib/agents/outreach-agent.ts
               │
               │  Scans leads table:
               │  • score ≥ 60
               │  • not already in linkedin_queue
               │  • status = "new" (connection request) OR
               │    status = "contacted" + connection accepted (DM follow-up)
               │
               ▼
         ┌─────────────────────────────────────────┐
         │  AgentAction (medium risk):              │
         │  type: "queue_linkedin_connections"      │
         │  payload: [                              │
         │    { leadId, profileUrl, message },      │
         │    { leadId, profileUrl, message },      │
         │    ...up to 10/day                       │
         │  ]                                       │
         └────────────────┬────────────────────────┘
                          │
                          ▼ (medium risk → Telegram approval required)
  ┌───────────────────────────────────────────────────┐
  │  TELEGRAM NOTIFICATION                             │
  │                                                    │
  │  🤖 Outreach Agent wants to queue                 │
  │  8 LinkedIn connection requests today:             │
  │                                                    │
  │  • Sarah Chen — VP Eng, Stripe (score 91)          │
  │  • Marcus Liu — Head of Growth, Linear (score 83)  │
  │  • ...6 more                                       │
  │                                                    │
  │  [✓ Approve]  [✗ Reject]                          │
  └──────────────────┬────────────────────────────────┘
                     │  You tap Approve
                     ▼
         ┌───────────────────────────┐
         │  RESOLVER                 │
         │  lib/agents/resolver.ts   │
         │                           │
         │  Writes N rows to         │
         │  linkedin_queue table     │
         │  (staggered over day)     │
         └────────────┬──────────────┘
                      │
                      ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                         SUPABASE (linkedin_queue)                            ║
║                                                                              ║
║  id  │ lead_id │ action_type         │ message      │ status  │ scheduled   ║
║  ────┼─────────┼─────────────────────┼──────────────┼─────────┼──────────── ║
║  1   │ ld_abc  │ connection_request  │ "Hi Sarah..." │ pending │ 10:15 AM   ║
║  2   │ ld_def  │ connection_request  │ "Hi Marcus..."│ pending │ 10:52 AM   ║
║  3   │ ld_ghi  │ connection_request  │ "Hi Priya..." │ pending │ 11:34 AM   ║
║  ... │ ...     │ ...                 │ ...          │ ...     │ ...         ║
╚══════════════════════════════════════════════════════════════════════════════╝
                      │
                      │  (polls every 5 min)
                      ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  LOCAL RUNNER  (runner/linkedin-runner.js)                            │
  │  Running on YOUR Windows machine — home IP — real Chrome profile      │
  │                                                                        │
  │  1. Check daily cap: connections < 10, DMs < 20?  ── NO ──► sleep    │
  │  2. Check time: 8 AM – 8 PM?  ── NO ──► sleep                        │
  │  3. Pull next pending action WHERE scheduled_for ≤ now()              │
  │  4. Mark status = "executing"                                          │
  │  5. Open Chrome (persistent profile — LinkedIn already trusts it)     │
  │  6. Navigate to lead's LinkedIn profile URL                            │
  │  7. Wait 5–15s (random — mimics reading the page)                     │
  │  8. Move mouse naturally to "Connect" button                          │
  │  9. Click → "Add a note" → type message at 80–120ms/keystroke        │
  │  10. Send → wait 30–120s (random)                                     │
  │  11. Mark status = "done"                                              │
  │  12. After every 5 actions → 15-minute break                          │
  │                                                                        │
  │  Safety hard stops:                                                    │
  │  • CAPTCHA detected → stop + Telegram alert                           │
  │  • Weekly invite limit warning → stop + Telegram alert                │
  └───────────────────────────────────┬───────────────────────────────────┘
                                      │
              ┌───────────────────────┼──────────────────────┐
              ▼                       ▼                      ▼
    ┌──────────────────┐   ┌────────────────────┐  ┌─────────────────────┐
    │  leads table      │   │ activity_log        │  │ linkedin_daily_stats│
    │                  │   │                    │  │                     │
    │ status →         │   │ "Sent LinkedIn     │  │ connections_sent: 3 │
    │  "contacted"     │   │  connection to     │  │ dms_sent: 0         │
    │ kanban_column → │   │  Sarah Chen"       │  │ last_run: 10:17 AM  │
    │  "Contacted"     │   │                    │  │                     │
    └──────────────────┘   └────────────────────┘  └─────────────────────┘
              │
              ▼
  ┌─────────────────────────────────────────┐
  │  OUTREACH PAGE (app/outreach/page.tsx)  │
  │                                         │
  │  Daily Usage                            │
  │  Connections  ████░░░░░░  3/10          │
  │  DMs          ░░░░░░░░░░  0/20          │
  │                                         │
  │  Runner Status   ● Live (2 min ago)     │
  │                                         │
  │  Pending Queue (5 actions)              │
  │  ┌──────────────┬──────────┬─────────┐  │
  │  │ Sarah Chen   │ Connect  │ 10:15AM │  │
  │  │ Marcus Liu   │ Connect  │ 10:52AM │  │
  │  │ Priya Nair   │ Connect  │ 11:34AM │  │
  │  └──────────────┴──────────┴─────────┘  │
  └─────────────────────────────────────────┘
```

---

## Sequence Engine Integration

When a sequence step has `channel: "linkedin"`, the engine currently logs it as `"skipped"`.

**New behavior:**
```
sequence step: channel="linkedin", type="connection_request", day=1
  → resolveTemplate(step.template, lead) → personalized message
  → insert into linkedin_queue:
      lead_id, sequence_execution_id, action_type="connection_request",
      message=resolved, scheduled_for=(execution.startedAt + step.day days),
      status="pending"
  → sequence_message.status = "queued" (not "skipped")
```

Day-2 DM step only runs after connection is accepted. The outreach agent detects accepted
connections (lead status = "replied") and queues the DM follow-up.

---

## Agent Integration Points

| Agent | Role |
|---|---|
| **Outreach Agent** | Identifies leads ready for outreach, queues `queue_linkedin_connections` + `queue_linkedin_dms` actions (medium risk, Telegram approval) |
| **Pipeline Manager** | Detects leads stuck in "Contacted" > 7 days with pending LinkedIn queue items → escalates to you |
| **Message Coach** | Tracks which connection note templates get accepted vs ignored — writes to knowledge store |
| **Data Janitor** | Clears `done` + `failed` queue rows older than 30 days |

**New knowledge store keys written by Outreach Agent:**
- `outreach.linkedin_queued_today` — count of items added to queue today
- `outreach.linkedin_pending_count` — total pending in queue right now
- `outreach.linkedin_acceptance_rate_7d` — % of connection requests accepted this week

---

## Files

### New files
| File | Purpose |
|---|---|
| `supabase/migrations/20260520_linkedin_queue.sql` | `linkedin_queue` + `linkedin_daily_stats` tables + RLS |
| `lib/linkedin-queue.ts` | `enqueueLinkedInAction()`, `getQueueStatus()`, `markActionDone()`, `getTodayStats()` |
| `app/api/outreach/queue/route.ts` | GET queue status + today stats / POST add manual action |
| `runner/linkedin-runner.js` | Standalone local execution daemon |
| `runner/package.json` | Dependencies: playwright, playwright-extra, @supabase/supabase-js, dotenv |
| `runner/.env.example` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, daily cap config |
| `runner/README.md` | Windows setup guide (one-time Chrome profile setup) |

### Modified files
| File | Change |
|---|---|
| `lib/sequence-engine.ts` | LinkedIn steps → write to queue instead of skip |
| `lib/agents/outreach-agent.ts` | Add LinkedIn candidate scanning + queue actions |
| `lib/agents/types.ts` | Add `queue_linkedin_connections`, `queue_linkedin_dms` action types |
| `lib/agents/resolver.ts` | Handle new action types → write to `linkedin_queue` |
| `app/outreach/page.tsx` | Rebuild: queue status, daily usage, pending table, setup guide |

**Total: 7 new + 5 modified = 12 files**

---

## Safety Limits (runner `.env`)

```
MAX_CONNECTIONS_PER_DAY=10
MAX_DMS_PER_DAY=20
MIN_DELAY_SECONDS=30
MAX_DELAY_SECONDS=120
ACTIVE_HOURS_START=8
ACTIVE_HOURS_END=20
BREAK_EVERY_N_ACTIONS=5
BREAK_DURATION_MINUTES=15
```

LinkedIn's documented soft limits: 20 connections/day, 100/week. Staying at 10/day gives
a 2× safety margin. DMs have no hard limit but 20/day is conservative.

---

## What This Does NOT Build

- No server-side browser automation (never — always detected)
- No LinkedIn API integration (Partner API doesn't support outreach for this use case)
- No residential proxy dependency (your home IP is safer than any proxy)
- No auto-reply or auto-accept (too risky, requires reading messages)
- No "unlimited sends" mode — caps are hard-coded safety rails

---

## Risk Assessment

| Scenario | Risk | Mitigation |
|---|---|---|
| Runner left running 24/7 | Medium | Active hours window 8 AM–8 PM only |
| Too many requests in one day | Low | Hard caps enforced before each action |
| LinkedIn security check mid-run | Low | Detects CAPTCHA, stops immediately, Telegram alert |
| Chrome profile expires | Low | Runner checks cookie validity on startup |
| User runs from VPN/new IP | Medium | Runner warns if IP changed since last run |
| Hetzner server accidentally runs it | None | Runner is a local CLI, never deployed to Vercel |
