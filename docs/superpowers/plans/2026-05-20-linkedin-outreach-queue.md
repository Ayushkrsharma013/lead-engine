# LinkedIn Outreach Queue System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken OpenOutreach integration with a cloud-queue + local-runner architecture that executes LinkedIn actions safely from the user's home machine.

**Architecture:** Supabase stores a `linkedin_queue` table. The Outreach Agent writes candidates to this queue (with Telegram approval). A standalone local Node.js runner polls the queue and executes actions via Playwright with a persistent Chrome profile (home IP, human pacing, anti-detection).

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin), Playwright + playwright-extra + stealth plugin (local runner only), TypeScript strict mode.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260520_linkedin_queue.sql` | Create | `linkedin_queue` + `linkedin_daily_stats` tables, RLS, index, add "queued" to sequence_messages |
| `lib/linkedin-queue.ts` | Create | Typed queue CRUD helpers used by sequence engine, resolver, and API route |
| `lib/sequence-engine.ts` | Modify (lines 177–196) | Replace "skip linkedin steps" block with "write to linkedin_queue" |
| `lib/agents/outreach-agent.ts` | Modify | Add LinkedIn candidate scanning section (Step 7) that queues connection requests |
| `lib/agents/resolver.ts` | Modify | Add `queue_linkedin_connections` + `queue_linkedin_dm` cases to `dispatchAction` |
| `app/api/outreach/queue/route.ts` | Create | GET queue status + today stats / POST add manual action |
| `app/outreach/page.tsx` | Rebuild | Queue status, daily usage, pending table, runner status, setup guide |
| `runner/linkedin-runner.js` | Create | Standalone local daemon — polls queue, executes LinkedIn actions via Playwright |
| `runner/package.json` | Create | playwright, playwright-extra, stealth plugin, @supabase/supabase-js, dotenv |
| `runner/.env.example` | Create | Required env vars template |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260520_linkedin_queue.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260520_linkedin_queue.sql

-- linkedin_queue: stores pending/executed LinkedIn actions
CREATE TABLE IF NOT EXISTS public.linkedin_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               TEXT NOT NULL,
  sequence_execution_id UUID REFERENCES public.sequence_executions(id) ON DELETE SET NULL,
  action_type           TEXT NOT NULL CHECK (action_type IN ('connection_request', 'dm', 'follow_up', 'profile_view')),
  message               TEXT,
  linkedin_profile_url  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'executing', 'done', 'failed', 'skipped')),
  scheduled_for         TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at           TIMESTAMPTZ,
  error                 TEXT,
  user_id               UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_linkedin_queue"
  ON public.linkedin_queue FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Index used by the runner's polling query
CREATE INDEX IF NOT EXISTS idx_linkedin_queue_status_scheduled
  ON public.linkedin_queue(status, scheduled_for)
  WHERE status = 'pending';

-- linkedin_daily_stats: runner writes daily action counts; dashboard reads them
CREATE TABLE IF NOT EXISTS public.linkedin_daily_stats (
  date             TEXT PRIMARY KEY,   -- 'YYYY-MM-DD'
  connections_sent INT NOT NULL DEFAULT 0,
  dms_sent         INT NOT NULL DEFAULT 0,
  profile_views    INT NOT NULL DEFAULT 0,
  last_run_at      TIMESTAMPTZ
);

ALTER TABLE public.linkedin_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_linkedin_daily_stats"
  ON public.linkedin_daily_stats FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Allow sequence_messages.status = 'queued' for LinkedIn steps
ALTER TABLE public.sequence_messages
  DROP CONSTRAINT IF EXISTS sequence_messages_status_check;

ALTER TABLE public.sequence_messages
  ADD CONSTRAINT sequence_messages_status_check
  CHECK (status IN ('sent', 'failed', 'bounced', 'skipped', 'replied', 'queued'));
```

- [ ] **Step 2: Apply via Supabase MCP**

Run against production project `tbsqpnqzpbnilifhwvgr`:

```
mcp__plugin_supabase_supabase__apply_migration
  sql: <contents of the file above>
```

- [ ] **Step 3: Verify tables exist**

```
mcp__plugin_supabase_supabase__list_tables
```

Expected: `linkedin_queue` and `linkedin_daily_stats` appear in the table list.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260520_linkedin_queue.sql
git commit -m "feat(db): add linkedin_queue + linkedin_daily_stats tables"
```

---

## Task 2: Queue Helper Library

**Files:**
- Create: `lib/linkedin-queue.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/linkedin-queue.ts
import { supabaseAdmin } from "./supabase";

export interface LinkedInQueueItem {
  id: string;
  leadId: string;
  sequenceExecutionId?: string;
  actionType: "connection_request" | "dm" | "follow_up" | "profile_view";
  message?: string;
  linkedinProfileUrl: string;
  status: "pending" | "executing" | "done" | "failed" | "skipped";
  scheduledFor: string;
  executedAt?: string;
  error?: string;
  userId?: string;
  createdAt: string;
}

export interface LinkedInDailyStats {
  date: string;
  connectionsSent: number;
  dmsSent: number;
  profileViews: number;
  lastRunAt?: string;
}

export interface QueueStatus {
  pending: number;
  executing: number;
  done: number;
  failed: number;
  total: number;
}

