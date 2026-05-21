# GMap Outreach Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 2-touch automated outreach pipeline that takes Google Maps leads from Supabase and sends a personalized contact form fill (Day 1) plus SMS follow-up (Day 3) via a local Playwright/Twilio runner, gated by Telegram approval, to book discovery calls for the Missed Call Recovery Agent.

**Architecture:** New agent module (`gmaps-outreach-agent`) joins the existing 7 AM dispatcher batch; approved actions insert rows into a new `gmaps_outreach_queue` table; a new local runner (`runner/gmaps-runner.js`) polls the queue every 5 min and executes contact form fills via Playwright (stealth, home IP) and SMS via Twilio REST. Bookings are detected by `?ref=gmaps&lid={leadId}` saved to `appointments.notes`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (supabaseAdmin), Playwright + puppeteer-extra-plugin-stealth, Twilio REST API, existing Telegram approval flow + resolver.ts switch pattern, existing knowledge_store, existing AgentModule interface.

---

## File Map

| File | Action |
|---|---|
| `supabase/migrations/20260521_gmaps_outreach.sql` | CREATE |
| `lib/agents/gmaps-message.ts` | CREATE |
| `lib/agents/gmaps-outreach-agent.ts` | CREATE |
| `lib/agents/resolver.ts` | MODIFY — add 2 switch cases |
| `lib/agents/dispatcher.ts` | MODIFY — import + AGENT_REGISTRY entry |
| `app/api/gmaps-outreach/queue/route.ts` | CREATE |
| `app/api/gmaps-outreach/stats/route.ts` | CREATE |
| `app/book/page.tsx` | MODIFY — Suspense wrapper + useSearchParams |
| `app/gmaps-search/page.tsx` | MODIFY — "Add to Outreach" button |
| `app/outreach/page.tsx` | MODIFY — GMap Outreach tab |
| `runner/gmaps-runner.js` | CREATE |
| `runner/package.json` | MODIFY — add twilio |
| `runner/.env.example` | MODIFY — add Twilio vars |

---

## Task 1: DB Migration + Agent Registration

**Files:**
- Create: `supabase/migrations/20260521_gmaps_outreach.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260521_gmaps_outreach.sql

-- Queue table for outreach actions
CREATE TABLE IF NOT EXISTS gmaps_outreach_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action_type    TEXT NOT NULL CHECK (action_type IN ('contact_form_fill', 'sms_follow_up')),
  website_url    TEXT,
  phone          TEXT,
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'executing', 'done', 'failed', 'skipped')),
  step_number    INT NOT NULL DEFAULT 1,
  scheduled_for  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at    TIMESTAMPTZ,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, step_number)
);

ALTER TABLE gmaps_outreach_queue ENABLE ROW LEVEL SECURITY;

-- Partial unique index: only one pending/executing row per lead per action type
CREATE UNIQUE INDEX IF NOT EXISTS gmaps_queue_no_dup_pending
  ON gmaps_outreach_queue (lead_id, action_type)
  WHERE status IN ('pending', 'executing');

-- Daily stats table
CREATE TABLE IF NOT EXISTS gmaps_outreach_stats (
  date            TEXT PRIMARY KEY,
  forms_queued    INT NOT NULL DEFAULT 0,
  forms_sent      INT NOT NULL DEFAULT 0,
  sms_sent        INT NOT NULL DEFAULT 0,
  meetings_booked INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gmaps_outreach_stats ENABLE ROW LEVEL SECURITY;

-- Register agent in the agents table
INSERT INTO agents (name, display_name, description, enabled, schedule, health_score, config)
VALUES (
  'gmaps-outreach-agent',
  'GMap Outreach Agent',
  'Queues contact form fills and SMS follow-ups for Google Maps businesses to sell Missed Call Recovery ($297 setup + $97/mo)',
  true,
  '0 7 * * *',
  100,
  '{"daily_cap": 30, "sms_cap": 20}'
)
ON CONFLICT (name) DO NOTHING;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run against production project `tbsqpnqzpbnilifhwvgr`:
```
mcp__claude_ai_Supabase__apply_migration with the SQL above
```

Expected: Tables `gmaps_outreach_queue` and `gmaps_outreach_stats` created; 1 row inserted into `agents`.

- [ ] **Step 3: Verify**

```
mcp__claude_ai_Supabase__list_tables
```

Expected: `gmaps_outreach_queue` and `gmaps_outreach_stats` appear in the table list.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260521_gmaps_outreach.sql
git commit -m "feat: add gmaps_outreach_queue + gmaps_outreach_stats tables + agent registration"
```

---

## Task 2: Message Generation Utility

**Files:**
- Create: `lib/agents/gmaps-message.ts`

- [ ] **Step 1: Create the message utility**

```typescript
// lib/agents/gmaps-message.ts

const BOOKING_BASE =
  "https://app.flow-forges.com/prospecting-os/book?type=discovery&ref=gmaps&lid=";

export function buildBookingUrl(leadId: string): string {
  return `${BOOKING_BASE}${encodeURIComponent(leadId)}`;
}

export function parseRatingFromNotes(notes: string): { rating: number; reviewCount: number } {
  const match = notes.match(/Rating:\s*([\d.]+)\/5\s*\((\d+)\s*reviews?\)/i);
  if (!match) return { rating: 0, reviewCount: 0 };
  return { rating: parseFloat(match[1]), reviewCount: parseInt(match[2], 10) };
}

export function parsePhoneFromNotes(notes: string): string {
  const match = notes.match(/Phone:\s*([+\d\s\-().]+?)(?:\s*\|{2}|\s*$)/);
  if (!match) return "";
  return match[1].trim();
}

export function parseCityFromLocation(location: string): string {
  // "123 Main St, Austin, TX 78701, USA" → "Austin"
  const parts = location.split(",").map(s => s.trim());
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length >= 2) return parts[0];
  return location.trim();
}

type Tier = "A" | "B" | "C";

export function determineTier(rating: number, reviewCount: number): Tier {
  if (rating >= 4.5 && reviewCount >= 100) return "A";
  if (rating >= 4.0 || reviewCount >= 20) return "B";
  return "C";
}

export function generateContactFormMessage(params: {
  businessName: string;
  city: string;
  industry: string;
  rating: number;
  reviewCount: number;
  leadId: string;
}): string {
  const { businessName, city, industry, rating, reviewCount, leadId } = params;
  const tier = determineTier(rating, reviewCount);
  const bookingUrl = buildBookingUrl(leadId);
  const industryLower = industry.toLowerCase();

  if (tier === "A") {
    return (
      `Hi ${businessName}, I came across ${businessName} while researching top ` +
      `${industryLower}s in ${city} — clearly you're doing great work with ${reviewCount} reviews.\n\n` +
      `Quick question: what happens when a patient calls after hours and no one picks up? ` +
      `We built an AI agent that texts back within 60 seconds, qualifies the lead, and books the ` +
      `appointment automatically. Takes 48 hours to set up, no new software for your team.\n\n` +
      `Worth a 15-min call? ${bookingUrl}\n\n` +
      `— Ayush Kumar, Flow Forges`
    );
  }

  if (tier === "B") {
    return (
      `Hi ${businessName}, spotted ${businessName} while looking at ${city} ${industryLower}s. ` +
      `You've built solid reviews — missed calls are one of the fastest ways to stall that momentum.\n\n` +
      `Our AI agent responds to every missed call in under 60 seconds and books the appointment ` +
      `automatically. No extra staff needed.\n\n` +
      `Happy to show you how it works in 15 minutes: ${bookingUrl}\n\n` +
      `— Ayush Kumar, Flow Forges`
    );
  }

  // Tier C
  return (
    `Hi ${businessName}, in ${industryLower}, the first business to call back wins the ` +
    `client — every time.\n\n` +
    `Our AI missed-call agent responds in under 60 seconds and books appointments automatically, ` +
    `even at midnight. Local ${city} businesses using it are converting 40% more missed calls ` +
    `into paying clients.\n\n` +
    `15-minute demo: ${bookingUrl}\n\n` +
    `— Ayush Kumar, Flow Forges`
  );
}

