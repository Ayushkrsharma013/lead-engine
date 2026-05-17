# Command Center Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Agent Command Center for in-UI approve/reject with immediate action dispatch, and add per-agent detail pages with enable/disable, Run Now, health charts, and run logs.

**Architecture:** Hub + spoke — `/admin/agents` gains approve/reject buttons on the existing Pending Approvals section; `/admin/agents/[name]` is a new server-component detail page. A new `POST /api/agents/resolve` endpoint dispatches approved actions synchronously by `action_type` using existing functions in `db.ts`, `sequence-engine.ts`, and `resend.ts`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (supabaseAdmin), Recharts, lucide-react, Tailwind CSS 3 + CSS variables. No new packages.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260517_resolver_failed_status.sql` | Create | Add `"failed"` to `agent_actions.status` constraint |
| `lib/agents/resolver.ts` | Modify | Replace dispatch stub with `dispatchAction()` switch |
| `app/api/agents/resolve/route.ts` | Create | `POST { actionId, decision }` — UI approval endpoint |
| `app/api/agent/telegram/route.ts` | Modify | Handle dispatch errors without crashing the webhook |
| `app/api/agents/approve/route.ts` | Modify | Handle dispatch errors without crashing the email flow |
| `app/api/agents/run/route.ts` | Modify | Add `?agent=<name>` single-agent filter |
| `app/api/admin/agents/[name]/route.ts` | Create | `GET` (agent + runs + actions) and `PATCH` (enabled/config) |
| `app/admin/agents/[name]/page.tsx` | Create | Agent detail page — hero, charts, run log, config |
| `app/admin/agents/page.tsx` | Modify | Expand/collapse rows + approve/reject in Pending Approvals |

---

## Task 1: DB Migration — Add `"failed"` Status

**Files:**
- Create: `supabase/migrations/20260517_resolver_failed_status.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260517_resolver_failed_status.sql
-- Allow agent_actions.status = 'failed' for dispatch errors

ALTER TABLE agent_actions
  DROP CONSTRAINT IF EXISTS agent_actions_status_check;

ALTER TABLE agent_actions
  ADD CONSTRAINT agent_actions_status_check
  CHECK (status IN ('pending','approved','rejected','executed','notified','failed'));
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the Supabase MCP `apply_migration` tool with the SQL above targeting the production project (`tbsqpnqzpbnilifhwvgr`).

Expected: migration applies with no errors. Verify with:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'agent_actions'::regclass AND contype = 'c';
```
Should show `(status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'executed'::text, 'notified'::text, 'failed'::text]))`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260517_resolver_failed_status.sql
git commit -m "feat: add 'failed' status to agent_actions constraint"
```

---

## Task 2: Implement `dispatchAction` in `lib/agents/resolver.ts`

**Files:**
- Modify: `lib/agents/resolver.ts`

The existing `resolveAgentAction` function has a `// Phase 2: dispatch` stub. Replace it with a concrete `dispatchAction` switch. All action types from all agents are covered; unknown types are no-ops.

**Exact action types queued by agents:**

| Agent | action_type | payload shape | Dispatch |
|---|---|---|---|
| outreach-agent | `launch_sequence` | `{ leadId, leadName, leadCompany, score }` | Insert `sequence_execution` for lead on first available sequence |
| outreach-agent | `follow_up` | `{ leadId, leadName, lastTouched }` | Update `leads.notes` with follow-up flag |
| pipeline-manager | `unstuck_recommendation` | `{ leadId, leadName, stuckDays, column }` | Update `leads.notes` with recommendation |
| pipeline-manager | `archive_won_lost` | `{ count, leadIds }` | `batchUpdateLeadStatus(leadIds, "archived")` |
| data-janitor | `resolve_duplicates` | `{ count, groupCount }` | No DB change — informational; mark executed |
| data-janitor | `archive_invalid_emails` | `{ count, leadIds }` | `batchUpdateLeadStatus(leadIds, "archived")` |
| icp-analyst | `adjust_score_threshold` | `{ suggestedThreshold, currentThreshold }` | Upsert `profiles.icp_preferences.score_threshold` for super_admin |
| icp-analyst | `deprioritize_industry` | `{ industry, conversionRate }` | No DB change — informational; mark executed |
| icp-analyst | `high_performing_industry` | `{ industry, conversionRate }` | No DB change — informational; mark executed |
| icp-analyst | `top_performing_segment` | `{ segment }` | No DB change — informational; mark executed |
| client-reporter | `client_weekly_report` | `{ clientId, clientName, company, stats }` | `sendEmail` to client's email address |
| message-coach | `variant_improvement` | `{ sequenceId, stepIndex, variantLabel }` | No DB change — informational; mark executed |
| message-coach | `high_performer_notice` | `{ sequenceId }` | No DB change — informational; mark executed |
| message-coach | `stale_template` | `{ sequenceId, stepIndex }` | No DB change — informational; mark executed |

