# Agentic Workforce — Phase 1 Design Spec

**Date:** 2026-05-17  
**Scope:** Phase 1 — Agent Infrastructure (runtime, registry, command center UI, notifications)  
**Project:** lead-engine (Prospecting OS)  
**Status:** Approved — ready for implementation planning

---

## Goal

Build the foundational infrastructure for an autonomous agentic workforce that runs Prospecting OS 24/7 without manual intervention. Phase 1 delivers: the agent dispatcher, the agent module system, the database registry, the `/admin/agents` command center, and the Telegram + email notification system. Individual agent logic (Phase 2), self-learning (Phase 3), and event-driven triggers (Phase 4) are explicitly out of scope here.

---

## Decisions Summary

| Concern | Decision |
|---|---|
| Execution model | Hybrid — Vercel Cron as baseline, event triggers deferred to Phase 2 |
| Autonomy | Auto-execute safe actions; queue risky actions for Telegram approval |
| Agent roster | 8 agents registered in Phase 1 (Finance Watcher already live) |
| Architecture | Shared dispatcher + TypeScript module system (Approach B) |
| Command center | `/admin/agents` — Full Mission Control (status board + approval inbox + notifications log + activity feed) |
| Notifications | Telegram for real-time approvals and alerts; Resend email for 6 AM daily digest; both mirrored in command center |

---

## Architecture

```
Vercel Cron (7 AM)  ──┐
Manual Trigger       ──┤──▶  /api/agents/run  ──▶  AgentDispatcher
Future: DB Webhook   ──┘                              │
                                                      │ reads agents table (enabled only)
                                                      │ runs lib/agents/*.ts in parallel (25s timeout each)
                                                      │
                                        ┌─────────────┴─────────────┐
                                        ▼                           ▼
                                  AgentResult.safeActions    AgentResult.riskyActions
                                        │                           │
                                  auto-execute                write to agent_actions
                                  immediately                 (status: pending)
                                        │                           │
                                        └──────────┬────────────────┘
                                                   │
                                          write to agent_runs
                                          update agents table
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                             /admin/agents    Telegram bot   Resend email
                             (reads DB)       (approval req)  (6 AM digest)
```

### Key invariant
The database is the source of truth. Telegram and email are delivery channels only — every notification they carry is also stored in `agent_actions` and readable in the command center without opening Telegram.

---

## Database Schema

Three new tables. All use `supabaseAdmin` (service role) for writes from cron. RLS: `super_admin` only for SELECT; service role for INSERT/UPDATE.

### `agents`

```sql
CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,         -- slug: "lead-scout"
  display_name    TEXT NOT NULL,                -- "Lead Scout"
  description     TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  schedule        TEXT NOT NULL,               -- cron: "0 7 * * *"
  last_run_at     TIMESTAMPTZ,
  last_run_status TEXT,                        -- success | failed | partial | skipped
  health_score    INT DEFAULT 100,             -- 0-100, recomputed from last 7 runs
  config          JSONB DEFAULT '{}',          -- agent-specific config knobs
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### `agent_actions`

Approval queue. Every risky action an agent wants to take, plus every notification sent (safe auto-executed actions are NOT recorded here — only things that were queued or notified).

```sql
CREATE TABLE agent_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name      TEXT NOT NULL,
  batch_run_id    UUID NOT NULL,               -- groups actions from one cron tick
  action_type     TEXT NOT NULL,               -- "launch_sequence" | "archive_leads" | "hot_lead_alert" | ...
  description     TEXT NOT NULL,               -- human-readable: "Launch Sequence-3 for 4 leads"
  payload         JSONB NOT NULL DEFAULT '{}', -- data needed to execute: { sequence_id, lead_ids }
  risk_level      TEXT NOT NULL,               -- safe_notify | medium | high
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | executed | notified
  notified_via    TEXT[] DEFAULT '{}',         -- ["telegram", "email"]
  telegram_msg_id TEXT,                        -- to edit message after resolution
  approved_by     TEXT,                        -- email of approver
  created_at      TIMESTAMPTZ DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);
