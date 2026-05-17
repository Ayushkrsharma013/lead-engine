# Command Center Automation — Design Spec

**Date:** 2026-05-17  
**Status:** Approved  
**Scope:** Agent Command Center full upgrade — in-UI approve/reject with immediate execution + per-agent detail pages

---

## Problem

The Agent Workforce Command Center (`/admin/agents`) is read-only. Pending risky actions can only be approved via Telegram or email one-click links. The `resolver.ts` dispatch block is a stub. Agent cards navigate to `/admin/agents/[name]` but that route does not exist. There is no way to trigger a single agent, toggle an agent on/off, or see per-agent analytics from the UI.

---

## Approach

Hub + spoke architecture.

- `/admin/agents` — command center (existing page, enhanced with approve/reject)
- `/admin/agents/[name]` — per-agent detail page (new)

All approval logic runs through a new `POST /api/agents/resolve` endpoint that dispatches synchronously by `action_type`. The existing Telegram and email approval paths are updated to call the same resolver so execution is consistent regardless of channel.

---

## Architecture

### 1. `app/admin/agents/page.tsx` (updated)

The Pending Approvals section gains interactive rows:

- Each row is **collapsed by default** — shows description, agent name, risk chip, age, notification channels
- **Clicking the row expands** a payload preview panel showing: operation name, affected records (lead chips if applicable), reversibility note, and human-readable what-will-execute text
- Approve and Reject buttons appear only in the expanded panel
- Clicking **Approve & Execute** calls `POST /api/agents/resolve { actionId, decision: "approve" }`
  - Row shows a spinner while in-flight
  - On success: row dims, strikes through, flips to green resolved state with execution message
  - On failure: row turns red with the error message inline (not dismissed)
- Clicking **Reject** calls the same endpoint with `decision: "reject"` — row dims to red resolved state
- Race condition guard: if action already resolved, a toast says "Already resolved: \<status\>"

No other changes to the command center page. Charts, activity feed, and agent grid are unchanged.

### 2. `app/api/agents/resolve/route.ts` (new)

```
POST { actionId: string, decision: "approve" | "reject" }
```

Auth: reads `x-user-role` header — rejects with 403 if not `super_admin`.

On approve: calls `resolveAgentAction(actionId, true, "super_admin")` from `lib/agents/resolver.ts`.  
On reject: calls `resolveAgentAction(actionId, false, "super_admin")`.  
Returns `{ success: boolean, message: string }` — always HTTP 200. The caller distinguishes success/failure from the `success` field.

### 3. `lib/agents/resolver.ts` (updated)

The `// Phase 2: dispatch` stub is replaced with `dispatchAction(action: AgentActionRow)`:

```
switch action.action_type:
  "launch_sequence"      → launchSequence(payload.sequenceId, payload.leadIds)  [sequence-engine.ts]
  "advance_kanban_lead"  → batchUpdateLeadKanban(payload.leadIds, payload.column, payload.status)  [db.ts]
  "archive_stale_lead"   → batchUpdateLeadStatus(payload.leadIds, "archived")  [db.ts]
  "update_lead_score"    → supabaseAdmin UPDATE leads SET score WHERE id IN payload.leadIds
  "update_icp_threshold" → supabaseAdmin UPSERT profiles.icp_preferences SET score_threshold
  "send_client_report"   → sendEmail(payload.to, payload.subject, payload.html)  [resend.ts]
  "flag_duplicate"       → supabaseAdmin UPDATE leads SET notes WHERE id = payload.leadId
  default                → no-op (log unknown type, still marks executed)
```

`dispatchAction` throws on failure. The caller wraps it in try/catch and sets `status = "failed"` if it throws, returning the error message to the UI.

The existing Telegram + email approve paths already call `resolveAgentAction()` — they get dispatch for free. Both callers (`app/api/agent/telegram/route.ts` and `app/api/agents/approve/route.ts`) must be updated to handle the new `{ success: false }` return shape gracefully (log error, do not crash the webhook).

**New DB constraint needed:** add `"failed"` to the `agent_actions.status` CHECK constraint.

### 4. `app/admin/agents/[name]/page.tsx` (new)

Server component. Fetches data at request time via `GET /api/admin/agents/[name]`.

Layout (top to bottom):
- **Topbar** — back link to Agent Workforce, agent name with color dot, enable/disable toggle (PATCH on change), Run Now button (POST `/api/agents/run?agent=<name>` then starts 5s polling burst)
- **Hero** — health ring (SVG, matches command center style), stats row: total runs, safe actions executed, queued pending, schedule, auto-approve level
- **Charts row** (2 columns) — health score trend area chart (from `agent_runs.health_score` or computed from `agent_runs` ordered by `started_at`); action type breakdown horizontal bar chart (count per `action_type` from `agent_actions`)
- **Run log + Config** (2 columns) — last 10 runs table (outcome chip, duration, safe count, queued count, log excerpt); config JSON panel (editable textarea, saves on blur via PATCH) + guardrails summary (auto-approve level, consecutive failures, disable threshold, health gate)