export function generateSmsMessage(params: {
  businessName: string;
  leadId: string;
}): string {
  const { businessName, leadId } = params;
  const url = buildBookingUrl(leadId);
  const msg = `Hi, I emailed ${businessName} about recovering missed calls with AI. Worth a quick 15-min call? ${url} — Ayush, Flow Forges`;
  return msg.slice(0, 160);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/gmaps-message.ts
git commit -m "feat: add gmaps message generation utility (3-tier templates + SMS)"
```

---

## Task 3: GMap Outreach Agent Module

**Files:**
- Create: `lib/agents/gmaps-outreach-agent.ts`

- [ ] **Step 1: Create the agent module**

```typescript
// lib/agents/gmaps-outreach-agent.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";
import { readKnowledgeNumber, writeKnowledge } from "./knowledge";
import {
  parseRatingFromNotes,
  parsePhoneFromNotes,
  parseCityFromLocation,
  generateContactFormMessage,
  generateSmsMessage,
} from "./gmaps-message";

export class GmapsOutreachAgent implements AgentModule {
  name = "gmaps-outreach-agent";
  displayName = "GMap Outreach Agent";
  description = "Queues contact form fills and SMS follow-ups for Google Maps businesses to sell Missed Call Recovery";

  async run(config: Record<string, unknown>): Promise<AgentResult> {
    const log: string[] = [];
    const actionsToQueue: AgentAction[] = [];

    const dailyCap = Number(config.daily_cap ?? (await readKnowledgeNumber("gmaps_outreach.daily_cap", 30)));
    const smsCap = Number(config.sms_cap ?? 20);

    // ── Step 1: Find new prospects ─────────────────────────────────────────────
    const { data: queuedRows } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("lead_id");
    const alreadyQueued = new Set(
      (queuedRows ?? []).map((r: { lead_id: string }) => r.lead_id)
    );

    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from("leads")
      .select("id, name, company, industry, location, website, notes, score")
      .eq("source", "gmaps")
      .not("status", "in", '("meeting","won")')
      .or("website.neq.,notes.ilike.%Phone:%")
      .order("score", { ascending: false })
      .limit(dailyCap * 2); // over-fetch so we have enough after excluding already-queued

    if (leadsErr) {
      return {
        outcome: "failed",
        log: `DB error fetching leads: ${leadsErr.message}`,
        safeActionsExecuted: 0,
        actionsToQueue: [],
      };
    }

    const newProspects = (leads ?? [])
      .filter((l: { id: string }) => !alreadyQueued.has(l.id))
      .slice(0, dailyCap);

    log.push(
      `Step 1: ${newProspects.length} new prospects found (${alreadyQueued.size} already queued, cap: ${dailyCap})`
    );

    // ── Steps 2+3: Generate messages + queue contact form fills ────────────────
    for (const lead of newProspects) {
      const notes = lead.notes ?? "";
      const { rating, reviewCount } = parseRatingFromNotes(notes);
      const phone = parsePhoneFromNotes(notes);
      const city = parseCityFromLocation(lead.location ?? "");
      const businessName = (lead.company || lead.name) as string;

      const message = generateContactFormMessage({
        businessName,
        city,
        industry: (lead.industry as string) ?? "business",
        rating,
        reviewCount,
        leadId: lead.id as string,
      });

      actionsToQueue.push({
        type: "gmaps_contact_form_fill",
        description: `Send contact form to ${businessName} (${city}) — Tier ${
          rating >= 4.5 && reviewCount >= 100 ? "A" : rating >= 4.0 || reviewCount >= 20 ? "B" : "C"
        }`,
        riskLevel: "medium",
        payload: {
          leadId: lead.id,
          websiteUrl: (lead.website as string) ?? "",
          phone,
          message,
          stepNumber: 1,
        },
      });
    }

    if (newProspects.length > 0) {
      log.push(`Step 3: Queued ${newProspects.length} contact form fills — pending Telegram approval`);
    }

    // ── Step 4: Check day-3 follow-up eligibility ──────────────────────────────
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

    const { data: doneStep1 } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("lead_id, phone, executed_at")
      .eq("step_number", 1)
      .eq("status", "done")
      .lt("executed_at", threeDaysAgo)
      .limit(smsCap);

    let smsQueued = 0;
    for (const row of (doneStep1 ?? [])) {
      const leadId = row.lead_id as string;

      // Skip if already booked
      const { data: booked } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .ilike("notes", `%lid=${leadId}%`)
        .maybeSingle();
      if (booked) continue;

      // Skip if step 2 already exists
      const { data: existingStep2 } = await supabaseAdmin
        .from("gmaps_outreach_queue")
        .select("id")
        .eq("lead_id", leadId)
        .eq("step_number", 2)
        .maybeSingle();
      if (existingStep2) continue;

      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, company, name")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead) continue;

      const businessName = ((lead.company || lead.name) as string);
      const smsMessage = generateSmsMessage({ businessName, leadId });

      actionsToQueue.push({
        type: "gmaps_sms_follow_up",
        description: `Day-3 SMS follow-up for ${businessName}`,
        riskLevel: "medium",
        payload: {
          leadId,
          phone: (row.phone as string) ?? "",
          message: smsMessage,
          stepNumber: 2,
        },
      });
      smsQueued++;
    }

    if (smsQueued > 0) {
      log.push(`Step 4: Queued ${smsQueued} SMS follow-ups — pending Telegram approval`);
    }

    // ── Step 4b: Detect new bookings + update lead status ─────────────────────
    const { data: sentItems } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("lead_id, executed_at")
      .eq("status", "done");

    let bookingsDetected = 0;
    for (const item of (sentItems ?? [])) {
      const leadId = item.lead_id as string;

      const { data: appointment } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .ilike("notes", `%lid=${leadId}%`)
        .gt("created_at", item.executed_at ?? "2000-01-01")
        .maybeSingle();

      if (!appointment) continue;

      // Check if already moved to meeting
      const { data: currentLead } = await supabaseAdmin
        .from("leads")
        .select("status, name, company, location")
        .eq("id", leadId)
        .maybeSingle();
      if (!currentLead || currentLead.status === "meeting" || currentLead.status === "won") continue;

      await supabaseAdmin.from("leads").update({
        status: "meeting",
        kanban_column: "Meeting",
        last_touched: new Date().toISOString(),
      }).eq("id", leadId);

      const businessName = ((currentLead.company || currentLead.name) as string);
      const city = parseCityFromLocation((currentLead.location as string) ?? "");
      await supabaseAdmin.from("activity_log").insert({
        type: "meeting_booked",
        text: `Discovery call booked via GMap outreach — ${businessName}, ${city}`,
        lead_id: leadId,
      });
      bookingsDetected++;
    }

    if (bookingsDetected > 0) {
      log.push(`Step 4b: Detected ${bookingsDetected} new booking(s) — leads moved to Meeting`);
    }

    // ── Step 5: Write knowledge store ─────────────────────────────────────────
    const { count: pipelineSize } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("*", { count: "exact", head: true });

    const today = new Date().toISOString().split("T")[0];
    const { count: formsSentToday } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "done")
      .eq("step_number", 1)
      .gte("executed_at", `${today}T00:00:00Z`);

    const { count: meetingsBooked } = await supabaseAdmin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .ilike("notes", "%ref=gmaps%");

    const { count: totalFormsSent } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "done")
      .eq("step_number", 1);

    const convRate =
      totalFormsSent && meetingsBooked
        ? `${Math.round(((meetingsBooked ?? 0) / totalFormsSent) * 100)}%`
        : "0%";

    await writeKnowledge("gmaps-outreach-agent", "gmaps_outreach.pipeline_size", pipelineSize ?? 0);
    await writeKnowledge("gmaps-outreach-agent", "gmaps_outreach.forms_sent_today", formsSentToday ?? 0);
    await writeKnowledge("gmaps-outreach-agent", "gmaps_outreach.meetings_booked", meetingsBooked ?? 0);
    await writeKnowledge("gmaps-outreach-agent", "gmaps_outreach.conversion_rate", convRate);

    log.push(
      `Step 5: pipeline=${pipelineSize ?? 0}, sent_today=${formsSentToday ?? 0}, meetings=${meetingsBooked ?? 0}, conv=${convRate}`
    );

    return {
      outcome: "success",
      log: log.join("\n"),
      safeActionsExecuted: bookingsDetected,
      actionsToQueue,
    };
  }
}

