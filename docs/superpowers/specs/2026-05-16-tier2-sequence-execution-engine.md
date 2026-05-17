# Tier 2 Phase 1 — Automated Sequence Execution Engine

**Date**: 2026-05-16  
**Status**: Building  
**Scope**: lead-engine only

## Summary

Sequences are built but never sent. This adds a Vercel Cron-powered engine that resolves templates, dispatches email via Resend, and tracks execution state per lead.

## Architecture

```
Vercel Cron (every 5 min)
  → GET /api/cron/sequence-runner
    → sequence-engine.ts: processDueSteps()
      → resolveTemplate() per lead
      → resend.ts: sendEmail()
      → db: insert sequence_messages, update sequence_executions
      → db: logActivity()
```

## New Database Tables

### sequence_executions
One row per lead per launched sequence. Tracks which step a lead is on.

| Column | Type | Default |
|--------|------|---------|
| id | UUID PK | gen_random_uuid() |
| sequence_id | UUID → sequences(id) | |
| lead_id | TEXT → leads(id) | |
| current_step | INT | 0 |
| status | TEXT CHECK (active/paused/completed/cancelled) | 'active' |
| started_at | TIMESTAMPTZ | now() |
| last_action_at | TIMESTAMPTZ | now() |
| created_at | TIMESTAMPTZ | now() |
| user_id | UUID → auth.users(id) | |

### sequence_messages
One row per sent message. Links to execution.

| Column | Type | Default |
|--------|------|---------|
| id | UUID PK | gen_random_uuid() |
| execution_id | UUID → sequence_executions(id) | |
| lead_id | TEXT | |
| step_index | INT | |
| channel | TEXT CHECK (email/linkedin) | |
| subject | TEXT | |
| body | TEXT | |
| status | TEXT CHECK (sent/failed/bounced/skipped) | 'sent' |
| resend_id | TEXT (nullable) | |
| variant | TEXT (nullable) | |
| created_at | TIMESTAMPTZ | now() |
| user_id | UUID → auth.users(id) | |

## New Files

| File | Purpose |
|------|---------|
| `lib/sequence-engine.ts` | Core: resolveTemplate, processDueSteps, launchSequence |
| `lib/resend.ts` | Resend SDK wrapper: sendEmail (extracted from notify.ts) |
| `app/api/cron/sequence-runner/route.ts` | Cron endpoint — calls processDueSteps |
| `app/api/sequence/launch/route.ts` | Launch endpoint — creates sequence_executions rows |

## Modified Files

| File | Change |
|------|--------|
| `lib/types.ts` | Add SequenceExecution, SequenceMessage types |
| `lib/db.ts` | Add getSequenceExecutions, saveSequenceExecution, getSequenceMessages, insertSequenceMessage |
| `app/sequences/page.tsx` | Launch button, execution status per sequence, pause/cancel |
| `vercel.json` | Add cron: `0,5,10,15,20,25,30,35,40,45,50,55 * * * *` at `/api/cron/sequence-runner` |
| `middleware.ts` | Allow `/api/cron/*` without auth (verify bearer token in route handler) |

## Template Resolution

Simple string replace: `{{first_name}}`, `{{company}}`, `{{industry}}`, `{{title}}` mapped from Lead fields. Missing value → empty string. No partial sends — if template has unresolvable reference, still send with empty string.

## Error Handling

- Resend failure → retry 3x with 1s delay, mark `failed` on final attempt
- Duplicate send prevention → check for existing (execution_id, step_index) row
- Cron overlap prevention → check if DB has messages created < 4 min ago with same step pattern; if yes, skip
- 0 assigned leads → return `{ processed: 0 }`, no error

## Cron Overlap Lock

Before processing, SELECT COUNT(*) FROM sequence_messages WHERE created_at > NOW() - INTERVAL '4 minutes'. If > 0, another cron is mid-run → return `{ skipped: true }`.

## Phase 1 Scope (this PR)

- Sequence execution engine + Vercel cron
- Email only (LinkedIn stays OpenOutreach-managed, skipped by engine)
- Launch / Pause / Cancel from Sequence Builder UI
- Auto-move kanban: first message sent → "Contacted"

## Phase 2 (next PR)

- Inbound email webhook (Resend → `/api/inbound-email`)
- Auto-move kanban: reply received → "Replied"
- Resend ID → delivery/bounce/open tracking

## Phase 3 (next PR)

- Message Lab generates A/B variants
- Track reply rates per variant in sequence_messages
- Pick winning variant automatically
