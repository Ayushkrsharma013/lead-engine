# Agentic Workforce Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational agent infrastructure — dispatcher, module system, 3 DB tables, `/admin/agents` command center, Telegram approval flow, and daily email digest — that the 8-agent workforce will run on.

**Architecture:** A single Vercel Cron endpoint (`/api/agents/run`) fires at 7 AM and dispatches 7 TypeScript agent modules in parallel via `Promise.allSettled` with a 25s timeout each. Each module returns safe actions (auto-executed immediately) and risky actions (queued in `agent_actions` for Telegram approval). Finance Watcher keeps its own 9 AM cron and writes directly to `agent_runs`. All state lives in 3 new Supabase tables; the command center UI is a server component reading those tables at request time.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Supabase (supabaseAdmin service role) · Telegram Bot API · Resend HTTP API · Vercel Cron · No new npm packages

---

## File Map

**New files:**
```
supabase/migrations/20260517_agentic_workforce.sql
lib/agents/types.ts
lib/agents/tokens.ts
lib/agents/resolver.ts
lib/agents/dispatcher.ts
lib/agents/lead-scout.ts
lib/agents/outreach-agent.ts
lib/agents/pipeline-manager.ts
lib/agents/icp-analyst.ts
lib/agents/client-reporter.ts
lib/agents/data-janitor.ts
lib/agents/message-coach.ts
app/api/agents/run/route.ts
app/api/agents/approve/route.ts
app/api/agents/digest/route.ts
app/admin/agents/page.tsx
```

**Modified files:**
```
app/api/agent/finance/cron/route.ts   — add agent_runs write at end
app/api/agent/telegram/route.ts       — add callback_query handler
components/layout/Sidebar.tsx         — add Agent Command Center link in Operations
vercel.json                           — add 2 cron entries
```

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260517_agentic_workforce.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260517_agentic_workforce.sql

-- ─── agents ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  enabled         BOOLEAN NOT NULL DEFAULT false,
  schedule        TEXT NOT NULL DEFAULT '0 7 * * *',
  last_run_at     TIMESTAMPTZ,
  last_run_status TEXT,
  health_score    INT NOT NULL DEFAULT 100,
  config          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── agent_actions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name      TEXT NOT NULL,
  batch_run_id    UUID NOT NULL,
  action_type     TEXT NOT NULL,
  description     TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  risk_level      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  notified_via    TEXT[] NOT NULL DEFAULT '{}',
  telegram_msg_id TEXT,
  approved_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

-- ─── agent_runs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name           TEXT NOT NULL,
  batch_run_id         UUID NOT NULL,
  started_at           TIMESTAMPTZ NOT NULL,
  completed_at         TIMESTAMPTZ,
  duration_ms          INT,
  outcome              TEXT NOT NULL DEFAULT 'success',
  safe_actions_count   INT NOT NULL DEFAULT 0,
  risky_actions_queued INT NOT NULL DEFAULT 0,
  log                  TEXT NOT NULL DEFAULT '',
  error                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS agent_runs_batch_idx
  ON agent_runs (batch_run_id);
CREATE INDEX IF NOT EXISTS agent_runs_agent_created_idx
  ON agent_runs (agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_actions_status_idx
  ON agent_actions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_actions_batch_idx
  ON agent_actions (batch_run_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_select_agents" ON agents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

CREATE POLICY "super_admin_update_agents" ON agents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

CREATE POLICY "super_admin_select_agent_actions" ON agent_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

CREATE POLICY "super_admin_select_agent_runs" ON agent_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  ));

-- ─── Seed: 8 agents ──────────────────────────────────────────────────────────
INSERT INTO agents (name, display_name, description, enabled, schedule) VALUES
  ('lead-scout',       'Lead Scout',       'Daily Apify scrape, dedup, and ICP scoring',       false, '0 7 * * *'),
  ('outreach-agent',   'Outreach Agent',   'Sequence execution, email sends, reply handling',   false, '0 8 * * *'),
  ('pipeline-manager', 'Pipeline Manager', 'Kanban health, stale lead detection, cleanup',      false, '0 9 * * *'),
  ('icp-analyst',      'ICP Analyst',      'Score calibration and ICP pattern detection',       false, '0 8 * * 0'),
  ('client-reporter',  'Client Reporter',  'Auto-generates client portal updates and reports',  false, '0 8 * * 0'),
  ('finance-watcher',  'Finance Watcher',  'Payment tracking, MRR, activation (already live)', true,  '0 9 * * *'),
  ('data-janitor',     'Data Janitor',     'Lead dedup, archival, and DB health maintenance',   false, '0 4 * * *'),
  ('message-coach',    'Message Coach',    'A/B winner detection and message refinement',       false, '0 10 * * *')
ON CONFLICT (name) DO NOTHING;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with the SQL above targeting the production project `tbsqpnqzpbnilifhwvgr`.

Expected: migration succeeds with no errors. Verify by running:
```sql
SELECT name, enabled FROM agents ORDER BY name;
```
Expected: 8 rows returned, only `finance-watcher` has `enabled = true`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260517_agentic_workforce.sql
git commit -m "feat: add agents/agent_actions/agent_runs DB tables with RLS and seed data"
```

---

## Task 2: TypeScript Interfaces + Token Utility

**Files:**
- Create: `lib/agents/types.ts`
- Create: `lib/agents/tokens.ts`

- [ ] **Step 1: Write `lib/agents/types.ts`**

```typescript
// lib/agents/types.ts