export const gmapsOutreachAgent = new GmapsOutreachAgent();
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/gmaps-outreach-agent.ts
git commit -m "feat: add GmapsOutreachAgent module (5-step run logic, 3-tier messages)"
```

---

## Task 4: Resolver Additions

**Files:**
- Modify: `lib/agents/resolver.ts:186-208` (after the `queue_linkedin_dm` case, before the informational types)

- [ ] **Step 1: Add two new cases to the switch statement**

In `lib/agents/resolver.ts`, locate the `case "queue_linkedin_dm":` block (ends around line 222). Add these two cases immediately **after** it, before the informational types comment:

```typescript
    case "gmaps_contact_form_fill": {
      const leadId = String(p.leadId ?? "");
      const websiteUrl = String(p.websiteUrl ?? "");
      const phone = String(p.phone ?? "");
      const message = String(p.message ?? "");
      const stepNumber = Number(p.stepNumber ?? 1);
      if (!leadId) throw new Error("gmaps_contact_form_fill payload missing leadId");
      if (!message) throw new Error("gmaps_contact_form_fill payload missing message");

      const { error } = await supabaseAdmin
        .from("gmaps_outreach_queue")
        .insert({
          lead_id: leadId,
          action_type: "contact_form_fill",
          website_url: websiteUrl || null,
          phone: phone || null,
          message,
          status: "pending",
          step_number: stepNumber,
          scheduled_for: new Date().toISOString(),
        });
      if (error) {
        if (error.code === "23505") return `Contact form fill already queued for lead ${leadId}`;
        throw new Error(`Failed to insert into gmaps_outreach_queue: ${error.message}`);
      }
      return `Contact form fill queued for lead ${leadId}`;
    }

    case "gmaps_sms_follow_up": {
      const leadId = String(p.leadId ?? "");
      const phone = String(p.phone ?? "");
      const message = String(p.message ?? "");
      const stepNumber = Number(p.stepNumber ?? 2);
      if (!leadId) throw new Error("gmaps_sms_follow_up payload missing leadId");
      if (!phone) throw new Error("gmaps_sms_follow_up payload missing phone");
      if (!message) throw new Error("gmaps_sms_follow_up payload missing message");

      const { error } = await supabaseAdmin
        .from("gmaps_outreach_queue")
        .insert({
          lead_id: leadId,
          action_type: "sms_follow_up",
          phone,
          message,
          status: "pending",
          step_number: stepNumber,
          scheduled_for: new Date().toISOString(),
        });
      if (error) {
        if (error.code === "23505") return `SMS follow-up already queued for lead ${leadId}`;
        throw new Error(`Failed to insert into gmaps_outreach_queue: ${error.message}`);
      }
      return `SMS follow-up queued for lead ${leadId} (phone: ${phone})`;
    }
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/resolver.ts
git commit -m "feat: add gmaps_contact_form_fill + gmaps_sms_follow_up action handlers in resolver"
```

---

## Task 5: Dispatcher Registration

**Files:**
- Modify: `lib/agents/dispatcher.ts`

- [ ] **Step 1: Add import at top of dispatcher.ts**

After the last existing agent import (line 13, `import { MessageCoachAgent } from "./message-coach";`), add:

```typescript
import { GmapsOutreachAgent } from "./gmaps-outreach-agent";
```

- [ ] **Step 2: Add to AGENT_REGISTRY**

In the `AGENT_REGISTRY` array (lines 16–24), append the new agent as the last entry:

```typescript
const AGENT_REGISTRY: AgentModule[] = [
  new LeadScoutAgent(),
  new OutreachAgent(),
  new PipelineManagerAgent(),
  new IcpAnalystAgent(),
  new ClientReporterAgent(),
  new DataJanitorAgent(),
  new MessageCoachAgent(),
  new GmapsOutreachAgent(),   // ← add this
];
```

- [ ] **Step 3: Verify TypeScript and build**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/agents/dispatcher.ts
git commit -m "feat: register GmapsOutreachAgent in dispatcher AGENT_REGISTRY"
```

