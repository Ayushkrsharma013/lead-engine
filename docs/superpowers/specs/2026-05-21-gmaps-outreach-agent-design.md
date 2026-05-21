# GMap Outreach Agent — Design Spec

**Date:** 2026-05-21  
**Status:** Approved  
**Goal:** Automated client acquisition pipeline for the Missed Call Recovery Agent, targeting dentists, realtors, and home service businesses found via Google Maps.

---

## 1. Purpose

This system takes businesses already scraped into Supabase via the Google Maps prospecting feature (`source = 'gmaps'`) and runs a 2-touch outreach sequence to sell the Missed Call Recovery Agent ($297 setup + $97/mo):

1. **Day 1** — Playwright fills the business's website contact form with a personalized pitch
2. **Day 3** — If no booking detected, sends an SMS follow-up via Twilio to the phone number from Google Maps

All outreach flows through Telegram approval before execution. The local `runner/gmaps-runner.js` process (running on a home machine with a residential IP) executes the Playwright and SMS actions.

---

## 2. Architecture

```
gmaps-search results (existing)
        ↓
  "Add to Outreach" button on /gmaps-search
        ↓
POST /api/gmaps-outreach/queue
  - generates personalized messages (3 rating tiers)
  - inserts into gmaps_outreach_queue as pending
  - sends Telegram notification for approval
        ↓
GMap Outreach Agent (7 AM daily cron, existing dispatcher)
  - finds new gmaps leads not yet queued
  - queues contact_form_fill → medium risk → Telegram approval
  - detects day-3 follow-up eligibility → queues sms_follow_up → Telegram approval
  - writes stats to knowledge store
        ↓
resolver.ts (existing) dispatches approved agent actions
  → inserts into gmaps_outreach_queue with status=pending
        ↓
runner/gmaps-runner.js (local machine, home IP, polls every 5 min)
  ├── contact_form_fill → Playwright navigates website, finds + fills contact form
  └── sms_follow_up → Twilio REST API call (no Playwright)
        ↓
Business receives message with booking link:
  app.flow-forges.com/prospecting-os/book?type=discovery&ref=gmaps&lid={leadId}
        ↓
/book page saves ?ref + ?lid into appointments.notes
        ↓
Agent detects booking → moves lead to "Meeting" kanban → Telegram alert
```

**Reused from existing codebase:**
- `agents` dispatcher + cron
- Telegram approval flow + `resolver.ts` + `AgentAction` types
- `/book` booking page (5-step wizard)
- Playwright runner pattern (`runner/linkedin-runner.js` as template)
- Supabase queue pattern (`linkedin_queue`)
- `knowledge_store` for cross-agent coordination

**Net new:**
- `gmaps_outreach_queue` DB table
- `gmaps_outreach_stats` DB table
- `lib/agents/gmaps-outreach-agent.ts`
- `runner/gmaps-runner.js`
- `app/api/gmaps-outreach/queue/route.ts`
- `app/api/gmaps-outreach/stats/route.ts`
- "Add to Outreach" button on `/gmaps-search` page
- "GMap Outreach" tab on `/outreach` page
- `?ref` + `?lid` tracking in `/book` page

---

## 3. Database

### `gmaps_outreach_queue`

```sql
CREATE TABLE gmaps_outreach_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action_type    TEXT NOT NULL CHECK (action_type IN ('contact_form_fill', 'sms_follow_up', 'sms_final')),
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

-- RLS: service role only
ALTER TABLE gmaps_outreach_queue ENABLE ROW LEVEL SECURITY;
```

Unique constraint on `(lead_id, step_number)` prevents double-sending the same step.

### `gmaps_outreach_stats`

```sql
CREATE TABLE gmaps_outreach_stats (
  date           TEXT PRIMARY KEY,  -- "2026-05-21"
  forms_queued   INT NOT NULL DEFAULT 0,
  forms_sent     INT NOT NULL DEFAULT 0,
  sms_sent       INT NOT NULL DEFAULT 0,
  meetings_booked INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gmaps_outreach_stats ENABLE ROW LEVEL SECURITY;
```

