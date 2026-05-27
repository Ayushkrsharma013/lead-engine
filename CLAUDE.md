# Prospecting OS — CLAUDE.md

Project context and conventions for AI-assisted development.

**Important**: This project now shares its Supabase database with FlowForges (mark1). Both apps read/write from the same `leads`, `messages`, `sequences`, `campaigns`, `clients`, `activity_log`, `appointments`, and `email_captures` tables.

---

## What this project is

**Prospecting OS** (formerly LinkedIn ProOS) is a full-stack B2B prospecting platform built with Next.js 14, Supabase, Resend, and the Anthropic Claude API.  
It provides 11 integrated modules for lead management, AI-powered messaging, ICP scoring, automated outreach sequences, kanban pipeline, analytics, client management, booking, outreach execution, and admin dashboard.

All Tier 1 (auth/payments/onboarding), Tier 2 (sequence execution/reply tracking/A/B testing), and Tier 3 (rate limiting/error tracking/business analytics) are complete.

The **root route `/`** is a marketing landing page (Prospecting OS) with a separate layout — no sidebar, no admin chrome.  
The **app routes** (`/leads`, `/dashboard`, etc.) use the full Shell layout with ProSidebar + TopBar.
**Auth routes** (`/login`, `/signup`, `/onboarding`) use marketing layout (no sidebar).
**Client portal** (`/client-portal/*`) uses its own layout with a slim client sidebar (no admin chrome, plan-gated modules).
**Admin routes** (`/admin/*`) use the full Shell layout (super_admin only).
**Protected routes** are gated by middleware — unauthenticated users redirect to `/login`. Role-based redirects: client → /client-portal.

Repo: `github.com/Ayushkrsharma013/lead-engine`  
Live: deployed via Vercel from the `main` branch  
Base path: `/prospecting-os` (multi-zone under `app.flow-forges.com`)

---

## RBAC System

### Roles
| Role | Access | Default Destination |
|---|---|---|
| `super_admin` | Everything — all 11 modules + `/admin/*` + `/client-portal/*` | `/dashboard` |
| `client` | Client portal only — plan-gated modules | `/client-portal` |
| `qa_agent` | Both surfaces, no restrictions, bypasses PlanGate | `/dashboard` or `/client-portal` |
| `user` | None yet — redirects to login | `/login` |

### Role-based middleware routing
- **client** users are redirected away from `/dashboard`, `/leads`, `/message-lab`, `/scorer`, `/sequences`, `/kanban`, `/analytics`, `/clients`, `/outreach`, `/settings`, `/admin/*` → redirected to `/client-portal`
- **qa_agent** users have full access to both admin and client surfaces — no restrictions
- **super_admin** users have full access — can also view client portal to see what clients see
- Unauthenticated users → redirected to `/login?redirect=<original-path>`

### Plan module gating (PLAN_MODULES in lib/types.ts)
| Module | DIY Setup | Managed Growth | Managed Scale |
|---|---|---|---|
| Overview | ✓ | ✓ | ✓ |
| Leads (view) | ✓ | ✓ | ✓ |
| Leads (full) | ✗ | ✓ | ✓ |
| Icebreakers | ✗ | ✓ | ✓ |
| Analytics | ✗ | ✓ | ✓ |
| A/B Analytics | ✗ | ✗ | ✓ |
| Sequences | ✗ | ✗ | ✓ |
| CRM Sync | ✗ | ✗ | ✓ |
| Slack Digest | ✗ | ✓ | ✓ |
| Billing | ✓ | ✓ | ✓ |
| Settings | ✗ | ✓ | ✓ |

### Key RBAC files
- `lib/types.ts` — UserRole, PlanKey, PLAN_MODULES, UserProfile, ClientWorkspace, QASession
- `lib/auth.ts` — Server-side: isRole, requireRoleApi, requireAuth, signOut
- `lib/plan-gate.ts` — Client-safe: canAccessModule (no server imports)
- `middleware.ts` — Role-based routing (client → /client-portal, qa_agent → both surfaces)
- `app/admin/users/` — User Management Panel (super_admin only)
- `app/client-portal/` — Client Portal (client + qa_agent + super_admin)
- `components/client-portal/PlanGate.tsx` — Plan-gated module wrapper (qa_agent bypasses)
- `app/api/admin/users/` — User CRUD API (super_admin writes, qa_agent reads)
- `app/api/client-portal/` — Client-scoped API (user_id scoping on all queries)

### QA Agent credential
- Email: qa@flow-forges.com (created post-deploy via `POST /api/admin/users`)
- Role: qa_agent — bypasses all PlanGate checks, accesses both surfaces
- Used by: tests/scenarios/rbac.sh QA test suite

---

## Shared Database Architecture

Both Lead Engine and FlowForges (mark1) point to the **same Supabase project**:
- **Project**: `mark1-flowforges` (`otxifqcvgmxoxemmgbjd`), region ap-south-1 — local development
- **Production**: `lead-engine` (`tbsqpnqzpbnilifhwvgr`), region us-east-1 — Vercel deployment
- **Tables shared**: `leads`, `messages`, `sequences`, `campaigns`, `clients`, `activity_log`, `lead_activity_log`, `appointments`, `email_captures`
- **RBAC tables**: `profiles`, `client_workspaces`, `qa_sessions`, `finance_agent_log` (on both projects)
- **Important**: When creating users or applying migrations, ensure you target the correct project. Vercel env uses `lead-engine` project keys.

### Why shared?
- FlowForges AI employees (Atlas, Echo, etc.) read and manage leads from the same pool
- Pipeline Kanban in FlowForges shows leads scraped by Lead Engine (and vice versa)
- Avoids data silos and sync complexity

