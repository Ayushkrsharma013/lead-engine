# LinkedIn ProOS

**AI-powered B2B prospecting platform** — find, score, message, and manage leads from LinkedIn, Google Maps, and Amazon Seller Central, all in one workspace.

Live: [lead-engine-henna.vercel.app](https://lead-engine-henna.vercel.app)

---

## Overview

LinkedIn ProOS is a full-stack SaaS application built for B2B sales teams and solo operators. It combines lead scraping, AI-generated outreach, ICP scoring, pipeline management, and analytics into a single, keyboard-friendly interface.

---

## Modules

| Module | Route | What it does |
|---|---|---|
| **Command Center** | `/dashboard` | Stats overview, activity feed, campaign tracker, quick actions |
| **Lead Intelligence** | `/` | Scrape & filter leads from LinkedIn / Google Maps / Amazon. Search, sort, export, bulk-delete |
| **AI Message Lab** | `/message-lab` | Generate personalised outreach (LinkedIn DM, cold email, connection request) using Claude |
| **Lead Scorer** | `/scorer` | ICP scoring with an animated ring, reasoning breakdown, add-to-pipeline action |
| **Sequence Builder** | `/sequences` | Drag-and-drop multi-step outreach sequences with variable chips |
| **Kanban Pipeline** | `/kanban` | 7-column drag-and-drop board with inline notes and status auto-save |
| **Analytics** | `/analytics` | Four Recharts visualisations with 7d / 30d / 90d / all-time date filters |
| **Client Manager** | `/clients` | CRUD client accounts, monthly retainer tracking, report generation |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript 5 — strict mode |
| Styling | Tailwind CSS 3 + CSS variables (dark & light themes) |
| Database | Supabase (Postgres) with Realtime subscriptions |
| State | React Context + useReducer |
| AI | Anthropic Claude API (Message Lab + Lead Scorer) |
| Lead scraping | Apify — `x_guru~Leads-Scraper-apollo-zoominfo` |
| Charts | Recharts |
| Drag & Drop | @hello-pangea/dnd |
| Google Drive | Google Identity Services (GIS) OAuth |
| Deploy | Vercel (auto-deploy from `main`) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Apify](https://apify.com) account (for live scraping — optional, mock mode is built-in)

### 1. Clone & install

```bash
git clone https://github.com/Ayushkrsharma013/lead-engine.git
cd lead-engine
npm install
```

### 2. Environment variables

Create a `.env.local` file at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
APIFY_API_KEY=your_apify_api_key
```

### 3. Database setup

Run the following SQL in your Supabase SQL editor to create the required tables:

```sql
-- Leads
create table leads (
  id text primary key,
  name text, title text, company text, industry text,
  location text, email text,
  email_status text check (email_status in ('verified','risky','not_found')),
  linkedin text, website text, company_size text,
  score integer default 0,
  source text check (source in ('linkedin','gmaps','amazon')),
  kanban_column text, status text, notes text, tags jsonb,
  saved_at timestamptz default now(),
  fetched_at timestamptz, last_touched timestamptz
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id text references leads(id) on delete cascade,
  subject text, body text, tone text, message_type text,
  char_count integer, created_at timestamptz default now()
);

-- Sequences
create table sequences (
  id uuid primary key default gen_random_uuid(),
  name text, steps jsonb, assigned_lead_ids jsonb,
  created_at timestamptz default now(), updated_at timestamptz
);

-- Campaigns
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text, target_industry text,
  status text check (status in ('active','paused','complete')),
  lead_ids jsonb, created_at timestamptz default now()
);

-- Clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text, company text, industry text,
  monthly_retainer numeric, status text check (status in ('active','inactive')),
  created_at timestamptz default now()
);

-- Activity Log
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  type text, text text, lead_id uuid,
  created_at timestamptz default now()
);

-- Enable Realtime on leads
alter publication supabase_realtime add table leads;
```

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Features

### Mock mode vs Live mode

Toggle **Mock / LIVE** in the toolbar on Lead Intelligence. In Mock mode, the agent replays a set of pre-defined leads and log steps locally — no API calls are made. In LIVE mode, the agent calls the Apify scraper via `/api/leads`.

### Anthropic API key

The Claude API key is entered once in the AI Message Lab or Lead Scorer UI. It is stored **only in React memory** — never written to localStorage, Supabase, or logs. It resets on page reload.

### Google Drive export

Click **Drive** in the Lead Intelligence toolbar. On first use, enter your Google OAuth Client ID (stored in `localStorage`). Subsequent exports use the cached token.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open Command Palette — navigate modules, search leads |
| `Esc` | Close any modal or palette |
| `↑ ↓` | Navigate Command Palette results |
| `↵` | Open highlighted result |

---

## Project Structure

```
lead-engine/
├── app/
│   ├── layout.tsx              # Root layout (AppProvider + Shell)
│   ├── page.tsx                # Lead Intelligence (main page)
│   ├── globals.css             # Design tokens, animations, fonts
│   ├── api/leads/route.ts      # POST /api/leads — Apify proxy
│   ├── dashboard/page.tsx
│   ├── message-lab/page.tsx
│   ├── scorer/page.tsx
│   ├── sequences/page.tsx
│   ├── kanban/page.tsx
│   ├── analytics/page.tsx
│   └── clients/page.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Collapsible nav (220px / 56px)
│   │   ├── TopBar.tsx          # Module header with ⌘K trigger
│   │   ├── CommandPalette.tsx  # Spotlight-style global search
│   │   ├── NotificationBell.tsx
│   │   └── ThemeToggle.tsx
│   ├── Shell.tsx               # App shell wrapper
│   ├── FilterPanel.tsx         # Left sidebar filter UI
│   ├── LeadsTable.tsx          # Sortable data table
│   ├── Pagination.tsx
│   ├── Toast.tsx               # Glassmorphism toast notifications
│   ├── GDriveModal.tsx
│   └── ui/                     # Primitive components
├── lib/
│   ├── AppContext.tsx           # Global state (useReducer + Realtime)
│   ├── db.ts                   # Typed Supabase data access layer
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── filters.ts              # Lead filtering & sorting logic
│   ├── storage.ts              # CSV generation, lead validation
│   ├── supabase.ts             # Supabase client
│   └── google-drive.ts         # GIS OAuth + Drive upload
└── CLAUDE.md                   # AI development context
```

---

## Deployment

The app auto-deploys to Vercel on every push to `main`. Make sure the following environment variables are set in your Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `APIFY_API_KEY`

---

## Design System

The UI uses a CSS variable-based design system with full dark/light theme support.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#060608` | `#f5f5f7` |
| `--surface` | `#0d0d12` | `#ffffff` |
| `--border` | `#1e1e2e` | `#e0e0e8` |
| `--accent-blue` | `#00d4ff` | same |
| `--accent-green` | `#00ff88` | same |
| `--accent-orange` | `#ff6b35` | same |
| `--accent-purple` | `#7c3aed` | same |

---

## License

MIT — built by [Ayush Kumar Sharma](https://github.com/Ayushkrsharma013).