---

## Task 6: Queue API Route

**Files:**
- Create: `app/api/gmaps-outreach/queue/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/gmaps-outreach/queue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromHeaders } from "@/lib/auth";
import {
  parseRatingFromNotes,
  parsePhoneFromNotes,
  parseCityFromLocation,
  generateContactFormMessage,
  generateSmsMessage,
} from "@/lib/agents/gmaps-message";

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => undefined);
}

export async function POST(req: NextRequest) {
  const user = getUserFromHeaders(req.headers);
  if (!user || !["super_admin", "qa_agent"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { leadIds?: string[] };
  const { leadIds } = body;
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds array required" }, { status: 400 });
  }

  let queued = 0;
  let skipped = 0;
  const skipReasons: string[] = [];

  for (const leadId of leadIds) {
    // Fetch lead
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, company, industry, location, website, notes")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) {
      skipped++;
      skipReasons.push(`${leadId}: not found in DB`);
      continue;
    }

    // Check if already queued
    const { data: existing } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("id")
      .eq("lead_id", leadId)
      .eq("step_number", 1)
      .maybeSingle();

    if (existing) {
      skipped++;
      skipReasons.push(`${leadId}: already_queued`);
      continue;
    }

    // Check contact method
    const notes = (lead.notes as string) ?? "";
    const phone = parsePhoneFromNotes(notes);
    const website = (lead.website as string) ?? "";
    if (!website && !phone) {
      skipped++;
      skipReasons.push(`${leadId}: no_contact_method`);
      continue;
    }

    const { rating, reviewCount } = parseRatingFromNotes(notes);
    const city = parseCityFromLocation((lead.location as string) ?? "");
    const businessName = ((lead.company || lead.name) as string);

    const message = generateContactFormMessage({
      businessName,
      city,
      industry: (lead.industry as string) ?? "business",
      rating,
      reviewCount,
      leadId: lead.id as string,
    });

    const { error } = await supabaseAdmin.from("gmaps_outreach_queue").insert({
      lead_id: leadId,
      action_type: "contact_form_fill",
      website_url: website || null,
      phone: phone || null,
      message,
      status: "pending",
      step_number: 1,
      scheduled_for: new Date().toISOString(),
    });

    if (error && error.code !== "23505") {
      skipped++;
      skipReasons.push(`${leadId}: db_error — ${error.message}`);
      continue;
    }
    queued++;
  }

  if (queued > 0) {
    await sendTelegram(
      `[GMap Outreach] ${queued} businesses added to outreach queue via /gmaps-search — pending runner execution`
    );
  }

  return NextResponse.json({ queued, skipped, skipReasons });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/gmaps-outreach/queue/route.ts
git commit -m "feat: add POST /api/gmaps-outreach/queue endpoint"
```

---

## Task 7: Stats API Route