export async function enqueueLinkedInAction(params: {
  leadId: string;
  linkedinProfileUrl: string;
  actionType: LinkedInQueueItem["actionType"];
  message?: string;
  scheduledFor?: Date;
  sequenceExecutionId?: string;
  userId?: string;
}): Promise<LinkedInQueueItem> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_queue")
    .insert({
      lead_id: params.leadId,
      linkedin_profile_url: params.linkedinProfileUrl,
      action_type: params.actionType,
      message: params.message ?? null,
      scheduled_for: (params.scheduledFor ?? new Date()).toISOString(),
      sequence_execution_id: params.sequenceExecutionId ?? null,
      user_id: params.userId ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToItem(data as Record<string, unknown>);
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_queue")
    .select("status");

  if (error) throw error;

  const counts: QueueStatus = { pending: 0, executing: 0, done: 0, failed: 0, total: 0 };
  for (const row of (data ?? []) as { status: string }[]) {
    counts.total++;
    const s = row.status as keyof QueueStatus;
    if (s in counts) counts[s]++;
  }
  return counts;
}

export async function getPendingActions(limit = 20): Promise<LinkedInQueueItem[]> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToItem);
}

export async function markActionExecuting(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "executing" })
    .eq("id", id);
  if (error) throw error;
}

export async function markActionDone(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "done", executed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markActionFailed(id: string, errorMsg: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "failed", error: errorMsg, executed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Reset actions stuck in "executing" for > 10 minutes (crashed runner recovery)
export async function resetStuckExecuting(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "pending" })
    .eq("status", "executing")
    .lt("created_at", tenMinutesAgo);
}

export async function getTodayStats(): Promise<LinkedInDailyStats> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabaseAdmin
    .from("linkedin_daily_stats")
    .select("*")
    .eq("date", today)
    .maybeSingle();

  return data
    ? rowToStats(data as Record<string, unknown>)
    : { date: today, connectionsSent: 0, dmsSent: 0, profileViews: 0 };
}

export async function isAlreadyQueued(
  leadId: string,
  actionType: LinkedInQueueItem["actionType"]
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("linkedin_queue")
    .select("id")
    .eq("lead_id", leadId)
    .eq("action_type", actionType)
    .in("status", ["pending", "executing"])
    .limit(1);
  return ((data as unknown[]) ?? []).length > 0;
}

function rowToItem(row: Record<string, unknown>): LinkedInQueueItem {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    sequenceExecutionId: row.sequence_execution_id ? String(row.sequence_execution_id) : undefined,
    actionType: row.action_type as LinkedInQueueItem["actionType"],
    message: row.message ? String(row.message) : undefined,
    linkedinProfileUrl: String(row.linkedin_profile_url),
    status: row.status as LinkedInQueueItem["status"],
    scheduledFor: String(row.scheduled_for),
    executedAt: row.executed_at ? String(row.executed_at) : undefined,
    error: row.error ? String(row.error) : undefined,
    userId: row.user_id ? String(row.user_id) : undefined,
    createdAt: String(row.created_at),
  };
}

