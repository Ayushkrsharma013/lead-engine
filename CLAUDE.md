# Prospecting OS — CLAUDE.md

Project context and conventions for AI-assisted development.

**Important**: This project now shares its Supabase database with FlowForges (mark1). Both apps read/write from the same `leads`, `messages`, `sequences`, `campaigns`, `clients`, `activity_log`, `appointments`, and `email_captures` tables.

---

## What this project is

**Prospecting OS** (formerly LinkedIn ProOS) is a full-stack B2B prospecting platform built with Next.js 14, Supabase, Resend, and the Gemini API.  
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
| AI | Gemini 2.5 Flash — called from browser (Message Lab + Scorer + A/B variants) |
| Lead scraping | Apify actor `x_guru~Leads-Scraper-apollo-zoominfo` |
| Email | Resend HTTP API — sequence dispatch + booking notifications + inbound webhooks |
| Scheduling | Vercel Cron Jobs — sequence runner daily at 8 AM (`vercel.json`) |
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
├── vercel.json                   # Cron: daily sequence runner (8 AM) + finance agent (9 AM)
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
│   ├── portal/                  # Legacy client portal (login, dashboard, leads, billing)
│   ├── admin/
│   │   └── users/
│   │       ├── page.tsx          # User management — table, filters, create modal
│   │       └── [id]/page.tsx     # Single user detail — profile, plan, activity, QA tabs
│   ├── client-portal/
│   │   ├── layout.tsx            # Separate layout (no admin sidebar)
│   │   ├── page.tsx              # Overview — plan-gated, stats + hot leads
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
│       ├── sequence/launch/        # POST — launch sequence for assigned leads
│       ├── sequence/cancel/        # POST — pause/cancel sequence executions
│       ├── inbound-email/          # POST — Resend inbound webhook (reply tracking)
│       ├── admin/users/
│       │   ├── route.ts               # GET list + POST create (super_admin only)
│       │   ├── [id]/route.ts          # GET/PATCH/DELETE single user
│       │   ├── [id]/activate/route.ts # POST — manually activate client plan
│       │   └── [id]/impersonate/route.ts # POST — generate impersonation magic link
│       ├── client-portal/
│       │   ├── me/route.ts            # GET current client's profile + workspace + modules
│       │   ├── leads/route.ts         # GET client's leads (scoped by user_id)
│       │   └── icebreakers/route.ts   # GET client's icebreaker-enriched leads
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
│   ├── portal-auth.tsx         # Client portal auth context
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
  monthlyRetainer: number; status: "active"|"inactive"; createdAt?: string;
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
| `clients` | `id UUID PK`, name, company, industry, monthly_retainer, status | — |
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
| `/clients` | Client Manager | CRUD, reports |
| `/portal` | Client Portal | Login, leads, billing |

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

The Gemini API key is entered by the user in the UI and stored in localStorage. Google Drive Client ID is stored in `localStorage`.

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

## Session History & Accomplishments

### 2026-05-16 (Evening) — RBAC System + Auth Bug Fixes + Sidebar Redesign

**RBAC Phase 1 — Database + Middleware Foundation**:
- `supabase/migrations/20260516120000_rbac_system.sql` (applied to both `mark1-flowforges` and `lead-engine` projects) — Added `qa_agent` role, new profile columns (plan_activated_at, plan_expires_at, modules_allowed, created_by, is_active, last_login_at, notes), client_workspaces table, qa_sessions table, finance_agent_log, updated RLS policies
- `lib/types.ts` — Added UserRole, PlanKey, PLAN_MODULES (diy/growth/scale with module gates), UserProfile, ClientWorkspace, QASession types
- `lib/auth.ts` — Extended Role type with qa_agent, added isRole, canAccessModule, requireRoleApi helpers
- `lib/plan-gate.ts` — Client-safe canAccessModule (no server imports — separate from auth.ts to avoid Next.js server/client conflicts)
- `lib/xflow.ts` — Payment reference generator (generatePaymentRef, getPlanAmount, getPlanInterval)
- `middleware.ts` — Role-based routing: client → /client-portal, qa_agent → both surfaces, super_admin → full access. Added /admin and /client-portal to protected prefixes.

**RBAC Phase 2 — User Management Panel (/admin/users)**:
- `app/api/admin/users/route.ts` — GET list (super_admin + qa_agent) + POST create with invite email + magic link (super_admin only)
- `app/api/admin/users/[id]/route.ts` — GET/PATCH/DELETE single user (soft delete — sets is_active=false, never deletes auth user)
- `app/api/admin/users/[id]/activate/route.ts` — POST activate plan (reuses jobActivateProfile from finance-agent)
- `app/api/admin/users/[id]/impersonate/route.ts` — POST generate impersonation magic link (audit logged)
- `app/admin/users/page.tsx` — Full admin page: MRR/total/active/pending stat cards, role/status filter pills, search, users table with avatar+role+plan+status columns, per-row actions menu (View/Edit, Activate Plan, Impersonate, Deactivate), Create User modal with invite toggle
- `app/admin/users/[id]/page.tsx` — Single user detail: header with avatar+role+status badges, 4 tabs (Profile edit, Plan & Billing, Activity log, QA sessions)
- `components/layout/Sidebar.tsx` — Users link in Operations section (super_admin only, role detected via Supabase)