**Files:**
- Create: `app/api/gmaps-outreach/stats/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/gmaps-outreach/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getUserFromHeaders(req.headers);
  if (!user || !["super_admin", "qa_agent"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Pipeline size
  const { count: pipelineSize } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true });

  // Forms queued today (inserted today with step 1)
  const { count: formsQueuedToday } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 1)
    .gte("created_at", `${today}T00:00:00Z`);

  // Forms sent today (done step 1 executed today)
  const { count: formsSentToday } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 1)
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);

  // SMS sent today
  const { count: smsSentToday } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 2)
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);

  // Meetings booked total
  const { count: meetingsBooked } = await supabaseAdmin
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .ilike("notes", "%ref=gmaps%");

  // Total forms sent (for conversion rate)
  const { count: totalFormsSent } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("step_number", 1)
    .eq("status", "done");

  const conversionRate =
    totalFormsSent && meetingsBooked
      ? `${Math.round(((meetingsBooked ?? 0) / totalFormsSent) * 100)}%`
      : "0%";

  // Queue table items (most recent 50)
  const { data: queueItems } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select(`
      id, lead_id, action_type, status, step_number,
      scheduled_for, executed_at, error, created_at,
      leads!inner(name, company, industry, location)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    pipelineSize: pipelineSize ?? 0,
    formsQueuedToday: formsQueuedToday ?? 0,
    formsSentToday: formsSentToday ?? 0,
    smsSentToday: smsSentToday ?? 0,
    meetingsBooked: meetingsBooked ?? 0,
    conversionRate,
    queue: queueItems ?? [],
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/gmaps-outreach/stats/route.ts
git commit -m "feat: add GET /api/gmaps-outreach/stats endpoint"
```

---

## Task 8: /book Page Tracking

**Files:**
- Modify: `app/book/page.tsx`

The page is `"use client"`. `useSearchParams` requires Suspense in Next.js 14. We wrap the main component.

- [ ] **Step 1: Add `useSearchParams` import and Suspense wrapper**

At the top of `app/book/page.tsx`, add to the React import line:
```typescript
import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
```

Add `useSearchParams` import from next/navigation (new import):
```typescript
import { useSearchParams } from "next/navigation";
```

- [ ] **Step 2: Rename the existing default export to `BookPageInner`**

Find the line that starts the default export component (it will be something like `export default function BookPage()` — search for `export default function`). Rename it to a regular (non-exported) function called `BookPageInner`.

Before the rename, the file ends with something like:
```typescript
export default function BookPage() {
```

After:
```typescript
function BookPageInner() {
```

- [ ] **Step 3: Add `useSearchParams` inside `BookPageInner`**

At the top of `BookPageInner`, after the `const` block for constants but near the first `useState` call, add:

```typescript
const searchParams = useSearchParams();
const gmapsRef = searchParams.get("ref");
const gmapsLid = searchParams.get("lid");
```

- [ ] **Step 4: Modify the notes submission to append tracking**

Find the form submission fetch call (around line 231). The `body: JSON.stringify(...)` includes `notes: notes.trim()`. Replace that specific part with:

```typescript
notes: gmapsRef === "gmaps" && gmapsLid
  ? (notes.trim() ? `${notes.trim()}  |  ref=gmaps&lid=${gmapsLid}` : `ref=gmaps&lid=${gmapsLid}`)
  : notes.trim(),
```

- [ ] **Step 5: Add new default export with Suspense wrapper at the bottom of the file**

After the closing brace of `BookPageInner`, add:

```typescript
export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 6: Verify TypeScript and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: 0 errors. The `/book` route should compile cleanly.

- [ ] **Step 7: Commit**

```bash
git add app/book/page.tsx
git commit -m "feat: capture ?ref=gmaps&lid={leadId} in /book and append to appointment notes"
```

---

## Task 9: /gmaps-search "Add to Outreach" Button

**Files:**
- Modify: `app/gmaps-search/page.tsx`

- [ ] **Step 1: Add `queuedIds` state and `outreachResult` state**

After the existing `importedIds` state declaration (line 215: `const [importedIds, setImportedIds] = useState<Set<string>>(new Set());`), add:

```typescript
const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
const [addingToOutreach, setAddingToOutreach] = useState(false);
const [outreachResult, setOutreachResult] = useState<{ queued?: number; skipped?: number; error?: string } | null>(null);
```

- [ ] **Step 2: Add `handleAddToOutreach` function**

After the `handleImport` function (which ends around line 350), add:

```typescript
const handleAddToOutreach = async () => {
  const toAdd = results.filter(r => selected.has(r.placeId));
  if (!toAdd.length) return;
  setAddingToOutreach(true);
  setOutreachResult(null);

  // Import any that haven't been imported yet first
  const notImported = toAdd.filter(r => !importedIds.has(r.placeId));
  if (notImported.length > 0) {
    const endpoint = mode === "quick"
      ? { url: "/prospecting-os/api/gmaps-search", method: "POST" }
      : { url: "/prospecting-os/api/gmaps-scrape", method: "PATCH" };
    try {
      const importRes = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: notImported }),
      });
      if (importRes.ok) {
        setImportedIds(prev => new Set([...prev, ...notImported.map(r => r.placeId)]));
      }
    } catch { /* non-critical — queue API will skip leads not in DB */ }
  }

  const leadIds = toAdd.map(r => `gmaps_${r.placeId}`);
  try {
    const res = await fetch("/prospecting-os/api/gmaps-outreach/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      setOutreachResult({ error: data.error || "Failed to add to outreach queue" });
      return;
    }
    setOutreachResult({ queued: data.queued, skipped: data.skipped });
    setQueuedIds(prev => new Set([...prev, ...toAdd.map(r => r.placeId)]));
  } catch {
    setOutreachResult({ error: "Network error — please try again" });
  } finally {
    setAddingToOutreach(false);
  }
};
```

- [ ] **Step 3: Add "Add to Outreach" button in the toolbar**

Find the section that renders the "Import N leads" button (around line 592–599):

```tsx
{selectedCount > 0 && (
  <button onClick={handleImport} disabled={importing}
```

Add the "Add to Outreach" button immediately **after** the Import button's closing `</button>` tag, still inside the `{selectedCount > 0 && (` block. The block should now look like:

```tsx
{selectedCount > 0 && (
  <>
    <button onClick={handleImport} disabled={importing}
      className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all duration-100 disabled:opacity-50"
      style={{ background: "var(--accent)", color: "#000" }}>
      {importing
        ? <><RefreshCw size={12} className="animate-spin" /> Importing…</>
        : <><Download size={12} /> Import {selectedCount} lead{selectedCount !== 1 ? "s" : ""}</>}
    </button>
    <button onClick={handleAddToOutreach} disabled={addingToOutreach || importing}
      className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all duration-100 disabled:opacity-50"
      style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)", color: "var(--accent-blue)" }}>
      {addingToOutreach
        ? <><RefreshCw size={12} className="animate-spin" /> Queuing…</>
        : <><Send size={12} /> Add to Outreach ({selectedCount})</>}
    </button>
  </>
)}
```

- [ ] **Step 4: Add `Send` icon import**

At the top of the file, the lucide-react import block currently reads:
```typescript
import {
  MapPin, Search, Star, Phone, Globe, Building2,
  CheckSquare, Square, Download, RefreshCw, ChevronRight,
  AlertCircle, X, Zap, ExternalLink, TrendingUp, Layers,
} from "lucide-react";
```

Add `Send` to the list:
```typescript
import {
  MapPin, Search, Star, Phone, Globe, Building2,
  CheckSquare, Square, Download, RefreshCw, ChevronRight,
  AlertCircle, X, Zap, ExternalLink, TrendingUp, Layers, Send,
} from "lucide-react";
```

- [ ] **Step 5: Show outreach result toast**

Find where `importResult` is displayed (there will be a conditional render showing the import result). Add similar display for `outreachResult` right after it:

```tsx
{outreachResult && (
  <div className="text-[11px] px-2 py-1 rounded"
    style={{
      background: outreachResult.error ? "rgba(255,107,53,0.1)" : "rgba(0,212,255,0.1)",
      color: outreachResult.error ? "var(--accent-orange)" : "var(--accent-blue)",
      border: `1px solid ${outreachResult.error ? "rgba(255,107,53,0.2)" : "rgba(0,212,255,0.2)"}`,
    }}>
    {outreachResult.error
      ? outreachResult.error
      : `${outreachResult.queued} added to outreach queue — pending runner`}
  </div>
)}
```

- [ ] **Step 6: Add "Queued" badge to BusinessCard**

The `BusinessCard` component receives `selected` and `imported` props. Add a `queued` prop:

Find the `BusinessCard` component signature:
```typescript
function BusinessCard({
  biz, selected, imported, onToggle,
}: {
  biz: GMapsBusiness;
  selected: boolean;
  imported: boolean;
  onToggle: () => void;
}) {
```

Change to:
```typescript
function BusinessCard({
  biz, selected, imported, queued, onToggle,
}: {
  biz: GMapsBusiness;
  selected: boolean;
  imported: boolean;
  queued: boolean;
  onToggle: () => void;
}) {
```

In the card header where the checkmark icon is rendered, add a "Queued" badge before the checkmark:
```tsx
{queued && (
  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
    style={{ background: "rgba(0,212,255,0.12)", color: "var(--accent-blue)", border: "1px solid rgba(0,212,255,0.25)" }}>
    QUEUED
  </span>
)}
```

Update the `BusinessCard` usage in the results map to pass `queued`:
```tsx
<BusinessCard key={biz.placeId} biz={biz}
  selected={selected.has(biz.placeId)}
  imported={importedIds.has(biz.placeId)}
  queued={queuedIds.has(biz.placeId)}
  onToggle={() => toggleSelect(biz.placeId)}
/>
```

- [ ] **Step 7: Verify TypeScript and build**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/gmaps-search/page.tsx
git commit -m "feat: add 'Add to Outreach' button + Queued badge to /gmaps-search"
```

---

## Task 10: /outreach GMap Outreach Tab

**Files:**
- Modify: `app/outreach/page.tsx`

- [ ] **Step 1: Add GMap Outreach types at top of file**

After the existing imports/interfaces (after the `RunnerConfig` import and before the component), add:

```typescript
interface GmapsStats {
  pipelineSize: number;
  formsQueuedToday: number;
  formsSentToday: number;
  smsSentToday: number;
  meetingsBooked: number;
  conversionRate: string;
  queue: Array<{
    id: string;
    lead_id: string;
    action_type: string;
    status: string;
    step_number: number;
    scheduled_for: string;
    executed_at: string | null;
    error: string | null;
    leads: { name: string; company: string; industry: string; location: string };
  }>;
}

type OutreachTab = "linkedin" | "gmaps";
```

- [ ] **Step 2: Add tab state + GMap data state inside the main component**

At the top of the main component function (after the existing `useState` declarations), add:

```typescript
const [activeTab, setActiveTab] = useState<OutreachTab>("linkedin");
const [gmapsStats, setGmapsStats] = useState<GmapsStats | null>(null);
const [gmapsLoading, setGmapsLoading] = useState(false);
```

- [ ] **Step 3: Add `fetchGmapsStats` function**

After the existing `fetchQueue` or `fetchStatus` function definition, add:

```typescript
const fetchGmapsStats = useCallback(async () => {
  setGmapsLoading(true);
  try {
    const res = await fetch(`${BASE}/api/gmaps-outreach/stats`);
    if (res.ok) {
      const data = await res.json();
      setGmapsStats(data);
    }
  } catch { /* non-critical */ }
  finally { setGmapsLoading(false); }
}, []);
```

- [ ] **Step 4: Fetch GMap stats when tab switches to "gmaps"**

In the `useEffect` that loads data (or add a new useEffect):

```typescript
useEffect(() => {
  if (activeTab === "gmaps") fetchGmapsStats();
}, [activeTab, fetchGmapsStats]);
```

- [ ] **Step 5: Replace the page's return with a tab-aware layout**

Find the outermost `<div>` of the return statement. Before the existing LinkedIn Queue content, add tab buttons. The structure should look like:

```tsx
return (
  <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
    {/* Tab switcher */}
    <div className="flex items-center gap-2 mb-6">
      {(["linkedin", "gmaps"] as OutreachTab[]).map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className="text-[12px] font-semibold px-4 py-2 rounded-lg transition-all duration-150"
          style={{
            background: activeTab === tab ? "var(--accent-blue)" : "var(--surface2)",
            color: activeTab === tab ? "#000" : "var(--muted)",
            border: `1px solid ${activeTab === tab ? "var(--accent-blue)" : "var(--border)"}`,
          }}
        >
          {tab === "linkedin" ? "LinkedIn Queue" : "GMap Outreach"}
        </button>
      ))}
    </div>

    {/* LinkedIn Queue tab — existing content */}
    {activeTab === "linkedin" && (
      /* ← paste the ENTIRE existing page content here, unchanged */
      <> ... existing JSX ... </>
    )}

    {/* GMap Outreach tab */}
    {activeTab === "gmaps" && (
      <div className="flex flex-col gap-6">
        {gmapsLoading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading stats…</p>}
        {gmapsStats && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {[
                { label: "Pipeline Size", value: gmapsStats.pipelineSize, color: "var(--accent-blue)" },
                { label: "Forms Queued Today", value: gmapsStats.formsQueuedToday, color: "var(--accent-blue)" },
                { label: "Forms Sent Today", value: gmapsStats.formsSentToday, color: "var(--accent-green)" },
                { label: "SMS Sent Today", value: gmapsStats.smsSentToday, color: "var(--accent-green)" },
                { label: "Meetings Booked", value: gmapsStats.meetingsBooked, color: "var(--accent-orange)" },
              ].map(card => (
                <div key={card.label}
                  className="rounded-xl p-4 flex flex-col gap-1"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>{card.label}</span>
                  <span className="text-2xl font-bold tabular-nums" style={{ color: card.color }}>
                    {card.value}
                  </span>
                </div>
              ))}
            </div>
            {/* Conversion rate */}
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="text-[13px]" style={{ color: "var(--muted)" }}>Conversion rate (forms → meetings):</span>
              <span className="text-xl font-bold" style={{ color: "var(--accent-orange)" }}>
                {gmapsStats.conversionRate}
              </span>
            </div>
            {/* Queue table */}
            {gmapsStats.queue.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>No items in queue yet. Import Google Maps businesses and click "Add to Outreach".</p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                      {["Business", "Industry", "Step", "Status", "Scheduled", "Executed"].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold"
                          style={{ color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gmapsStats.queue.map(item => {
                      const statusColor = item.status === "done" ? "var(--accent-green)"
                        : item.status === "failed" ? "var(--accent-orange)"
                        : item.status === "skipped" ? "var(--muted)"
                        : "var(--accent-blue)";
                      const stepLabel = item.step_number === 1 ? "Form" : "SMS";
                      return (
                        <tr key={item.id}
                          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                          <td className="px-3 py-2 font-medium" style={{ color: "var(--text)" }}>
                            {item.leads?.company || item.leads?.name || item.lead_id.slice(0, 12)}
                          </td>
                          <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                            {item.leads?.industry ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                              style={{
                                background: item.step_number === 1 ? "rgba(0,212,255,0.1)" : "rgba(124,58,237,0.1)",
                                color: item.step_number === 1 ? "var(--accent-blue)" : "var(--accent-purple)",
                              }}>
                              {stepLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                              style={{ background: `${statusColor}18`, color: statusColor }}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular-nums" style={{ color: "var(--muted)" }}>
                            {new Date(item.scheduled_for).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 tabular-nums" style={{ color: "var(--muted)" }}>
                            {item.executed_at ? new Date(item.executed_at).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    )}
  </div>
);
```

- [ ] **Step 6: Verify TypeScript and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add app/outreach/page.tsx
git commit -m "feat: add GMap Outreach tab to /outreach page (stats + queue table)"
```

---

## Task 11: Local Runner

**Files:**
- Create: `runner/gmaps-runner.js`
- Modify: `runner/package.json`
- Modify: `runner/.env.example` (or create if not present)

- [ ] **Step 1: Create `runner/gmaps-runner.js`**

```javascript
// runner/gmaps-runner.js
// Local GMap outreach runner — runs on your home machine (residential IP).
// Polls gmaps_outreach_queue every 5 min.
// contact_form_fill → Playwright navigates website, fills contact form.
// sms_follow_up    → Twilio REST API (no Playwright).
// Never run this on a server.

require("dotenv").config();
const path = require("path");
const os = require("os");

const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const twilio = require("twilio");

chromium.use(StealthPlugin());

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || "ayush@flow-forges.com";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[gmaps-runner] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let MAX_FORM_FILLS = parseInt(process.env.MAX_FORM_FILLS_PER_DAY ?? "30", 10);
let MAX_SMS = parseInt(process.env.MAX_SMS_PER_DAY ?? "20", 10);
let ACTIVE_START = parseInt(process.env.ACTIVE_HOURS_START ?? "9", 10);
let ACTIVE_END = parseInt(process.env.ACTIVE_HOURS_END ?? "18", 10);

const POLL_INTERVAL = 5 * 60 * 1000;
const PROFILE_DIR = path.join(os.homedir(), ".gmaps-runner", "profile");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActiveHour() {
  const h = new Date().getHours();
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false; // skip weekends
  return h >= ACTIVE_START && h < ACTIVE_END;
}

function randomDelay(minMs, maxMs) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

async function getTodayCounts() {
  const today = new Date().toISOString().split("T")[0];
  const { count: formsFilled } = await supabase
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "contact_form_fill")
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);
  const { count: smsSent } = await supabase
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "sms_follow_up")
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);
  return { formsFilled: formsFilled ?? 0, smsSent: smsSent ?? 0 };
}

async function markExecuting(id) {
  await supabase.from("gmaps_outreach_queue")
    .update({ status: "executing" }).eq("id", id);
}

async function markDone(id, logMessage) {
  await supabase.from("gmaps_outreach_queue").update({
    status: "done",
    executed_at: new Date().toISOString(),
    error: logMessage ?? null,
  }).eq("id", id);
}

async function markFailed(id, error) {
  await supabase.from("gmaps_outreach_queue").update({
    status: "failed",
    error: String(error).slice(0, 500),
    executed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function markSkipped(id, reason) {
  await supabase.from("gmaps_outreach_queue").update({
    status: "skipped",
    error: String(reason).slice(0, 200),
  }).eq("id", id);
}

async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `[GMap Runner] ${message}` }),
  }).catch(() => undefined);
}

async function logActivity(leadId, text) {
  await supabase.from("activity_log").insert({
    type: "notification",
    text,
    lead_id: leadId || null,
  });
}

async function resetStuckExecuting() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("gmaps_outreach_queue")
    .update({ status: "pending" })
    .eq("status", "executing")
    .lt("scheduled_for", tenMinutesAgo)
    .select("id");
  if (data?.length) {
    console.log(`[gmaps-runner] Reset ${data.length} stuck executing rows back to pending`);
  }
}

// ─── Contact Form Fill (Playwright) ──────────────────────────────────────────

async function fillContactForm(websiteUrl, message) {
  let browser;
  try {
    browser = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);

    await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Try to find contact form on current page
    let formFound = await tryFillForm(page, message);

    if (!formFound) {
      // Look for /contact page link in nav/footer
      const contactHref = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const link = links.find(l =>
          /\bcontact\b|get.in.touch/i.test(l.textContent + " " + l.href)
        );
        return link ? link.href : null;
      });

      if (contactHref && contactHref !== websiteUrl) {
        await page.goto(contactHref, { waitUntil: "domcontentloaded", timeout: 15000 });
        formFound = await tryFillForm(page, message);
      }
    }

    await browser.close();

    if (!formFound) return { success: false, error: "no_contact_form" };
    return { success: true };
  } catch (err) {
    if (browser) await browser.close().catch(() => undefined);
    return { success: false, error: err.message };
  }
}

async function tryFillForm(page, message) {
  // Locate a contact form — priority order
  const formSelectors = [
    'form[action*="contact"]',
    'form#contact',
    'form.contact-form',
    'form.wpcf7-form',
    'form[class*="contact"]',
  ];

  let form = null;
  for (const sel of formSelectors) {
    const el = await page.$(sel);
    if (el) { form = el; break; }
  }

  // Fallback: form containing a message textarea
  if (!form) {
    const textareas = await page.$$("textarea");
    for (const ta of textareas) {
      const parent = await ta.evaluateHandle(el => el.closest("form"));
      if (parent) { form = parent; break; }
    }
  }

  if (!form) return false;

  // Fill name field
  const nameInput = await form.$('input[name*="name"], input[placeholder*="name" i], input[id*="name" i]');
  if (nameInput) {
    await nameInput.click();
    await nameInput.fill("Ayush Kumar | Flow Forges");
  }

  // Fill email field
  const emailInput = await form.$('input[type="email"], input[name*="email" i], input[placeholder*="email" i]');
  if (emailInput) {
    await emailInput.click();
    await emailInput.fill(BUSINESS_EMAIL);
  }

  // Fill message/textarea
  const textarea = await form.$("textarea");
  if (!textarea) return false;
  await textarea.click();
  for (const char of message) {
    await textarea.type(char, { delay: 80 + Math.random() * 40 });
  }

  // Submit
  const submitBtn = await form.$('button[type="submit"], input[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  // Wait for success signal
  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes("thank you") || text.includes("received") || text.includes("success");
  }, { timeout: 5000 }).catch(() => undefined);

  return true;
}

// ─── SMS Follow-up (Twilio) ───────────────────────────────────────────────────

async function sendSms(phone, message) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { success: false, error: "Twilio credentials not configured in .env" };
  }
  try {
    const client = twilio(TWILIO_SID, TWILIO_TOKEN);
    const msg = await client.messages.create({
      body: message,
      from: TWILIO_FROM,
      to: phone,
    });
    return { success: true, sid: msg.sid };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Main poll cycle ──────────────────────────────────────────────────────────

async function runOnce() {
  await resetStuckExecuting();

  if (!isActiveHour()) {
    console.log(`[gmaps-runner] Outside active hours (${ACTIVE_START}:00–${ACTIVE_END}:00, weekdays only) — skipping`);
    return;
  }

  const { formsFilled, smsSent } = await getTodayCounts();

  // Pick next pending item in priority order: form fills first, then SMS
  const { data: item } = await supabase
    .from("gmaps_outreach_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("step_number", { ascending: true })
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!item) {
    console.log(`[gmaps-runner] No pending items — forms: ${formsFilled}/${MAX_FORM_FILLS}, SMS: ${smsSent}/${MAX_SMS}`);
    return;
  }

  if (item.action_type === "contact_form_fill" && formsFilled >= MAX_FORM_FILLS) {
    console.log(`[gmaps-runner] Daily form fill cap reached (${MAX_FORM_FILLS}) — skipping`);
    return;
  }
  if (item.action_type === "sms_follow_up" && smsSent >= MAX_SMS) {
    console.log(`[gmaps-runner] Daily SMS cap reached (${MAX_SMS}) — skipping`);
    return;
  }

  await markExecuting(item.id);
  console.log(`[gmaps-runner] Processing ${item.action_type} for lead ${item.lead_id}`);

  if (item.action_type === "contact_form_fill") {
    if (!item.website_url) {
      await markSkipped(item.id, "no_website_url");
      await logActivity(item.lead_id, "GMap outreach: skipped — no website URL");
      return;
    }

    const result = await fillContactForm(item.website_url, item.message);

    if (result.success) {
      await markDone(item.id, null);
      await logActivity(item.lead_id, `GMap outreach: contact form filled on ${item.website_url}`);
      await sendTelegramAlert(`Contact form sent to lead ${item.lead_id}`);
      console.log(`[gmaps-runner] Contact form filled for ${item.lead_id}`);
    } else if (result.error === "no_contact_form") {
      await markSkipped(item.id, "no_contact_form");
      await logActivity(item.lead_id, `GMap outreach: skipped — no contact form found on ${item.website_url}`);
      console.log(`[gmaps-runner] No contact form found for ${item.lead_id}`);
    } else {
      await markFailed(item.id, result.error);
      await logActivity(item.lead_id, `GMap outreach: contact form failed — ${result.error}`);
      console.log(`[gmaps-runner] Contact form FAILED for ${item.lead_id}: ${result.error}`);
    }

  } else if (item.action_type === "sms_follow_up") {
    if (!item.phone) {
      await markSkipped(item.id, "no_phone_number");
      return;
    }

    const result = await sendSms(item.phone, item.message);

    if (result.success) {
      await markDone(item.id, `Twilio SID: ${result.sid}`);
      await logActivity(item.lead_id, `GMap outreach: SMS follow-up sent to ${item.phone}`);
      await sendTelegramAlert(`SMS follow-up sent to lead ${item.lead_id}`);
      console.log(`[gmaps-runner] SMS sent to ${item.phone}, SID: ${result.sid}`);
    } else {
      await markFailed(item.id, result.error);
      // No retry for SMS — log and move on
      console.log(`[gmaps-runner] SMS FAILED for ${item.lead_id}: ${result.error}`);
    }
  }

  // Small delay between consecutive actions
  await randomDelay(2000, 5000);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

console.log(`[gmaps-runner] Starting. Poll interval: ${POLL_INTERVAL / 1000}s. Active hours: ${ACTIVE_START}:00–${ACTIVE_END}:00 weekdays.`);
runOnce().catch(console.error);
setInterval(() => runOnce().catch(console.error), POLL_INTERVAL);
```

- [ ] **Step 2: Update `runner/package.json` to add Twilio and rename main**

Replace the contents with:

```json
{
  "name": "linkedin-runner",
  "version": "1.0.0",
  "description": "Local LinkedIn + GMap outreach runners — poll Supabase queues and execute via Playwright/Twilio",
  "scripts": {
    "start": "node linkedin-runner.js",
    "start:gmaps": "node gmaps-runner.js",
    "setup": "node linkedin-runner.js --setup"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0",
    "dotenv": "^16.4.5",
    "playwright": "^1.44.0",
    "playwright-extra": "^4.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "twilio": "^5.0.0"
  }
}
```

- [ ] **Step 3: Update `runner/.env.example`**

Add these lines to the existing `.env.example` (create the file if it doesn't exist):

```
# ─── GMap Runner specific ──────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
BUSINESS_EMAIL=ayush@flow-forges.com
MAX_FORM_FILLS_PER_DAY=30
MAX_SMS_PER_DAY=20
ACTIVE_HOURS_START=9
ACTIVE_HOURS_END=18
```

- [ ] **Step 4: Install twilio in runner directory**

```bash
cd runner && npm install
```

Expected: `twilio` package installed in `runner/node_modules/`.

- [ ] **Step 5: Verify the runner starts without syntax errors**

```bash
cd runner && node -e "require('./gmaps-runner.js')" 2>&1 | head -5
```

Expected: Shows `[gmaps-runner] Starting.` line (will fail on missing env vars but should not throw a syntax/parse error).

- [ ] **Step 6: Commit**

```bash
git add runner/gmaps-runner.js runner/package.json
git commit -m "feat: add runner/gmaps-runner.js (Playwright form fill + Twilio SMS)"
```

---

## Final Verification

- [ ] **Full TypeScript build check**

```bash
cd d:\Flow-Forges\lead-engine && npm run build
```

Expected: 0 TypeScript errors, all pages/routes compile.

- [ ] **Manual smoke test — queue API**

With the dev server running (`npm run dev`), log in as `super_admin`, navigate to `/gmaps-search`, select a business that has already been imported (or import one), then click "Add to Outreach". Verify:
- Toast shows "N added to outreach queue — pending runner"
- "QUEUED" badge appears on the card
- Check Supabase `gmaps_outreach_queue` table — row should exist with `status = "pending"`, `step_number = 1`

- [ ] **Manual smoke test — /outreach tab**

Navigate to `/outreach`. Verify:
- "LinkedIn Queue" and "GMap Outreach" tab buttons appear
- Clicking "GMap Outreach" loads stats (pipeline size, etc.)
- Queue table shows the row added in the previous step

- [ ] **Manual smoke test — /book tracking**

Open `/book?ref=gmaps&lid=gmaps_test123` in the browser. Complete the booking flow. Verify the submitted appointment in Supabase has `notes` containing `ref=gmaps&lid=gmaps_test123`.

- [ ] **Agent dispatch dry-run**

Trigger the agent manually via the Command Center "Run Now" button or:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://app.flow-forges.com/prospecting-os/api/agents/run?agent=gmaps-outreach-agent
```

Check `/admin/agents` — the GMap Outreach Agent card should show a recent run with `status = success`.