- [ ] **Step 1: Replace resolver.ts with the full updated version**

```typescript
// lib/agents/resolver.ts
import { supabaseAdmin } from "@/lib/supabase";
import { batchUpdateLeadStatus } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import type { AgentActionRow } from "./types";

// ── Action Dispatch ────────────────────────────────────────────────────────────

async function dispatchAction(action: AgentActionRow): Promise<string> {
  const p = action.payload as Record<string, unknown>;

  switch (action.action_type) {

    case "launch_sequence": {
      const leadId = String(p.leadId ?? "");
      if (!leadId) throw new Error("launch_sequence payload missing leadId");

      // Find first available active sequence
      const { data: seqs, error: seqErr } = await supabaseAdmin
        .from("sequences")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(1);
      if (seqErr) throw new Error(`Could not fetch sequences: ${seqErr.message}`);
      if (!seqs?.length) throw new Error("No sequences available to launch");

      const sequenceId = String(seqs[0].id);
      const sequenceName = String(seqs[0].name);

      // Check not already running
      const { data: existing } = await supabaseAdmin
        .from("sequence_executions")
        .select("id")
        .eq("sequence_id", sequenceId)
        .eq("lead_id", leadId)
        .in("status", ["active", "paused"])
        .maybeSingle();
      if (existing) return `${String(p.leadName ?? "Lead")} already running on "${sequenceName}"`;

      // Insert execution row
      const { error: insertErr } = await supabaseAdmin
        .from("sequence_executions")
        .insert({
          sequence_id: sequenceId,
          lead_id: leadId,
          status: "active",
          variant: "A",
          current_step: 0,
        });
      if (insertErr) throw new Error(`Failed to create execution: ${insertErr.message}`);

      return `Sequence "${sequenceName}" launched for ${String(p.leadName ?? leadId)}`;
    }

    case "follow_up": {
      const leadId = String(p.leadId ?? "");
      if (!leadId) throw new Error("follow_up payload missing leadId");
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ notes: `[Agent] Follow-up flagged ${new Date().toLocaleDateString()}` })
        .eq("id", leadId);
      if (error) throw new Error(`Failed to flag follow-up: ${error.message}`);
      return `Follow-up flagged for ${String(p.leadName ?? leadId)}`;
    }

    case "unstuck_recommendation": {
      const leadId = String(p.leadId ?? "");
      if (!leadId) throw new Error("unstuck_recommendation payload missing leadId");
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ notes: `[Agent] Stuck ${String(p.stuckDays ?? "?")} days in ${String(p.column ?? "unknown")}` })
        .eq("id", leadId);
      if (error) throw new Error(`Failed to update lead notes: ${error.message}`);
      return `Stuck note added for ${String(p.leadName ?? leadId)}`;
    }

    case "archive_won_lost":
    case "archive_invalid_emails":
    case "archive_stale_lead": {
      const leadIds = Array.isArray(p.leadIds) ? p.leadIds.map(String) : [];
      if (!leadIds.length) throw new Error(`${action.action_type} payload missing leadIds`);
      await batchUpdateLeadStatus(leadIds, "archived" as never);
      return `${leadIds.length} lead(s) archived`;
    }

    case "adjust_score_threshold": {
      const threshold = Number(p.suggestedThreshold ?? 0);
      if (!threshold) throw new Error("adjust_score_threshold payload missing suggestedThreshold");
      // Apply to super_admin profile's icp_preferences
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, icp_preferences")
        .eq("role", "super_admin")
        .maybeSingle();
      if (!profile) throw new Error("No super_admin profile found");
      const current = (profile.icp_preferences as Record<string, unknown>) ?? {};
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ icp_preferences: { ...current, score_threshold: threshold } })
        .eq("id", profile.id);
      if (error) throw new Error(`Failed to update ICP threshold: ${error.message}`);
      return `ICP score threshold updated to ${threshold}`;
    }

    case "client_weekly_report": {
      const clientId = String(p.clientId ?? "");
      if (!clientId) throw new Error("client_weekly_report payload missing clientId");
      // Fetch client email
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("name, email, company")
        .eq("id", clientId)
        .maybeSingle();
      if (!client?.email) throw new Error(`Client ${clientId} has no email on file`);

      const stats = (p.stats as Record<string, number>) ?? {};
      const html = `
        <h2>Weekly Report — ${String(p.company ?? client.company)}</h2>
        <ul>
          <li>Total leads: <strong>${stats.total ?? 0}</strong></li>
          <li>New this week: <strong>${stats.newThisWeek ?? 0}</strong></li>
          <li>Hot leads: <strong>${stats.hot ?? 0}</strong></li>
          <li>Contacted: <strong>${stats.contacted ?? 0}</strong></li>
          <li>Meetings booked: <strong>${stats.meetings ?? 0}</strong></li>
          <li>Avg score: <strong>${stats.avgScore ?? 0}</strong></li>
        </ul>
        <p>View your full dashboard: <a href="https://app.flow-forges.com/prospecting-os/client-portal">Client Portal</a></p>
      `;
      const result = await sendEmail({
        to: client.email,
        subject: `Weekly Prospecting Report — ${String(p.company ?? client.company)}`,
        html,
      });
      if (!result.ok) throw new Error(`Resend failed: ${result.error}`);
      return `Weekly report sent to ${client.email}`;
    }

    // Informational types — no DB changes, just mark executed
    case "resolve_duplicates":
    case "deprioritize_industry":
    case "high_performing_industry":
    case "top_performing_segment":
    case "variant_improvement":
    case "high_performer_notice":
    case "stale_template":
      return `Acknowledged: ${action.description}`;

    default:
      console.warn(`[resolver] Unknown action_type: ${action.action_type} — marking executed`);
      return `No dispatch handler for "${action.action_type}"`;
  }
}

// ── Resolve ───────────────────────────────────────────────────────────────────

export async function resolveAgentAction(
  actionId: string,
  approved: boolean,
  approvedBy: string,
): Promise<{ success: boolean; message: string }> {
  const { data: action, error } = await supabaseAdmin
    .from("agent_actions")
    .select("*")
    .eq("id", actionId)
    .single<AgentActionRow>();

  if (error || !action) {
    return { success: false, message: `Action not found: ${actionId}` };
  }
  if (action.status !== "pending") {
    return { success: false, message: `Already resolved: ${action.status}` };
  }

  let message = approved ? "Rejected" : "Rejected";
  let finalStatus: "executed" | "rejected" | "failed" = "rejected";

  if (approved) {
    try {
      message = await dispatchAction(action);
      finalStatus = "executed";
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
      finalStatus = "failed";
    }
  } else {
    message = "Rejected by " + approvedBy;
  }

  await supabaseAdmin.from("agent_actions").update({
    status: finalStatus,
    approved_by: approvedBy,
    resolved_at: new Date().toISOString(),
  }).eq("id", actionId);

  // Edit the original Telegram message to show resolution
  if (action.telegram_msg_id) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const label = finalStatus === "executed" ? "Approved & Executed" :
                    finalStatus === "failed"   ? "Dispatch Failed" : "Rejected";
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(action.telegram_msg_id, 10),
          text: `[${action.agent_name}] — ${label}\n\n${action.description}\n\nResolved by: ${approvedBy}\n${message}`,
        }),
      }).catch(() => undefined);
    }
  }

  return { success: finalStatus !== "failed", message };
}

// ── Escalation Engine ─────────────────────────────────────────────────────────

export async function runEscalationEngine(): Promise<{
  autoRejected: number;
  escalated: number;
  archived: number;
  log: string;
}> {
  const now = new Date().toISOString();
  const threeDaysAgo = new Date(Date.now() - 72 * 3600_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { data: rejectedData } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "rejected", resolved_at: now })
    .eq("status", "pending")
    .lt("created_at", threeDaysAgo)
    .select("id");
  const autoRejected = rejectedData?.length || 0;

  const { data: toEscalate } = await supabaseAdmin
    .from("agent_actions")
    .select("id, notified_via")
    .eq("status", "pending")
    .lt("created_at", oneDayAgo)
    .gt("created_at", threeDaysAgo);

  let escalated = 0;
  for (const action of (toEscalate || [])) {
    const channels = action.notified_via || [];
    await supabaseAdmin.from("agent_actions").update({
      notified_via: [...channels, "telegram_escalation"],
    }).eq("id", action.id);
    escalated++;
  }

  const { data: archivedData } = await supabaseAdmin
    .from("agent_actions")
    .delete()
    .in("status", ["executed", "rejected", "failed"])
    .lt("created_at", thirtyDaysAgo)
    .select("id");
  const archived = archivedData?.length || 0;

  const parts: string[] = [];
  if (autoRejected) parts.push(`auto-rejected ${autoRejected} stale`);
  if (escalated) parts.push(`escalated ${escalated} urgent`);
  if (archived) parts.push(`archived ${archived} old`);
  const log = parts.length ? parts.join(", ") : "No escalations needed";

  return { autoRejected, escalated, archived, log };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd D:/Flow-Forges/lead-engine && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/resolver.ts
git commit -m "feat: implement dispatchAction in resolver — all 14 action types wired"
```