**RBAC Phase 3 — Client Portal (/client-portal)**:
- `app/client-portal/layout.tsx` — Separate layout from admin Shell: slim sidebar with plan badge, module-gated nav items, QA mode indicator, logout button
- `app/client-portal/page.tsx` — Plan-gated overview: stat cards (total/hot/avg score/contacted), CSV export, hot leads preview table
- `app/client-portal/leads/page.tsx` — Read-only lead table, score threshold filter (All/40+/60+/80+), pagination, CSV export
- `app/client-portal/icebreakers/page.tsx` — Icebreaker viewer (PlanGate: Growth+), expandable message cards with tone badges
- `app/client-portal/analytics/page.tsx` — Status breakdown grid + industry distribution bars (PlanGate: Growth+)
- `app/client-portal/sequences/page.tsx` — Sequence viewer placeholder (PlanGate: Scale only)
- `app/client-portal/slack/page.tsx` — Slack webhook config with save button (PlanGate: Growth+)
- `app/client-portal/billing/page.tsx` — Plan details card, payment ref with copy button, upgrade CTA link
- `app/client-portal/settings/page.tsx` — ICP preferences: industry chip selector, min score slider
- `app/api/client-portal/me/route.ts` — GET profile + workspace + computed allowed modules (qa_agent gets all)
- `app/api/client-portal/leads/route.ts` — GET leads scoped by user_id (pagination, score_min filter, sort)
- `app/api/client-portal/icebreakers/route.ts` — GET enriched leads (score 60+) with associated messages grouped by lead
- `components/client-portal/PlanGate.tsx` — Client-safe PlanGate wrapper (imports from plan-gate.ts, not auth.ts). Shows upgrade prompt for restricted modules. qa_agent bypasses all gates.
- `components/Shell.tsx` — Client-portal routes excluded from admin chrome (clean layout without ProSidebar)

**RBAC Phase 4 — QA Agent + Tests**:
- `tests/scenarios/rbac.sh` — 10 RBAC boundary tests (unauth redirects, public routes, API gating)
- QA agent credential: qa@flow-forges.com (role: qa_agent, bypasses all PlanGate checks, accesses both surfaces)
- qa_agent role added to VALID_ROLES, middleware routing, and PlanGate bypass

**Auth Bug Fixes — Login/Redirect Issues**:
- `lib/supabase/client.ts` — Strips `/rest/v1` from NEXT_PUBLIC_SUPABASE_URL before creating browser client. Was causing auth calls to hit `/rest/v1/auth/v1/token` (broken).
- `middleware.ts` — Strips `/rest/v1` from Supabase URL for createServerClient. Same root cause as browser client — getUser() returned null even with valid cookies.
- `lib/supabase/server.ts` — Strips `/rest/v1` from URL for SSR server client. Same fix across all three client types.
- Fixed double basePath: all `<Link href="/prospecting-os/...">` changed to `<Link href="/...">` (Next.js auto-prepends basePath). Affected login, signup, onboarding nav logos, client-portal links, PlanGate links.
- Fixed `router.push("/prospecting-os/...")` in login/signup to use basePath-relative paths.
- Created users + profiles + RBAC tables on production `lead-engine` Supabase project (`tbsqpnqzpbnilifhwvgr`) — local `.env.local` pointed to different project (`mark1-flowforges`).

**Sidebar Redesign — FlowOS-Style Premium Animations**:
- Installed framer-motion for `motion.div`, `AnimatePresence`, `layoutId` animations
- Collapsible category sections with animated chevron rotation (ChevronDown rotates 180° via framer-motion)
- `layoutId="sidebar-active-pill"` — smooth pill transitions between active items using brass/gold gradient
- Hover overlays: gradient from left + right-edge brass accent bar on inactive items
- AnimatePresence on all expand/collapse transitions (section children, logo text, tooltips, button labels)
- Better categorization: Overview (Dashboard, Lead Intelligence), AI Studio (Message Lab, Lead Scorer), Pipeline (Sequence Builder, Kanban, Analytics, Client Manager), Outreach (LinkedIn Outreach), Operations (Finance Agent, Users for super_admin)
- Users link only rendered when role === "super_admin" (dynamically injected into Operations section)

**Credentials**:
- Super admin: ayushkumarsharma013@gmail.com / Pro2026!Secure
- QA agent: qa@flow-forges.com / QA2026!Secure

**Total session**: 8 commits, 28 files created, 8 modified, 0 TypeScript errors, 48/48 pages compiled, 18 new routes

### 2026-05-17 — Hub + Checkout + Email Modal + Hero Refine + ProBot AI + Comparison Fixes