---

## 4. Message Templates (3 Tiers)

Tier is determined at queue time from the lead's `notes` field (which stores `Rating: X/5 (N reviews)`).

**Tier A — High performer** (rating ≥ 4.5 AND reviews ≥ 100)
```
Subject/opener: dominant local player, after-hours capacity angle

"Hi [Business Name], I came across [Name] while researching top 
[industry]s in [city] — clearly you're doing great work with 
[N] reviews.

Quick question: what happens when a patient calls after hours and 
no one picks up? We built an AI agent that texts back within 60 
seconds, qualifies the lead, and books the appointment automatically.
Takes 48 hours to set up, no new software for your team.

Worth a 15-min call? [booking_url]

— Ayush Kumar, Flow Forges"
```

**Tier B — Growing** (rating 4.0–4.4 OR reviews 20–100)
```
Subject/opener: momentum angle, don't let missed calls stall growth

"Hi [Business Name], spotted [Name] while looking at [city] 
[industry]s. You've built solid reviews — missed calls are one 
of the fastest ways to stall that momentum.

Our AI agent responds to every missed call in under 60 seconds 
and books the appointment automatically. No extra staff needed.

Happy to show you how it works in 15 minutes: [booking_url]

— Ayush Kumar, Flow Forges"
```

**Tier C — Early stage** (rating < 4.0 OR reviews < 20)
```
Subject/opener: speed-to-respond competitive advantage

"Hi [Business Name], in [industry], the first business to call 
back wins the client — every time.

Our AI missed-call agent responds in under 60 seconds and books 
appointments automatically, even at midnight. Local [city] 
businesses using it are converting 40% more missed calls into 
paying clients.

15-minute demo: [booking_url]

— Ayush Kumar, Flow Forges"
```

**SMS follow-up (day 3, all tiers — 160 chars max):**
```
"Hi, I emailed [Business Name] about recovering missed calls 
with AI. Worth a quick 15-min call? [short_booking_url] 
— Ayush, Flow Forges"
```

**Booking URL format:**
```
https://app.flow-forges.com/prospecting-os/book?type=discovery&ref=gmaps&lid={leadId}
```

---

## 5. GMap Outreach Agent (`lib/agents/gmaps-outreach-agent.ts`)

Registered in `agents` table, enabled=true, runs in 7 AM daily dispatch batch.

### Run logic

**Step 1 — Find new prospects**
- Query `leads` where `source = 'gmaps'` AND `status NOT IN ('meeting', 'won')`
- Exclude `lead_id` values already present in `gmaps_outreach_queue`
- Require: `website` is non-empty OR `notes ILIKE '%Phone:%'`
- Sort by `score DESC`, cap at 30 per run
- Read `gmaps_outreach.daily_cap` from knowledge_store (default 30)

**Step 2 — Generate messages**
- Parse rating and review count from `lead.notes` (format: `Rating: X/5 (N reviews)`)
- Parse phone from `lead.notes` (format: `Phone: +1...`)
- Parse website from `lead.website`
- Determine tier (A/B/C) from rating + review count
- Substitute `[Business Name]`, `[city]`, `[industry]`, `[N]` from lead fields
- Append `?ref=gmaps&lid={lead.id}` to booking URL

**Step 3 — Queue as agent actions**
- Each prospect → `AgentAction` with:
  - `type: "gmaps_contact_form_fill"`
  - `riskLevel: "medium"`
  - `payload: { leadId, websiteUrl, phone, message, stepNumber: 1 }`
- Batch Telegram notification: "N GMap outreach forms ready — approve to send"

**Step 4 — Check follow-up eligibility**
- Query `gmaps_outreach_queue` where `step_number = 1`, `status = 'done'`, `executed_at < NOW() - INTERVAL '3 days'`
- For each: check `appointments` table for `notes ILIKE '%lid={leadId}%'` — skip if booked
- Remaining leads → `AgentAction` with `type: "gmaps_sms_follow_up"`, `riskLevel: "medium"`