### Auth implications
- Both apps now use Supabase SSR Auth (cookies via `@supabase/ssr`) with shared `auth.users` and `profiles` tables
- **lead-engine middleware** (`middleware.ts`) mirrors mark1 — sets `x-user-*` headers on every request from the profiles table
- **Public routes**: `/`, `/book`, `/book/admin`, `/login`, `/signup`, `/onboarding`, `/api/*`, `/portal/*`
- **Protected routes**: `/dashboard`, `/leads`, `/message-lab`, `/scorer`, `/sequences`, `/kanban`, `/analytics`, `/clients`, `/outreach`, `/settings`
- **Redirect logic**: unauthenticated → `/prospecting-os/login?redirect=<original-path>`; authenticated on `/login` → `/prospecting-os/dashboard`
- **Roles**: `super_admin`, `client`, `user` (default new-user role)
- **RLS**: `user_id` columns added to leads/messages/sequences/campaigns with RLS policies — data isolation by `auth.uid()`
- **Required env var**: `SUPABASE_SERVICE_ROLE_KEY` (from FlowForges Supabase dashboard)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Language | TypeScript 5 — strict mode ON |
| Styling | Tailwind CSS 3 + CSS variables (dark + light themes) + `app/landing.css` (marketing page) |
| Fonts | Landing: Cabinet Grotesk + JetBrains Mono + Instrument Serif. App: Geist + Geist Mono |
| Database | Supabase (Postgres) — shared with FlowForges |
| Auth | Supabase SSR (`@supabase/ssr`) — cookie-based, mirrors mark1 middleware pattern |
| Payments | Xflow Pay — manual activation via Finance Agent |
| State | React Context + useReducer (`lib/AppContext.tsx`) |
| Realtime | Supabase Realtime on leads table |
| Icons | lucide-react ^0.400.0 (outline variants only, 16-18px; no emoji characters) |
| Charts | recharts (Analytics module) |
| Drag & Drop | @hello-pangea/dnd (Kanban module) |
| Animations | framer-motion (sidebar collapsible sections, active pill, hover effects) |
| AI | Anthropic Claude API (server-side: scoring, icebreakers, Message Lab) + Gemini 2.5 Flash (browser: Scorer, A/B variants) |
| Lead scraping | Apify actor `x_guru~Leads-Scraper-apollo-zoominfo` |
| Email | Resend HTTP API — sequence dispatch + booking notifications + inbound webhooks |
| Scheduling | Vercel Cron Jobs — 5 daily crons at 6/6/7/8/9 AM (`vercel.json`) |
| Error tracking | `lib/error-tracking.ts` — Supabase error_logs table + optional Sentry |
| Google Drive | Google Identity Services (GIS) — client-side OAuth |
| Browser testing | agent-browser CLI (Vercel) — screenshots gitignored |
| Deploy | Vercel (auto-deploys on push to `main`) |
| MCP | Supabase MCP server configured in `.mcp.json` for DB migrations |

---

## Project structure