---

## Task 3: New `POST /api/agents/resolve` Endpoint

**Files:**
- Create: `app/api/agents/resolve/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/agents/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveAgentAction } from "@/lib/agents/resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Auth: super_admin only
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { actionId?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { actionId, decision } = body;
  if (!actionId || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json(
      { error: "Required: actionId (string), decision ('approve' | 'reject')" },
      { status: 400 }
    );
  }

  const approved = decision === "approve";

  // resolveAgentAction now returns { success, message } — never throws
  const result = await resolveAgentAction(actionId, approved, "super_admin");

  // Race condition: already resolved
  if (!result.success && result.message.startsWith("Already resolved")) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/agents/resolve/route.ts
git commit -m "feat: add POST /api/agents/resolve endpoint for UI approvals"
```

---

## Task 4: Update Telegram + Email Callers for Dispatch Errors

**Files:**
- Modify: `app/api/agent/telegram/route.ts` (lines 261-268)
- Modify: `app/api/agents/approve/route.ts` (lines 23-30)

`resolveAgentAction` now returns `{ success, message }` instead of throwing. Both callers currently catch a throw — update them to handle the new return shape.

- [ ] **Step 1: Update telegram/route.ts — the agent approve/reject block**

Find this block (around line 261):
```typescript
        try {
          await resolveAgentAction(actionId, approved, approvedBy);
          if (chatId) await sendMessage(chatId, `${approved ? "Approved" : "Rejected"} action ${actionId.slice(0, 8)}...`);
        } catch (err) {
          console.error("[telegram] resolveAgentAction failed:", err);
        }
```