export interface AgentAction {
  type: string;
  description: string;
  payload: Record<string, unknown>;
  riskLevel: "safe_notify" | "medium" | "high";
}

export interface AgentResult {
  outcome: "success" | "partial" | "failed" | "skipped";
  log: string;
  safeActionsExecuted: number;
  actionsToQueue: AgentAction[];
}

export interface AgentModule {
  name: string;
  displayName: string;
  description: string;
  run(config: Record<string, unknown>): Promise<AgentResult>;
}

// DB row shapes (returned from Supabase queries)
export interface AgentRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  enabled: boolean;
  schedule: string;
  last_run_at: string | null;
  last_run_status: string | null;
  health_score: number;
  config: Record<string, unknown>;
  created_at: string;
}

export interface AgentRunRow {
  id: string;
  agent_name: string;
  batch_run_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  outcome: AgentResult["outcome"];
  safe_actions_count: number;
  risky_actions_queued: number;
  log: string;
  error: string | null;
  created_at: string;
}

export interface AgentActionRow {
  id: string;
  agent_name: string;
  batch_run_id: string;
  action_type: string;
  description: string;
  payload: Record<string, unknown>;
  risk_level: "safe_notify" | "medium" | "high";
  status: "pending" | "approved" | "rejected" | "executed" | "notified";
  notified_via: string[];
  telegram_msg_id: string | null;
  approved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}
```

- [ ] **Step 2: Write `lib/agents/tokens.ts`**

```typescript
// lib/agents/tokens.ts
import { createHmac } from "crypto";

export function generateApproveToken(actionId: string): string {
  const secret = process.env.CRON_SECRET ?? "dev-secret";
  return createHmac("sha256", secret).update(actionId).digest("hex").slice(0, 32);
}