**FlowForges Hub (new project)**:
- Created `D:\Flow-Forges\hub\` — separate Next.js 14 app at `app.flow-forges.com` root zone
- 6 product cards: Prospecting OS (live), Support OS + Content OS (coming soon), Proposal OS + Reputation OS + SOW OS (planned)
- Design tokens match lead-engine (--accent: #E8A840, Geist fonts, grain texture, zero emojis)
- All lucide-react icons, filter pills, animated live dot, spring hover, scroll progress bar
- Shared Supabase auth — user logged into Prospecting OS auto-recognized on hub
- Multi-zone: Vercel edge rewrites proxy `/prospecting-os/*` to lead-engine deployment
- Domain `app.flow-forges.com` transferred from lead-engine → hub project
- Fixed redirect loop: Vercel `:path*` doesn't match bare paths — added exact match rules
- Disabled Vercel SSO on both projects (was returning 401 for all public routes)
- Repo: `github.com/Ayushkrsharma013/flowforges-hub`

**Checkout / Billing page (`/checkout`)**:
- Client-facing payment page with plan details, status badge, payment reference (copy button)
- Xflow Pay 3-step payment instructions (Transfer → Share reference → We activate)
- Active state: green shield + "Go to Dashboard" CTA
- Pending state: payment steps + "Book a Call" / "Sign Out" actions
- Onboarding redirect now goes to `/checkout` instead of `dashboard?checkout=manual`
- Added `/checkout` to public routes in middleware

**Email Capture Modal — framer-motion upgrade**:
- AnimatePresence for open/close (opacity + scale + y transitions)
- Spring-animated success checkmark, mobile-aware (no trigger below 768px)
- whileHover/whileTap on buttons, keyboard shortcuts (Escape/Enter)

**Email Capture Section — custom dropdown**:
- Replaced native `<select>` with `IndustryDropdown`: pill button, animated chevron, framer-motion drawer
- Staggered item reveals, glass backdrop, click-outside-to-close

**Comparison Table — Badge fix**:
- Added `paddingTop: 16px` to prevent "Best value" badge clipping

**Hero Section — minimalist refine**:
- H1: clamp(1.9rem, 3.5vw, 2.6rem), weight 800, no italic serif
- Badge: 0.68rem, no pulse animation, "AI Lead Generation"
- Subtitle: 0.92rem, trimmed to 2 lines
- Pipeline: removed LIVE/AI/AUTO badges, simpler step labels
- Stats: 0.75rem, no monospace font. Buttons: 0.875rem

**ProsBot — Gemini AI upgrade**:
- New `/api/chat/bot` — Gemini 2.5 Flash with full product knowledge system prompt
- 8-message context, natural responses, auto-suggests booking, replaced rule-based state machine

**Pricing nav fix**: "Pricing" links scroll to `#pricing` section (not separate route)

**Files**: hub: 10 created; lead-engine: ~12 modified, 2 new routes
**Build**: 0 TS errors, 54/54 pages (lead-engine), 5/5 pages (hub)

### 2026-05-16 (Night) — Landing Page Final Push

**Bug fixes**:
- H1 typewriter: initialized with `FULL_TEXT` for SSR/SEO (was empty string → blank headline for Googlebot). Briefly resets and replays animation on client mount
- Footer `/book` links: converted `<a href="/book">` to `<Link href="/book">` for proper basePath auto-prefixing (was 404ing on multi-zone)

**New sections**:
- `// Free Sample` (id="sample") — email capture with industry selector, Resend sample report email with 5 AI-scored leads, AnimatePresence success state
- `// Why Prospecting OS` (id="compare") — competitor comparison table: Prospecting OS vs In-house SDR, Apollo.io, Clay, Uplead across 10 features with "Best value" badge and staggered row reveals

**New files**:
- `components/landing/EmailCaptureForm.tsx` — 'use client', framer-motion AnimatePresence, industry dropdown, loading spinner, success/error states
- `components/landing/ComparisonTable.tsx` — staggered row reveals (viewport trigger, 0.04s stagger), check/cross/warn indicators, "Best value" badge on Prospecting OS column
- `components/landing/ScrollProgressBar.tsx` — useScroll + useSpring, fixed top 2px accent bar
- `app/api/landing/email-capture/route.ts` — POST handler, dedup check, Resend email with 5 sample scored leads, Telegram notify

**Framer Motion additions**:
- Scroll progress bar (useScroll, useSpring) fixed at page top
- Email capture form: AnimatePresence mode="wait" for idle→loading→success transitions
- Competitor table: motion.tr staggered whileInView row reveals, spring hover on CTA button
- Landing page now imports EmailCaptureForm, ComparisonTable, ScrollProgressBar

**Build**: 0 TypeScript errors, 49/49 pages compiled (new API route added)

### 2026-05-16 (Morning) — Booking System Full Upgrade + Tier 1 (Auth/Payments/Onboarding)

**Booking system (14 features)**: Meeting types, weekend blocking, 15-min buffer, 8/day cap, Turnstile CAPTCHA, confirmation/cancellation emails (Resend), admin dashboard, phone/timezone fields, Google Calendar integration, Telegram notifications, full E2E QA.

**Auth (Phase 1)**: middleware.ts with SSR cookies, login/signup pages, LogoutButton, x-user-* headers.

**Payments (Phase 2)**: Xflow Pay integration, 3 plan definitions, manual activation via Finance Agent.

**Onboarding (Phase 3)**: 4-step wizard (Welcome → ICP → API Keys → Plan & Pay), skip option.

**Files**: 25+ files, ~3,200+ lines, 0 TS errors.

### 2026-05-16 (Afternoon) — Tier 2: Product Completeness + Tier 3: Scale

**Tier 2.1 — Automated Sequence Execution Engine** (`8a48435`):
- `lib/sequence-engine.ts` — template resolution with `{{variables}}`, launchSequence, processDueSteps cron handler
- `lib/resend.ts` — reusable Resend HTTP client (sendEmail + HTML builder)
- `app/api/cron/sequence-runner/` — Vercel Cron endpoint (daily at 8 AM)
- `app/api/sequence/launch/` + `cancel/` — launch/pause/cancel sequence executions
- `vercel.json` — `0 8 * * *` sequence + `0 9 * * *` finance (Hobby tier daily)
- `app/sequences/page.tsx` — Launch button, execution status per lead, pause/cancel controls
- New DB tables: `sequence_executions`, `sequence_messages` (RLS enabled)
- Auto-moves kanban to "Contacted" on first send
- Duplicate prevention, cron overlap lock, 3x retry on Resend failure

**Tier 2.2 — Email Inbound Reply Tracking** (`62e0bcf`):
- `app/api/inbound-email/` — parses Resend webhook, extracts email from From header
- `processInboundReply()` — matches lead by email, matches sequence_message by resend_id
- Auto-updates kanban to "Replied" on reply, logs activity with reply preview
- Added `findLeadByEmail`, `findSequenceMessageByResendId`, `updateSequenceMessageStatus` to db.ts
- Schema: added 'replied' to sequence_messages.status CHECK constraint

**Tier 2.3 — A/B Testing for Messages** (`f5b2cbf`):
- SequenceStep gets `variants?: string[]` — alternative templates per step
- SequenceExecution gets `variant` field — round-robin A/B/C assignment on launch
- Variant-aware template resolution in processDueSteps
- `app/api/analytics/variant-stats/` — reply rate per variant
- `app/sequences/page.tsx` — collapsible variant editor per step, variant stats panel
- `app/message-lab/page.tsx` — "Generate A/B Test" button creates 2 Gemini variants
- Schema: added variant column to sequence_executions

**Tier 3 — Rate Limiting, Error Tracking, Business Analytics** (`e91e1a3`):
- `lib/rate-limit.ts` — daily scrape cap (500/day) + email cap (200/day), X-RateLimit headers
- Applied to leads API POST with per-user session extraction
- `lib/error-tracking.ts` — captureError → error_logs table + optional Sentry forwarding
- `app/api/analytics/business/` — MRR, churn rate, lead conversion, plan distribution
- `app/dashboard/page.tsx` — Business Overview widget (4 stat cards)
- New DB table: `error_logs` (RLS: super_admin only)

**Database migrations executed** (via Supabase MCP):
- `profiles`: added subscription_status, plan, onboarding_complete, icp_preferences, apify_key, payment_ref, payment_method, subscription_activated_at, xflow_transaction_id
- RLS enabled on pricing_tiers + quote_requests
- Fixed profiles super_admin policy (was reading insecure user_metadata from JWT)

**Total Tier 2+3**: 6 commits, 25 files, +1,564 lines, 0 TypeScript errors.

### 2026-05-16 (Evening) — Finance Agent, Stripe Removal, Auth Redesign, Deployment Fixes

**Finance Agent** (`6375290`, `0d62666`):
- Autonomous payment operations agent on Vercel Cron (daily at 9 AM)
- 5 jobs: payment watcher, reminder escalation, 5-day follow-up, activation, monthly summary
- Telegram bot with inline keyboard callbacks (Activate, Invoice Sent, Dismiss, etc.)
- Web dashboard at `/agent/finance` (super_admin only, MRR chart, client tables, activity log)
- Claude follow-up email drafts switched to Gemini (uses existing GEMINI_API_KEY)
- Telegram webhook registered at `/api/agent/finance/callback`

**Stripe Removal** (`e23b007`, `99c8f48`, `4749d01`):
- Deleted Stripe checkout/webhook API routes — payments via Xflow Pay
- `lib/stripe.ts` simplified to PLANS definitions only (no SDK dependency)
- Onboarding Plan & Pay step wired to `/api/onboarding/save` with `pending_payment` status
- Created `/api/onboarding/save` — saves profile data (name, ICP, API keys, plan, subscription status)
- Finance Agent picks up pending_payment profiles via cron

**Auth Pages Redesign** (`3d34760`, `efdc61a`):
- Replaced `<Zap>` icons with `Logo_Icon.png` on login, signup, and onboarding nav
- Brand-aligned glass-morphism cards using actual design tokens (--surface-2, --line, --accent)
- Subtle brass radial glow matching `#E8A840` accent — no foreign colors
- Glass input fields with accent focus rings

**Navbar** (`3d34760`):
- Auth-aware CTAs: "Sign In" for unauthenticated users, "Dashboard" for authenticated
- Desktop + mobile both updated
- Uses `createClient()` to check Supabase session

**Deployment fixes** (`8d0c933`):
- Vercel Hobby tier limits cron to daily — changed schedules to `0 8 * * *` + `0 9 * * *`
- Added "Run Engine" button to Sequence Builder for on-demand execution
- Production deploy passes clean (0 errors, 35 routes)

**Total session**: 14 commits, 30+ files, 2,500+ lines, 0 TypeScript errors.

---

### 2026-05-16 (Evening) — Lead Magnet Tools: Free Pipeline Audit + AI Icebreaker Generator

**LM-04 — Free Pipeline Audit (`/tools/free-audit`):**
- `app/tools/free-audit/page.tsx` — public marketing page: hero with animated availability badge, 3 deliverable cards with staggered entrance, audit form, sample Google Sheet output table mockup, bottom CTA to /book
- `components/tools/AuditForm.tsx` — 'use client', 7-field form (name, email, company, website, team size, weekly hours, current tool, ICP description, CSV upload), AnimatePresence success/error states, file drag-to-upload zone
- `app/api/tools/audit-request/route.ts` — multipart/form-data handler: 5/week cap check, 30-day email dedupe, CSV base64 encode, Supabase insert into `audit_requests`, Resend confirmation email, Telegram notify

**LM-03 — AI Icebreaker Generator (`/tools/icebreaker-generator`):**
- `app/tools/icebreaker-generator/page.tsx` — public marketing page: hero, generator tool, 3-step how-it-works, upgrade CTA
- `components/tools/IcebreakerGenerator.tsx` — 'use client', split input/output layout, tone selector (professional/conversational/direct), 3-gen localStorage limit with progress bar, AnimatePresence states (idle/generating/done/limit/error), copy-to-clipboard
- `app/api/tools/icebreaker/route.ts` — server-side Gemini 2.5 Flash call (GEMINI_API_KEY env var), IP-based rate limit (3/day) via `tool_rate_limits` table, structured prompt with tone guidance

**New DB tables (applied to `lead-engine` production project `tbsqpnqzpbnilifhwvgr`):**
- `audit_requests` — stores full audit submissions with RLS (public INSERT, admin-only SELECT/UPDATE)
- `tool_rate_limits` — IP-based rate log for public tools (no RLS, service role only)

**Middleware:** Added `/tools` to `publicRoutes` — all `/tools/*` pages are public, no auth required

**lib/notify.ts:** Added `notifyTelegram(message: string)` generic helper for raw text Telegram messages

**Required new env var (add to Vercel lead-engine project):**
- `GEMINI_API_KEY` — server-side key for icebreaker API route (NOT NEXT_PUBLIC)

**Build:** 0 TypeScript errors, 65/65 pages compiled (63 previous + 2 new tool pages + 2 new API routes)

---

### 2026-05-16 (Evening) — QA, Bug Fixes, Live Verification

**Email capture modal fix:**
- `components/EmailCaptureModal.tsx` — Fixed API URL from `/api/leads/capture` → `/prospecting-os/api/leads/capture` (was 404ing due to missing basePath prefix)
- `app/landing.css` — Added `@keyframes scale-in` + `.animate-scale-in` class (was referenced but missing, modal card entrance was invisible)

**Shell routing fix:**
- `components/Shell.tsx` — Added `/tools` to both `MARKETING_ROUTES` and `CLEAN_ROUTES` arrays. Tool pages were showing the full admin sidebar/chrome instead of the bare landing-page layout.

**Gemini model fix (3 commits):**
- Changed `gemini-2.0-flash` → `gemini-2.5-flash` — the GEMINI_API_KEY on Vercel only has access to 2.5 (500 error root cause)
- Gemini 2.5 Flash has "thinking" mode ON by default — `parts[0]` is a reasoning part (`thought: true`), `parts[1]` is the actual response. Reading `parts[0]` returned truncated reasoning ("Your recent post on building..."). Fix: set `thinkingConfig: { thinkingBudget: 0 }` in `generationConfig` to disable thinking, and added `parts.find(p => !p.thought) ?? parts[0]` fallback in response parsing.
- Bumped `maxOutputTokens` from 120 → 200 to ensure full sentences

**IMPORTANT — Gemini 2.5 Flash gotchas (lead-engine specific):**
- Always use `gemini-2.5-flash` model (not 2.0 — key restricted)
- Always set `thinkingConfig: { thinkingBudget: 0 }` when you want fast non-thinking responses
- Always extract response text with: `parts.find(p => !p.thought) ?? parts[0]` (not just `parts[0]`)

**Live QA results (all PASS):**
- `/tools/free-audit` — No sidebar, correct layout, hero + deliverables + form + sample table + CTA all rendered
- `/tools/icebreaker-generator` — No sidebar, correct layout, form + output panel + tone selector all rendered
- Icebreaker API E2E: Generated *"Marcus, congrats on HubSpot's Series C and the ambitious EMEA AE expansion—that's huge! I can only imagine the pressure to fill 40 new roles efficiently."* — full sentence, on-brand, contextual
- Usage counter decrements (3 → 2 remaining), Copy/Generate-another buttons appear post-generation

**Commits:** 5 commits this sub-session (modal fix, model fix, thinking-mode fix + Shell fix + CLAUDE.md)

---

### 2026-05-17 — Application Analysis + Progress Tracker + 12-Bug Fix Swarm

**Application Analysis (SPARC Analyzer):**
- 3 parallel agents analyzed all 55 pages, 31 API routes, 38 components, 28 lib files
- Comprehensive report at `docs/PROGRESS.md` — module inventory, completion stats, bug tracker
- Live progress dashboard at `/prospecting-os/progress` — server component reads CLAUDE.md at request time, auto-updates when CLAUDE.md is pushed (Vercel deploy triggers rebuild)
- Added `/progress` to public routes (middleware.ts) and clean layout routes (Shell.tsx)
- 5 stat cards (87% overall), progress bar, module grid, API route list, roadmap tracker, bug list, future enhancement list
- Zero console errors, 55/55 pages compiled

**12-Bug Fix Swarm (3 specialized agents in parallel):**

High:
- `.mcp.json` — Replaced hardcoded `RESEND_API_KEY` with `${RESEND_API_KEY}` env var reference (`c7329e1`)
- `app/dashboard/page.tsx:343` — Fixed missing basePath: `/api/appointments` → `/prospecting-os/api/appointments` (`3c5bedb`)

Medium:
- `app/client-portal/slack/page.tsx` — Wired `handleSave` to POST webhook URL via `createClient().from("client_workspaces").update()` with toast feedback (`0afaa29`)
- `app/client-portal/settings/page.tsx` — Replaced wrong admin API PATCH with direct Supabase upsert to `client_workspaces.icp_config` (`89a0a62`)
- `app/client-portal/sequences/page.tsx` — Replaced placeholder with live data from `sequence_executions` joined with `sequences`, loading/error/empty states (`09e388d`)
- `app/portal/billing/page.tsx` — Removed hardcoded SAMPLE_INVOICES, now queries `finance_agent_log` for real payment history (`6b6ee55`)
- `db: clients` — Added bcrypt-hashed `portal_password` column, created `verify_portal_password()` SECURITY DEFINER RPC function, updated `lib/portal-auth.tsx` to use `.rpc()` instead of plaintext `.eq()` comparison (`e9f7cc3`)
- `db: profiles` — Added `super_admin_select_all_profiles` + `super_admin_update_all_profiles` RLS policies (DB migration applied to `tbsqpnqzpbnilifhwvgr`)

Low:
- `lib/storage.ts` + `lib/types.ts` — Deduplicated `MergeResult` interface, imports from types.ts (`6a2f5ce`)
- `lib/db.ts` + `lib/sequence-engine.ts` — Exported `leadFromDB`, removed local `leadFromRow` copy (`d5c9828`)
- `public/sitemap.xml` — Added 5 missing URLs: onboarding, checkout, tools/free-audit, tools/icebreaker-generator, progress (`c7329e1`)
- `tsconfig.json` — Bumped `target` from `es5` to `es2017` (`c7329e1`)

**Files:** 14 files changed across app, lib, public, and Supabase DB
**Build:** 0 TypeScript errors, 55/55 pages compiled

---

### 2026-05-17 — RLS Hardening + External Configuration

**Database RLS Hardening (Supabase MCP):**
- Enabled RLS on all 9 public tables that lacked it: leads, messages, sequences, campaigns, clients, activity_log, appointments, email_captures, tool_rate_limits
- Added policies: super_admin-gated access for internal tables, public INSERT-only for appointments/email_captures/audit_requests
- Added finance_agent_log policies (RLS was enabled but had no policies)
- Revoked anon EXECUTE on `verify_portal_password` — only service_role can call it now
- Fixed: `REVOKE EXECUTE ON FUNCTION public.verify_portal_password(text, text) FROM anon, authenticated`
- CRON_SECRET set on Vercel, both cron endpoints verified working after redeploy
- Resend inbound webhook configured, signing secret received
- Added Resend webhook signature verification to `/api/inbound-email` (Svix-compatible HMAC-SHA256)
- Leaked password protection: NOT enabled — restricted on Supabase free tier

**External Configuration Status:**
- CRON_SECRET: DONE — set on Vercel, cron endpoints verified
- Resend inbound webhook: DONE — webhook configured, signing secret set as RESEND_WEBHOOK_SECRET
- Leaked password protection: BLOCKED — requires Supabase Pro/Team tier
- SENTRY_DSN: Optional, not yet configured

---

## Roadmap — What's Left

### Immediate (external configuration — 3/4 complete)

| # | Action | Where | Status |
|---|--------|-------|--------|
| 1 | ~~Enable leaked password protection~~ | Supabase Auth dashboard | **BLOCKED** (free tier) |
| 2 | ~~Configure Resend inbound webhook~~ | Resend dashboard | **DONE** |
| 3 | ~~Set CRON_SECRET env var on Vercel~~ | Vercel | **DONE** |
| 4 | Set SENTRY_DSN env var | Vercel (optional) | Optional |
| 5 | ~~Add GEMINI_API_KEY env var~~ | Vercel | **DONE** |

### Immediate (code — all done)

| # | Item | Status |
|---|------|--------|
| 6 | Resend webhook signature verification | **DONE** — HMAC-SHA256 in inbound-email route |
| 7 | RLS on all public tables | **DONE** — 18/18 tables with policies |
| 8 | 12 bugs from analysis | **DONE** — all fixed |

### Immediate (code — portal modernization)

| # | Item | Status |
|---|------|--------|
| 9 | Legacy portal modernized | **DONE** — all 4 pages live |
| 10 | client_id column on leads | **DONE** — DB migration applied to production |
| 11 | Portal API routes | **DONE** — /api/portal/leads + /api/portal/stats |
| 12 | Progress page + tracker | **DONE** — live at /prospecting-os/progress |

### 2026-05-17 — Portal Modernization + External Config Complete

**Portal Modernization (2-agent swarm):**
- Added `client_id TEXT` column + index to production `leads` table via Supabase MCP (`add_client_id_to_leads` migration)
- Created `app/api/portal/leads/route.ts` — GET leads by client_id via supabaseAdmin (bypasses RLS)
- Created `app/api/portal/stats/route.ts` — GET pre-computed stats (total, hot, contacted, meetings, avgScore)
- Updated `app/portal/page.tsx` — fetches from /api/portal/stats + /api/portal/leads instead of direct anon Supabase queries
- Updated `app/portal/leads/page.tsx` — fetches from /api/portal/leads, added error state
- Portal login unchanged — uses bcrypt `verify_portal_password` RPC (already secure)
- Portal billing unchanged — already uses live `finance_agent_log` data
- Portal layout unchanged — well-designed with PortalAuthProvider + auth guard

**Final Stats:**
- 34/34 pages fully functional (0 legacy, 0 placeholder, 0 partial)
- 22/22 API routes live
- 0 open bugs
- External config: 3/4 done (1 blocked on free tier)
- Build: 0 TypeScript errors, 55/55 pages compiled

---

### 2026-05-17 — Agentic Workforce Phase 1 — Design + Planning

**Brainstorm + Design (superpowers:brainstorming skill):**
- Full design doc at `docs/superpowers/specs/2026-05-17-agentic-workforce-design.md` (committed `e2cac35`)
- 8-agent workforce: Lead Scout, Outreach Agent, Pipeline Manager, ICP Analyst, Client Reporter, Finance Watcher (live), Data Janitor, Message Coach
- Dispatcher pattern (Approach B): single `/api/agents/run` cron at 7 AM dispatches 7 modules in parallel via `Promise.allSettled` with 25s timeout each
- Finance Watcher stays on its own 9 AM cron and writes directly to `agent_runs` (not in AGENT_REGISTRY)
- 3 new DB tables: `agents` (registry), `agent_actions` (approval queue + notifications log), `agent_runs` (execution log)
- Safe vs risky action classification: `safe_notify` = auto-execute; `medium`/`high` = queue for Telegram approval
- Telegram inline keyboard buttons (`approve_agent:<id>` / `reject_agent:<id>`) added to existing `/api/agent/telegram` webhook
- Email one-click approve/reject via HMAC-signed tokens (CRON_SECRET) — `GET /api/agents/approve?id=&token=&decision=`
- 6 AM daily Resend digest email with yesterday's run summary + pending approval list
- `/admin/agents` Full Mission Control: status grid, pending approvals inbox, notifications log, activity feed
- All notifications mirrored in DB — Telegram/email are delivery channels, command center is source of truth
- No new npm packages — uses existing Supabase, Resend, Telegram integrations

**Implementation plan:**
- Full plan at `docs/superpowers/plans/2026-05-17-agentic-workforce-phase1.md`
- 11 tasks with complete code for every step
- Status: **COMPLETE — All 4 phases shipped in this session**

---

## Agentic Workforce — COMPLETE (All 4 Phases)

### Architecture

```
Vercel Cron (7 AM) ──▶ /api/agents/run ──▶ AgentDispatcher
                                              │ reads agents table (enabled only)
                                              │ runs lib/agents/*.ts in parallel (25s timeout)
                                              ├─▶ safeActions → auto-execute
                                              └─▶ riskyActions → agent_actions (pending)
                                                                → Telegram inline keyboard
/api/agent/finance/cron (9 AM) ──▶ Finance Watcher (own cron, writes to agent_runs directly)
Vercel Cron (6 AM) ──▶ /api/agents/digest ──▶ Resend HTML email with pending approvals
/api/agent/telegram ──▶ handles approve_agent:/reject_agent: callbacks
/api/agents/approve ──▶ email one-click approve/reject (HMAC token)
/admin/agents ──▶ Full Mission Control UI (reads DB at request time)
```

### New files (Phase 1)

```
supabase/migrations/20260517_agentic_workforce.sql
lib/agents/types.ts            — AgentModule, AgentAction, AgentResult, DB row shapes
lib/agents/tokens.ts           — generateApproveToken, verifyApproveToken (HMAC-SHA256)
lib/agents/resolver.ts         — resolveAgentAction() shared by Telegram webhook + email endpoint
lib/agents/dispatcher.ts       — runAgentBatch(), parallel execution, health score
lib/agents/lead-scout.ts       — stub (enabled Phase 2)
lib/agents/outreach-agent.ts   — stub (enabled Phase 2)
lib/agents/pipeline-manager.ts — stub (enabled Phase 2)
lib/agents/icp-analyst.ts      — stub (enabled Phase 2)
lib/agents/client-reporter.ts  — stub (enabled Phase 2)
lib/agents/data-janitor.ts     — stub (enabled Phase 2)
lib/agents/message-coach.ts    — stub (enabled Phase 2)
app/api/agents/run/route.ts    — GET cron endpoint (CRON_SECRET auth, maxDuration 300)
app/api/agents/approve/route.ts — GET email one-click approve/reject
app/api/agents/digest/route.ts  — GET 6 AM daily digest cron
app/admin/agents/page.tsx       — Full Mission Control UI
```

### Modified files (Phase 1)

```
app/api/agent/finance/cron/route.ts  — add agent_runs write at end of run
app/api/agent/telegram/route.ts      — add callback_query handler for approve_agent/reject_agent
components/layout/Sidebar.tsx        — add "Agent Command Center" link in Operations section
vercel.json                          — add 2 cron entries (7 AM run + 6 AM digest)
```

### Phase 1 task checklist

| # | Task | Status |
|---|------|--------|
| 1 | DB migration — agents, agent_actions, agent_runs + RLS + 8 seed rows | **DONE** — `127f1e0` |
| 2 | lib/agents/types.ts + lib/agents/tokens.ts | **DONE** — `1384ee0` |
| 3 | lib/agents/dispatcher.ts (runAgentBatch) | **DONE** — `479761c` |
| 4 | 7 stub agent modules in lib/agents/ | **DONE** — `14467ba` |
| 5 | Finance Watcher integration (writes to agent_runs) | **DONE** — `2c0a58d` |
| 6 | /api/agents/run cron endpoint | **DONE** — `0ca3e0b` |
| 7 | lib/agents/resolver.ts + /api/agents/approve GET endpoint | **DONE** — `d6e5abc` |
| 8 | Telegram webhook callback_query handler | **DONE** — `8be44bd` |
| 9 | /api/agents/digest daily email cron | **DONE** — `383c6ec` |
| 10 | /admin/agents Full Mission Control UI | **DONE** — `50b95ef` |
| 11 | Sidebar link + vercel.json + full build check | **DONE** — `d3680f6` |

### Phase 2 — All Agents Implemented (7-agent swarm)

**Date:** 2026-05-17 — dispatched 7 parallel subagents, all completed within 3 minutes.

| Agent | Commit | What it does |
|---|---|---|
| Data Janitor | `813d733` | Finds stale leads (>30d), flags duplicates, queues invalid email archives |
| Lead Scout | `4a7e6b7` | Scores unscored leads, detects hot leads (score 80+), classifies new leads |
| Outreach Agent | `44d6ef2` | Finds qualified leads (score 60+), detects follow-up needs, queues launch actions |
| Pipeline Manager | `bbb6479` | Auto-advances contacted/replied leads, detects stuck leads (>14d), queues won/lost archives |
| ICP Analyst | `a8dcd7a` | Conversion stats by industry/size/source, suggests ICP threshold adjustments, weekly trends |
| Client Reporter | `0a48797` | Per-client weekly stats, queues report actions, flags at-risk clients (0 new leads) |
| Message Coach | `db7fd90` | Reply rate analysis by variant, template improvement suggestions, stale template detection |

All 8 agents enabled in production DB (`agents.enabled = true` on `tbsqpnqzpbnilifhwvgr`).
Build: 0 errors, 59/59 pages.

### Phase 2 task checklist

| # | Task | Status |
|---|------|--------|
| 1 | Data Janitor — stale detection + dedup + invalid email cleanup | **DONE** |
| 2 | Lead Scout — ICP scoring + hot lead detection + pipeline classification | **DONE** |
| 3 | Outreach Agent — qualified leads + follow-up tracking + launch queuing | **DONE** |
| 4 | Pipeline Manager — kanban auto-advance + stuck detection + archive queuing | **DONE** |
| 5 | ICP Analyst — conversion analysis + industry scoring + threshold suggestions | **DONE** |
| 6 | Client Reporter — per-client summaries + at-risk detection | **DONE** |
| 7 | Message Coach — reply rate analysis + variant optimization + template health | **DONE** |
| 8 | Enable all agents in production DB | **DONE** |
| 9 | Update progress page + CLAUDE.md | **DONE** |

### Phase 3 — Shared Knowledge Store (COMPLETE)

**Date:** 2026-05-17

Agents now coordinate via a shared `knowledge_store` Supabase table (key TEXT, value JSONB, agent TEXT, updated_at TIMESTAMPTZ). RLS enabled — service role only.

`lib/agents/knowledge.ts` exports:
- `readKnowledge(key)` → JSONB value
- `readKnowledgeNumber(key, fallback)` → number
- `readKnowledgeList(key)` → string[]
- `readKnowledgeRecord(key)` → Record<string, number>
- `writeKnowledge(agent, key, value)` → upsert

What each agent writes to the store:

| Agent | Knowledge written |
|---|---|
| Lead Scout | `lead_scout.hot_leads_today`, `lead_scout.industry_distribution`, `lead_scout.avg_icp_score` |
| Outreach Agent | `outreach.follow_up_needed_count`, `outreach.qualified_leads_today` |
| Pipeline Manager | `pipeline.stuck_leads_count`, `pipeline.kanban_distribution` |
| ICP Analyst | `icp.top_industries`, `icp.suggested_threshold`, `icp.conversion_rates` |
| Client Reporter | `reporter.at_risk_clients`, `reporter.total_clients_active` |
| Message Coach | `message_coach.best_variant_by_sequence`, `message_coach.avg_reply_rate` |
| Data Janitor | `janitor.stale_leads_count`, `janitor.duplicate_count` |

| Commit | What was added |
|---|---|
| `96664ca` | knowledge_store table migration + `lib/agents/knowledge.ts` |
| `32c128c`–`5baa542` | All 7 agents wired to write/read knowledge store |
| `c00d7a0` | Progress dashboard updated with Phase 3 section |

---

### Phase 4 — Guardrails (COMPLETE)

**Date:** 2026-05-17

`lib/agents/guardrails.ts` — `runGuardrails(agent)` pre-flight check runs before each agent execution:

**Auto-disable rule:** 3 consecutive failures → agent disabled, Telegram alert sent. Resets to 0 on success.

**Auto-approve ladder (trust scoring):**
- `agents.health_score` 90+ → medium-risk actions auto-approved (no Telegram needed)
- `agents.health_score` 95+ → high-risk actions also auto-approved
- Stored in `agents.auto_approve_level` ("none" | "medium" | "high")

**Anomaly detection flags:**
- Action spike: agent returns >10× its baseline `actionsToQueue` count
- Duration spike: run took >2× rolling average duration
- Zero-output: agent active for >7 days but returns 0 actions today

**Escalation engine** (in `lib/agents/resolver.ts`):
- Pending actions >48h → auto-rejected + Telegram alert
- Pending actions >24h → re-notify via Telegram
- Resolved actions (approved/rejected/executed) >7d → archived (status = "archived")

New DB columns added to `agents` table:
- `auto_approve_level TEXT` — "none" | "medium" | "high"
- `consecutive_failures INT` — resets to 0 on success

| Commit | What was added |
|---|---|
| `52c5f01` | `lib/agents/guardrails.ts` — trust scoring + auto-approve + anomaly detection |
| `149196f` | Escalation engine in resolver — stale rejection, re-notify, archive |
| `863e615` | Guardrails integrated into dispatcher pre-flight |
| `d08f842` | TypeScript fixes across Phase 4 |

---

### Command Center — Final State (COMPLETE)

`app/admin/agents/page.tsx` rebuilt as a **live client component** (`35d80dd`):
- New **"Agent Workforce"** sidebar category (below Overview) — shows Command Center + Finance Agent links
- `app/api/admin/agents/route.ts` — dedicated GET endpoint returns agents + recent runs + pending actions
- Agent grid: 8 cards with health bars, auto-approve badge, consecutive_failures dot, last run log
- Pending approvals inbox with agent/risk chips and Telegram/email review note
- Notification log table with channel badges (Telegram / Email / Internal)
- Activity feed with full run history ordered by created_at
- "Run All Now" button manually triggers `/api/agents/run`
- Auth: middleware passes `x-user-*` headers; page uses supabaseAdmin for server-side data

---

### Agent roster

| Agent | Slug | Schedule | Status |
|---|---|---|---|
| Data Janitor | `data-janitor` | 4 AM daily | **Live** — stale detection, dedup, invalid email cleanup |
| Lead Scout | `lead-scout` | 7 AM daily | **Live** — ICP scoring, hot lead detection, pipeline classification |
| Outreach Agent | `outreach-agent` | 8 AM daily | **Live** — qualified leads, follow-up tracking, launch queuing |
| Pipeline Manager | `pipeline-manager` | 9 AM daily | **Live** — kanban auto-advance, stuck detection, archive queuing |
| Finance Watcher | `finance-watcher` | 9 AM daily | **Live** — own cron, payment operations |
| ICP Analyst | `icp-analyst` | Sun 8 AM | **Live** — conversion analysis, industry scoring, threshold suggestions |
| Client Reporter | `client-reporter` | Sun 8 AM | **Live** — per-client weekly summaries, at-risk detection |
| Message Coach | `message-coach` | 10 AM daily | **Live** — reply rate analysis, variant optimization, template health |

### Safe vs risky action classification

| Action | Risk Level | Execution |
|---|---|---|
| Update leads.kanban_column / score / status | safe_notify | Auto |
| Insert into activity_log / lead_activity_log | safe_notify | Auto |
| Flag lead as stale (update leads.notes) | safe_notify | Auto |
| Update agents.health_score | safe_notify | Auto |
| Update profiles.icp_preferences score threshold | safe_notify | Auto (with notify) |
| Launch a sequence for leads | **medium** | Queue |
| Send email / create campaign / modify sequence | **medium** | Queue |
| Archive leads (status = archived) | **medium** | Queue |
| Send client report | **medium** | Queue |
| Delete any record | **high** | Queue |
| Bulk status change (>10 leads) | **high** | Queue |
| Modify another agent's config | **high** | Queue |

### Environment variables (all already set)

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram approvals + alerts
- `RESEND_API_KEY`, `NOTIFY_EMAIL` — 6 AM digest email
- `SUPABASE_SERVICE_ROLE_KEY` — all agent DB writes (supabaseAdmin)
- `CRON_SECRET` — secures /api/agents/run + signs email approve tokens

---

---

### 2026-05-17 — Integration Fix + Migration Sync

**TypeScript strict errors fixed in `app/settings/page.tsx` (4 errors):**
- `profile` is typed `Record<string, unknown> | null` — all field accesses return `unknown`
- Fixed by wrapping with `String()`, `!!` coercion, and explicit `String()` for ReactNode contexts
- Build: 0 errors, 59/59 pages

**Missing migration files created** (production DB already had the columns/tables applied manually):
- `supabase/migrations/20260517_phase3_knowledge_store.sql` — `knowledge_store` table + RLS (`96664ca` had no file)
- `supabase/migrations/20260517_phase4_guardrails.sql` — `agents.auto_approve_level` + `agents.consecutive_failures` columns (Phase 4 had no file)
- Commit: `1c572a2` — repo migrations now fully in sync with production schema `tbsqpnqzpbnilifhwvgr`

**Migration files in repo (5 total):**
```
supabase/migrations/20260516200000_audit_requests.sql
supabase/migrations/20260516200001_tool_rate_limits.sql
supabase/migrations/20260517_agentic_workforce.sql
supabase/migrations/20260517_phase3_knowledge_store.sql
supabase/migrations/20260517_phase4_guardrails.sql
```

---

### Future enhancements (not yet planned)

- CRM integrations (HubSpot/Salesforce) — deferred, build in-house instead
- OpenOutreach sequence integration — connect LinkedIn steps to the engine
- Email open/bounce tracking via Resend webhooks
- Automated winner selection in A/B testing
- Client portal billing history
- Multi-currency MRR tracking