```
lead-engine/
├── middleware.ts                 # Auth middleware — protects admin routes, sets x-user-* headers
├── next.config.mjs               # basePath: '/prospecting-os', assetPrefix
├── vercel.json                   # Cron: digest(6AM) + apify-scrape(6AM) + agents(7AM) + sequences(8AM) + finance(9AM)
├── supabase-migration.sql        # Full DB schema + RLS policies + auth columns
├── .env.example                  # All required environment variables
├── .mcp.json                     # MCP servers: ruflo + supabase
├── package.json                  # Dependencies including @supabase/ssr, recharts
├── app/
│   ├── layout.tsx              # Root layout — AppProvider + Shell + font imports
│   ├── page.tsx                # Marketing landing page (3 tiers, ROI calculator, ProsBot)
│   ├── globals.css             # App CSS variables (dark/light), scrollbar
│   ├── landing.css             # Landing page styles (.landing-page, accent #e8420a)
│   ├── login/page.tsx           # Login page (marketing layout, Supabase SSR auth)
│   ├── signup/page.tsx          # Signup page → redirects to onboarding
│   ├── onboarding/page.tsx      # 4-step wizard: Welcome → ICP → API Keys → Plan & Pay
│   ├── book/
│   │   ├── page.tsx             # 5-step booking wizard (Type→Date→Time→Details→Confirm)
│   │   └── admin/page.tsx       # Appointment manager (stats, filters, cancel)
│   ├── dashboard/page.tsx       # Command Center (stats, charts, activity)
│   ├── leads/page.tsx           # Lead Intelligence (scrape, filter, export)
│   ├── message-lab/page.tsx     # AI Message Lab (Gemini-generated outreach + A/B variants)
│   ├── scorer/page.tsx          # AI Lead Scorer (ICP scoring ring)
│   ├── sequences/page.tsx       # Sequence Builder (drag-and-drop timeline)
│   ├── kanban/page.tsx          # Kanban Pipeline (7-column DnD board)
│   ├── analytics/page.tsx       # Analytics (4 Recharts visualizations)
│   ├── clients/page.tsx         # Client Manager (agency mode CRUD)
│   ├── outreach/page.tsx        # LinkedIn Outreach (OpenOutreach sync)
│   ├── settings/page.tsx        # Settings (API keys, sources, preferences)
│   ├── admin/
│   │   └── users/
│   │       ├── page.tsx          # User management — table, filters, create modal
│   │       └── [id]/page.tsx     # Single user detail — profile, plan, activity, QA tabs
│   ├── client-portal/
│   │   ├── layout.tsx            # Separate layout — clean pass-through for /login, sidebar for authenticated
│   │   ├── page.tsx              # Plan-gated dashboard — DIY/Growth/Scale sections
│   │   ├── login/page.tsx        # Public login page matching main /login design
│   │   ├── leads/page.tsx        # Lead report viewer (read-only, score filters, CSV export)
│   │   ├── icebreakers/page.tsx  # Icebreaker viewer (Growth+)
│   │   ├── analytics/page.tsx    # Status breakdown + industry bars (Growth+)
│   │   ├── sequences/page.tsx    # Sequences running for client (Scale only)
│   │   ├── slack/page.tsx        # Slack digest config (Growth+)
│   │   ├── billing/page.tsx      # Plan details, payment ref, upgrade CTA
│   │   └── settings/page.tsx     # ICP preferences, score thresholds
│   └── api/
│       ├── leads/route.ts       # POST — Apify scraping proxy
│       ├── leads/import/route.ts  # POST — import past Apify runs
│       ├── leads/capture/route.ts # POST — email capture
│       ├── appointments/route.ts  # GET/POST/PATCH — booking CRUD with validation
│       ├── auth/google-calendar/   # Google Calendar OAuth (connect/status/callback)
│       ├── outreach/               # OpenOutreach status/sync endpoints
│       ├── agent/telegram/route.ts # Telegram bot webhook
│       ├── cron/sequence-runner/   # GET — Vercel Cron: processes due sequence steps
│       ├── cron/apify-scrape/      # GET — Vercel Cron: scheduled Apify scrape (6 AM)
│       ├── sequence/launch/        # POST — launch sequence for assigned leads
│       ├── sequence/cancel/        # POST — pause/cancel sequence executions
│       ├── sequences/route.ts      # GET — list sequences [{id, name}] for bulk picker
│       ├── inbound-email/          # POST — Resend webhook: reply + open/click/bounce tracking
│       ├── agents/knowledge/       # GET — knowledge store lookup (?key=) or full list
│       ├── admin/users/
│       │   ├── route.ts               # GET list + POST create (super_admin only)
│       │   ├── [id]/route.ts          # GET/PATCH/DELETE single user
│       │   ├── [id]/activate/route.ts # POST — manually activate client plan
│       │   └── [id]/impersonate/route.ts # POST — generate impersonation magic link
│       ├── clients/route.ts          # POST — create client with auto credentials + email
│       ├── client-portal/
│       │   ├── me/route.ts            # GET current client's profile + workspace + modules (SSR auth)
│       │   ├── dashboard/route.ts     # GET plan-gated dashboard data (stats, breakdowns, funnel)
│       │   ├── leads/route.ts         # GET client's leads (scoped by user_id)
│       │   └── icebreakers/route.ts   # GET client's icebreaker-enriched leads
│       ├── settings/scheduler/     # GET|POST — Apify scheduler config (super_admin)
│       └── analytics/
│           ├── business/           # GET — MRR, churn rate, conversion stats
│           └── variant-stats/      # GET — A/B variant reply rate comparison
├── components/
│   ├── Shell.tsx               # Marketing vs admin layout router (client-portal uses own layout)
│   ├── Navbar.tsx              # Landing navbar (scroll-aware glass morphism, auth-aware Sign In/Dashboard links)
│   ├── client-portal/
│   │   └── PlanGate.tsx        # Plan-gated module wrapper (qa_agent bypasses)
│   ├── ProsBotPanel.tsx        # Conversational booking chatbot (9-state machine)
│   ├── AgentPanel.tsx          # Right sidebar AI assistant (Gemini-powered)
│   ├── EmailCaptureModal.tsx   # Exit-intent email capture modal
│   ├── FilterPanel.tsx         # Lead filter sidebar (multi-select chips)
│   ├── LeadsTable.tsx          # Sortable/paginated leads table
│   ├── Toast.tsx               # Toast notification system
│   ├── Pagination.tsx          # Pagination controls
│   ├──ImportModal.tsx          # Apify run import modal
│   ├── GDriveModal.tsx         # Google Drive export modal
│   ├── layout/                 # Sidebar, TopBar, ThemeToggle, CommandPalette, NotificationBell
│   ├── auth/                   # LogoutButton
│   └── ui/                     # Button, Badge, Input, Select, Switch, Progress, Chip, etc.
├── lib/
│   ├── types.ts                # All shared types: Lead, Message, Sequence, Campaign, Client,
│   │                           #   Appointment, MeetingType, AppointmentInput, IcpPreferences
│   ├── supabase.ts             # Supabase clients: `supabase` (anon) + `supabaseAdmin` (service role)
│   ├── supabase/server.ts      # SSR-compatible server client (cookie-based)
│   ├── supabase/client.ts      # Browser client for login/signup
│   ├── auth.ts                 # getUserFromHeaders, requireAuth, getSession, requireAuthApi
│   ├── db.ts                   # Typed data access layer (uses supabaseAdmin)
│   ├── storage.ts              # validateLead, sanitizeLead, generateCSV, stableLeadId
│   ├── filters.ts              # Client-side lead filtering + sorting
│   ├── AppContext.tsx           # Global state: leads, messages, sequences, campaigns, clients
│   ├── stripe.ts               # PLANS definitions, PlanKey type (diy/growth/scale)
│   ├── xflow.ts                 # Payment reference generator (generatePaymentRef)
│   ├── plan-gate.ts             # Client-safe canAccessModule — no server imports
│   ├── notify.ts               # Telegram + Resend email notifications (5 functions)
│   ├── booking-chat.ts         # ProsBot conversational state machine (9 steps)
│   ├── onboarding.ts           # Onboarding state machine, ICP option lists
│   ├── google-calendar.ts      # Server-side Google Calendar API + OAuth
│   ├── google-drive.ts         # Client-side Google Drive upload (GIS OAuth)
│   ├── openoutreach.ts         # OpenOutreach data model mapper
│   ├── sequence-engine.ts      # Core: template resolution, launch, cron processor, reply tracking
│   ├── resend.ts               # Reusable Resend HTTP client (sendEmail)
│   ├── rate-limit.ts           # Per-user daily scrape/email caps + X-RateLimit headers
│   ├── error-tracking.ts       # captureError → Supabase error_logs + optional Sentry
│   ├── api-auth.ts             # Legacy Bearer token validation
│   ├── nav.ts                  # Landing nav items (Features, Pricing, FAQ)
│   ├── seed.ts                 # Sample lead seeding for empty DB
│   ├── mock-data.ts            # Pre-defined mock leads
│   └── utils.ts                # cn() classname merger
├── scripts/
│   ├── setup-appointments.ts    # Create appointments/email_captures tables
│   ├── create-table.js          # Same as above (CommonJS)
│   └── sync-openoutreach.mjs    # OpenOutreach SQLite → Supabase sync
└── tests/
    ├── sanity.sh                # QA_Bot test runner
    └── scenarios/               # landing-page, api, dashboard, booking-flow tests
```

