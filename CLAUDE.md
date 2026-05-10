# LinkedIn ProOS — CLAUDE.md

Project context and conventions for AI-assisted development.

---

## What this project is

**LinkedIn ProOS** is a full-stack B2B prospecting platform built with Next.js 14, Supabase, and the Anthropic API.  
It provides 8 integrated modules for lead management, AI-powered messaging, ICP scoring, outreach sequences, kanban pipeline, analytics, and client management.  
Leads are persisted in Supabase (Postgres) — localStorage is used only for theme and sidebar preferences.

Repo: `github.com/Ayushkrsharma013/lead-engine`  
Live: deployed via Vercel from the `main` branch

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Language | TypeScript 5 — strict mode ON |
| Styling | Tailwind CSS 3 + CSS variables (dark + light themes) |
| Database | Supabase (Postgres) — `@supabase/supabase-js` |
| State | React Context + useReducer (`lib/AppContext.tsx`) |
| Realtime | Supabase Realtime on leads table |
| Icons | lucide-react ^0.400.0 (outline variants only, 16-18px) |
| Charts | recharts (Analytics module) |
| Drag & Drop | @hello-pangea/dnd (Kanban module) |
| AI | Anthropic API — called from browser (Message Lab + Scorer) |
| Lead scraping | Apify actor `x_guru~Leads-Scraper-apollo-zoominfo` |
| Google Drive | Google Identity Services (GIS) — client-side OAuth |
| Deploy | Vercel (auto-deploys on push to `main`) |

---

## Project structure

```
lead-engine/
├── app/
│   ├── layout.tsx              # Root layout — AppProvider + Shell wrapper
│   ├── page.tsx                # Lead Intelligence (TopBar + filter sidebar + leads table + agent)
│   ├── globals.css             # CSS variables (dark/light), scrollbar, fonts
│   ├── api/leads/route.ts      # POST /api/leads — Apify scraping proxy
│   ├── dashboard/page.tsx      # Command Center (stats, activity, campaigns)
│   ├── message-lab/page.tsx    # AI Message Lab (Anthropic API, typewriter)
│   ├── scorer/page.tsx         # AI Lead Scorer (ICP scoring, SVG ring)
│   ├── sequences/page.tsx      # Sequence Builder (timeline, DnD reorder)
│   ├── kanban/page.tsx         # Kanban Pipeline (7-column DnD board)
│   ├── analytics/page.tsx      # Analytics (4 recharts, date filters)
│   └── clients/page.tsx        # Client Manager (CRUD, reports)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Collapsible sidebar (220px/56px), Lucide icons
│   │   ├── TopBar.tsx          # Module header with Cmd+K trigger + bell + theme
│   │   ├── ThemeToggle.tsx     # Sun/moon toggle
│   │   ├── CommandPalette.tsx  # Cmd+K global search (leads, modules, actions)
│   │   └── NotificationBell.tsx# Bell icon + dropdown with unread count
│   ├── Shell.tsx               # App shell: Sidebar + content + Toast + CommandPalette
│   ├── FilterPanel.tsx         # Vertical filter sidebar (272px) below TopBar — collapsible sections
│   ├── GDriveModal.tsx         # Google Drive export modal
│   ├── LeadsTable.tsx          # Data table with sort headers + row selection
│   ├── Pagination.tsx          # Page nav (first/prev/pages/next/last + size)
│   ├── Toast.tsx               # Bottom-right toast notifications (4 types)
│   └── ui/                     # UI primitives (button, badge, input, select, etc.)
├── lib/
│   ├── types.ts                # All shared types + default constants
│   ├── supabase.ts             # Supabase client (createClient)
│   ├── db.ts                   # Typed async data access layer (16 functions)
│   ├── storage.ts              # validateLead, sanitizeLead, generateCSV
│   ├── filters.ts              # applyFilters, sortLeads, countActiveFilters
│   ├── AppContext.tsx           # Global state (useReducer + realtime subscription)
│   ├── seed.ts                 # 15-lead sample data seeder
│   ├── google-drive.ts         # GIS OAuth token flow + Drive multipart upload
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
└── CLAUDE.md                   # ← you are here
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

## Database — Supabase

### Tables (6)

| Table | Key columns | Notes |
|---|---|---|
| `leads` | `id TEXT PK`, email_status, score, source, kanban_column, status, notes | Real-time enabled |
| `messages` | `id UUID PK`, lead_id FK, subject, body, tone, message_type | CASCADE delete |
| `sequences` | `id UUID PK`, name, steps JSONB, assigned_lead_ids JSONB | — |
| `campaigns` | `id UUID PK`, name, target_industry, status, lead_ids JSONB | — |
| `clients` | `id UUID PK`, name, company, industry, monthly_retainer, status | — |
| `activity_log` | `id UUID PK`, type, text, lead_id UUID | Ordered by created_at DESC |

### Data access layer (`lib/db.ts`)

All functions are async and handle snake_case ↔ camelCase transformation:

```typescript
// Leads
fetchLeadsFromDB() → Promise<Lead[]>
mergeLeadsInDB(incoming: Lead[]) → Promise<MergeResult>
deleteLeadsFromDB(ids: string[]) → Promise<Lead[]>
computeStatsFromLeads(leads: Lead[]) → Promise<Stats>