function rowToStats(row: Record<string, unknown>): LinkedInDailyStats {
  return {
    date: String(row.date),
    connectionsSent: Number(row.connections_sent ?? 0),
    dmsSent: Number(row.dms_sent ?? 0),
    profileViews: Number(row.profile_views ?? 0),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd "D:/Flow-Forges/lead-engine" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/linkedin-queue.ts
git commit -m "feat: linkedin queue helper library"
```

---

## Task 3: Sequence Engine — Queue LinkedIn Steps Instead of Skip

**Files:**
- Modify: `lib/sequence-engine.ts` (lines 177–196)

The current block at line 177 reads:
```typescript
// Skip LinkedIn steps (handled by OpenOutreach)
if (step.channel === "linkedin") {
  await insertSequenceMessage({ ... status: "skipped" ... });
  // advance step...
  skipped++;
  continue;
}
```

- [ ] **Step 1: Add the import at the top of sequence-engine.ts**

In `lib/sequence-engine.ts`, find the imports block (lines 1–18) and add:
```typescript
import { enqueueLinkedInAction, isAlreadyQueued } from "./linkedin-queue";
```

- [ ] **Step 2: Replace the LinkedIn skip block**

Find and replace the block starting at `// Skip LinkedIn steps (handled by OpenOutreach)`:

```typescript
    // Queue LinkedIn steps in linkedin_queue for local runner execution
    if (step.channel === "linkedin") {
      const leadRow = leadMap.get(exec.leadId);
      const profileUrl = leadRow ? String(leadRow.linkedin || "") : "";

      // Only enqueue if lead has a LinkedIn URL and isn't already queued
      if (profileUrl) {
        const alreadyQueued = await isAlreadyQueued(
          exec.leadId,
          step.type === "connection_request" ? "connection_request" : "dm"
        );
        if (!alreadyQueued) {
          const resolvedMessage = leadRow
            ? resolveTemplate(step.template, leadFromRow(leadRow))
            : step.template;
          const scheduledFor = new Date(
            new Date(exec.startedAt).getTime() + step.day * 86400000
          );
          await enqueueLinkedInAction({
            leadId: exec.leadId,
            linkedinProfileUrl: profileUrl,
            actionType: step.type === "connection_request" ? "connection_request" : "dm",
            message: resolvedMessage,
            scheduledFor,
            sequenceExecutionId: exec.id,
          });
        }
      }

      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "linkedin",
        subject: step.type,
        body: step.template,
        status: "queued",
        variant: exec.variant,
      });
      const nextStep = exec.currentStep + 1;
      if (nextStep >= sequence.steps.length) {
        await updateSequenceExecution(exec.id, { status: "completed" });
      } else {
        await updateSequenceExecution(exec.id, { current_step: nextStep });
      }
      skipped++;
      continue;
    }
```

- [ ] **Step 3: Type-check**

```bash
cd "D:/Flow-Forges/lead-engine" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/sequence-engine.ts
git commit -m "feat(sequences): queue linkedin steps instead of skipping"
```

---

## Task 4: Outreach Agent — LinkedIn Candidate Scanning

**Files:**
- Modify: `lib/agents/outreach-agent.ts`

Add a new Step 7 that identifies leads ready for a direct LinkedIn connection request (without a sequence), and adds them to the queue as a medium-risk Telegram-approval action.

- [ ] **Step 1: Add the import at the top of outreach-agent.ts**

After the existing imports, add:
```typescript
import { isAlreadyQueued } from "@/lib/linkedin-queue";
```

- [ ] **Step 2: Add Step 7 inside the `run()` method**

Find the `// ── Build summary ──` comment (near the end of the `run()` method) and insert this block before it:

```typescript
      // ── Step 7: LinkedIn connection candidates ────────────────────────────────
      // Find qualified leads with a LinkedIn URL not yet in the queue.
      // Build a batched action so the user approves the whole set at once.
      const linkedinCandidates: Array<{ leadId: string; leadName: string; company: string; profileUrl: string; score: number }> = [];

      for (const lead of qualifiedLeads) {
        if (!lead.linkedin) continue;
        const alreadyQueued = await isAlreadyQueued(lead.id, "connection_request").catch(() => false);
        if (alreadyQueued) continue;
        linkedinCandidates.push({
          leadId: lead.id,
          leadName: lead.name,
          company: lead.company,
          profileUrl: lead.linkedin,
          score: lead.score,
        });
        if (linkedinCandidates.length >= 10) break; // cap at 10/day
      }

      if (linkedinCandidates.length > 0) {
        const names = linkedinCandidates
          .slice(0, 3)
          .map(c => `${c.leadName} — ${c.company} (score ${c.score})`)
          .join(", ");
        const suffix = linkedinCandidates.length > 3 ? ` +${linkedinCandidates.length - 3} more` : "";
        actionsToQueue.push({
          type: "queue_linkedin_connections",
          description: `Queue ${linkedinCandidates.length} LinkedIn connection requests: ${names}${suffix}`,
          payload: { candidates: linkedinCandidates },
          riskLevel: "medium",
        });
      }

      // Write linkedin stats to knowledge store
      try {
        await writeKnowledge("outreach.linkedin_candidates_today", linkedinCandidates.length, "outreach-agent");
      } catch { /* ignore */ }
```

- [ ] **Step 3: Type-check**

```bash
cd "D:/Flow-Forges/lead-engine" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/agents/outreach-agent.ts
git commit -m "feat(agents): outreach agent scans linkedin connection candidates"
```

---

## Task 5: Resolver — Dispatch LinkedIn Queue Actions

**Files:**
- Modify: `lib/agents/resolver.ts`

- [ ] **Step 1: Add the import at the top of resolver.ts**

After the existing imports, add:
```typescript
import { enqueueLinkedInAction } from "@/lib/linkedin-queue";
```

- [ ] **Step 2: Add two new cases to `dispatchAction`**

In `resolver.ts`, find the `// Informational types` comment (near line 186) and insert these two cases BEFORE it:

```typescript
    case "queue_linkedin_connections": {
      const candidates = Array.isArray(p.candidates) ? p.candidates : [];
      if (!candidates.length) throw new Error("queue_linkedin_connections payload missing candidates");

      let queued = 0;
      for (const c of candidates as Array<Record<string, unknown>>) {
        const leadId = String(c.leadId ?? "");
        const profileUrl = String(c.profileUrl ?? "");
        if (!leadId || !profileUrl) continue;
        try {
          await enqueueLinkedInAction({
            leadId,
            linkedinProfileUrl: profileUrl,
            actionType: "connection_request",
            message: c.message ? String(c.message) : undefined,
          });
          queued++;
        } catch {
          // continue with remaining candidates
        }
      }
      return `Queued ${queued} LinkedIn connection request${queued !== 1 ? "s" : ""}`;
    }

    case "queue_linkedin_dm": {
      const leadId = String(p.leadId ?? "");
      const profileUrl = String(p.profileUrl ?? "");
      const message = String(p.message ?? "");
      if (!leadId || !profileUrl) throw new Error("queue_linkedin_dm payload missing leadId or profileUrl");

      await enqueueLinkedInAction({
        leadId,
        linkedinProfileUrl: profileUrl,
        actionType: "dm",
        message: message || undefined,
      });
      return `LinkedIn DM queued for ${String(p.leadName ?? leadId)}`;
    }
```

- [ ] **Step 3: Type-check**

```bash
cd "D:/Flow-Forges/lead-engine" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/agents/resolver.ts
git commit -m "feat(agents): resolver dispatches linkedin queue actions"
```

---

## Task 6: Queue API Route

**Files:**
- Create: `app/api/outreach/queue/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/outreach/queue/route.ts
import { NextResponse } from "next/server";
import {
  getQueueStatus,
  getPendingActions,
  getTodayStats,
  enqueueLinkedInAction,
} from "@/lib/linkedin-queue";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const [status, pending, todayStats] = await Promise.all([
      getQueueStatus(),
      getPendingActions(10),
      getTodayStats(),
    ]);

    // Runner heartbeat: last_run_at from linkedin_daily_stats tells us if runner is alive
    const today = new Date().toISOString().split("T")[0];
    const { data: statsRow } = await supabaseAdmin
      .from("linkedin_daily_stats")
      .select("last_run_at")
      .eq("date", today)
      .maybeSingle();

    const lastRunAt = (statsRow as { last_run_at?: string } | null)?.last_run_at ?? null;
    const runnerLive = lastRunAt
      ? Date.now() - new Date(lastRunAt).getTime() < 10 * 60 * 1000 // within 10 min
      : false;

    return NextResponse.json({
      status,
      pending,
      todayStats,
      runnerLive,
      lastRunAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      leadId: string;
      actionType: "connection_request" | "dm" | "follow_up";
      message?: string;
      scheduledFor?: string;
    };

    if (!body.leadId || !body.actionType) {
      return NextResponse.json({ error: "leadId and actionType required" }, { status: 400 });
    }

    // Look up the lead's linkedin URL
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, linkedin")
      .eq("id", body.leadId)
      .single();

    if (!lead || !(lead as { linkedin?: string }).linkedin) {
      return NextResponse.json({ error: "Lead not found or has no LinkedIn URL" }, { status: 404 });
    }

    const l = lead as { id: string; name: string; linkedin: string };
    const item = await enqueueLinkedInAction({
      leadId: l.id,
      linkedinProfileUrl: l.linkedin,
      actionType: body.actionType,
      message: body.message,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    });

    return NextResponse.json({ item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check + build check**

```bash
cd "D:/Flow-Forges/lead-engine" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/outreach/queue/route.ts
git commit -m "feat(api): linkedin queue GET/POST route"
```

---

## Task 7: Outreach Page Rebuild

**Files:**
- Modify: `app/outreach/page.tsx` (full replacement)

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send, RefreshCw, CheckCircle2, Clock, Users,
  AlertTriangle, Terminal, ChevronDown, ChevronUp,
  Copy, Plus, Wifi, WifiOff,
} from "lucide-react";
import type { LinkedInQueueItem, LinkedInDailyStats, QueueStatus } from "@/lib/linkedin-queue";

const BASE = "/prospecting-os";

interface QueueResponse {
  status: QueueStatus;
  pending: LinkedInQueueItem[];
  todayStats: LinkedInDailyStats;
  runnerLive: boolean;
  lastRunAt: string | null;
}

// ─── Daily usage gauge ────────────────────────────────────────────────────────

function UsageBar({ label, used, max, color }: { label: string; used: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {used}/{max}
        </span>
      </div>
      <div className="rounded-full h-1.5 overflow-hidden" style={{ background: "var(--surface2)" }}>
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Runner setup guide ───────────────────────────────────────────────────────

function SetupGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const steps = [
    {
      key: "install",
      title: "Install runner dependencies (one-time)",
      code: "cd runner\nnpm install",
      desc: "Installs Playwright + Supabase client. Requires Node.js 18+.",
    },
    {
      key: "env",
      title: "Configure .env (one-time)",
      code: "cp .env.example .env\n# Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Vercel env",
      desc: "Only needs Supabase credentials. No LinkedIn password stored here.",
    },
    {
      key: "browser",
      title: "Set up Chrome profile (one-time)",
      code: "node linkedin-runner.js --setup",
      desc: "Opens a Chrome window. Log into LinkedIn manually. Close when done — your session is saved.",
    },
    {
      key: "run",
      title: "Start the runner",
      code: "node linkedin-runner.js",
      desc: "Polls queue every 5 min. Runs 8 AM–8 PM only. Keep this terminal open while working.",
    },
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ color: "var(--text)" }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={15} style={{ color: "var(--accent-blue)" }} />
          <span className="text-[13px] font-semibold">Local Runner Setup Guide</span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          {steps.map(({ key, title, code, desc }) => (
            <div key={key} className="rounded-lg p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>{desc}</p>
              <div className="relative rounded-md overflow-hidden" style={{ background: "#0a0a12" }}>
                <pre className="text-[11px] px-3 py-2 pr-10 overflow-x-auto font-mono leading-relaxed" style={{ color: "#a8e6cf" }}>
                  {code}
                </pre>
                <button
                  onClick={() => copy(code, key)}
                  className="absolute top-2 right-2 p-1 rounded"
                  style={{ color: "var(--muted)" }}
                  title="Copy"
                >
                  <Copy size={12} />
                </button>
                {copied === key && (
                  <span className="absolute top-2 right-7 text-[10px]" style={{ color: "var(--accent-green)" }}>✓</span>
                )}
              </div>
            </div>
          ))}

          <div
            className="flex items-start gap-2 rounded-lg px-4 py-3"
            style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.20)" }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent-orange)" }} />
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              <span className="font-semibold" style={{ color: "var(--accent-orange)" }}>LinkedIn ToS:</span>{" "}
              This automation uses your real account. Stay within limits: 10 connections/day, 20 DMs/day.
              Always use a dedicated LinkedIn account, not your main one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action type badge ────────────────────────────────────────────────────────

function ActionBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    connection_request: { bg: "rgba(0,212,255,0.10)", color: "var(--accent-blue)", label: "Connect" },
    dm: { bg: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", label: "DM" },
    follow_up: { bg: "rgba(245,158,11,0.10)", color: "#f59e0b", label: "Follow-up" },
    profile_view: { bg: "rgba(107,107,128,0.10)", color: "var(--muted)", label: "View" },
  };
  const s = styles[type] ?? styles.profile_view;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${BASE}/api/outreach/queue`);
      if (res.ok) setData(await res.json() as QueueResponse);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const stats = data?.todayStats;
  const status = data?.status;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}>
            <Send size={16} style={{ color: "var(--accent-blue)" }} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>LinkedIn Outreach</h1>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Queue-based safe outreach — runs from your local machine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Runner status */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: data?.runnerLive ? "rgba(0,255,136,0.08)" : "rgba(107,107,128,0.08)",
              border: `1px solid ${data?.runnerLive ? "rgba(0,255,136,0.20)" : "rgba(107,107,128,0.20)"}`,
              color: data?.runnerLive ? "var(--accent-green)" : "var(--muted)",
            }}
          >
            {data?.runnerLive ? <Wifi size={10} /> : <WifiOff size={10} />}
            {loading ? "..." : data?.runnerLive ? "Runner live" : "Runner offline"}
          </div>

          <button
            onClick={() => load(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
            title="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Daily usage */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <UsageBar
            label="Connections today"
            used={stats?.connectionsSent ?? 0}
            max={10}
            color="var(--accent-blue)"
          />
          <UsageBar
            label="DMs today"
            used={stats?.dmsSent ?? 0}
            max={20}
            color="var(--accent-purple)"
          />
        </div>

        {/* Queue status cards */}
        <div className="grid grid-cols-4 gap-3">
          {([
            { label: "Pending", key: "pending", color: "#f59e0b" },
            { label: "Executing", key: "executing", color: "var(--accent-blue)" },
            { label: "Done", key: "done", color: "var(--accent-green)" },
            { label: "Failed", key: "failed", color: "var(--accent-orange)" },
          ] as const).map(({ label, key, color }) => (
            <div key={key} className="rounded-xl p-4 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</span>
              <span className="text-2xl font-bold tabular-nums" style={{ color }}>
                {loading ? "—" : (status?.[key] ?? 0)}
              </span>
            </div>
          ))}
        </div>

        {/* Pending actions table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Next Pending Actions
            </h2>
          </div>

          {(data?.pending?.length ?? 0) === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: "var(--muted)" }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Queue is empty</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Run the Outreach Agent to find LinkedIn candidates, or approve a pending Telegram action.
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    {["Lead", "Type", "Scheduled", "Message preview"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.pending?.map((item, i) => (
                    <tr
                      key={item.id}
                      style={{
                        background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>
                        {item.leadId}
                      </td>
                      <td className="px-4 py-2.5">
                        <ActionBadge type={item.actionType} />
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--muted)" }}>
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(item.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 max-w-xs truncate" style={{ color: "var(--muted)" }}>
                        {item.message?.slice(0, 60) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* How this works */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)" }}>
          <p className="text-[12px] font-semibold" style={{ color: "var(--accent-blue)" }}>How this works</p>
          <div className="space-y-1.5">
            {[
              { icon: Users, text: "Outreach Agent (8 AM) finds qualified leads → sends Telegram approval" },
              { icon: CheckCircle2, text: "You approve → actions are written to this queue" },
              { icon: Send, text: "Local runner on your machine executes actions at human pace (30–120s delay)" },
              { icon: Clock, text: "10 connection requests/day · 20 DMs/day · runs 8 AM–8 PM only" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-2">
                <Icon size={12} className="mt-0.5 shrink-0" style={{ color: "var(--accent-blue)" }} />
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <SetupGuide />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

```bash
cd "D:/Flow-Forges/lead-engine" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/outreach/page.tsx
git commit -m "feat(ui): rebuild outreach page as linkedin queue dashboard"
```

---

## Task 8: Local Runner

**Files:**
- Create: `runner/package.json`
- Create: `runner/.env.example`
- Create: `runner/linkedin-runner.js`

- [ ] **Step 1: Create runner/package.json**

```json
{
  "name": "linkedin-runner",
  "version": "1.0.0",
  "description": "Local LinkedIn outreach runner — polls Supabase queue and executes actions via Playwright",
  "main": "linkedin-runner.js",
  "scripts": {
    "start": "node linkedin-runner.js",
    "setup": "node linkedin-runner.js --setup"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0",
    "dotenv": "^16.4.5",
    "playwright": "^1.44.0",
    "playwright-extra": "^4.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2"
  }
}
```

- [ ] **Step 2: Create runner/.env.example**

```bash
# Copy this to .env and fill in your values
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Safety limits (optional — these are the defaults)
MAX_CONNECTIONS_PER_DAY=10
MAX_DMS_PER_DAY=20
MIN_DELAY_SECONDS=30
MAX_DELAY_SECONDS=120
ACTIVE_HOURS_START=8
ACTIVE_HOURS_END=20
BREAK_EVERY_N_ACTIONS=5
BREAK_DURATION_MINUTES=15
```

- [ ] **Step 3: Create runner/linkedin-runner.js**

```javascript
// runner/linkedin-runner.js
// Local LinkedIn outreach runner — runs on your home machine.
// Polls the linkedin_queue table and executes actions via Playwright.
// Never run this on a server — home IP only.

require("dotenv").config();
const path = require("path");
const os = require("os");

const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[runner] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS_PER_DAY ?? "10", 10);
const MAX_DMS = parseInt(process.env.MAX_DMS_PER_DAY ?? "20", 10);
const MIN_DELAY = parseInt(process.env.MIN_DELAY_SECONDS ?? "30", 10) * 1000;
const MAX_DELAY = parseInt(process.env.MAX_DELAY_SECONDS ?? "120", 10) * 1000;
const ACTIVE_START = parseInt(process.env.ACTIVE_HOURS_START ?? "8", 10);
const ACTIVE_END = parseInt(process.env.ACTIVE_HOURS_END ?? "20", 10);
const BREAK_EVERY = parseInt(process.env.BREAK_EVERY_N_ACTIONS ?? "5", 10);
const BREAK_DURATION = parseInt(process.env.BREAK_DURATION_MINUTES ?? "15", 10) * 60 * 1000;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PROFILE_DIR = path.join(os.homedir(), ".linkedin-runner", "profile");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomDelay(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function isActiveHour() {
  const h = new Date().getHours();
  return h >= ACTIVE_START && h < ACTIVE_END;
}

async function getTodayStats() {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("linkedin_daily_stats")
    .select("*")
    .eq("date", today)
    .maybeSingle();
  return {
    date: today,
    connections_sent: data?.connections_sent ?? 0,
    dms_sent: data?.dms_sent ?? 0,
    profile_views: data?.profile_views ?? 0,
  };
}

async function incrementStat(field) {
  const today = new Date().toISOString().split("T")[0];
  const current = await getTodayStats();
  await supabase.from("linkedin_daily_stats").upsert({
    date: today,
    connections_sent: field === "connections_sent" ? current.connections_sent + 1 : current.connections_sent,
    dms_sent: field === "dms_sent" ? current.dms_sent + 1 : current.dms_sent,
    profile_views: field === "profile_views" ? current.profile_views + 1 : current.profile_views,
    last_run_at: new Date().toISOString(),
  });
}

async function heartbeat() {
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("linkedin_daily_stats").upsert(
    { date: today, last_run_at: new Date().toISOString() },
    { onConflict: "date", ignoreDuplicates: false }
  );
}

async function getNextPendingAction() {
  const { data } = await supabase
    .from("linkedin_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function markExecuting(id) {
  await supabase.from("linkedin_queue").update({ status: "executing" }).eq("id", id);
}

async function markDone(id) {
  await supabase.from("linkedin_queue").update({
    status: "done",
    executed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function markFailed(id, error) {
  await supabase.from("linkedin_queue").update({
    status: "failed",
    error: String(error).slice(0, 500),
    executed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function logActivity(leadId, text) {
  await supabase.from("activity_log").insert({
    type: "notification",
    text,
    lead_id: leadId || null,
  });
}

async function updateLeadStatus(leadId, status, kanbanColumn) {
  await supabase.from("leads").update({
    status,
    kanban_column: kanbanColumn,
    last_touched: new Date().toISOString(),
  }).eq("id", leadId);
}

async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `[LinkedIn Runner] ${message}` }),
  }).catch(() => undefined);
}

// ─── Setup mode (one-time login) ──────────────────────────────────────────────

async function setupProfile() {
  console.log("[runner] Setup mode — opening Chrome for manual LinkedIn login...");
  console.log(`[runner] Profile will be saved to: ${PROFILE_DIR}`);
  console.log("[runner] Log into LinkedIn, then close the browser window.");

  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await browser.newPage();
  await page.goto("https://www.linkedin.com/login");
  console.log("[runner] Browser opened. Log in and close the window when done.");

  await browser.waitForEvent("close").catch(() => undefined);
  console.log("[runner] Profile saved. Run `node linkedin-runner.js` to start the runner.");
  process.exit(0);
}

// ─── LinkedIn action execution ────────────────────────────────────────────────

async function executeConnectionRequest(page, action) {
  console.log(`[runner] Navigating to: ${action.linkedin_profile_url}`);
  await page.goto(action.linkedin_profile_url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Check for CAPTCHA or security challenge
  const url = page.url();
  if (url.includes("checkpoint") || url.includes("challenge") || url.includes("captcha")) {
    throw new Error("CAPTCHA_DETECTED");
  }

  // Wait for page content + random read time
  await randomDelay(5000, 15000);

  // Check if already connected
  const messageBtn = page.locator("button:has-text('Message')");
  if (await messageBtn.count() > 0) {
    console.log("[runner] Already connected — skipping");
    return "already_connected";
  }

  // Check if connection request already pending
  const pendingBtn = page.locator("button:has-text('Pending')");
  if (await pendingBtn.count() > 0) {
    console.log("[runner] Connection already pending — skipping");
    return "already_pending";
  }

  // Find and click Connect button
  const connectBtn = page.locator("button:has-text('Connect')").first();
  if (await connectBtn.count() === 0) {
    // Try "More" dropdown which sometimes houses Connect
    const moreBtn = page.locator("button:has-text('More')").first();
    if (await moreBtn.count() > 0) {
      await moreBtn.click();
      await randomDelay(800, 1500);
    }
    const connectInMenu = page.locator("[aria-label*='Connect']").first();
    if (await connectInMenu.count() === 0) {
      throw new Error("Connect button not found");
    }
    await connectInMenu.click();
  } else {
    // Move mouse naturally before clicking
    const box = await connectBtn.boundingBox();
    if (box) {
      await page.mouse.move(
        box.x + box.width * 0.3 + Math.random() * box.width * 0.4,
        box.y + box.height * 0.3 + Math.random() * box.height * 0.4
      );
      await randomDelay(300, 800);
    }
    await connectBtn.click();
  }

  await randomDelay(1000, 2000);

  // Add a note if message is provided
  if (action.message) {
    const addNoteBtn = page.locator("button:has-text('Add a note')");
    if (await addNoteBtn.count() > 0) {
      await addNoteBtn.click();
      await randomDelay(500, 1000);

      const textarea = page.locator("textarea[name='message']");
      if (await textarea.count() > 0) {
        // Human-like typing: random delay between keystrokes
        for (const char of action.message.slice(0, 300)) {
          await textarea.type(char, { delay: 80 + Math.random() * 80 });
        }
        await randomDelay(500, 1200);
      }
    }
  }

  // Send
  const sendBtn = page.locator("button:has-text('Send')").first();
  if (await sendBtn.count() > 0) {
    await sendBtn.click();
    console.log(`[runner] Connection request sent`);
    return "sent";
  }

  throw new Error("Send button not found after adding note");
}

async function executeDM(page, action) {
  console.log(`[runner] Navigating to: ${action.linkedin_profile_url}`);
  await page.goto(action.linkedin_profile_url, { waitUntil: "domcontentloaded", timeout: 30000 });

  const url = page.url();
  if (url.includes("checkpoint") || url.includes("challenge")) {
    throw new Error("CAPTCHA_DETECTED");
  }

  await randomDelay(5000, 12000);

  const messageBtn = page.locator("button:has-text('Message')").first();
  if (await messageBtn.count() === 0) {
    throw new Error("Message button not found — not connected yet?");
  }

  await messageBtn.click();
  await randomDelay(1500, 3000);

  const msgInput = page.locator(".msg-form__contenteditable, div[role='textbox']").first();
  if (await msgInput.count() === 0) {
    throw new Error("Message input not found");
  }

  const msgText = action.message ?? "Hi, I wanted to follow up with you.";
  for (const char of msgText.slice(0, 500)) {
    await msgInput.type(char, { delay: 80 + Math.random() * 80 });
  }

  await randomDelay(800, 2000);

  const submitBtn = page.locator("button[type='submit']").first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
    console.log(`[runner] DM sent`);
    return "sent";
  }

  throw new Error("Submit button not found in message dialog");
}

// ─── Main run loop ────────────────────────────────────────────────────────────

async function runOnce() {
  const stats = await getTodayStats();

  if (!isActiveHour()) {
    console.log(`[runner] Outside active hours (${ACTIVE_START}:00–${ACTIVE_END}:00) — waiting`);
    return 0;
  }

  await heartbeat();

  const action = await getNextPendingAction();
  if (!action) {
    console.log("[runner] Queue empty — nothing to do");
    return 0;
  }

  // Check daily caps
  if (action.action_type === "connection_request" && stats.connections_sent >= MAX_CONNECTIONS) {
    console.log(`[runner] Connection cap reached (${MAX_CONNECTIONS}/day) — waiting until tomorrow`);
    return 0;
  }
  if (action.action_type === "dm" && stats.dms_sent >= MAX_DMS) {
    console.log(`[runner] DM cap reached (${MAX_DMS}/day) — waiting until tomorrow`);
    return 0;
  }

  await markExecuting(action.id);
  console.log(`[runner] Executing ${action.action_type} for lead ${action.lead_id}`);

  let browser;
  try {
    browser = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      args: ["--start-minimized"],
    });

    const page = await browser.newPage();

    let result;
    if (action.action_type === "connection_request") {
      result = await executeConnectionRequest(page, action);
      if (result === "sent") {
        await incrementStat("connections_sent");
        await updateLeadStatus(action.lead_id, "contacted", "Contacted");
        await logActivity(action.lead_id, `Sent LinkedIn connection request`);
      }
    } else if (action.action_type === "dm" || action.action_type === "follow_up") {
      result = await executeDM(page, action);
      if (result === "sent") {
        await incrementStat("dms_sent");
        await logActivity(action.lead_id, `Sent LinkedIn DM`);
      }
    }

    await markDone(action.id);
    console.log(`[runner] Done — ${action.action_type} result: ${result}`);
    return 1;
  } catch (err) {
    const msg = String(err?.message ?? err);
    console.error(`[runner] Failed: ${msg}`);
    await markFailed(action.id, msg);

    if (msg === "CAPTCHA_DETECTED") {
      const alert = "CAPTCHA detected on LinkedIn — runner stopped. Please log in manually and restart.";
      console.error(`[runner] ${alert}`);
      await sendTelegramAlert(alert);
      process.exit(1);
    }
    return 0;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  if (process.argv.includes("--setup")) {
    await setupProfile();
    return;
  }

  console.log(`[runner] LinkedIn Runner started`);
  console.log(`[runner] Limits: ${MAX_CONNECTIONS} connections/day · ${MAX_DMS} DMs/day`);
  console.log(`[runner] Active hours: ${ACTIVE_START}:00–${ACTIVE_END}:00`);
  console.log(`[runner] Profile: ${PROFILE_DIR}`);
  console.log(`[runner] Poll interval: ${POLL_INTERVAL / 1000}s\n`);

  let actionsSinceBreak = 0;

  while (true) {
    try {
      const executed = await runOnce();
      if (executed > 0) {
        actionsSinceBreak++;
        if (actionsSinceBreak >= BREAK_EVERY) {
          console.log(`[runner] ${BREAK_EVERY} actions done — taking ${BREAK_DURATION / 60000} min break`);
          actionsSinceBreak = 0;
          await new Promise(r => setTimeout(r, BREAK_DURATION));
        } else {
          await randomDelay(MIN_DELAY, MAX_DELAY);
        }
      } else {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    } catch (err) {
      console.error(`[runner] Unhandled error: ${err?.message ?? err}`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }
}

main().catch(err => {
  console.error("[runner] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Install runner dependencies**

```bash
cd "D:/Flow-Forges/lead-engine/runner" && npm install
```

Expected: `node_modules/` created with playwright, playwright-extra, supabase-js, dotenv.

- [ ] **Step 5: Verify runner starts without crashing**

```bash
cd "D:/Flow-Forges/lead-engine/runner" && cp .env.example .env
```

Edit `runner/.env` — add real `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Vercel env vars.

```bash
node linkedin-runner.js
```

Expected output (no errors, runner waits for queue):
```
[runner] LinkedIn Runner started
[runner] Limits: 10 connections/day · 20 DMs/day
[runner] Active hours: 8:00–20:00
[runner] Poll interval: 300s
[runner] Queue empty — nothing to do
```

- [ ] **Step 6: Add runner to .gitignore**

In the root `.gitignore`, add:
```
runner/node_modules/
runner/.env
runner/.env.local
~/.linkedin-runner/
```

- [ ] **Step 7: Commit everything**

```bash
cd "D:/Flow-Forges/lead-engine"
git add runner/package.json runner/.env.example runner/linkedin-runner.js .gitignore
git commit -m "feat: linkedin local runner with playwright stealth + human pacing"
```

---

## Task 9: Final Build Check + CLAUDE.md Update

- [ ] **Step 1: Full TypeScript check**

```bash
cd "D:/Flow-Forges/lead-engine" && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Production build**

```bash
cd "D:/Flow-Forges/lead-engine" && npm run build
```

Expected: 0 errors, all pages compile, new route `/api/outreach/queue` appears in output.

- [ ] **Step 3: Update CLAUDE.md roadmap**

In `CLAUDE.md`, find the Phase 15 roadmap entry:
```
| **15** | **OpenOutreach → Sequence integration** | ... |
```

Replace with:
```
| ~~**15**~~ | ~~**OpenOutreach → Sequence integration**~~ | **DONE** — LinkedIn Queue System: local runner (runner/linkedin-runner.js), Supabase queue, Outreach Agent integration, rebuilt /outreach page |
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark phase 15 complete — linkedin queue system"
```

---

## Self-Review

**Spec coverage check:**
- DB tables (`linkedin_queue`, `linkedin_daily_stats`) — Task 1
- `lib/linkedin-queue.ts` helpers — Task 2
- Sequence engine writes to queue instead of skip — Task 3
- Outreach Agent LinkedIn scanning — Task 4
- Resolver dispatches `queue_linkedin_connections` + `queue_linkedin_dm` — Task 5
- `app/api/outreach/queue` GET/POST — Task 6
- Rebuilt outreach page with queue UI — Task 7
- Local runner with Playwright, anti-detection, pacing, safety stops — Task 8
- `runner/package.json` + `.env.example` — Task 8

**All spec requirements covered.**

**Type consistency check:**
- `enqueueLinkedInAction` defined in Task 2, imported in Tasks 3, 4, 5 — consistent
- `QueueStatus`, `LinkedInQueueItem`, `LinkedInDailyStats` defined in Task 2, used in Task 6+7 — consistent
- `action_type` values `"connection_request" | "dm" | "follow_up" | "profile_view"` used consistently across DB, types, runner
- `queue_linkedin_connections` / `queue_linkedin_dm` action types referenced consistently in Tasks 4 and 5