---

## Key types (`lib/types.ts`)

```typescript
interface Lead {
  id: string; name: string; title: string; company: string;
  industry: string; location: string;
  email: string; emailStatus: "verified" | "risky" | "not_found";
  linkedin: string; website: string; companySize: string;
  score: number;                     // 0-100
  source: "linkedin" | "gmaps" | "amazon";
  savedAt?: string; fetchedAt?: string; tags?: string[];
  kanbanColumn?: string;             // "New"|"Contacted"|"Replied"|"Hot Lead"|...
  status?: "new"|"contacted"|"replied"|"hot"|"meeting"|"won"|"lost";
  notes?: string; lastTouched?: string;
}

interface Message {
  id: string; leadId: string; subject: string; body: string;
  tone: string; messageType: "linkedin_connection"|"linkedin_dm"|"cold_email"|...;
  charCount?: number; createdAt?: string;
}

interface Sequence {
  id: string; name: string; steps: SequenceStep[];
  assignedLeadIds: string[]; createdAt?: string; updatedAt?: string;
}

interface SequenceStep {
  day: number; channel: "linkedin"|"email"; type: string;
  template: string; active: boolean;
  variants?: string[];               // A/B test alternative templates
}

interface SequenceExecution {
  id: string; sequenceId: string; leadId: string;
  currentStep: number; variant: string;
  status: "active"|"paused"|"completed"|"cancelled";
  startedAt: string; lastActionAt: string;
}

interface SequenceMessage {
  id: string; executionId: string; leadId: string;
  stepIndex: number; channel: "email"|"linkedin";
  subject: string; body: string;
  status: "sent"|"failed"|"bounced"|"skipped"|"replied";
  resendId?: string; variant?: string;
}

interface Campaign {
  id: string; name: string; targetIndustry: string;
  status: "active"|"paused"|"complete"; leadIds: string[]; createdAt?: string;
}

interface Client {
  id: string; name: string; company: string; industry: string;
  monthlyRetainer: number; status: "active"|"inactive";
  email?: string; portalUsername?: string; portalPassword?: string;
  plan?: PlanKey; createdAt?: string;
}

interface ActivityLogEntry {
  id: string; type: "lead_added"|"message_sent"|"scored_hot"|"meeting_booked"|"lead_moved"|"notification";
  text: string; leadId?: string; createdAt?: string;
}

type ModuleName = "dashboard"|"leads"|"message-lab"|"scorer"|"sequences"|"kanban"|"analytics"|"clients";
```

---

## Database — Supabase (Shared with FlowForges)

**Project**: `mark1-flowforges` (`otxifqcvgmxoxemmgbjd`)

### Tables (shared)

| Table | Key columns | Notes |
|---|---|---|
| `leads` | `id TEXT PK`, email_status, score, source, kanban_column, status, notes, user_id | RLS enabled (user-scoped). Shared with FlowForges |
| `messages` | `id UUID PK`, lead_id FK, subject, body, tone, message_type | CASCADE delete |
| `sequences` | `id UUID PK`, name, steps JSONB, assigned_lead_ids JSONB | — |
| `campaigns` | `id UUID PK`, name, target_industry, status, lead_ids JSONB | — |
| `clients` | `id UUID PK`, name, company, industry, monthly_retainer, status, email, portal_username, portal_password, plan | Email + auto-generated credentials + plan tier for client portal |
| `activity_log` | `id UUID PK`, type, text, lead_id UUID | Ordered by created_at DESC |
| `lead_activity_log` | `id UUID PK`, user_id, type, text, lead_id | Lead-specific activity |
| `email_captures` | `id UUID PK`, email TEXT UNIQUE, source TEXT, created_at | Public insert RLS policy |
| `appointments` | `id UUID PK`, date TEXT, time TEXT, name TEXT, email TEXT, company TEXT, notes TEXT, created_at | Public insert RLS policy |
| `sequence_executions` | `id UUID PK`, sequence_id FK, lead_id FK, current_step, status, variant, started_at, last_action_at | RLS enabled (user-scoped). Tracks each lead per sequence run |
| `sequence_messages` | `id UUID PK`, execution_id FK, lead_id, step_index, channel, subject, body, status, resend_id, variant | RLS enabled (user-scoped). Outbound message log |
| `error_logs` | `id UUID PK`, message, stack, source, url, user_id, metadata, created_at | RLS enabled (super_admin only) |
| `profiles` | `id UUID PK REFERENCES auth.users`, email, full_name, display_name, avatar_url, role, subscription_status, plan, onboarding_complete, icp_preferences JSONB, apify_key, payment_ref, payment_method, subscription_activated_at, xflow_transaction_id, is_active, last_login_at, notes, created_by | RLS enabled (self + super_admin) |
| `client_workspaces` | `id UUID PK`, client_user_id FK, plan, icp_config JSONB, leads_count, last_sync_at, slack_webhook, settings JSONB | RLS enabled (self + super_admin + qa_agent) |
| `qa_sessions` | `id UUID PK`, surface, test_suite, status, results JSONB, started_at, ended_at, triggered_by FK | RLS enabled (super_admin + qa_agent only) |
| `finance_agent_log` | `id UUID PK`, event_type, profile_id FK, payload JSONB, telegram_msg_id, status, created_at, updated_at | RLS enabled |