Color per agent name matches `AGENT_COLORS` map from the command center.

### 5. `app/api/admin/agents/[name]/route.ts` (new)

```
GET  → returns { agent: AgentRow, runs: AgentRunRow[20], actions: AgentActionRow[20] }
       all scoped to WHERE agent_name = params.name
PATCH { enabled?: boolean, config?: Record<string, unknown> }
      → UPDATE agents SET enabled/config WHERE name = params.name
      → returns updated AgentRow
```

Auth on both: `x-user-role` header must be `super_admin`.

### 6. `app/api/agents/run/route.ts` (updated)

Add optional `?agent=<name>` query param.

If present: filter `AGENT_REGISTRY` to `[registry.find(a => a.name === agentName)]`. If not found, return 404.  
If absent: existing behaviour (run all).

The per-agent run goes through the same guardrails + health scoring as the batch run.

---

## Data Flow

### Approve flow

```
UI click "Approve & Execute"
  POST /api/agents/resolve { actionId, decision: "approve" }
    load action WHERE id AND status = "pending" — 404 if missing, 409 if already resolved
    dispatchAction(action) — synchronous, throws on failure
    UPDATE agent_actions SET status="executed", resolved_at, approved_by
    edit Telegram message (existing resolver logic)
  ← { success: true, message: "Sequence launched for 14 leads" }
UI: spinner → green resolved row
```

### Run Now flow

```
UI click "Run Now" on detail page
  POST /api/agents/run?agent=outreach-agent  (Authorization: Bearer CRON_SECRET)
    dispatcher runs OutreachAgent only
    writes agent_run row
    processes actionsToQueue (same path as batch)
  ← 200 OK
UI: polls GET /api/admin/agents/[name] every 5s for 30s → new run appears in log
```

---

## Error Handling

| Scenario | Resolver behaviour | UI behaviour |
|---|---|---|
| Dispatch throws (e.g. sequence launch fails) | Catches error, sets `status = "failed"`, returns `{ success: false, message: error }` | Row turns red with error message inline |
| Action already resolved (race condition) | Returns `{ success: false, message: "Already resolved: executed" }` with HTTP 409 | Toast: "This action was already resolved" |
| Agent not found for Run Now | `GET /api/admin/agents/[name]` returns 404 | Error state on detail page |
| Run Now timeout (25s agent timeout) | `agent_runs` row written with `outcome: "failed"` | Polling picks it up, run log shows failed row |
| Config PATCH with invalid JSON | Client-side JSON.parse before PATCH — shows parse error, does not submit | Error message below textarea |

---

## DB Changes

One migration needed:

```sql
-- Add "failed" to agent_actions status constraint
ALTER TABLE agent_actions
  DROP CONSTRAINT IF EXISTS agent_actions_status_check;

ALTER TABLE agent_actions
  ADD CONSTRAINT agent_actions_status_check
  CHECK (status IN ('pending','approved','rejected','executed','notified','failed'));
```

No new tables. No new columns (beyond the constraint change).

---

## Scope Boundaries

The following are explicitly out of scope for this implementation:

- Real-time WebSocket / Supabase Realtime on the command center (30s polling is sufficient)
- Bulk approve ("Approve All" button)
- Config validation / schema enforcement (free-form JSON textarea)
- Action history pagination beyond 20 rows
- Knowledge store visualisation on the detail page
- Digest email changes

---

## Files Changed

| File | Change |
|---|---|
| `app/admin/agents/page.tsx` | Add expand/collapse + approve/reject to Pending Approvals section |
| `app/api/agents/resolve/route.ts` | **New** — POST endpoint |
| `lib/agents/resolver.ts` | Replace dispatch stub with `dispatchAction()` switch |
| `app/admin/agents/[name]/page.tsx` | **New** — agent detail page |
| `app/api/admin/agents/[name]/route.ts` | **New** — GET + PATCH scoped to agent |
| `app/api/agents/run/route.ts` | Add `?agent=<name>` filter |
| `app/api/agent/telegram/route.ts` | Handle new `{ success: false }` from resolver |
| `app/api/agents/approve/route.ts` | Handle new `{ success: false }` from resolver |
| Supabase migration | Add `"failed"` to `agent_actions.status` constraint |

**9 changes total.** No new npm packages. No new environment variables.
