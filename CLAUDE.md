# Prospecting OS — CLAUDE.md

Project context and conventions for AI-assisted development.

**Important**: This project now shares its Supabase database with FlowForges (mark1). Both apps read/write from the same `leads`, `messages`, `sequences`, `campaigns`, `clients`, `activity_log`, `appointments`, and `email_captures` tables.

---

## What this project is

**Prospecting OS** (formerly LinkedIn ProOS) is a full-stack B2B prospecting platform built with Next.js 14, Supabase, and the Anthropic API.  
It provides 8 integrated modules for lead management, AI-powered messaging, ICP scoring, outreach sequences, kanban pipeline, analytics, and client management.

The **root route `/`** is a marketing landing page (Prospecting OS) with a separate layout — no sidebar, no admin chrome.  
The **app routes** (`/leads`, `/dashboard`, etc.) use the full Shell layout with Sidebar + TopBar.

Repo: `github.com/Ayushkrsharma013/lead-engine`  
Live: deployed via Vercel from the `main` branch

---

## Shared Database Architecture

Both Lead Engine and FlowForges (mark1) point to the **same Supabase project**:
- **Project**: `mark1-flowforges` (`otxifqcvgmxoxemmgbjd`), region ap-south-1
- **Tables shared**: `leads`, `messages`, `sequences`, `campaigns`, `clients`, `activity_log`, `lead_activity_log`, `appointments`, `email_captures`

### Why shared?
- FlowForges AI employees (Atlas, Echo, etc.) read and manage leads from the same pool
- Pipeline Kanban in FlowForges shows leads scraped by Lead Engine (and vice versa)
- Avoids data silos and sync complexity

### Auth implications
- FlowForges uses Supabase SSR Auth (cookies) with `profiles` table
- Lead Engine uses a simpler model — server-side DB operations use `supabaseAdmin` (service role) to bypass RLS
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
| State | React Context + useReducer (`lib/AppContext.tsx`) |
| Realtime | Supabase Realtime on leads table |
| Icons | lucide-react ^0.400.0 (outline variants only, 16-18px; no emoji characters) |
| Charts | recharts (Analytics module) |
| Drag & Drop | @hello-pangea/dnd (Kanban module) |
| AI | Anthropic API — called from browser (Message Lab + Scorer) |
| Lead scraping | Apify actor `x_guru~Leads-Scraper-apollo-zoominfo` |
| Google Drive | Google Identity Services (GIS) — client-side OAuth |
| Browser testing | agent-browser CLI (Vercel) — screenshots gitignored |
| Deploy | Vercel (auto-deploys on push to `main`) |

---

## Project structure

```
lead-engine/
├── app/
│   ├── layout.tsx              # Root layout — AppProvider + Shell + font imports + landing.css
│   ├── page.tsx                # Marketing landing page
│   ├── globals.css             # App CSS variables (dark/light), scrollbar, fonts
│   ├── landing.css             # Landing page styles scoped to .landing-page (orange accent #e8420a)
│   ├── api/leads/route.ts      # POST /api/leads — Apify scraping proxy
│   ├── api/leads/import/route.ts  # POST /api/leads/import — import into shared DB
│   ├── api/leads/capture/route.ts # POST /api/leads/capture — email capture
│   ├── api/appointments/route.ts  # GET/POST appointments
│   ├── dashboard/page.tsx      # Command Center (stats, activity, campaigns)
│   ├── leads/page.tsx          # Lead Intelligence
│   ├── message-lab/page.tsx    # AI Message Lab
│   ├── scorer/page.tsx         # AI Lead Scorer
│   ├── sequences/page.tsx      # Sequence Builder
│   ├── kanban/page.tsx         # Kanban Pipeline
│   ├── analytics/page.tsx      # Analytics
│   ├── clients/page.tsx        # Client Manager
│   └── portal/                 # Client portal
├── components/
│   ├── Navbar.tsx            # Marketing landing navbar (scroll-aware glass morphism)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── CommandPalette.tsx
│   │   └── NotificationBell.tsx
│   ├── Shell.tsx             # Renders Navbar on marketing pages
│   ├── EmailCaptureModal.tsx
│   ├── FilterPanel.tsx
│   ├── SettingsModal.tsx
│   ├── GDriveModal.tsx
│   ├── LeadsTable.tsx
│   ├── Pagination.tsx
│   ├── Toast.tsx
│   └── ui/
├── lib/
│   ├── nav.ts                  # Landing nav items (Features, Pricing, FAQ)
│   ├── types.ts                # All shared types + default constants
│   ├── supabase.ts             # Supabase clients: `supabase` (anon) + `supabaseAdmin` (service role)
│   ├── db.ts                   # Typed async data access layer (uses supabaseAdmin)
│   ├── storage.ts              # validateLead, sanitizeLead, generateCSV, stableLeadId
│   ├── filters.ts
│   ├── AppContext.tsx
│   ├── seed.ts
│   ├── google-drive.ts
│   └── utils.ts
└── CLAUDE.md
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
| `/message-lab` | AI Message Lab | Claude API, typewriter, message types |
| `/scorer` | Lead Scorer | ICP criteria, SVG score ring |
| `/sequences` | Sequence Builder | Timeline DnD, Supabase CRUD |
| `/kanban` | Kanban Pipeline | 7 columns, DnD, detail panel |
| `/analytics` | Analytics | 4 recharts, date filters |
| `/clients` | Client Manager | CRUD, reports |
| `/portal` | Client Portal | Login, leads, billing |

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `APIFY_API_KEY` | Vercel + `.env.local` | Required for live scraping |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL (shared with FlowForges) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Supabase anon key (shared with FlowForges) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | **Required** — service role for server-side DB ops (bypasses RLS) |

The Anthropic API key is entered by the user in the UI and stored ONLY in React Context memory. Google Drive Client ID is stored in `localStorage`.

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
- **Required env vars on Vercel**: `APIFY_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