### Data access layer (`lib/db.ts`)

All functions use `supabaseAdmin` (service role) to bypass RLS:

```typescript
// Leads
fetchLeadsFromDB() → Promise<Lead[]>
mergeLeadsInDB(incoming: Lead[]) → Promise<MergeResult>
deleteLeadsFromDB(ids: string[]) → Promise<Lead[]>
batchUpdateLeadStatus(ids, status) → Promise<Lead[]>
computeStatsFromLeads(leads) → Promise<Stats>

// Messages
getMessages(leadId?) → Promise<Message[]>
addMessage(msg) → Promise<Message>

// Sequences
getSequences() → Promise<Sequence[]>
saveSequence(seq) → Promise<Sequence>
deleteSequence(id) → Promise<void>

// Campaigns
getCampaigns() → Promise<Campaign[]>
saveCampaign(c) → Promise<Campaign>

// Clients
getClients() → Promise<Client[]>
saveClient(c) → Promise<Client>
updateClient(id, updates) → Promise<Client>

// Activity Log
getActivityLog(limit?) → Promise<ActivityLogEntry[]>
logActivity(entry) → Promise<void>

// Sequence Executions
getSequenceExecutions(sequenceId?) → Promise<SequenceExecution[]>
getDueExecutions() → Promise<SequenceExecution[]>
createSequenceExecutions(rows) → Promise<SequenceExecution[]>
updateSequenceExecution(id, updates) → Promise<SequenceExecution>

// Sequence Messages
getSequenceMessages(executionId?) → Promise<SequenceMessage[]>
insertSequenceMessage(msg) → Promise<SequenceMessage>
findSequenceMessageByResendId(resendId) → Promise<SequenceMessage | null>
updateSequenceMessageStatus(id, status) → Promise<void>
hasRecentMessages(minutesAgo?) → Promise<boolean>  // cron overlap lock

// Leads (extended)
findLeadByEmail(email) → Promise<Lead | null>
batchUpdateLeadKanban(leadIds, column, status) → Promise<void>

// Analytics
getVariantStats(sequenceId) → Promise<VariantStat[]>
```

---

## Global state — AppContext (`lib/AppContext.tsx`)

React Context + useReducer wrapping the entire app in `layout.tsx`.

**State shape:**
```typescript
interface AppState {
  leads, latestLeads, messages, sequences, campaigns, clients, activityLog: [];
  apiKey: string;                   // in-memory ONLY — never persisted
  theme: "dark"|"light";            // persisted to localStorage("leados_theme")
  sidebarCollapsed: boolean;        // persisted to localStorage("leados_sidebar")
  settingsOpen: boolean;            // Settings modal visibility
  enabledSources: EnabledSources;   // per-source toggle — persisted to localStorage("leados_sources")
  activeModule: ModuleName;
  notifications: Notification[];
  loading: boolean;
  selected: string[]; filters: FilterState; sort: SortState;
  pagination: PaginationState; tab: "all"|"latest"; source: Source;
  mock: boolean; running: boolean; log: LogEntry[]; progress: number;
  toast: { msg, type } | null; stats: Stats;
}
```

**Key behaviors on mount:**
1. Read theme + sidebar from localStorage
2. Seed sample data if leads table is empty (`seedIfEmpty()`)
3. Fetch all leads from Supabase → dispatch `SET_LEADS`
4. Subscribe to Supabase Realtime on `leads` table → re-fetch on any change
5. Set `loading = false`

**Critical rule**: `apiKey` is stored in React state ONLY. Never written to localStorage, Supabase, or logs.

---

## CSS design system

### Variables (defined in `app/globals.css`)

| Variable | Dark (default) | Light |
|---|---|---|
| `--bg` | `#060608` | `#f8f8f6` |
| `--surface` | `#0d0d12` | `#ffffff` |
| `--surface2` | `#13131a` | `#f1f1ef` |
| `--border` | `#1e1e2e` | `#e2e2e0` |
| `--text` | `#e8e8f0` | `#1a1a2e` |
| `--muted` | `#6b6b80` | `#6b6b80` |

### Accent constants

| Variable | Value | Usage |
|---|---|---|
| `--accent-blue` | `#00d4ff` | Primary CTAs, active sidebar, linkedin source |
| `--accent-purple` | `#7c3aed` | AI features (Message Lab) |
| `--accent-orange` | `#ff6b35` | Hot leads, alerts, Scorer, amazon source |
| `--accent-green` | `#00ff88` | Success, verified, gmaps source |

Theme is applied via `data-theme="light"` attribute on `<html>`.

### Tailwind color mapping

```
bg-bg          → var(--bg)
bg-surface     → var(--surface)
bg-surface-2   → var(--surface2)
border-border  → var(--border)
text-text      → var(--text)
text-muted     → var(--muted)
bg-accent-blue → var(--accent-blue)
text-accent-blue → var(--accent-blue)
```

### Design rules