**Step 5 — Write knowledge store**
- `gmaps_outreach.pipeline_size` — total leads in queue
- `gmaps_outreach.forms_sent_today` — count of done items today
- `gmaps_outreach.meetings_booked` — count of appointments with `notes ILIKE '%ref=gmaps%'`
- `gmaps_outreach.conversion_rate` — meetings_booked / forms_sent (as percentage string)

### Safe actions (auto-executed, no approval needed)
- `gmaps_update_lead_status` — move lead to "Meeting" kanban when booking detected
- `gmaps_log_activity` — write to `activity_log`

### resolver.ts additions
Two new action type handlers:
- `gmaps_contact_form_fill` → insert row into `gmaps_outreach_queue` (step 1)
- `gmaps_sms_follow_up` → insert row into `gmaps_outreach_queue` (step 2)

---

## 6. Local Runner (`runner/gmaps-runner.js`)

Standalone Node.js process. Runs on home machine. Polls `gmaps_outreach_queue` every 5 minutes for pending items.

### Contact form fill (Playwright)

```
1. Launch Chromium with stealth plugin (same as linkedin-runner)
2. Navigate to website_url (timeout 15s)
3. Find contact form — priority order:
   a. form[action*="contact"], form#contact, form.contact-form
   b. input[name*="message"] parent form
   c. Navigate to /contact, /contact-us, /get-in-touch via nav/footer links
4. Fill fields:
   - name field: "Ayush Kumar | Flow Forges"
   - email field: BUSINESS_EMAIL from .env
   - phone field: skip if not required
   - message/textarea: pre-generated message from queue
5. Submit form
6. Wait up to 5s for success indicator (thank you text, redirect, modal)
7. Mark status = "done", executed_at = now()
8. On failure: mark status = "failed", error = message, schedule retry once
9. If no form found: mark status = "skipped", error = "no_contact_form"
   (lead still eligible for SMS follow-up on day 3)
```

### SMS follow-up (Twilio REST, no Playwright)

```
1. Extract phone from queue item
2. POST to Twilio Messages API
3. Body: 160-char SMS template with booking URL
4. On success: mark done, store Twilio message SID in error field (repurposed as log)
5. On failure: mark failed, store error message
```

### Safety limits (`.env` configurable)

```
MAX_FORM_FILLS_PER_DAY=30
MAX_SMS_PER_DAY=20
ACTIVE_HOURS_START=9
ACTIVE_HOURS_END=18
# Weekends: skip automatically
```

### New dependency
- `twilio` npm package (for SMS API calls)