export function verifyApproveToken(actionId: string, token: string): boolean {
  return token === generateApproveToken(actionId);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/agents/types.ts lib/agents/tokens.ts
git commit -m "feat: add AgentModule/AgentResult/AgentAction interfaces and token utility"
```

---

## Task 3: Agent Dispatcher

**Files:**
- Create: `lib/agents/dispatcher.ts`

- [ ] **Step 1: Write `lib/agents/dispatcher.ts`**

```typescript
// lib/agents/dispatcher.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentRow, AgentActionRow } from "./types";

// Import stub agents (will be populated in Task 4)
import { LeadScoutAgent } from "./lead-scout";
import { OutreachAgent } from "./outreach-agent";
import { PipelineManagerAgent } from "./pipeline-manager";
import { IcpAnalystAgent } from "./icp-analyst";
import { ClientReporterAgent } from "./client-reporter";
import { DataJanitorAgent } from "./data-janitor";
import { MessageCoachAgent } from "./message-coach";

// Finance Watcher is NOT here — it has its own cron at 9 AM
const AGENT_REGISTRY: AgentModule[] = [
  new LeadScoutAgent(),
  new OutreachAgent(),
  new PipelineManagerAgent(),
  new IcpAnalystAgent(),
  new ClientReporterAgent(),
  new DataJanitorAgent(),
  new MessageCoachAgent(),
];

const AGENT_TIMEOUT_MS = 25_000;

async function getEnabledAgentSlugs(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("name")
    .eq("enabled", true);
  if (error) throw new Error(`Failed to fetch enabled agents: ${error.message}`);
  return (data ?? []).map((r: Pick<AgentRow, "name">) => r.name);
}

async function getAgentConfig(name: string): Promise<Record<string, unknown>> {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("config")
    .eq("name", name)
    .single();
  return (data as Pick<AgentRow, "config"> | null)?.config ?? {};
}

async function runWithTimeout(
  agent: AgentModule,
  config: Record<string, unknown>,
): Promise<{ result: AgentResult; durationMs: number }> {
  const startMs = Date.now();
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Agent timed out after ${AGENT_TIMEOUT_MS}ms`)), AGENT_TIMEOUT_MS)
  );
  const result = await Promise.race([agent.run(config), timeout]);
  return { result, durationMs: Date.now() - startMs };
}

async function sendTelegramWithButtons(
  text: string,
  actionId: string,
): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: "Approve", callback_data: `approve_agent:${actionId}` },
          { text: "Reject",  callback_data: `reject_agent:${actionId}` },
        ]],
      },
    }),
  });

  const data = await res.json() as { ok: boolean; result?: { message_id: number } };
  return data.ok && data.result ? String(data.result.message_id) : null;
}

async function sendTelegramText(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => undefined);
}

async function updateAgentHealthScore(agentName: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("agent_runs")
    .select("outcome")
    .eq("agent_name", agentName)
    .order("created_at", { ascending: false })
    .limit(7);

  if (!data || data.length === 0) return;

  const score = Math.round(
    (data.reduce((sum: number, r: { outcome: string }) => {
      if (r.outcome === "success") return sum + 1;
      if (r.outcome === "partial") return sum + 0.5;
      return sum;
    }, 0) / Math.max(data.length, 1)) * 100
  );

  await supabaseAdmin
    .from("agents")
    .update({ health_score: score })
    .eq("name", agentName);
}

export async function runAgentBatch(): Promise<void> {
  const batchRunId = crypto.randomUUID();
  const enabledSlugs = await getEnabledAgentSlugs();
  const toRun = AGENT_REGISTRY.filter(a => enabledSlugs.includes(a.name));

  if (toRun.length === 0) return;

  // Run all agents in parallel, never let one throw — catch inside each
  const settled = await Promise.allSettled(
    toRun.map(async (agent) => {
      const config = await getAgentConfig(agent.name);
      const startedAt = new Date().toISOString();

      let result: AgentResult;
      let durationMs: number;
      let runError: string | undefined;

      try {
        ({ result, durationMs } = await runWithTimeout(agent, config));
      } catch (err) {
        durationMs = AGENT_TIMEOUT_MS;
        result = { outcome: "failed", log: "", safeActionsExecuted: 0, actionsToQueue: [] };
        runError = err instanceof Error ? err.message : String(err);
      }

      const completedAt = new Date().toISOString();

      // Write agent_run
      await supabaseAdmin.from("agent_runs").insert({
        agent_name: agent.name,
        batch_run_id: batchRunId,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        outcome: runError ? "failed" : result.outcome,
        safe_actions_count: result.safeActionsExecuted,
        risky_actions_queued: result.actionsToQueue.filter(
          a => a.riskLevel !== "safe_notify"
        ).length,
        log: result.log,
        error: runError ?? null,
      });

      // Process actionsToQueue
      for (const action of result.actionsToQueue) {
        const isPending = action.riskLevel !== "safe_notify";
        const initialStatus = isPending ? "pending" : "notified";

        const { data: inserted } = await supabaseAdmin
          .from("agent_actions")
          .insert({
            agent_name: agent.name,
            batch_run_id: batchRunId,
            action_type: action.type,
            description: action.description,
            payload: action.payload,
            risk_level: action.riskLevel,
            status: initialStatus,
            notified_via: [],
          } satisfies Omit<AgentActionRow, "id" | "telegram_msg_id" | "approved_by" | "created_at" | "resolved_at">)
          .select("id")
          .single();

        if (!inserted) continue;

        // Telegram: always for medium/high; safe_notify only for hot_lead_alert type
        const shouldTelegram =
          isPending ||
          action.type === "hot_lead_alert" ||
          action.type === "agent_error";

        if (shouldTelegram) {
          const riskLabel = action.riskLevel === "high" ? "HIGH RISK" : "Needs Approval";
          const text = isPending
            ? `[${agent.displayName}] — ${riskLabel}\n\n${action.description}\n\nRisk: ${action.riskLevel}`
            : `[${agent.displayName}] — ${action.description}`;

          if (isPending) {
            const msgId = await sendTelegramWithButtons(text, inserted.id);
            if (msgId) {
              await supabaseAdmin
                .from("agent_actions")
                .update({ telegram_msg_id: msgId, notified_via: ["telegram"] })
                .eq("id", inserted.id);
            }
          } else {
            await sendTelegramText(text);
            await supabaseAdmin
              .from("agent_actions")
              .update({ notified_via: ["telegram"] })
              .eq("id", inserted.id);
          }
        }
      }

      // Update agents table
      await supabaseAdmin.from("agents").update({
        last_run_at: completedAt,
        last_run_status: runError ? "failed" : result.outcome,
      }).eq("name", agent.name);

      await updateAgentHealthScore(agent.name);

      // Error alert to Telegram
      if (runError) {
        await sendTelegramText(`[${agent.displayName}] — Failed\n\n${runError.slice(0, 200)}`);
      }
    })
  );

  // Log any unexpected Promise.allSettled rejections (shouldn't happen — inner try/catch)
  for (const s of settled) {
    if (s.status === "rejected") {
      console.error("[dispatcher] Unexpected rejection:", s.reason);
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles (will fail until Task 4 agent files exist)**

Skip this step — come back after Task 4.

- [ ] **Step 3: Commit (partial — agents not yet created)**

```bash
git add lib/agents/dispatcher.ts
git commit -m "feat: add AgentDispatcher with parallel execution, timeout, and Telegram approval"
```

---

## Task 4: Stub Agent Modules

**Files:**
- Create: `lib/agents/lead-scout.ts`
- Create: `lib/agents/outreach-agent.ts`
- Create: `lib/agents/pipeline-manager.ts`
- Create: `lib/agents/icp-analyst.ts`
- Create: `lib/agents/client-reporter.ts`
- Create: `lib/agents/data-janitor.ts`
- Create: `lib/agents/message-coach.ts`

- [ ] **Step 1: Create `lib/agents/lead-scout.ts`**

```typescript
// lib/agents/lead-scout.ts
import type { AgentModule, AgentResult } from "./types";

export class LeadScoutAgent implements AgentModule {
  name = "lead-scout";
  displayName = "Lead Scout";
  description = "Daily Apify scrape, dedup, and ICP scoring";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Lead Scout not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
```

- [ ] **Step 2: Create `lib/agents/outreach-agent.ts`**

```typescript
// lib/agents/outreach-agent.ts
import type { AgentModule, AgentResult } from "./types";

export class OutreachAgent implements AgentModule {
  name = "outreach-agent";
  displayName = "Outreach Agent";
  description = "Sequence execution, email sends, reply handling";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Outreach Agent not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
```

- [ ] **Step 3: Create `lib/agents/pipeline-manager.ts`**

```typescript
// lib/agents/pipeline-manager.ts
import type { AgentModule, AgentResult } from "./types";

export class PipelineManagerAgent implements AgentModule {
  name = "pipeline-manager";
  displayName = "Pipeline Manager";
  description = "Kanban health, stale lead detection, cleanup";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Pipeline Manager not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
```

- [ ] **Step 4: Create `lib/agents/icp-analyst.ts`**

```typescript
// lib/agents/icp-analyst.ts
import type { AgentModule, AgentResult } from "./types";

export class IcpAnalystAgent implements AgentModule {
  name = "icp-analyst";
  displayName = "ICP Analyst";
  description = "Score calibration and ICP pattern detection";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "ICP Analyst not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
```

- [ ] **Step 5: Create `lib/agents/client-reporter.ts`**

```typescript
// lib/agents/client-reporter.ts
import type { AgentModule, AgentResult } from "./types";

export class ClientReporterAgent implements AgentModule {
  name = "client-reporter";
  displayName = "Client Reporter";
  description = "Auto-generates client portal updates and reports";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Client Reporter not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
```

- [ ] **Step 6: Create `lib/agents/data-janitor.ts`**

```typescript
// lib/agents/data-janitor.ts
import type { AgentModule, AgentResult } from "./types";

export class DataJanitorAgent implements AgentModule {
  name = "data-janitor";
  displayName = "Data Janitor";
  description = "Lead dedup, archival, and DB health maintenance";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Data Janitor not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
```

- [ ] **Step 7: Create `lib/agents/message-coach.ts`**

```typescript
// lib/agents/message-coach.ts
import type { AgentModule, AgentResult } from "./types";

export class MessageCoachAgent implements AgentModule {
  name = "message-coach";
  displayName = "Message Coach";
  description = "A/B winner detection and message refinement";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    return {
      outcome: "skipped",
      log: "Message Coach not yet implemented — will be enabled in Phase 2.",
      safeActionsExecuted: 0,
      actionsToQueue: [],
    };
  }
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors. The dispatcher imports all 7 modules; this confirms the module graph is clean.

- [ ] **Step 9: Commit**

```bash
git add lib/agents/lead-scout.ts lib/agents/outreach-agent.ts lib/agents/pipeline-manager.ts lib/agents/icp-analyst.ts lib/agents/client-reporter.ts lib/agents/data-janitor.ts lib/agents/message-coach.ts
git commit -m "feat: add 7 stub agent modules (skipped outcome, Phase 2 will implement each)"
```

---

## Task 5: Finance Watcher Integration

**Files:**
- Modify: `app/api/agent/finance/cron/route.ts`

The goal: after the finance cron runs its 4 jobs, write one row to `agent_runs` so Finance Watcher appears in the command center alongside the other agents.

- [ ] **Step 1: Modify `app/api/agent/finance/cron/route.ts`**

Open the file. It currently ends with `return NextResponse.json({ ok: true, results, ts: ... })`.

Add these imports at the top of the file:

```typescript
import { supabaseAdmin } from "@/lib/supabase";
```

Replace the final return statement with:

```typescript
  // Write to agent_runs so Finance Watcher appears in the command center
  const hasErrors = Object.values(results).some(v => String(v).startsWith("error:"));
  const logLines = Object.entries(results)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  await supabaseAdmin.from("agent_runs").insert({
    agent_name: "finance-watcher",
    batch_run_id: crypto.randomUUID(),
    started_at: new Date(Date.now() - 60_000).toISOString(), // approx
    completed_at: new Date().toISOString(),
    duration_ms: null,
    outcome: hasErrors ? "partial" : "success",
    safe_actions_count: 0,
    risky_actions_queued: 0,
    log: logLines,
    error: null,
  }).then(() => undefined).catch(console.warn);

  await supabaseAdmin.from("agents").update({
    last_run_at: new Date().toISOString(),
    last_run_status: hasErrors ? "partial" : "success",
  }).eq("name", "finance-watcher").then(() => undefined).catch(console.warn);

  return NextResponse.json({ ok: true, results, ts: new Date().toISOString() });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/agent/finance/cron/route.ts
git commit -m "feat: Finance Watcher cron now writes to agent_runs and agents tables"
```

---

## Task 6: Agent Run Cron Endpoint

**Files:**
- Create: `app/api/agents/run/route.ts`

- [ ] **Step 1: Create `app/api/agents/run/route.ts`**

```typescript
// app/api/agents/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runAgentBatch } from "@/lib/agents/dispatcher";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min ceiling — 7 agents × 25s timeout + overhead

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await runAgentBatch();
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agents/run] Batch failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test (local dev)**

```bash
npm run dev
# In a new terminal:
curl http://localhost:3001/prospecting-os/api/agents/run
```
Expected: `{"ok":true,"ts":"..."}` — no agents run (all disabled) but batch completes without error.

- [ ] **Step 4: Commit**

```bash
git add app/api/agents/run/route.ts
git commit -m "feat: add /api/agents/run cron endpoint with CRON_SECRET auth"
```

---

## Task 7: Action Resolver + Email Approve Endpoint

**Files:**
- Create: `lib/agents/resolver.ts`
- Create: `app/api/agents/approve/route.ts`

The resolver is a shared function called from both the email link (GET) and the Telegram webhook callback (Task 8).

- [ ] **Step 1: Create `lib/agents/resolver.ts`**

```typescript
// lib/agents/resolver.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentActionRow } from "./types";

export async function resolveAgentAction(
  actionId: string,
  approved: boolean,
  approvedBy: string,
): Promise<void> {
  const { data: action, error } = await supabaseAdmin
    .from("agent_actions")
    .select("*")
    .eq("id", actionId)
    .single<AgentActionRow>();

  if (error || !action) throw new Error(`Action not found: ${actionId}`);
  if (action.status !== "pending") throw new Error(`Already resolved: ${action.status}`);

  // Execute the approved action (Phase 2 will fill in type-specific logic)
  if (approved) {
    console.log(`[resolver] Executing ${action.action_type}`, action.payload);
    // Phase 2: dispatch based on action.action_type
  }

  await supabaseAdmin.from("agent_actions").update({
    status: approved ? "executed" : "rejected",
    approved_by: approvedBy,
    resolved_at: new Date().toISOString(),
  }).eq("id", actionId);

  // Edit the original Telegram message to show resolution
  if (action.telegram_msg_id) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(action.telegram_msg_id, 10),
          text: `[${action.agent_name}] — ${approved ? "Approved" : "Rejected"}\n\n${action.description}\n\nResolved by: ${approvedBy}`,
        }),
      }).catch(() => undefined);
    }
  }
}
```

- [ ] **Step 2: Create `app/api/agents/approve/route.ts`**

This handles the email one-click approve/reject link (GET only). Telegram callbacks are handled in the telegram webhook (Task 8).

```typescript
// app/api/agents/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyApproveToken } from "@/lib/agents/tokens";
import { resolveAgentAction } from "@/lib/agents/resolver";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id       = searchParams.get("id") ?? "";
  const token    = searchParams.get("token") ?? "";
  const decision = searchParams.get("decision") ?? "approve";

  if (!id || !token) {
    return new NextResponse("Missing id or token", { status: 400 });
  }

  if (!verifyApproveToken(id, token)) {
    return new NextResponse("Invalid or expired token", { status: 401 });
  }

  const approved = decision === "approve";

  try {
    await resolveAgentAction(id, approved, "email-link");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>Error</h2><p>${msg}</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  const label = approved ? "Approved" : "Rejected";
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#000;color:#eee">
      <h2 style="color:${approved ? "#6BCB77" : "#E06060"}">${label}</h2>
      <p style="color:#888">Action has been ${approved ? "executed" : "rejected"}.</p>
      <a href="/prospecting-os/admin/agents" style="color:#E8A840">View Command Center →</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/agents/resolver.ts app/api/agents/approve/route.ts
git commit -m "feat: add action resolver and email one-click approve/reject endpoint"
```

---

## Task 8: Telegram Webhook — Add Callback Handler

**Files:**
- Modify: `app/api/agent/telegram/route.ts`

The current webhook only handles `message` type. Telegram sends `callback_query` when a user clicks an inline keyboard button. We need to route `approve_agent:` and `reject_agent:` callbacks to the resolver.

- [ ] **Step 1: Add imports at the top of `app/api/agent/telegram/route.ts`**

Add after the existing imports:

```typescript
import { resolveAgentAction } from "@/lib/agents/resolver";
```

- [ ] **Step 2: Replace the entire `POST` handler**

Find the existing `export async function POST(req: Request)` and replace it with:

```typescript
export async function POST(req: Request) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  try {
    const body = await req.json() as {
      message?: { chat?: { id: number }; text?: string; from?: { first_name?: string } };
      callback_query?: {
        id: string;
        data: string;
        from: { username?: string; first_name?: string };
        message?: { chat?: { id: number } };
      };
    };

    // ── Handle inline keyboard callback (agent approve/reject) ──────────────
    if (body.callback_query) {
      const cb = body.callback_query;
      const match = cb.data.match(/^(approve_agent|reject_agent):(.+)$/);

      // Answer the callback query first (removes Telegram's loading spinner)
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id }),
      });

      if (match) {
        const approved = match[1] === "approve_agent";
        const actionId = match[2];
        const approvedBy = cb.from.username ?? cb.from.first_name ?? "telegram-user";

        try {
          await resolveAgentAction(actionId, approved, approvedBy);
        } catch (err) {
          console.error("[telegram] resolveAgentAction failed:", err);
        }
      }

      return NextResponse.json({ ok: true });
    }

    // ── Handle regular text message (existing Gemini AI chat) ───────────────
    const msg = body.message;
    if (!msg?.text) {
      return NextResponse.json({ ok: true });
    }

    const reply = await callGemini(msg.text);

    if (msg.chat?.id) {
      await sendTelegramMessage(msg.chat.id, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/agent/telegram/route.ts
git commit -m "feat: Telegram webhook now handles approve_agent/reject_agent callback queries"
```

---

## Task 9: Daily Digest Email Cron

**Files:**
- Create: `app/api/agents/digest/route.ts`

Sends a structured HTML email at 6 AM with yesterday's agent run summary + pending approval list with one-click approve/reject links.

- [ ] **Step 1: Create `app/api/agents/digest/route.ts`**

```typescript
// app/api/agents/digest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { generateApproveToken } from "@/lib/agents/tokens";
import type { AgentRunRow, AgentActionRow } from "@/lib/agents/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    return NextResponse.json({ error: "NOTIFY_EMAIL not set" }, { status: 500 });
  }

  // Yesterday's runs
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const { data: runs } = await supabaseAdmin
    .from("agent_runs")
    .select("*")
    .gte("created_at", yesterday.toISOString())
    .order("created_at", { ascending: true })
    .returns<AgentRunRow[]>();

  const { data: pending } = await supabaseAdmin
    .from("agent_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<AgentActionRow[]>();

  const runRows   = runs   ?? [];
  const pendingRows = pending ?? [];

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.flow-forges.com")
    + "/prospecting-os";

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  const outcomeColor = (o: string) =>
    o === "success" ? "#6BCB77" : o === "failed" ? "#E06060" : "#E8A840";

  const agentRows = runRows.map(r =>
    `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:13px;color:#ddd;">${r.agent_name}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:13px;color:${outcomeColor(r.outcome)};font-weight:600;">${r.outcome}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:12px;color:#888;">${r.log.split("\n")[0] ?? ""}</td>
    </tr>`
  ).join("");

  const approvalRows = pendingRows.map(a => {
    const token        = generateApproveToken(a.id);
    const approveUrl   = `${base}/api/agents/approve?id=${a.id}&token=${token}&decision=approve`;
    const rejectUrl    = `${base}/api/agents/approve?id=${a.id}&token=${token}&decision=reject`;
    return `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:12px;color:#a78bfa;">${a.agent_name}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;font-size:13px;color:#ddd;">${a.description}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1a1a1a;white-space:nowrap;">
        <a href="${approveUrl}" style="color:#6BCB77;font-size:12px;font-weight:600;margin-right:12px;text-decoration:none;">Approve</a>
        <a href="${rejectUrl}"  style="color:#E06060;font-size:12px;font-weight:600;text-decoration:none;">Reject</a>
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#0a0a0a;border-radius:12px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#E8A840;padding:24px 32px;">
            <p style="margin:0;color:#000;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">
              Prospecting OS
            </p>
            <h1 style="margin:6px 0 0;color:#000;font-size:22px;font-weight:800;">
              Agent Report · ${date}
            </h1>
          </td>
        </tr>

        <!-- Summary stats -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:#ddd;">${runRows.length}</div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Agents Ran</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:#6BCB77;">
                    ${runRows.filter(r => r.outcome === "success").length}
                  </div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Succeeded</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:${pendingRows.length > 0 ? "#E8A840" : "#ddd"};">
                    ${pendingRows.length}
                  </div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">
                    Pending${pendingRows.length > 0 ? " — action needed" : ""}
                  </div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:28px;font-weight:700;color:#ddd;">
                    ${runRows.reduce((s, r) => s + r.safe_actions_count, 0)}
                  </div>
                  <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Safe Actions</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Agent run table -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;">
              Yesterday's Runs
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#111;border-radius:8px;overflow:hidden;">
              ${agentRows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#555;font-size:13px;">No runs recorded</td></tr>'}
            </table>
          </td>
        </tr>

        ${pendingRows.length > 0 ? `
        <!-- Pending approvals -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#E8A840;text-transform:uppercase;letter-spacing:1px;">
              Pending Approvals — ${pendingRows.length} action${pendingRows.length !== 1 ? "s" : ""} waiting
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#111;border-radius:8px;overflow:hidden;">
              ${approvalRows}
            </table>
          </td>
        </tr>` : ""}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#444;text-align:center;">
              Prospecting OS · Agent Command Center ·
              <a href="${base}/admin/agents" style="color:#E8A840;text-decoration:none;">View Dashboard →</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const subject = `Agent Report · ${date}${pendingRows.length > 0 ? ` · ${pendingRows.length} pending` : " · All clear"}`;

  await sendEmail({ to: notifyEmail, subject, html });

  return NextResponse.json({
    ok: true,
    runs: runRows.length,
    pending: pendingRows.length,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/agents/digest/route.ts
git commit -m "feat: add /api/agents/digest cron — daily HTML email with agent run summary and approval links"
```

---

## Task 10: Command Center UI

**Files:**
- Create: `app/admin/agents/page.tsx`

A server component (force-dynamic) with 4 sections: Agent Status Board, Pending Approvals, Notifications Log, Activity Feed.

- [ ] **Step 1: Create `app/admin/agents/page.tsx`**

```typescript
// app/admin/agents/page.tsx
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { headers } from "next/headers";
import type { AgentRow, AgentActionRow, AgentRunRow } from "@/lib/agents/types";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  // Auth check — super_admin only
  const hdrs = await headers();
  const role = hdrs.get("x-user-role");
  if (role !== "super_admin") {
    return (
      <div style={{ padding: "40px", color: "#E06060", fontFamily: "monospace" }}>
        Access denied. Super admin only.
      </div>
    );
  }

  // Fetch all data
  const [agentsRes, actionsRes, runsRes] = await Promise.all([
    supabaseAdmin.from("agents").select("*").order("display_name").returns<AgentRow[]>(),
    supabaseAdmin
      .from("agent_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<AgentActionRow[]>(),
    supabaseAdmin
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<AgentRunRow[]>(),
  ]);

  const agents   = agentsRes.data  ?? [];
  const actions  = actionsRes.data ?? [];
  const runs     = runsRes.data    ?? [];

  const pendingActions  = actions.filter(a => a.status === "pending");
  const notifActions    = actions.filter(a => a.status !== "pending");

  // Colours
  const statusColor = (s: string | null) => {
    if (!s)              return "#555";
    if (s === "success") return "#6BCB77";
    if (s === "failed")  return "#E06060";
    return "#E8A840";
  };
  const riskColor = (r: string) =>
    r === "high" ? "#E06060" : r === "medium" ? "#E8A840" : "#3b82f6";

  const channelLabel = (via: string[]) => {
    if (via.includes("telegram") && via.includes("email")) return "Telegram + Email";
    if (via.includes("telegram")) return "Telegram";
    if (via.includes("email")) return "Email";
    return "Internal";
  };
  const channelColor = (via: string[]) => {
    if (via.includes("telegram") && via.includes("email")) return "#a78bfa";
    if (via.includes("telegram")) return "#00d4ff";
    if (via.includes("email")) return "#6BCB77";
    return "#555";
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto", fontFamily: "Geist, sans-serif" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#EBEBEB", margin: 0, letterSpacing: "-0.02em" }}>
            Agent Command Center
          </h1>
          <p style={{ fontSize: 12, color: "#555", margin: "4px 0 0" }}>
            {agents.filter(a => a.enabled).length} of {agents.length} agents enabled ·{" "}
            {pendingActions.length > 0
              ? <span style={{ color: "#E8A840" }}>{pendingActions.length} pending approval{pendingActions.length !== 1 ? "s" : ""}</span>
              : "no pending approvals"}
          </p>
        </div>
        <form action="/prospecting-os/api/agents/run" method="GET">
          <button
            type="submit"
            style={{
              padding: "8px 16px", background: "rgba(232,168,64,0.12)",
              border: "1px solid rgba(232,168,64,0.3)", borderRadius: 7,
              color: "#E8A840", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Run All Now
          </button>
        </form>
      </div>

      {/* Agent status grid */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Agent Workforce
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 28 }}>
        {agents.map(agent => {
          const dotColor = !agent.last_run_status
            ? "#3b82f6"
            : statusColor(agent.last_run_status);
          const lastRun = agent.last_run_at
            ? new Date(agent.last_run_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
            : "Never run";
          const latestRun = runs.find(r => r.agent_name === agent.name);
          return (
            <div key={agent.id} style={{
              padding: "12px 14px", background: "#0A0A0A",
              border: `1px solid ${agent.last_run_status === "failed" ? "rgba(224,96,96,0.2)" : pendingActions.some(a => a.agent_name === agent.name) ? "rgba(232,168,64,0.2)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 9,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#EBEBEB" }}>{agent.display_name}</span>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
              </div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>
                {agent.enabled ? `Last: ${lastRun}` : "Disabled — Phase 2"}
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {latestRun ? latestRun.log.split("\n")[0]?.slice(0, 60) ?? "—" : "—"}
              </div>
              {agent.enabled && (
                <div style={{ marginTop: 6, fontSize: 10, color: statusColor(agent.last_run_status) }}>
                  health: {agent.health_score}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending Approvals */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Pending Approvals{pendingActions.length > 0 && (
          <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(232,168,64,0.15)", color: "#E8A840" }}>
            {pendingActions.length}
          </span>
        )}
      </p>
      {pendingActions.length === 0 ? (
        <div style={{ padding: "14px 16px", background: "#0A0A0A", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", color: "#444", fontSize: 12, marginBottom: 28 }}>
          No pending approvals — agents are either all clear or awaiting their next run.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
          {pendingActions.map(action => (
            <div key={action.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", background: "rgba(232,168,64,0.03)",
              border: "1px solid rgba(232,168,64,0.18)", borderRadius: 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: "rgba(124,58,237,0.15)", color: "#a78bfa", flexShrink: 0,
              }}>{action.agent_name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: `${riskColor(action.risk_level)}18`, color: riskColor(action.risk_level),
                flexShrink: 0,
              }}>{action.risk_level}</span>
              <span style={{ flex: 1, fontSize: 12, color: "#CCC" }}>{action.description}</span>
              <span style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>
                {new Date(action.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ fontSize: 11, color: "#888", flexShrink: 0 }}>Review in Telegram or via email link</span>
            </div>
          ))}
        </div>
      )}

      {/* Notifications Log */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Notifications Log
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
        {notifActions.length === 0 ? (
          <div style={{ padding: "14px 16px", background: "#0A0A0A", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", color: "#444", fontSize: 12 }}>
            No notifications sent yet.
          </div>
        ) : notifActions.map(action => (
          <div key={action.id} style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            padding: "10px 14px", background: "#0A0A0A",
            border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, flexShrink: 0, marginTop: 1,
              background: `${channelColor(action.notified_via)}15`, color: channelColor(action.notified_via),
            }}>{channelLabel(action.notified_via)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#CCC", marginBottom: 2 }}>{action.description}</div>
              <div style={{ fontSize: 10, color: "#444" }}>
                {action.agent_name} · {new Date(action.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {action.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Activity Feed
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {runs.length === 0 ? (
          <div style={{ padding: "14px 16px", background: "#0A0A0A", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", color: "#444", fontSize: 12 }}>
            No runs yet. The first run will happen at 7 AM tomorrow (or click Run All Now above).
          </div>
        ) : runs.map(run => (
          <div key={run.id} style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
              background: statusColor(run.outcome),
            }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, color: "#EBEBEB", fontSize: 12 }}>{run.agent_name}</span>
              {" "}
              <span style={{ fontSize: 12, color: "#888" }}>{run.log || "(no log)"}</span>
            </div>
            <span style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>
              {new Date(run.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Start dev server and navigate to `/admin/agents`**

```bash
npm run dev
# Open: http://localhost:3001/prospecting-os/admin/agents
```
Expected: Page loads with "Agent Workforce" grid showing 8 cards (7 disabled, Finance Watcher enabled). No pending approvals. Empty activity feed.

- [ ] **Step 4: Commit**

```bash
git add app/admin/agents/page.tsx
git commit -m "feat: add /admin/agents Full Mission Control UI — status grid, approval inbox, notifications log, activity feed"
```

---

## Task 11: Sidebar Link + vercel.json + Final Wiring

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Modify: `vercel.json`
- Modify: `middleware.ts` (verify — no change expected)
- Modify: `components/Shell.tsx` (verify — no change expected)

- [ ] **Step 1: Add Agent Command Center link to Sidebar**

Open `components/layout/Sidebar.tsx`. Find the `operations` section (around line 71–75):

```typescript
  {
    id: "operations",
    label: "Operations",
    items: [],
  },
```

Replace it with:

```typescript
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "agents", module: "dashboard" as ModuleName, label: "Agent Command Center", icon: Bot, href: "/admin/agents" },
    ],
  },
```

Note: `Bot` is already imported at the top of the Sidebar (`import { ..., Bot, ... } from "lucide-react"`). If it's not, add it to the import. The `module: "dashboard" as ModuleName` is a safe cast — the sidebar uses this for active state only and `/admin/agents` is not in the module list.

Also find the dynamic Operations items injection block (search for "super_admin" in the sidebar file — this is where the Users link is injected). Add the agents link only for super_admin:

Look for the useEffect that builds the dynamic Operations items and add:
```typescript
{ id: "agents", module: "dashboard" as ModuleName, label: "Agent Command Center", icon: Bot, href: "/admin/agents" },
```
alongside the existing Users link. The exact location depends on how the sidebar dynamically injects Operations items — read the full sidebar file to find the injection point before making this change.

- [ ] **Step 2: Add 2 cron entries to `vercel.json`**

Open `vercel.json`. Replace the entire file with:

```json
{
  "crons": [
    {
      "path": "/prospecting-os/api/cron/sequence-runner",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/prospecting-os/api/agent/finance/cron",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/prospecting-os/api/agents/run",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/prospecting-os/api/agents/digest",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- [ ] **Step 3: Verify middleware — no change needed**

Open `middleware.ts`. Confirm that `/admin` is in the protected routes list. The command center at `/admin/agents` is automatically protected since the middleware guards all `/admin/*` paths.

- [ ] **Step 4: Verify Shell.tsx — no change needed**

Open `components/Shell.tsx`. Confirm that `/admin` routes are served with the full admin Shell (not the marketing layout). No change should be needed — the existing admin routing already covers `/admin/agents`.

- [ ] **Step 5: Full build check**

```bash
npm run build
```
Expected: Build completes with 0 TypeScript errors. New routes in the build output:
- `/admin/agents`
- `/api/agents/run`
- `/api/agents/approve`
- `/api/agents/digest`

- [ ] **Step 6: Final commit**

```bash
git add components/layout/Sidebar.tsx vercel.json
git commit -m "feat: add Agent Command Center sidebar link and 2 cron entries to vercel.json"
```

---

## Done Checklist

After all tasks complete, verify against the spec:

- [ ] DB migration applied — `agents`, `agent_actions`, `agent_runs` tables exist with RLS
- [ ] All 8 agents seeded (7 disabled stubs + Finance Watcher enabled)
- [ ] `lib/agents/types.ts` — interfaces defined
- [ ] `lib/agents/tokens.ts` — HMAC token utility
- [ ] `lib/agents/resolver.ts` — `resolveAgentAction()` shared function
- [ ] `lib/agents/dispatcher.ts` — `runAgentBatch()` working
- [ ] 7 stub agent files in `lib/agents/`
- [ ] Finance Watcher cron writes to `agent_runs` and `agents` tables
- [ ] `/api/agents/run` — cron endpoint, CRON_SECRET-secured
- [ ] `/api/agents/approve` — email one-click GET endpoint with signed tokens
- [ ] `/api/agents/digest` — 6 AM cron sends HTML digest email
- [ ] `/api/agent/telegram` — handles `approve_agent:` / `reject_agent:` callbacks
- [ ] `/admin/agents` — Full Mission Control UI (all 4 sections)
- [ ] Sidebar — "Agent Command Center" link in Operations section
- [ ] `vercel.json` — 4 cron entries total (2 existing + 2 new)
- [ ] `npm run build` — 0 errors