- Use CSS variable-based Tailwind classes everywhere
- Lucide icons: outline variants only, `size={16}` or `size={18}`
- Transitions: 150-200ms ease on interactive elements
- Border radius: 6-8px cards/buttons, 12px modals
- Modals: `bg-black/60 backdrop-blur-sm` overlay
- Scrollbar: 4px wide, transparent track, white/10 thumb

---

## Module routing

| Route | Module | Key features |
|---|---|---|
| `/` | Landing Page | Marketing page — no sidebar/shell chrome |
| `/book` | Appointment Scheduling | Multi-step booking flow |
| `/leads` | Lead Intelligence | Filter sidebar, leads table, agent run, CSV/Drive export |
| `/dashboard` | Command Center | Stats, activity feed, campaigns |
| `/message-lab` | AI Message Lab | Gemini-powered generation, A/B variant mode, typewriter |
| `/scorer` | Lead Scorer | ICP criteria, SVG score ring |
| `/sequences` | Sequence Builder | Timeline DnD, Launch/Pause/Cancel, execution status, A/B variant editor, variant stats |
| `/kanban` | Kanban Pipeline | 7 columns, DnD, detail panel, auto-moves on send/reply |
| `/analytics` | Analytics | 4 recharts, date filters, variant stats endpoint |
| `/clients` | Client Manager | CRUD, email field, plan selector, auto-credentials via Resend |
| `/client-portal` | Client Portal | Plan-gated dashboard, leads, icebreakers, analytics, sequences, slack, billing, settings |
| `/client-portal/login` | Client Portal Login | Matches main /login design — glass card, Logo_Icon, Supabase SSR auth |

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL (shared with FlowForges) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Supabase anon key (shared with FlowForges) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | **Required** — service role for server-side DB ops (bypasses RLS) |
| `APIFY_API_KEY` | Vercel + `.env.local` | Required for live lead scraping |
| `RESEND_API_KEY` | Vercel + `.env.local` | Email notifications (booking confirmations, cancellations) |
| `NOTIFY_EMAIL` | Vercel + `.env.local` | Admin email for booking notifications |
| `TELEGRAM_BOT_TOKEN` | Vercel + `.env.local` | Optional — Telegram booking alerts |
| `TELEGRAM_CHAT_ID` | Vercel + `.env.local` | Optional — Telegram chat for booking alerts |
| `GOOGLE_CLIENT_ID` | Vercel + `.env.local` | Optional — Google Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Vercel + `.env.local` | Optional — Google Calendar OAuth |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | Vercel + `.env.local` | Optional — Google Calendar refresh token |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel + `.env.local` | Optional — Cloudflare Turnstile CAPTCHA |
| `NEXT_PUBLIC_SITE_URL` | Vercel + `.env.local` | Canonical URL for OAuth callbacks |
| `CRON_SECRET` | Vercel + `.env.local` | Optional — bearer token to secure cron endpoints |
| `SENTRY_DSN` | Vercel + `.env.local` | Optional — Sentry DSN for error forwarding |

The Anthropic API key is entered by the user in the UI and stored in React state only (never persisted). Gemini API key is stored in localStorage for browser-side AI features (Scorer, A/B variants).

---

