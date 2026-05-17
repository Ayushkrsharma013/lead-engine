# Tier 2 Phase 1 — Automated Sequence Execution Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel Cron-powered engine that processes sequence steps, resolves templates, and sends email via Resend.

**Architecture:** Vercel Cron hits `/api/cron/sequence-runner` every 5 min → `sequence-engine.ts` queries `sequence_executions` for due steps → resolves `{{variables}}` against lead data → sends via `lib/resend.ts` → logs to `sequence_messages` + `activity_log` → auto-advances kanban.

**Tech Stack:** Next.js 14 API Routes, Supabase MCP (execute_sql for schema), Resend HTTP API, @supabase/ssr (anon client for cron).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/resend.ts` | Create | Resend HTTP API wrapper — sendEmail() |
| `lib/types.ts` | Modify | Add SequenceExecution, SequenceMessage interfaces |
| `lib/db.ts` | Modify | Add CRUD for new tables, update existings |
| `lib/sequence-engine.ts` | Create | Core engine: resolveTemplate, launchSequence, processDueSteps |
| `app/api/sequence/launch/route.ts` | Create | POST endpoint — launches a sequence |
| `app/api/sequence/cancel/route.ts` | Create | POST endpoint — cancels an execution |
| `app/api/cron/sequence-runner/route.ts` | Create | GET endpoint — cron invokes processDueSteps |
| `app/api/inbound-email/route.ts` | Create | Stub for Phase 2 (accepts Resend webhooks) |
| `app/sequences/page.tsx` | Modify | Launch button, execution status, pause/cancel |
| `vercel.json` | Create | Cron schedule config |
| `middleware.ts` | Modify | No changes needed — `/api/*` already public |

---

### Task 1: Create DB tables via Supabase MCP

**Files:**
- Execute: Supabase MCP `execute_sql` on `otxifqcvgmxoxemmgbjd`

- [ ] **Step 1: Create sequence_executions table**

Use `mcp__plugin_supabase_supabase__execute_sql`:
```sql
CREATE TABLE IF NOT EXISTS sequence_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE sequence_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_sequence_executions" ON sequence_executions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Create sequence_messages table**

Use `mcp__plugin_supabase_supabase__execute_sql`:
```sql
CREATE TABLE IF NOT EXISTS sequence_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES sequence_executions(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced', 'skipped')),
  resend_id TEXT,
  variant TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE sequence_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_sequence_messages" ON sequence_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_sequence_messages_execution ON sequence_messages(execution_id);
CREATE INDEX idx_sequence_messages_created ON sequence_messages(created_at);
```

- [ ] **Step 3: Verify tables exist**

Use `mcp__plugin_supabase_supabase__list_tables` with `verbose: true` and confirm both tables appear with correct columns.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add sequence_executions and sequence_messages tables"
```

---

### Task 2: Create reusable Resend client

**Files:**
- Create: `lib/resend.ts`

- [ ] **Step 1: Write lib/resend.ts**

```typescript
const RESEND_API = "https://api.resend.com/emails";
const FROM = "Prospecting OS <notifications@flow-forges.com>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  resendId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] No RESEND_API_KEY configured");
    return { ok: false, error: "No API key" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const data = await res.json() as { id?: string; message?: string };

    if (res.ok && data.id) {
      return { ok: true, resendId: data.id };
    }
    return { ok: false, error: data.message || `HTTP ${res.status}` };
  } catch (err) {
    console.warn("[resend] Send failed:", err);
    return { ok: false, error: String(err) };
  }
}

export function buildProspectingEmailHtml(params: {
  leadName: string;
  subject: string;
  body: string;
}): string {
  const bodyHtml = params.body.replace(/\n/g, "<br>");
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0d0a;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td>
      <div style="background:#1a1917;border-radius:12px;padding:24px;border:1px solid rgba(255,255,255,0.06);max-width:560px;margin:0 auto;">
        <p style="color:#7a7875;font-size:12px;margin:0 0 16px;">Hi ${params.leadName},</p>
        <div style="color:#f5f4f1;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      </div>
      <p style="color:#4a4845;font-size:11px;text-align:center;margin-top:16px;">
        Sent by Prospecting OS &middot; <a href="https://app.flow-forges.com/prospecting-os" style="color:#e8420a;text-decoration:none;">app.flow-forges.com</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
```

This extracts the Resend fetch pattern from `lib/notify.ts` (which already works) into a reusable client. `notify.ts` continues to use its own inline fetch — this is for the sequence engine.

- [ ] **Step 2: Commit**

```bash
git add lib/resend.ts
git commit -m "feat: add reusable Resend email client"
```

---

### Task 3: Add new types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add SequenceExecution and SequenceMessage types**

Add after the `Sequence` interface (around line 118):

```typescript
export interface SequenceExecution {
  id: string;
  sequenceId: string;
  leadId: string;
  currentStep: number;
  status: "active" | "paused" | "completed" | "cancelled";
  startedAt: string;
  lastActionAt: string;
  createdAt?: string;
}

export interface SequenceMessage {
  id: string;
  executionId: string;
  leadId: string;
  stepIndex: number;
  channel: "email" | "linkedin";
  subject: string;
  body: string;
  status: "sent" | "failed" | "bounced" | "skipped";
  resendId?: string;
  variant?: string;
  createdAt?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No new errors (0 errors from these additions).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add SequenceExecution and SequenceMessage types"
```

---

### Task 4: Add DB functions for new tables

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Add transformation helpers and CRUD functions**

Add these helpers after the existing `activityFromDB` function (around line 123):

```typescript
function sequenceExecutionFromDB(row: Record<string, unknown>): SequenceExecution {
  return {
    id: String(row.id || ""),
    sequenceId: String(row.sequence_id || ""),
    leadId: String(row.lead_id || ""),
    currentStep: Number(row.current_step ?? 0),
    status: String(row.status || "active") as SequenceExecution["status"],
    startedAt: row.started_at ? String(row.started_at) : new Date().toISOString(),
    lastActionAt: row.last_action_at ? String(row.last_action_at) : new Date().toISOString(),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function sequenceMessageFromDB(row: Record<string, unknown>): SequenceMessage {
  return {
    id: String(row.id || ""),
    executionId: String(row.execution_id || ""),
    leadId: String(row.lead_id || ""),
    stepIndex: Number(row.step_index ?? 0),
    channel: String(row.channel || "email") as SequenceMessage["channel"],
    subject: String(row.subject || ""),
    body: String(row.body || ""),
    status: String(row.status || "sent") as SequenceMessage["status"],
    resendId: row.resend_id ? String(row.resend_id) : undefined,
    variant: row.variant ? String(row.variant) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}
```

Add these exported functions after the `logActivity` function (end of file):

```typescript
// ─── Sequence Executions ──────────────────────────────────────────────────────

export async function getSequenceExecutions(sequenceId?: string): Promise<SequenceExecution[]> {
  let q = supabase.from("sequence_executions").select("*").order("created_at", { ascending: false });
  if (sequenceId) q = q.eq("sequence_id", sequenceId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(sequenceExecutionFromDB);
}

export async function getDueExecutions(): Promise<SequenceExecution[]> {
  const { data, error } = await supabase
    .from("sequence_executions")
    .select("*")
    .eq("status", "active")
    .order("last_action_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(sequenceExecutionFromDB);
}

export async function createSequenceExecutions(
  rows: Array<{
    sequence_id: string;
    lead_id: string;
    status: string;
    user_id?: string;
  }>
): Promise<SequenceExecution[]> {
  const { data, error } = await supabase
    .from("sequence_executions")
    .insert(rows)
    .select();
  if (error) throw error;
  return (data || []).map(sequenceExecutionFromDB);
}

export async function updateSequenceExecution(
  id: string,
  updates: { current_step?: number; status?: string; last_action_at?: string }
): Promise<SequenceExecution> {
  const { data, error } = await supabase
    .from("sequence_executions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return sequenceExecutionFromDB(data as unknown as Record<string, unknown>);
}

// ─── Sequence Messages ────────────────────────────────────────────────────────

export async function getSequenceMessages(executionId?: string): Promise<SequenceMessage[]> {
  let q = supabase.from("sequence_messages").select("*").order("created_at", { ascending: false });
  if (executionId) q = q.eq("execution_id", executionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(sequenceMessageFromDB);
}

export async function insertSequenceMessage(
  msg: Omit<SequenceMessage, "id" | "createdAt">
): Promise<SequenceMessage> {
  const { data, error } = await supabase
    .from("sequence_messages")
    .insert({
      execution_id: msg.executionId,
      lead_id: msg.leadId,
      step_index: msg.stepIndex,
      channel: msg.channel,
      subject: msg.subject,
      body: msg.body,
      status: msg.status,
      resend_id: msg.resendId,
      variant: msg.variant,
    })
    .select()
    .single();
  if (error) throw error;
  return sequenceMessageFromDB(data as unknown as Record<string, unknown>);
}

export async function hasRecentMessages(minutesAgo: number = 4): Promise<boolean> {
  const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("sequence_messages")
    .select("*", { count: "exact", head: true })
    .gt("created_at", cutoff);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function batchUpdateLeadKanban(leadIds: string[], column: string, status: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leads")
    .update({ kanban_column: column, status: status, last_touched: now, updated_at: now })
    .in("id", leadIds);
  if (error) throw error;
}
```

Also add the imports for new types at the top of `lib/db.ts` — add `SequenceExecution, SequenceMessage` to the existing import from `"./types"` (line 4):
```typescript
import type {
  Lead, Message, Sequence, Campaign, Client,
  ActivityLogEntry, MergeResult, Stats,
  SequenceExecution, SequenceMessage,
} from "./types";
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add DB functions for sequence_executions and sequence_messages"
```

---

### Task 5: Build the sequence engine

**Files:**
- Create: `lib/sequence-engine.ts`

- [ ] **Step 1: Write lib/sequence-engine.ts**

```typescript
import {
  getDueExecutions,
  hasRecentMessages,
  updateSequenceExecution,
  insertSequenceMessage,
  getSequences,
  batchUpdateLeadKanban,
  logActivity,
} from "./db";
import { sendEmail, buildProspectingEmailHtml } from "./resend";
import { supabaseAdmin } from "./supabase";
import type { Sequence, SequenceExecution, Lead } from "./types";

const supabase = supabaseAdmin;

interface CronResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  locked: boolean;
}

// ─── Template Resolution ─────────────────────────────────────────────────────

export function resolveTemplate(template: string, lead: Lead): string {
  const vars: Record<string, string> = {
    "{{first_name}}": lead.name?.split(" ")[0] || "there",
    "{{company}}": lead.company || "",
    "{{industry}}": lead.industry || "",
    "{{title}}": lead.title || "",
  };

  let resolved = template;
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replaceAll(key, value);
  }
  // Clean up any remaining {{unknown}} patterns
  resolved = resolved.replace(/\{\{[^}]+\}\}/g, "");
  return resolved.trim();
}

// ─── Launch ──────────────────────────────────────────────────────────────────

export async function launchSequence(sequenceId: string, userId?: string): Promise<{
  sequence: Sequence;
  executions: SequenceExecution[];
  alreadyRunning: number;
}> {
  const sequences = await getSequences();
  const sequence = sequences.find(s => s.id === sequenceId);
  if (!sequence) throw new Error("Sequence not found");

  // Check existing executions
  const { data: existing } = await supabase
    .from("sequence_executions")
    .select("lead_id, status")
    .eq("sequence_id", sequenceId)
    .in("status", ["active", "paused"]);

  const existingLeadIds = new Set((existing || []).map((e: Record<string, unknown>) => String(e.lead_id)));
  const alreadyRunning = existingLeadIds.size;

  // Get leads that are assigned but not yet enrolled
  const { data: leads } = await supabase
    .from("leads")
    .select("id")
    .in("id", sequence.assignedLeadIds);

  const leadIds = (leads || []).map((l: Record<string, unknown>) => String(l.id));
  const newLeadIds = leadIds.filter(id => !existingLeadIds.has(id));

  if (newLeadIds.length === 0) {
    return { sequence, executions: [], alreadyRunning };
  }

  const rows = newLeadIds.map(leadId => ({
    sequence_id: sequenceId,
    lead_id: leadId,
    status: "active",
    user_id: userId || null,
  }));

  const { data: created } = await supabase
    .from("sequence_executions")
    .insert(rows)
    .select();

  const executions = (created || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    sequenceId: String(r.sequence_id),
    leadId: String(r.lead_id),
    currentStep: Number(r.current_step ?? 0),
    status: String(r.status) as SequenceExecution["status"],
    startedAt: String(r.started_at || new Date().toISOString()),
    lastActionAt: String(r.last_action_at || new Date().toISOString()),
    createdAt: String(r.created_at || ""),
  }));

  await logActivity({
    type: "notification",
    text: `Sequence "${sequence.name}" launched for ${newLeadIds.length} leads`,
  });

  return { sequence, executions, alreadyRunning };
}

// ─── Cron Handler ────────────────────────────────────────────────────────────

export async function processDueSteps(): Promise<CronResult> {
  // Prevent overlapping cron runs
  const locked = await hasRecentMessages(4);
  if (locked) {
    console.log("[sequence-engine] Skipping — another cron run is in progress");
    return { processed: 0, sent: 0, skipped: 0, failed: 0, locked: true };
  }

  const executions = await getDueExecutions();
  if (executions.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, locked: false };
  }

  const sequences = await getSequences();
  const sequenceMap = new Map(sequences.map(s => [s.id, s]));

  // Get leads for all executions in one query
  const leadIds = [...new Set(executions.map(e => e.leadId))];
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .in("id", leadIds);
  const leadMap = new Map((leads || []).map((l: Record<string, unknown>) => [String(l.id), l]));

  let sent = 0, skipped = 0, failed = 0;
  const contactedLeadIds: string[] = [];

  for (const exec of executions) {
    const sequence = sequenceMap.get(exec.sequenceId);
    if (!sequence) { skipped++; continue; }

    const step = sequence.steps[exec.currentStep];
    if (!step || !step.active) {
      // Advance to next step
      const nextStep = exec.currentStep + 1;
      if (nextStep >= sequence.steps.length) {
        await updateSequenceExecution(exec.id, { status: "completed" });
      } else {
        await updateSequenceExecution(exec.id, { current_step: nextStep });
      }
      skipped++;
      continue;
    }

    // Check if this step is due
    const startedAt = new Date(exec.startedAt).getTime();
    const dueAt = startedAt + step.day * 86400000; // day → ms
    if (Date.now() < dueAt) { skipped++; continue; }

    // Check for duplicate
    const { data: existingMsg } = await supabase
      .from("sequence_messages")
      .select("id")
      .eq("execution_id", exec.id)
      .eq("step_index", exec.currentStep)
      .maybeSingle();
    if (existingMsg) { skipped++; continue; }

    // Skip LinkedIn for now (OpenOutreach handles that)
    if (step.channel === "linkedin") {
      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "linkedin",
        subject: step.type,
        body: step.template,
        status: "skipped",
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

    // Resolve template and send email
    const leadRow = leadMap.get(exec.leadId);
    const lead: Lead = {
      id: String(leadRow?.id || ""),
      name: String(leadRow?.name || ""),
      title: String(leadRow?.title || ""),
      company: String(leadRow?.company || ""),
      industry: String(leadRow?.industry || ""),
      location: String(leadRow?.location || ""),
      email: String(leadRow?.email || ""),
      emailStatus: (["verified", "risky", "not_found"].includes(String(leadRow?.email_status)) ? String(leadRow.email_status) : "not_found") as Lead["emailStatus"],
      linkedin: String(leadRow?.linkedin || ""),
      website: String(leadRow?.website || ""),
      companySize: String(leadRow?.company_size || ""),
      score: Number(leadRow?.score ?? 0),
      source: "linkedin",
    };

    const subject = resolveTemplate(
      step.type.includes("Cold Email") ? step.template.split("\n")[0].replace("Subject: ", "") : step.type,
      lead
    );
    const body = resolveTemplate(step.template, lead);

    const html = buildProspectingEmailHtml({
      leadName: lead.name,
      subject: subject,
      body: body.includes("\n") ? body.split("\n").slice(1).filter(Boolean).join("\n") : body,
    });

    // Retry up to 3 times
    let result: { ok: boolean; resendId?: string } = { ok: false };
    for (let attempt = 0; attempt < 3; attempt++) {
      result = await sendEmail({ to: lead.email, subject, html: html });
      if (result.ok) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }

    if (result.ok) {
      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "email",
        subject,
        body,
        status: "sent",
        resendId: result.resendId,
      });
      sent++;
      contactedLeadIds.push(exec.leadId);
    } else {
      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "email",
        subject,
        body,
        status: "failed",
      });
      failed++;
    }

    // Advance to next step
    const nextStep = exec.currentStep + 1;
    const now = new Date().toISOString();
    if (nextStep >= sequence.steps.length) {
      await updateSequenceExecution(exec.id, { status: "completed", last_action_at: now });
    } else {
      await updateSequenceExecution(exec.id, { current_step: nextStep, last_action_at: now });
    }
  }

  // Auto-move contacted leads to "Contacted" in kanban
  if (contactedLeadIds.length > 0) {
    try {
      await batchUpdateLeadKanban(contactedLeadIds, "Contacted", "contacted");
    } catch (err) {
      console.warn("[sequence-engine] Kanban update failed:", err);
    }
  }

  const processed = executions.length;
  console.log(`[sequence-engine] Processed ${processed} executions — sent=${sent} skipped=${skipped} failed=${failed}`);

  return { processed, sent, skipped, failed, locked: false };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/sequence-engine.ts
git commit -m "feat: add sequence execution engine with template resolution"
```

---

### Task 6: Create API routes

**Files:**
- Create: `app/api/cron/sequence-runner/route.ts`
- Create: `app/api/sequence/launch/route.ts`
- Create: `app/api/sequence/cancel/route.ts`
- Create: `app/api/inbound-email/route.ts`

- [ ] **Step 1: Write cron endpoint**

Create `app/api/cron/sequence-runner/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { processDueSteps } from "@/lib/sequence-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s max for Vercel cron

export async function GET(req: Request) {
  // Allow only Vercel Cron or manual trigger with auth
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Check if this is a Vercel Cron request (has x-vercel-cron header in production)
    const isVercelCron = req.headers.get("x-vercel-cron") === "true";
    if (!isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processDueSteps();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/sequence-runner] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write launch endpoint**

Create `app/api/sequence/launch/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { launchSequence } from "@/lib/sequence-engine";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sequenceId } = await req.json() as { sequenceId: string };
  if (!sequenceId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });

  try {
    const result = await launchSequence(sequenceId, user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write cancel endpoint**

Create `app/api/sequence/cancel/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { executionId, sequenceId, action } = await req.json() as {
    executionId?: string;
    sequenceId?: string;
    action: "pause" | "cancel";
  };

  try {
    if (executionId) {
      await supabaseAdmin
        .from("sequence_executions")
        .update({ status: action === "cancel" ? "cancelled" : "paused" })
        .eq("id", executionId);
    } else if (sequenceId) {
      await supabaseAdmin
        .from("sequence_executions")
        .update({ status: action === "cancel" ? "cancelled" : "paused" })
        .eq("sequence_id", sequenceId)
        .in("status", ["active"]);
    } else {
      return NextResponse.json({ error: "executionId or sequenceId required" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write inbound email stub (Phase 2)**

Create `app/api/inbound-email/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST — Resend inbound webhook (Phase 2)
// Resend forwards replies to this endpoint after domain configuration.
// Body: { from, to, subject, text, html, headers: { "message-id", "in-reply-to" } }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    console.log("[inbound-email] Received:", { from: body.from, subject: body.subject });

    // Phase 2 implementation:
    // 1. Parse body.from to extract reply-to email
    // 2. Match to lead via leads.email
    // 3. Match to sequence_messages via resend_id in headers
    // 4. Update lead kanban_column → "Replied", status → "replied"
    // 5. Log activity

    return NextResponse.json({ ok: true, phase: "stub" });
  } catch (err) {
    console.error("[inbound-email] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/ app/api/sequence/ app/api/inbound-email/
git commit -m "feat: add cron, launch, cancel, and inbound email API routes"
```

---

### Task 7: Add Vercel Cron config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/prospecting-os/api/cron/sequence-runner",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Note: `basePath` in Next.js does NOT auto-prefix cron paths in Vercel, so the full `/prospecting-os/api/...` path is needed.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel cron for sequence runner every 5 minutes"
```

---

### Task 8: Update Sequence Builder UI

**Files:**
- Modify: `app/sequences/page.tsx`

- [ ] **Step 1: Add imports for new API calls and types**

Add to existing imports (after the DB import on line 9):
```typescript
import type { SequenceExecution } from "@/lib/types";
```

- [ ] **Step 2: Add state variables for execution management**

Add after existing state declarations (around line 43):
```typescript
const [executions, setExecutions] = useState<SequenceExecution[]>([]);
const [launching, setLaunching] = useState(false);
const [cancelling, setCancelling] = useState<string | null>(null);
const [pausing, setPausing] = useState<string | null>(null);
const [selectedSeqId, setSelectedSeqId] = useState<string | null>(null);
```

- [ ] **Step 3: Add launch/cancel/pause handlers and execution fetch**

Add after `resetForm` (around line 64):
```typescript
const fetchExecutions = async (sequenceId: string) => {
  setSelectedSeqId(sequenceId);
  try {
    const { getSequenceExecutions } = await import("@/lib/db");
    const exs = await getSequenceExecutions(sequenceId);
    setExecutions(exs);
  } catch { setExecutions([]); }
};

const handleLaunch = async () => {
  if (!editingId && !(await import("@/lib/db").getSequences()).find(s => s.id === selectedSeqId)) {
    showToast("Save the sequence first", "warn");
    return;
  }
  const seqId = editingId || selectedSeqId;
  if (!seqId) return;

  setLaunching(true);
  try {
    const res = await fetch("/prospecting-os/api/sequence/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequenceId: seqId }),
    });
    const data = await res.json() as { executions?: SequenceExecution[]; alreadyRunning?: number; error?: string };
    if (data.error) { showToast(data.error, "error"); return; }
    showToast(`Launched for ${data.executions?.length || 0} leads${data.alreadyRunning ? ` (${data.alreadyRunning} already running)` : ""}`);
    if (data.executions) setExecutions(prev => [...prev, ...data.executions]);
  } catch { showToast("Failed to launch", "error"); }
  setLaunching(false);
};

const handleCancel = async (executionId?: string) => {
  setCancelling(executionId || "all");
  try {
    const body: Record<string, string> = { action: "cancel" };
    if (executionId) body.executionId = executionId;
    else body.sequenceId = selectedSeqId || editingId || "";

    const res = await fetch("/prospecting-os/api/sequence/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (data.error) { showToast(data.error, "error"); return; }
    showToast(executionId ? "Execution cancelled" : "All executions cancelled");
    // Refresh
    if (selectedSeqId) fetchExecutions(selectedSeqId);
  } catch { showToast("Failed to cancel", "error"); }
  setCancelling(null);
};

const handlePause = async (executionId: string) => {
  setPausing(executionId);
  try {
    const res = await fetch("/prospecting-os/api/sequence/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId, action: "pause" }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (data.error) { showToast(data.error, "error"); return; }
    showToast("Execution paused");
    setExecutions(prev => prev.map(e => e.id === executionId ? { ...e, status: "paused" as const } : e));
  } catch { showToast("Failed to pause", "error"); }
  setPausing(null);
};
```

- [ ] **Step 4: Fetch executions when loading a sequence**

Modify `loadSequence` function (around line 55) — add at the end:
```typescript
const loadSequence = (seq: Sequence) => {
  setName(seq.name);
  setSteps(seq.steps);
  setEditingId(seq.id);
  setAssignedIds(seq.assignedLeadIds || []);
  fetchExecutions(seq.id);  // <-- add this line
};
```

- [ ] **Step 5: Add execution status bar below the save button**

After the `</div>` closing the "Sequence Details" card (line 243), add:
```typescript
{/* Execution Status */}
{editingId && executions.length > 0 && (
  <div
    className="rounded-xl p-4"
    style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
  >
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
        Execution Status
      </h3>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleCancel()}
          disabled={cancelling === "all"}
          className="text-[10px] px-2 py-1 rounded-md font-medium transition-all duration-200"
          style={{ background: "rgba(212,148,132,0.10)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.18)" }}
        >
          {cancelling === "all" ? "Cancelling..." : "Cancel All"}
        </button>
      </div>
    </div>
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {executions.map(exec => {
        const lead = leads.find(l => l.id === exec.leadId);
        return (
          <div
            key={exec.id}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px]"
            style={{ background: "var(--surface-2)" }}
          >
            <span style={{ color: "var(--ink-2)" }}>
              {lead?.name || exec.leadId} — Day {exec.currentStep}
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: exec.status === "active" ? "rgba(0,255,136,0.10)" :
                    exec.status === "paused" ? "rgba(245,158,11,0.10)" :
                    exec.status === "completed" ? "rgba(0,212,255,0.10)" :
                    "rgba(107,107,128,0.10)",
                  color: exec.status === "active" ? "var(--accent-green)" :
                    exec.status === "paused" ? "#f59e0b" :
                    exec.status === "completed" ? "var(--accent-blue)" :
                    "var(--muted)",
                }}
              >
                {exec.status}
              </span>
              {exec.status === "active" && (
                <button
                  onClick={() => handlePause(exec.id)}
                  disabled={pausing === exec.id}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                  style={{ color: "var(--ink-3)" }}
                >
                  {pausing === exec.id ? "..." : "Pause"}
                </button>
              )}
              {exec.status !== "cancelled" && (
                <button
                  onClick={() => handleCancel(exec.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                  style={{ color: "var(--ink-4)" }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 6: Add Launch button next to Save**

Add a Launch button right after the Save button in the Sequence Details card (after line 180):
```typescript
<button
  onClick={handleLaunch}
  disabled={launching || !editingId}
  className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40"
  style={{
    background: "linear-gradient(90deg, rgba(0,212,255,0.14), rgba(0,212,255,0.08))",
    color: "var(--accent-blue)",
    border: "1px solid rgba(0,212,255,0.22)",
  }}
>
  <Play size={14} /> {launching ? "Launching..." : "Launch"}
</button>
```

Add `Play` to the lucide-react import on line 5:
```typescript
import { Save, Trash2, GripVertical, Plus, Users, Copy, Check, Play } from "lucide-react";
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/sequences/page.tsx
git commit -m "feat: add Launch/Pause/Cancel controls and execution status to Sequence Builder"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```
Expected: Build completes successfully.

- [ ] **Step 3: Review changed files**

```bash
git status
git diff --stat HEAD
```

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "chore: final TypeScript fixes for sequence execution engine"
```