// Messages
getMessages(leadId?: string) → Promise<Message[]>
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
getActivityLog(limit?: number) → Promise<ActivityLogEntry[]>
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
  activeModule: ModuleName;
  notifications: Notification[];
  loading: boolean;
  // Legacy lead table state:
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

### Accent constants (never change between themes)

| Variable | Value | Usage |
|---|---|---|
| `--accent-blue` | `#00d4ff` | Primary CTAs, active sidebar, linkedin source |
| `--accent-purple` | `#7c3aed` | AI features (Message Lab) |
| `--accent-orange` | `#ff6b35` | Hot leads, alerts, Scorer, amazon source |
| `--accent-green` | `#00ff88` | Success, verified, gmaps source |

Theme is applied via `data-theme="light"` attribute on `<html>`. Toggle in TopBar dispatches `SET_THEME`.

### Tailwind color mapping (`tailwind.config.ts`)

```
bg-bg          → var(--bg)
bg-surface     → var(--surface)
bg-surface-2   → var(--surface2)
border-border  → var(--border)
text-text      → var(--text)
text-muted     → var(--muted)
bg-accent-blue → var(--accent-blue) (same for purple, orange, green)
text-accent-blue → var(--accent-blue)
```

### CSS component classes (in `app/globals.css`)

| Class | Purpose |
|---|---|
| `.filter-chip` | Inactive filter chip — hover/active transitions, light/dark support |
| `.filter-chip-active` | Active filter chip — inherits color/border/shadow from inline style |
| `.filter-chip-dot` | 6px colored dot inside email quality chips |
| `.section-group` | Collapsible filter section wrapper — bottom border |
| `.section-header` | Section toggle button — hover transitions, no JS handlers |
| `.section-count` | Blue count badge inside section headers |
| `.filter-date-input` | Date picker input — focus glow, theme-aware calendar icon |
| `.search-input` | Search bar — gradient focus ring, ⌘K shortcut hint |
| `.search-shortcut` | ⌘K badge inside search bar |
| `.transition-premium` | Universal `150ms cubic-bezier(0.4, 0, 0.2, 1)` transition |

### Filter chip colors