```

**`risk_level` values:**
- `safe_notify` — already executed automatically. Logged to `agent_actions` for the command center activity feed. Telegram is NOT fired for every `safe_notify` — only for specific high-value types (`hot_lead_alert`). Status immediately set to `notified`.
- `medium` — needs approval. Written to queue, Telegram approval message sent.
- `high` — needs approval. Telegram message sent with extra warning context.

### `agent_runs`

Full execution log per agent per batch. Powers the activity feed and daily email digest.

```sql
CREATE TABLE agent_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name            TEXT NOT NULL,
  batch_run_id          UUID NOT NULL,          -- same value for all agents in one cron tick
  started_at            TIMESTAMPTZ NOT NULL,
  completed_at          TIMESTAMPTZ,
  duration_ms           INT,
  outcome               TEXT NOT NULL,          -- success | failed | partial | skipped
  safe_actions_count    INT DEFAULT 0,
  risky_actions_queued  INT DEFAULT 0,
  log                   TEXT NOT NULL DEFAULT '', -- full narrative of what happened
  error                 TEXT,                   -- stack trace if outcome = failed
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Index for activity feed queries
CREATE INDEX agent_runs_batch_run_id_idx ON agent_runs (batch_run_id);
CREATE INDEX agent_runs_agent_name_created_idx ON agent_runs (agent_name, created_at DESC);
```

**`health_score` computation** (run after each batch):
```
health = (successes_last_7_runs / 7) * 100
```
Partial = 0.5 weight. Failed = 0 weight. Stored on `agents.health_score`.

---

## Agent Module Interface

```typescript
// lib/agents/types.ts

export interface AgentAction {
  type: string;                         // "launch_sequence" | "archive_leads" | "send_email" | ...
  description: string;                  // human-readable, shown in approval UI
  payload: Record<string, unknown>;     // data needed to execute the action
  riskLevel: "safe_notify" | "medium" | "high";
}

export interface AgentResult {
  outcome: "success" | "partial" | "failed" | "skipped";
  log: string;                          // narrative paragraph for activity feed + email digest
  safeActionsExecuted: number;          // count of things already done
  actionsToQueue: AgentAction[];        // risky (needs approval) + safe_notify (already done, just inform)
}

export interface AgentModule {
  name: string;                         // must match agents.name slug
  displayName: string;
  description: string;
  run(config: Record<string, unknown>): Promise<AgentResult>;
}
```

### Adding a new agent
1. Create `lib/agents/<name>.ts` implementing `AgentModule`
2. Import and add to `AGENT_REGISTRY` array in `lib/agents/dispatcher.ts`
3. Insert one row into the `agents` table (via migration or Supabase dashboard)

No other changes required.

---

## Agent Roster (Phase 1)

All 8 agents are registered in the `agents` table. Only Finance Watcher has implementation in Phase 1 (it's already live). The other 7 are registered with `enabled: false` and a stub `run()` that returns `{ outcome: "skipped", log: "Not yet implemented", ... }`. They become enabled in Phase 2 as each is implemented.

| Agent | Slug | Schedule | Phase 1 Status |
|---|---|---|---|
| Lead Scout | `lead-scout` | 7 AM daily | Stub (enabled Phase 2) |
| Outreach Agent | `outreach-agent` | 8 AM daily | Stub |
| Pipeline Manager | `pipeline-manager` | 9 AM daily | Stub |
| ICP Analyst | `icp-analyst` | Sun 8 AM | Stub |
| Client Reporter | `client-reporter` | Sun 8 AM | Stub |
| Finance Watcher | `finance-watcher` | 9 AM daily | **Live — own cron, writes to agent_runs** |
| Data Janitor | `data-janitor` | 4 AM daily | Stub |
| Message Coach | `message-coach` | 10 AM daily | Stub |

Finance Watcher: its existing `/api/agent/finance/cron` logic stays unchanged. Phase 1 just inserts its row into `agents` and writes its outcomes to `agent_runs` so it appears in the command center.

---

## Safe vs Risky Actions

Agents must classify every action before returning it. This table is the canonical definition — agents must not reclassify unilaterally.

| Action | Risk Level | Execution |
|---|---|---|
| Update `leads.kanban_column` | safe_notify | Auto |
| Update `leads.score` | safe_notify | Auto |
| Insert into `activity_log` | safe_notify | Auto |
| Insert into `lead_activity_log` | safe_notify | Auto |
| Update `leads.status` | safe_notify | Auto |
| Update `agents.health_score` | safe_notify | Auto |
| Update `profiles.icp_preferences` score threshold | safe_notify | Auto (with notify) |
| Flag lead as stale (update `leads.notes`) | safe_notify | Auto |
| Launch a sequence for leads | **medium** | Queue |
| Send email (non-sequence) | **medium** | Queue |
| Create or modify a campaign | **medium** | Queue |
| Update a sequence template | **medium** | Queue |
| Archive leads (`status = archived`) | **medium** | Queue |
| Send client report | **medium** | Queue |
| Delete any record | **high** | Queue |
| Bulk status change (>10 leads) | **high** | Queue |
| Modify another agent's `config` | **high** | Queue |

---

## AgentDispatcher

```typescript
// lib/agents/dispatcher.ts