Replace with:
```typescript
        {
          const result = await resolveAgentAction(actionId, approved, approvedBy).catch(err => ({
            success: false,
            message: err instanceof Error ? err.message : String(err),
          }));
          if (chatId) {
            const label = result.success
              ? `${approved ? "Approved" : "Rejected"} action ${actionId.slice(0, 8)}...`
              : `Action ${actionId.slice(0, 8)}... — ${result.message}`;
            await sendMessage(chatId, label);
          }
        }
```

- [ ] **Step 2: Update approve/route.ts — the resolveAgentAction call**

Find this block (around line 23):
```typescript
  try {
    await resolveAgentAction(id, approved, "email-link");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>Error</h2><p>${msg}</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }
```

Replace with:
```typescript
  const result = await resolveAgentAction(id, approved, "email-link").catch(err => ({
    success: false,
    message: err instanceof Error ? err.message : String(err),
  }));

  if (!result.success) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#000;color:#eee"><h2 style="color:#E06060">Error</h2><p style="color:#888">${result.message}</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/agent/telegram/route.ts app/api/agents/approve/route.ts
git commit -m "fix: handle resolver dispatch errors in telegram and email approve callers"
```

---

## Task 5: Add `?agent=<name>` Filter to Run Endpoint

**Files:**
- Modify: `app/api/agents/run/route.ts`

- [ ] **Step 1: Update the run route to accept an optional agent query param**