## Development commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build — must pass with 0 errors
npm run lint     # ESLint check
bash tests/sanity.sh                       # QA_Bot full sanity suite
```

---

## Deployment

- **Trigger**: push to `main` branch on GitHub
- **Platform**: Vercel (project: `lead-engine`)
- **Build command**: `npm run build`
- **Required env vars on Vercel**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APIFY_API_KEY`
- **Auth env vars**: `NEXT_PUBLIC_SITE_URL` (for redirect URLs)
- **Email/notify env vars**: `RESEND_API_KEY`, `NOTIFY_EMAIL`, `TELEGRAM_BOT_TOKEN` (optional), `TELEGRAM_CHAT_ID` (optional)
- **Google Calendar env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN` (optional)
- **CAPTCHA env var**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (optional — Cloudflare Turnstile)

---

## Completed Phases

| Phase | Feature | Date |
|-------|---------|------|
| 1–3 | Auth, payments, onboarding, booking | 2026-05-16 |
| 4 | Finance Agent, Stripe removal, auth redesign | 2026-05-16 |
| 5–7 | Sequence execution engine, reply tracking, A/B testing, rate limiting, error tracking | 2026-05-16 |
| 8–14 | Hot leads, Apify scheduler, score decay, email engagement, A/B winner, bulk ops, knowledge store | 2026-05-18 |
| 15 | LinkedIn Queue System (local runner) | 2026-05-20 |
| 16 | Multi-currency MRR tracking | 2026-05-19 |
| W1–W4 | Agentic Workforce: 8 agents, knowledge store, guardrails, Command Center | 2026-05-17 |
| P0 | Unblock $997 funnel — booking/payment/checkout/RLS hardening | 2026-05-26 |
| Trust | JSON-LD, analytics, GDPR consent, llms.txt, legal pages | 2026-05-26 |
| Delivery | Micro plan onboarding, portal smoke, delivery SLA agent | 2026-05-26 |
| Phase 6 | Superadmin safety + client-portal audit remediation | 2026-05-27 |
| Tools | Icebreaker + Free Audit with Navbar, Footer, custom dropdowns, rate-limit fixes | 2026-05-27 |
| N8N | 5 n8n workflows built, Vercel→n8n wired, credentials pushed to Hetzner | 2026-05-26/27 |

### Credentials
- Super admin: ayushkumarsharma013@gmail.com / Pro2026!Secure
- QA agent: qa@flow-forges.com / QA2026!Secure

### Key Architecture Decisions
- `full_name` → `display_name` throughout (profiles table uses display_name)
- `motion(Link)` for basePath-safe animated links (no hardcoded `/prospecting-os` in `<a>` tags)
- Custom `ToolDropdown` component (zero native `<select>`/`<ul>`/`<li>` in tools)
- Rate-limit records inserted BEFORE external API calls (fail-safe)
- Email/Telegram notifications fire-and-forget after DB writes
- Middleware: fail-closed subscription check, `effectiveRole = role || "user"`, hoisted supabaseAdmin
- Gemini 2.5 Flash: `thinkingConfig: { thinkingBudget: 0 }`, extract with `parts.find(p => !p.thought)`

---

## Recent Sessions

### 2026-05-26 — Launch Readiness Swarm (6 Phases + n8n Automation Engine)

**Full Audit** — 5 dimensions scored:
- Build & TypeScript: 10/10 (0 errors, 125 routes)
- Payments: 1/10 (manual bank transfer only, no gateway configured)
- Content Accuracy: 4/10 (metadata referenced wrong stack: "Sales Navigator + Gemini AI")
- Auth & Security: 6/10 (works, but gaps: user role escalation, cron auth bypass)
- Overall: 5.8/10

**Phase 1 — Payment Wiring** (`35f1d99`):
- `lib/types.ts` — PlanKey fixed to include `'scale'`, PLAN_MODULES rebalanced (scale=full access, micro=basic)
- `app/api/payment/create-checkout/route.ts` — PLAN_URLS now maps scale with EASEBUZZ_SCALE_URL
- Env vars needed on Vercel: EASEBUZZ_PILOT_URL, EASEBUZZ_GROWTH_URL, EASEBUZZ_SCALE_URL, EASEBUZZ_MICRO_URL

**Phase 2 — Content Accuracy** (`35f1d99`):
- `app/layout.tsx` — Metadata: description, keywords, OG, Twitter all now reference Apify + Claude (not Sales Navigator + Gemini)
- `app/api/chat/bot/route.ts` — System prompt rewritten: pipeline source, scoring, tech stack, data delivery, plans/pricing all corrected
- `lib/booking-chat.ts` — Replaced "Sales Navigator" → "Apify scrapers", updated pricing references
- `app/tools/icebreaker-generator/page.tsx` — "Gemini AI" → "Claude AI"
- `components/landing/LandingFooter.tsx` — Fixed tech stack reference
- `components/tools/AuditForm.tsx`, `components/tools/IcebreakerGenerator.tsx` — Updated references
- `app/tools/free-audit/page.tsx` — "Google Sheet" → "report"
- `app/api/tools/audit-request/route.ts` — Fixed email copy
- `app/leads/page.tsx` — Removed "Open Google Sheets" popup after CSV export
- **Content sweep**: zero "Sales Navigator", "Gemini AI", "Google Sheet" across all .ts/.tsx files

**Phase 3 — Trust & Pricing** (`35f1d99`):
- `app/page.tsx`:
  - Live counter: removed random increment interval, now shows static "delivered to pilot clients"
  - Pipeline cards: "LIVE" badge → "Example Pipeline"
  - Aggregate rating schema: removed fake 4.8★/27 reviews
  - ROI calculator: $997 → $999 (correct Growth monthly rate)
  - Footer: "Pro plan" → "Every managed plan"
  - FAQ: fixed duplicated "Growth:" → "Scale:" for enterprise timeline
  - FAQ link: `/pricing` → `#pricing`
  - Schema offers: removed phantom "Advanced — Full AI SDR" ($10,000), added Micro-Offer
  - Schema FAQ: "Pro plan"/"Basic plan"/"Advanced" → "Pilot"/"Growth"/"Scale"
  - Chat quick replies: "What does Pro plan include?" → "What plans are available?"
- `components/landing/ComparisonTable.tsx` — CTA: `/prospecting-os/book` → `/book`

**Phase 4 — Scale Plan Integration** (`35f1d99`):
- `app/onboarding/page.tsx` — Added Scale plan card with purple ENTERPRISE badge, synced PLANS_DATA with lib/stripe.ts
- `lib/types.ts` — PlanKey now `'pilot' | 'growth' | 'scale' | 'micro'`

**Phase 5 — Security Hardening** (`35f1d99`):
- `middleware.ts` — `user` role now blocked from superAdminOnly paths, redirected to /dashboard (was bypassing role check entirely)
- `app/api/cron/apify-scrape/route.ts` — CRON_SECRET now mandatory (returns 500 if not configured, 401 if wrong)
- `app/api/cron/invoice-agent/route.ts` — Same mandatory CRON_SECRET enforcement
- `app/api/cron/blog-writer/route.ts` — Same mandatory CRON_SECRET enforcement
- `app/api/agent/finance/cron/route.ts` — Same mandatory CRON_SECRET enforcement
- `lib/api-auth.ts` — Added comment documenting that NEXT_PUBLIC_SUPABASE_ANON_KEY is not a secret, with compensating IP-based rate limiting noted

**Phase 6 — UX Polish** (`35f1d99`):
- `app/globals.css` — Accent color standardized to `#e8420a` (orange) in both dark and light themes
- `components/layout/Sidebar.tsx` — Gold references updated to orange `#e8420a`
- `components/landing/LandingFooter.tsx` — Fixed and wired into `app/page.tsx` (was orphaned)
- `components/Shell.tsx` — Blog/tools route handling verified

**Phase 7 — Verification + Deploy** (`35f1d99`):
- TypeScript: 0 errors (tsc --noEmit)
- Content sweep: 0 old stack references
- Live Playwright checks: accent color, pricing cards (3 + Micro), metadata, counter, footer, console errors (0)
- 23 files, +157/-139 lines