### Environment variables (`runner/.env`)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
BUSINESS_EMAIL=ayush@flow-forges.com
BOOKING_URL=https://app.flow-forges.com/prospecting-os/book?type=discovery
MAX_FORM_FILLS_PER_DAY=30
MAX_SMS_PER_DAY=20
ACTIVE_HOURS_START=9
ACTIVE_HOURS_END=18
```

---

## 7. API Routes

### `POST /api/gmaps-outreach/queue`
- Auth: `super_admin` or `qa_agent`
- Body: `{ leadIds: string[] }`
- For each leadId: fetch lead from DB, generate message (tier logic), insert into `gmaps_outreach_queue` as `pending`
- Send Telegram notification: "N businesses added to outreach queue — pending approval"
- Returns: `{ queued: N, skipped: M, reason: "already_queued | no_contact_method" }`

### `GET /api/gmaps-outreach/stats`
- Auth: `super_admin` or `qa_agent`
- Returns: pipeline stats from `gmaps_outreach_queue` + `gmaps_outreach_stats` + knowledge store
- Shape: `{ pipelineSize, formsQueuedToday, formsSentToday, smsSentToday, meetingsBooked, conversionRate }`

---

## 8. UI Additions

### `/gmaps-search` page
- "Add to Outreach" button appears when ≥1 business is selected (alongside existing "Import to Leads")
- Calls `POST /api/gmaps-outreach/queue`
- Shows toast: "N businesses added to outreach queue — pending Telegram approval"
- Businesses already in queue shown with a "Queued" badge in their card

### `/outreach` page
- New "GMap Outreach" tab alongside existing LinkedIn Queue tab
- Tab content:
  - 4 stat cards: Queued / Forms Sent / SMS Sent / Meetings Booked
  - Conversion rate card (forms sent → meetings %)
  - Queue table: business name, industry, city, step badge (Form/SMS), status badge, scheduled date, executed date

### `/book` page
- Read `?ref` and `?lid` query params on page load
- On appointment save: append `ref=gmaps&lid={value}` to `appointments.notes`
- Zero visible change to the booking experience

---

## 9. Booking Detection Flow

1. Business clicks `?ref=gmaps&lid={leadId}` link from message/SMS
2. `/book` page captures `lid` and saves in `appointments.notes` on submit
3. GMap Outreach Agent (next 7 AM run) queries:
   ```sql
   SELECT * FROM appointments 
   WHERE notes ILIKE '%lid={leadId}%' 
   AND created_at > {queue_item.executed_at}
   ```
4. Match found → queues `gmaps_update_lead_status` (safe_notify):
   - `leads.status = 'meeting'`
   - `leads.kanban_column = 'Meeting'`
   - Insert into `activity_log`: "Discovery call booked via GMap outreach"
5. Telegram alert: "New discovery call booked — [Business Name], [city] [industry]"

---

## 10. Error Handling

| Scenario | Behavior |
|---|---|
| Contact form not found | Mark `skipped`, still eligible for SMS day 3 |
| Website times out (>15s) | Mark `failed`, retry once next run |
| Twilio SMS fails | Mark `failed`, log error, no retry (avoid spam) |
| Lead has no website AND no phone | Skip entirely, log in agent run |
| Business already booked | Skip step 2 + step 3 entirely |
| Runner crash mid-fill | `resetStuckExecuting()` at start of each poll cycle (same pattern as linkedin-runner) |

---

## 11. Agent DB Registration

Insert into `agents` table on production (`tbsqpnqzpbnilifhwvgr`):

```sql
INSERT INTO agents (name, display_name, description, enabled, schedule, health_score, config)
VALUES (
  'gmaps-outreach-agent',
  'GMap Outreach Agent',
  'Queues contact form fills and SMS follow-ups for Google Maps businesses to sell Missed Call Recovery',
  true,
  '0 7 * * *',
  100,
  '{"daily_cap": 30, "sms_cap": 20}'
);
```

---

## 12. Files Changed / Created

| File | Status |
|---|---|
| `supabase/migrations/20260521_gmaps_outreach.sql` | NEW — gmaps_outreach_queue + gmaps_outreach_stats tables |
| `lib/agents/gmaps-outreach-agent.ts` | NEW — agent module |
| `lib/agents/resolver.ts` | MODIFY — add gmaps_contact_form_fill + gmaps_sms_follow_up dispatch |
| `app/api/gmaps-outreach/queue/route.ts` | NEW — POST queue endpoint |
| `app/api/gmaps-outreach/stats/route.ts` | NEW — GET stats endpoint |
| `app/gmaps-search/page.tsx` | MODIFY — Add to Outreach button |
| `app/outreach/page.tsx` | MODIFY — GMap Outreach tab |
| `app/book/page.tsx` | MODIFY — capture ?ref + ?lid params |
| `runner/gmaps-runner.js` | NEW — local Playwright + Twilio runner |
| `runner/package.json` | MODIFY — add twilio dependency |
| `runner/.env.example` | MODIFY — add Twilio + business email vars |
| `agents` DB table | MODIFY — insert gmaps-outreach-agent row |