Replace the entire file with:
```typescript
// app/api/agents/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runAgentBatch } from "@/lib/agents/dispatcher";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const agentName = req.nextUrl.searchParams.get("agent") ?? undefined;

  try {
    await runAgentBatch(agentName);
    return NextResponse.json({ ok: true, agent: agentName ?? "all", ts: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agents/run] Batch failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update `runAgentBatch` in `lib/agents/dispatcher.ts` to accept optional agent name**

Find the function signature:
```typescript
export async function runAgentBatch(): Promise<void> {
```

Replace with:
```typescript
export async function runAgentBatch(singleAgentName?: string): Promise<void> {
```

Find the line that filters the registry:
```typescript
  const toRun = AGENT_REGISTRY.filter(a => enabledAgentMap.has(a.name));
```

Replace with:
```typescript
  const toRun = AGENT_REGISTRY.filter(a =>
    enabledAgentMap.has(a.name) &&
    (!singleAgentName || a.name === singleAgentName)
  );

  if (singleAgentName && toRun.length === 0) {
    throw new Error(`Agent "${singleAgentName}" not found or not enabled`);
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/agents/run/route.ts lib/agents/dispatcher.ts
git commit -m "feat: add ?agent=<name> filter to run endpoint for per-agent triggers"
```

---

## Task 6: New Agent Detail API `GET|PATCH /api/admin/agents/[name]`

**Files:**
- Create: `app/api/admin/agents/[name]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/admin/agents/[name]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const name = params.name;

  const [agentRes, runsRes, actionsRes] = await Promise.all([
    supabaseAdmin.from("agents").select("*").eq("name", name).maybeSingle(),
    supabaseAdmin
      .from("agent_runs")
      .select("*")
      .eq("agent_name", name)
      .order("started_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("agent_actions")
      .select("*")
      .eq("agent_name", name)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (agentRes.error) {
    return NextResponse.json({ error: agentRes.error.message }, { status: 500 });
  }
  if (!agentRes.data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({
    agent: agentRes.data,
    runs: runsRes.data ?? [],
    actions: actionsRes.data ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { enabled?: boolean; config?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (body.config && typeof body.config === "object") updates.config = body.config;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update(updates)
    .eq("name", params.name)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json({ agent: data });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/agents/[name]/route.ts"
git commit -m "feat: add GET|PATCH /api/admin/agents/[name] for agent detail data"
```

---

## Task 7: Agent Detail Page `/admin/agents/[name]`

**Files:**
- Create: `app/admin/agents/[name]/page.tsx`

This is a `"use client"` page (needs interactive toggle + Run Now polling). It fetches from `/api/admin/agents/[name]`, renders the full detail layout designed in the wireframe.

- [ ] **Step 1: Create the page**

```typescript
// app/admin/agents/[name]/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Cpu, Play, RefreshCw, ArrowLeft, Bot, HardDrive, Search,
  Send, Workflow, BarChart3, FileText, MessageSquare, AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid,
} from "recharts";
import type { AgentRow, AgentRunRow, AgentActionRow } from "@/lib/agents/types";

const AGENT_COLORS: Record<string, string> = {
  "data-janitor": "#6BCB77",
  "lead-scout": "#E8A840",
  "outreach-agent": "#4FC3F7",
  "pipeline-manager": "#7C4DFF",
  "finance-watcher": "#FF7043",
  "icp-analyst": "#4DB6AC",
  "client-reporter": "#F06292",
  "message-coach": "#9575CD",
};

const AGENT_ICONS: Record<string, LucideIcon> = {
  "data-janitor": HardDrive,
  "lead-scout": Search,
  "outreach-agent": Send,
  "pipeline-manager": Workflow,
  "finance-watcher": Bot,
  "icp-analyst": BarChart3,
  "client-reporter": FileText,
  "message-coach": MessageSquare,
};

const cardBorder = "rgba(201,168,124,0.07)";

const statusDot = (s: string | null) => {
  if (!s) return "#555";
  if (s === "success" || s === "skipped") return "#6BCB77";
  if (s === "failed" || s === "disabled_by_guardrails") return "#E06060";
  return "#E8A840";
};

const relativeTime = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const tooltipStyle = {
  background: "var(--surface-elev)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--ink)",
  padding: "6px 10px",
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentName = String(params?.name ?? "");

  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [actions, setActions] = useState<AgentActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [configText, setConfigText] = useState("");
  const [configError, setConfigError] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/prospecting-os/api/admin/agents/${agentName}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setAgent(data.agent);
      setRuns(data.runs ?? []);
      setActions(data.actions ?? []);
      if (configText === "" && data.agent?.config) {
        setConfigText(JSON.stringify(data.agent.config, null, 2));
      }
      setError("");
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [agentName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    const cronSecret = "";
    try {
      await fetch(`/prospecting-os/api/agents/run?agent=${agentName}`, {
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      });
    } catch { /* ignore */ }

    // Poll for 30s to pick up new run
    pollCountRef.current = 0;
    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current++;
      await fetchData();
      if (pollCountRef.current >= 6) { // 6 × 5s = 30s
        stopPolling();
        setRunning(false);
      }
    }, 5000);
  };

  const handleToggle = async () => {
    if (!agent) return;
    setToggling(true);
    try {
      const res = await fetch(`/prospecting-os/api/admin/agents/${agentName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !agent.enabled }),
      });
      const data = await res.json();
      if (data.agent) setAgent(data.agent);
    } catch { /* ignore */ }
    setToggling(false);
  };

  const handleConfigSave = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configText);
      setConfigError("");
    } catch (e) {
      setConfigError("Invalid JSON: " + String(e));
      return;
    }
    try {
      await fetch(`/prospecting-os/api/admin/agents/${agentName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
    } catch { /* ignore */ }
  };

  useEffect(() => () => stopPolling(), []);

  const color = AGENT_COLORS[agentName] || "var(--accent)";
  const Icon = AGENT_ICONS[agentName] || Bot;

  // Health trend from runs
  const healthTrend = runs.slice().reverse().map((r, i) => ({
    i: i + 1,
    label: relativeTime(r.started_at),
    score: r.outcome === "success" ? 1 : r.outcome === "failed" ? -1 : 0,
  }));

  // Action type distribution
  const actionDist: Record<string, number> = {};
  actions.forEach(a => { actionDist[a.action_type] = (actionDist[a.action_type] || 0) + 1; });
  const actionDistArr = Object.entries(actionDist)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxActionCount = Math.max(1, ...actionDistArr.map(([, c]) => c));

  const totalRuns = runs.length;
  const safeTotal = runs.reduce((s, r) => s + (r.safe_actions_count || 0), 0);
  const pendingCount = actions.filter(a => a.status === "pending").length;

  // Health ring
  const r = 26;
  const circ = 2 * Math.PI * r;
  const healthScore = agent?.health_score ?? 0;
  const off = circ - (Math.min(100, Math.max(0, healthScore)) / 100) * circ;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <RefreshCw size={22} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ color: "#E06060", fontSize: 13 }}>{error || "Agent not found"}</div>
        <button onClick={() => router.push("/admin/agents")} style={{ marginTop: 12, fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
          ← Back to Command Center
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" style={{
        height: 56, padding: "0 24px",
        borderBottom: "1px solid var(--line)",
        background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.4) 100%)",
      }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/agents")}
            style={{ fontSize: 11, color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}
          >
            <ArrowLeft size={12} /> Agent Workforce
          </button>
          <span style={{ color: "var(--line)" }}>/</span>
          <div className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}66`, display: "inline-block" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{agent.display_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Enable / disable toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, fontWeight: 600,
              color: agent.enabled ? "#6BCB77" : "var(--ink-4)",
              background: "none", border: "none", cursor: "pointer", opacity: toggling ? 0.5 : 1,
            }}
          >
            <span style={{
              width: 36, height: 20, borderRadius: 10, position: "relative",
              background: agent.enabled ? "#6BCB77" : "var(--surface-2)",
              display: "inline-block", transition: "background 0.2s",
            }}>
              <span style={{
                position: "absolute", top: 3, width: 14, height: 14, borderRadius: "50%",
                background: "#fff",
                left: agent.enabled ? "calc(100% - 17px)" : 3,
                transition: "left 0.2s",
              }} />
            </span>
            {agent.enabled ? "Enabled" : "Disabled"}
          </button>

          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 18px", borderRadius: 9999,
              border: "none", cursor: running ? "not-allowed" : "pointer",
              background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: 13,
              opacity: running ? 0.5 : 1, transition: "opacity 0.2s",
            }}
          >
            {running
              ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <Play size={13} />}
            {running ? "Running..." : "Run Now"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Hero */}
        <div className="rounded-xl p-5 flex items-center gap-5" style={{
          background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
          border: `1px solid ${color}1a`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}>
          <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
            <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={32} cy={32} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={3.5} />
              <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={3.5}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
                style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "monospace" }}>{healthScore}</span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>{agent.display_name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.5, maxWidth: 500 }}>{agent.description}</div>
            <div style={{ display: "flex", gap: 28, marginTop: 12 }}>
              {[
                { val: totalRuns, label: "Total runs" },
                { val: safeTotal, label: "Safe actions" },
                { val: pendingCount, label: "Pending", color: pendingCount > 0 ? "#E8A840" : undefined },
                { val: agent.schedule, label: "Schedule" },
                { val: agent.auto_approve_level ?? "none", label: "Auto-approve", color: "#3b82f6" },
              ].map(({ val, label, color: c }) => (
                <div key={label}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c ?? "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Health trend */}
          <div className="rounded-xl p-5" style={{
            background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
            border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>
              Recent Runs — Success / Fail
            </span>
            {runs.length > 0 ? (
              <ResponsiveContainer width="100%" height={100} style={{ marginTop: 8 }}>
                <AreaChart data={runs.slice().reverse().map((r, i) => ({
                  i, outcome: r.outcome === "success" ? 1 : r.outcome === "partial" ? 0.5 : 0,
                }))} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                  <defs>
                    <linearGradient id="health-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} opacity={0.3} />
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={[0, 1]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="outcome" stroke={color} strokeWidth={1.5}
                    fill="url(#health-grad)" dot={false}
                    activeDot={{ r: 3, fill: color, stroke: "var(--bg)", strokeWidth: 1.5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-4)" }}>No runs yet</div>
            )}
          </div>

          {/* Action type breakdown */}
          <div className="rounded-xl p-5" style={{
            background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
            border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>
              Action Types
            </span>
            {actionDistArr.length > 0 ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {actionDistArr.map(([type, count]) => (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--ink-4)", width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{type}</span>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(count / maxActionCount) * 100}%`, background: color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, color: "var(--ink-4)", width: 20, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-4)" }}>No actions yet</div>
            )}
          </div>
        </div>

        {/* Run log + Config */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
          {/* Run log */}
          <div className="rounded-xl" style={{
            background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
            border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "18px 20px 12px" }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>
                Run Log — Last {runs.length}
              </span>
            </div>
            {runs.length === 0 ? (
              <div style={{ padding: "24px 20px", fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>No runs yet</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      {["Outcome", "Duration", "Safe", "Queued", "Log", "When"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => {
                      const oc = run.outcome;
                      const ocColor = oc === "success" ? "#6BCB77" : oc === "failed" ? "#E06060" : "#E8A840";
                      return (
                        <tr key={run.id} style={{ borderBottom: "1px solid rgba(30,30,46,0.5)" }}>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${ocColor}15`, color: ocColor, textTransform: "uppercase" }}>{oc}</span>
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--ink-3)", fontFamily: "monospace" }}>
                            {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{run.safe_actions_count}</td>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: run.risky_actions_queued > 0 ? "#E8A840" : "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{run.risky_actions_queued}</td>
                          <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--ink-4)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {run.log ? run.log.slice(0, 100) : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--ink-4)" }}>{relativeTime(run.started_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Config + Guardrails */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="rounded-xl p-5" style={{
              background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
              border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>Config</span>
              <textarea
                value={configText}
                onChange={e => setConfigText(e.target.value)}
                onBlur={handleConfigSave}
                rows={8}
                style={{
                  width: "100%", marginTop: 10, background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px",
                  fontSize: 11, fontFamily: "monospace", color: "var(--ink-3)",
                  lineHeight: 1.6, resize: "vertical",
                }}
                spellCheck={false}
              />
              {configError && <div style={{ fontSize: 10, color: "#E06060", marginTop: 4 }}>{configError}</div>}
              <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>Saves on blur</div>
            </div>

            <div className="rounded-xl p-5" style={{
              background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
              border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>Guardrails</span>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Auto-approve", val: agent.auto_approve_level ?? "none", color: "#3b82f6" },
                  { label: "Consecutive failures", val: String(agent.consecutive_failures ?? 0), color: (agent.consecutive_failures ?? 0) > 0 ? "#E06060" : "#6BCB77" },
                  { label: "Disable threshold", val: "3 failures" },
                  { label: "Health score", val: String(healthScore), color },
                ].map(({ label, val, color: c }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c ?? "var(--ink-3)", fontFamily: "monospace" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Fix any type issues before continuing.

- [ ] **Step 3: Smoke test in browser**

With dev server running (`npm run dev`), navigate to `/admin/agents/outreach-agent`. Verify:
- Page loads without console errors
- Agent hero card shows name, description, health ring, stats
- Run log table renders (or "No runs yet" if empty)
- Enable/disable toggle fires and reflects the new state
- Run Now button shows spinner while polling

- [ ] **Step 4: Commit**

```bash
git add "app/admin/agents/[name]/page.tsx"
git commit -m "feat: add /admin/agents/[name] detail page with toggle, Run Now, charts, run log"
```

---

## Task 8: Update Command Center — Expand/Approve/Reject in Pending Approvals

**Files:**
- Modify: `app/admin/agents/page.tsx` (lines 466–496 — the Pending Approvals section)

The Pending Approvals section currently renders read-only rows. Replace that section with interactive expand/collapse rows that have payload preview and approve/reject buttons.

- [ ] **Step 1: Add state and handler to `AgentCommandCenter`**

After the existing `const [running, setRunning] = useState(false);` line, add:

```typescript
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [resolvingAction, setResolvingAction] = useState<string | null>(null);
  const [actionMessages, setActionMessages] = useState<Record<string, { success: boolean; text: string }>>({});

  const handleResolve = useCallback(async (actionId: string, decision: "approve" | "reject") => {
    setResolvingAction(actionId);
    try {
      const res = await fetch("/prospecting-os/api/agents/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setActionMessages(prev => ({ ...prev, [actionId]: { success: data.success, text: data.message } }));
      if (res.status === 409) {
        // Already resolved elsewhere — refresh data
        await fetchData();
      } else {
        // Optimistically update the action status in local state
        setActions(prev => prev.map(a =>
          a.id === actionId
            ? { ...a, status: (decision === "approve" ? (data.success ? "executed" : "failed") : "rejected") as AgentActionRow["status"] }
            : a
        ));
      }
    } catch (e) {
      setActionMessages(prev => ({ ...prev, [actionId]: { success: false, text: String(e) } }));
    }
    setResolvingAction(null);
    setExpandedAction(null);
  }, [fetchData]);
```

- [ ] **Step 2: Replace the Pending Approvals section**

Find the entire `{/* Pending Approvals */}` block (lines ~465–496) and replace it with:

```tsx
        {/* Pending Approvals */}
        <div className="rounded-xl p-5 transition-all duration-250"
          style={{ background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)", border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Pending Approvals ({pendingActions.length})
            </span>
          </div>
          {pendingActions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "14px 0", fontSize: 12, color: "var(--ink-3)" }}>
              <Check size={18} style={{ display: "block", margin: "0 auto 6px", color: "#6BCB77" }} />
              All clear
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pendingActions.map((a) => {
                const isExpanded = expandedAction === a.id;
                const isResolving = resolvingAction === a.id;
                const msg = actionMessages[a.id];
                const resolved = a.status !== "pending";

                return (
                  <div
                    key={a.id}
                    style={{
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: `1px solid ${resolved ? (a.status === "executed" ? "rgba(107,203,119,0.2)" : "rgba(224,96,96,0.15)") : "var(--line)"}`,
                      overflow: "hidden",
                      opacity: resolved ? 0.6 : 1,
                      transition: "opacity 0.2s, border-color 0.2s",
                    }}
                  >
                    {/* Row header — click to expand */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", cursor: resolved ? "default" : "pointer", userSelect: "none" }}
                      onClick={() => !resolved && setExpandedAction(isExpanded ? null : a.id)}
                    >
                      <AlertTriangle size={16} style={{ color: riskColor(a.risk_level), flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textDecoration: resolved ? "line-through" : "none" }}>
                          {a.description}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>{a.agent_name}</span>
                          <span style={{ padding: "1px 6px", borderRadius: 9999, background: `${riskColor(a.risk_level)}15`, color: riskColor(a.risk_level) }}>{a.risk_level}</span>
                          <span>{relativeTime(a.created_at)}</span>
                          {a.notified_via?.length > 0 && <span>{a.notified_via.join(", ")}</span>}
                        </div>
                      </div>
                      {resolved ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: a.status === "executed" ? "#6BCB77" : "#E06060", padding: "2px 8px", borderRadius: 9999, background: a.status === "executed" ? "rgba(107,203,119,0.1)" : "rgba(224,96,96,0.1)" }}>
                          {a.status}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--ink-4)", transform: isExpanded ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}>▼</span>
                      )}
                    </div>

                    {/* Expanded payload + buttons */}
                    {isExpanded && !resolved && (
                      <div style={{ padding: "0 14px 14px 44px", borderTop: "1px solid rgba(30,30,46,0.8)" }}>
                        {/* Payload preview */}
                        <div style={{ marginTop: 10, marginBottom: 12 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 6 }}>Payload</div>
                          <pre style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ink-3)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", overflow: "auto", maxHeight: 120 }}>
                            {JSON.stringify(a.payload, null, 2)}
                          </pre>
                        </div>

                        {/* Error message from dispatch */}
                        {msg && !msg.success && (
                          <div style={{ fontSize: 11, color: "#E06060", marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(224,96,96,0.06)", border: "1px solid rgba(224,96,96,0.12)" }}>
                            {msg.text}
                          </div>
                        )}

                        {/* Approve / Reject buttons */}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleResolve(a.id, "approve")}
                            disabled={isResolving}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, border: "none", cursor: isResolving ? "not-allowed" : "pointer", background: "#6BCB77", color: "#000", fontSize: 12, fontWeight: 700, opacity: isResolving ? 0.6 : 1 }}
                          >
                            {isResolving ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
                            Approve &amp; Execute
                          </button>
                          <button
                            onClick={() => handleResolve(a.id, "reject")}
                            disabled={isResolving}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(224,96,96,0.25)", cursor: isResolving ? "not-allowed" : "pointer", background: "transparent", color: "#E06060", fontSize: 12, fontWeight: 700, opacity: isResolving ? 0.6 : 1 }}
                          >
                            <X size={13} />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Success message after execution */}
                    {msg?.success && (
                      <div style={{ padding: "6px 14px 10px 44px", fontSize: 11, color: "#6BCB77" }}>
                        {msg.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
```

- [ ] **Step 3: Add missing imports at top of file**

The file already imports `Check`, `X`, `RefreshCw`, and `AlertTriangle` — verify they are all present in the import line. If `X` is missing, add it:

```typescript
import {
  Cpu, Play, Check, X, Clock, RefreshCw, Bot, AlertTriangle, TrendingUp,
  HardDrive, Search, Send, Workflow, BarChart3, FileText, MessageSquare,
} from "lucide-react";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test the full flow**

With dev server running:
1. Navigate to `/admin/agents`
2. Find a pending action row — click it to expand
3. Verify payload JSON is shown
4. Click "Approve & Execute" — verify spinner appears, then row resolves green with message
5. Click "Reject" on another row — verify row resolves red

- [ ] **Step 6: Full build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: 0 TypeScript errors, all pages compiled successfully.

- [ ] **Step 7: Commit**

```bash
git add app/admin/agents/page.tsx
git commit -m "feat: add expand/approve/reject to command center pending approvals"
```

---

## Final Verification

- [ ] Run `npm run build` — zero errors, all pages compiled
- [ ] Navigate to `/admin/agents` — approve/reject works inline
- [ ] Navigate to `/admin/agents/outreach-agent` — detail page loads, toggle works, Run Now polls
- [ ] Approve an action in Telegram — Telegram message edits correctly (resolver still edits via existing logic)
- [ ] Approve via email link — resolves correctly without crashing the HTML response