Active filter chips in the chip bar are color-coded by group:
- keyword/seniority/companySizes/dates → `--accent-blue` (#00d4ff)
- jobFunction/countries → `--accent-purple` (#7c3aed)
- industries → `--accent-green` (#00ff88)
- emailStatus → per-status color (verified=#10b981, risky=#f59e0b, not_found=#6b6b80)
- minScore → `--accent-orange` (#ff6b35)
- sources → per-source color (linkedin=blue, gmaps=green, amazon=orange)

### Design rules

- Use CSS variable-based Tailwind classes everywhere — no hardcoded hex colors except the 4 accent constants in inline styles
- Lucide icons: outline variants only, `size={16}` or `size={18}`, color inherits from parent or CSS variable
- Transitions: 150-200ms ease on interactive elements (use `.transition-premium` or `transition-all duration-150`)
- Border radius: 6-8px cards/buttons, 12px modals
- Modals: `bg-black/60 backdrop-blur-sm` overlay, `bg-surface border border-border rounded-xl` panel
- Loading states: subtle spinner (border accent + transparent), not heavy animations
- Scrollbar: 4px wide, transparent track, white/10 thumb
- Filter interactions: use CSS classes instead of JS `onMouseEnter`/`onMouseLeave` for hover states — smoother and no DOM thrashing

---

## Module routing

| Route | Module | Key features |
|---|---|---|
| `/` | Lead Intelligence | TopBar + filter sidebar (272px, 7 collapsible sections) + search + leads table, agent run, CSV/Drive export |
| `/dashboard` | Command Center | 5 stat cards, activity feed, campaigns, quick actions |
| `/message-lab` | AI Message Lab | Claude API, typewriter, 3 message types, 4 tones, history |
| `/scorer` | Lead Scorer | ICP criteria, SVG score ring, reasoning, add-to-pipeline |
| `/sequences` | Sequence Builder | Timeline DnD, 5-step default, variable chips, Supabase CRUD |
| `/kanban` | Kanban Pipeline | 7 columns, @hello-pangea/dnd, detail panel, notes auto-save |
| `/analytics` | Analytics | 4 recharts, date filters (7d/30d/90d/all) |
| `/clients` | Client Manager | Client CRUD, detail view, report generator |

---

## Sidebar (`components/layout/Sidebar.tsx`)

- **Expanded**: 220px — shows icon + label + left border on active item
- **Collapsed**: 56px — shows icon only, tooltips on hover
- **Toggle**: ChevronLeft/ChevronRight button at bottom
- **Active indicator**: 3px blue left border + `rgba(0,212,255,0.07)` background
- **Theme toggle**: sun/moon below collapse button
- **Separators**: between nav groups (Command Center+Leads | Message Lab+Scorer | Sequences+Kanban+Analytics+Clients)

---

## TypeScript gotchas

1. **Double-cast pattern** — never cast directly between non-overlapping types; always go through `unknown`:
   ```typescript
   // ✗ fails strict mode
   obj as Record<string, unknown>
   // ✓ correct
   obj as unknown as Record<string, unknown>
   ```

2. **LucideIcon type** — use `import type { LucideIcon } from "lucide-react"` for icon component types, not `React.ComponentType<{ size?: number }>`.

3. **Set spread** — `[...new Set()]` requires `--downlevelIteration`; use `Array.from(new Set(...))` instead.

4. **Window globals** — use the `gis()` accessor pattern rather than `declare const google` to avoid SSR errors.

5. **Supabase Realtime** — requires the table to be added to the publication:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE leads;
   ```

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `APIFY_API_KEY` | Vercel → Settings → Env Vars | Required for live scraping |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Supabase anon key |

The Anthropic API key is entered by the user in the UI (Message Lab or Scorer) and stored ONLY in React Context memory. Google Drive Client ID is stored in `localStorage` (`leadgen_gdrive_client_id`).

---

## localStorage usage

Only 3 keys are allowed in localStorage — everything else is in Supabase:

| Key | Purpose | Values |
|---|---|---|
| `leados_theme` | Theme preference | `"dark"` \| `"light"` |
| `leados_sidebar` | Sidebar state | `"open"` \| `"closed"` |
| `leadgen_gdrive_client_id` | Google Drive OAuth client ID | string |

---

## Development commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build (tsc + Next.js) — must pass with 0 errors
npm run lint     # ESLint check
```

---

## Deployment

- **Trigger**: push to `main` branch on GitHub
- **Platform**: Vercel (project: `lead-engine`)
- **Build command**: `npm run build` (Next.js default)
- **Build failures to watch for**: TypeScript strict-mode errors, missing env vars
- **Required env vars on Vercel**: `APIFY_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