const AGENT_REGISTRY: AgentModule[] = [
  new LeadScoutAgent(),
  new OutreachAgent(),
  new PipelineManagerAgent(),
  new IcpAnalystAgent(),
  new ClientReporterAgent(),
  // Finance Watcher NOT here — it runs on its own 9 AM cron and writes to agent_runs directly
  new DataJanitorAgent(),
  new MessageCoachAgent(),
];

const AGENT_TIMEOUT_MS = 25_000;

export async function runAgentBatch(): Promise<void> {
  const batchRunId = crypto.randomUUID();
  const enabledSlugs = await getEnabledAgentSlugs(); // reads agents table

  const tasks = AGENT_REGISTRY
    .filter(a => enabledSlugs.includes(a.name))
    .map(agent => runWithTimeout(agent, batchRunId, AGENT_TIMEOUT_MS));

  const results = await Promise.allSettled(tasks);

  // For each result:
  // 1. Write to agent_runs
  // 2. Insert agent_actions rows for actionsToQueue
  // 3. Fire Telegram messages for medium/high risk actions
  // 4. Fire Telegram for safe_notify if it's a hot lead alert
  // 5. Update agents.last_run_at, last_run_status, health_score
}
```

**Timeout handling:** if an agent exceeds 25s, it's marked `outcome: "failed"` with `error: "Timed out after 25s"`. The other agents are unaffected.

---

## New Files & Routes

```
lib/
├── agents/
│   ├── types.ts              # AgentModule, AgentAction, AgentResult interfaces
│   ├── dispatcher.ts         # runAgentBatch(), runWithTimeout(), getEnabledAgentSlugs()
│   ├── lead-scout.ts         # stub
│   ├── outreach-agent.ts     # stub
│   ├── pipeline-manager.ts   # stub
│   ├── icp-analyst.ts        # stub
│   ├── client-reporter.ts    # stub
│   ├── finance-watcher.ts    # NOT in dispatcher — existing cron writes to agent_runs directly
│   ├── data-janitor.ts       # stub
│   └── message-coach.ts      # stub

app/
├── admin/
│   └── agents/
│       └── page.tsx          # Full Mission Control UI
├── api/
│   └── agents/
│       ├── run/route.ts      # POST — main dispatcher cron endpoint
│       ├── approve/route.ts  # POST — Telegram callback + email one-click approve
│       └── digest/route.ts   # GET — 6 AM daily email digest cron

supabase/
└── migrations/
    └── 20260517_agentic_workforce.sql  # agents + agent_actions + agent_runs tables + RLS