**n8n Automation Engine** (`8f7f416`):
- Installed 7 n8n-skills for workflow building
- Created project: `D:/Flow-Forges/n8n-workflows/`
- Built 5 workflows on live n8n instance (`automate.flow-forges.com`, v2.15.1):
  - WF-01: Payment Processor (`CpxYp38MxtWQCwS8`) — Easebuzz webhook → validate → activate in Supabase → Telegram
  - WF-02: Welcome Sequence (`PxK0Y7IQwKiLhHtW`) — Signup webhook → route by status → Resend email → Telegram
  - WF-03: Payment Reminder (`nk5JxoyeuIetCbLz`) — Cron/6h → find pending >24h → SplitInBatches → Resend → Telegram
  - WF-04: Lead Delivery Alert (`fh0pYtCq1CAJYzZv`) — Lead webhook → Telegram + Client Slack
  - WF-05: Weekly Digest (`kgxd0hZV3vHRZV0C`) — Cron Mon 9AM → Supabase stats → Resend HTML → Telegram
- Architecture: n8n primary + Vercel fallback (dual-path for zero silent failures)
- Every workflow routes through Telegram for real-time visibility

**Vercel → n8n Wiring** (`8f7f416`):
- `app/api/onboarding/save/route.ts` — fire-and-forget POST to n8n welcome-sequence after profile save
- `app/api/leads/route.ts` — fire-and-forget POST to n8n lead-delivery after successful scrape
- Both fire-and-forget — n8n failure never blocks the user flow

**Payment Docs** — `docs/PAYMENT-INTEGRATION.md`: XflowPay vs Easebuzz explained, full flow charts, setup guide

**Current State**:
- Audit score: 5.8 → 8.1/10 (payment blocking — Easebuzz KYC pending)
- 131 routes, 0 TypeScript errors, 0 old stack references
- 5 n8n workflows built, pending activation (need env vars set on n8n)
- Pending: Easebuzz KYC or switch to Razorpay/Stripe for payment gateway
- Deployment: live on `app.flow-forges.com/prospecting-os` and `lead-engine-henna.vercel.app/prospecting-os`

---

### 2026-05-27 — Phase 6: Superadmin Safety + Client-Portal Audit Remediation

**Commit**: `1187ebe` → merged to main `447174a`, deployed to Vercel

**Audit**: Full 57-issue audit (11 critical, 25 medium, 21 low) across superadmin, client-portal, and middleware.

**Superadmin Safety Fixes:**
- `app/admin/users/page.tsx` — Debounced search (300ms), server-side MRR/stats, confirmation modals for deactivate & impersonate, click-outside-close menu, PATCH-based soft-deactivate (was DELETE), Scale plan in create modal
- `app/admin/users/[id]/page.tsx` — Split profile/plan saves (separate endpoints, no cross-tab overwrite), role elevation confirmation (type email to confirm), plan change confirmation modal, Scale plan option
- `app/api/admin/users/route.ts` — Server-side MRR/stats computation, ILIKE-safe search escaping, `full_name` → `display_name`
- `app/admin/agents/page.tsx` — Run All polls for completion (15×2s instead of blind 3s), error handling, knowledge store value search, refresh after resolve

**Client-Portal Audit Remediation:**
- `components/client-portal/PlanGate.tsx` — Fully rewritten: `requiredPlan` prop (PlanKey), pulls name+price from PLANS object, lock icon, styled upgrade CTA button
- `components/client-portal/UpgradeCTA.tsx` — **New** shared component extracted from inline portal code, handles all plan tiers
- `app/api/client-portal/sequences/route.ts` — **New** API endpoint (replaces direct Supabase browser query)
- `app/client-portal/billing/page.tsx` — Full rewrite: upgrade options grid with plan comparison cards, CTA buttons, Scale plan support
- `app/client-portal/page.tsx` — Extracted UpgradeCTA to shared component, CSV injection defense, Scale plan label
- `app/client-portal/sequences/page.tsx` — Wired to new API endpoint, `requiredPlan="scale"` (was wrong "Growth")
- `app/client-portal/slack/page.tsx` — Slack URL validation (`hooks.slack.com/services/`), webhook trimming
- `app/client-portal/layout.tsx` — **Critical fix**: useEffect now has `[pathname, router, supabase]` deps + cleanup `ignore` flag — sidebar renders after login without hard refresh
- `app/client-portal/leads/page.tsx` — PlanGate wrapper added (`requiredPlan="pilot"`), CSV injection defense
- `app/client-portal/analytics/page.tsx` — Switched from client-side 1000-lead fetch to server-side dashboard API; added hot/meeting statuses to breakdown
- `app/client-portal/icebreakers/page.tsx` — PlanGate `planName` → `requiredPlan` prop update

**Blog Admin Fixes:**
- `app/admin/blog/page.tsx` — AI toast truncated to 200 chars, save-preview race fixed (`setSelectedPost(prev => ...)` instead of stale `posts.find()`)

**Middleware Hardening:**
- `middleware.ts` — `display_name` instead of `full_name`, hoisted supabaseAdmin (single instance, not re-created twice), BASE_PATH constant, fail-closed subscription check (was fail-open → DB error now redirects to checkout), `_next/data` in matcher exclusion, role defaults to "user" when null (was bypassing all RBAC), login rate-limiting documented

**Build**: 0 TypeScript errors, 131 routes, 18 files changed (+1,570/-388 lines)

**Live verification**: Landing, login, booking, checkout, client-portal/login all return 200. 1 non-blocking console error (checkout page browser RLS query — middleware handles auth server-side).

**Launch Readiness Score**: 8.1/10
- Payment: 2/10 (Easebuzz KYC pending — blocks first customer)
- Everything else: 8-10/10