```

**`vercel.json` cron additions:**
```json
{ "path": "/api/agents/run",    "schedule": "0 7 * * *" },
{ "path": "/api/agents/digest", "schedule": "0 6 * * *" }
```

Finance Watcher's existing `0 9 * * *` cron stays. The Finance Watcher agent module calls it internally.

---

## Command Center UI — `/admin/agents`

Server component (force-dynamic) — reads directly from Supabase at request time. No polling needed; user refreshes to see latest state.

**Layout (top to bottom):**

1. **Page header** — title, last batch time, next batch time, "Run All Now" button (calls `POST /api/agents/run` with `CRON_SECRET`)

2. **Agent Status Grid** — 8 cards in a 4-column grid. Each card:
   - Agent display name
   - Status dot: green (success), amber (pending approval), blue (idle/scheduled), red (failed)
   - Last run time + duration
   - One-line outcome from `agent_runs.log` (first sentence)
   - Enabled/disabled toggle (PATCH `agents.enabled`)

3. **Command Inbox tabs:**
   - **Pending Approvals** (badge: count of `agent_actions WHERE status = 'pending'`)  
     Each row: agent chip, risk level chip, description, timestamp, Approve + Reject buttons  
     Approve → POST `/api/agents/approve` → executes payload, sets status = executed  
     Reject → same endpoint, status = rejected  
     Resolved rows stay visible (greyed out) with approval badge
   - **Notifications Log** (badge: count from today)  
     All `agent_actions` ordered by `created_at DESC`, showing channel badges (`Telegram`, `Email`, `Telegram + Email`), description, and status
   - **Activity Feed**  
     All `agent_runs` ordered by `created_at DESC`, grouped by `batch_run_id`, full `log` text per agent

**Access control:** `super_admin` only — existing middleware guards `/admin/*`.

---

## Notification System

### Telegram (real-time)

**Approval request** (for `medium` and `high` risk actions):
```
[Agent Name] — Approval Needed

[action description]

Risk: [Medium|High] · Queued at [time]

[Approve ✓]  [Reject ✗]  [View Dashboard →]
```
Callback data: `approve:<action_id>` / `reject:<action_id>`  
Handler: existing `/api/agent/telegram` webhook — add `approve:` and `reject:` cases.  
After resolution: edit original Telegram message to show outcome.

**Hot lead alert** (auto-executed, no approval):
```
[Lead Scout] — Hot Lead

[Name] · [Title] · [Company]
Score: [N]/100 · ICP match: [N]/9
→ Moved to Hot Lead column automatically

[View Lead →]
```

**Error alert** (if any agent outcome = `failed`):
```
[Agent Name] — Failed

[first line of error]
Duration: [N]s

[View Dashboard →]
```

### Resend Email (6 AM daily digest)

- **From:** `agents@flow-forges.com` (Resend domain)
- **To:** `NOTIFY_EMAIL` env var
- **Subject:** `Agent Report · [date] · [N] pending approvals` (N = 0 means clean run)
- **Content:** HTML email with summary stats, per-agent highlights, pending approval list with one-click approve/reject links (signed token via `CRON_SECRET`), and tomorrow's scheduled runs.
- One-click approve link: `GET /api/agents/approve?id=<action_id>&token=<hmac_signed_token>` — no login required, token expires in 24h.

---

## Out of Scope (Phase 1)

- Individual agent implementations (Lead Scout logic, Outreach Agent logic, etc.) — Phase 2
- Event-driven triggers (Supabase webhooks, DB listeners) — Phase 2
- Self-learning / mistake logging / memory system — Phase 3
- Multi-agent coordination (agents talking to each other) — Phase 3
- Guardrails beyond the safe/risky classification — Phase 4
- `/progress` page update to show agentic workforce section — small add-on, can do alongside Phase 1

---

## Environment Variables Required

No new env vars. All required vars already exist:
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram notifications
- `RESEND_API_KEY`, `NOTIFY_EMAIL` — email digest
- `SUPABASE_SERVICE_ROLE_KEY` — agent DB writes
- `CRON_SECRET` — secure cron endpoints + email approve tokens

---

## What "Done" Looks Like for Phase 1

- [ ] DB migration applied: `agents`, `agent_actions`, `agent_runs` tables with RLS
- [ ] All 8 agents seeded in `agents` table (7 stubs disabled, Finance Watcher enabled)
- [ ] `lib/agents/types.ts` — interfaces defined
- [ ] `lib/agents/dispatcher.ts` — runAgentBatch() working, runs enabled agents, logs to agent_runs
- [ ] `lib/agents/finance-watcher.ts` — thin wrapper, Finance Watcher visible in command center
- [ ] `/api/agents/run` — cron endpoint, secured with CRON_SECRET, calls dispatcher
- [ ] `/api/agents/approve` — Telegram callback + email one-click approve/reject
- [ ] `/api/agents/digest` — 6 AM cron, sends Resend email digest
- [ ] `/admin/agents` — Full Mission Control UI (all 4 sections)
- [ ] Telegram approval flow end-to-end (queue → notify → approve/reject → edit message)
- [ ] `vercel.json` — 2 new cron entries added
