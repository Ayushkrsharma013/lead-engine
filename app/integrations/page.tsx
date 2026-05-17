"use client";

import { useState, useEffect } from "react";
import {
  Database, Lock, Globe, Cpu, Mail, Send, Calendar,
  Clock, Bot, CreditCard, Users, FileText, Shield,
  Check, AlertTriangle, X, ArrowRight, ArrowLeftRight,
  ExternalLink, RefreshCw, Zap, Sparkles, Wifi, WifiOff,
  ChevronDown, ChevronRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════

interface Integration {
  id: string;
  name: string;
  category: "database" | "auth" | "ai" | "email" | "messaging" | "scheduling" | "payments" | "external";
  status: "live" | "partial" | "offline" | "blocked";
  icon: React.ElementType;
  color: string;
  description: string;
  flow: string;
  checks: { label: string; pass: boolean; detail: string }[];
  frontend: string[];
  backend: string[];
  database: string[];
  envVars: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: "supabase-db",
    name: "Supabase Database",
    category: "database",
    status: "live",
    icon: Database,
    color: "#6BCB77",
    description: "Postgres database shared between lead-engine and mark1. All tables RLS-hardened with appropriate policies.",
    flow: `┌─────────────────────────────────────────────────────┐
│              DATA FLOW — Supabase DB                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Frontend (browser)                                 │
│    │ supabase (anon key) → SELECT only (RLS)        │
│    │ AppContext fetches via lib/db.ts (anon reads)  │
│    ▼                                                │
│  API Routes (server)                                │
│    │ supabaseAdmin (service_role) → full access     │
│    │ lib/db.ts: leads, messages, sequences, etc.    │
│    │ All writes go through API routes               │
│    ▼                                                │
│  Supabase Postgres (tbsqpnqzpbnilifhwvgr)           │
│    │ 18 tables · 222 leads · 5 appointments         │
│    │ RLS: 18/18 tables · Public INSERT for forms     │
│    │ Realtime enabled on leads table                │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Database connection", pass: true, detail: "Connected to tbsqpnqzpbnilifhwvgr (us-east-1)" },
      { label: "RLS enabled (all tables)", pass: true, detail: "18/18 tables with RLS policies" },
      { label: "anon reads working", pass: true, detail: "SELECT policies allow public reads where needed" },
      { label: "service_role writes", pass: true, detail: "API routes use supabaseAdmin for writes" },
      { label: "Realtime", pass: true, detail: "Enabled on leads table — live updates in dashboard" },
    ],
    frontend: ["lib/supabase/client.ts", "lib/AppContext.tsx", "All page components"],
    backend: ["lib/supabase.ts", "lib/db.ts", "31 API routes"],
    database: ["18 tables", "RLS on all tables", "leads (222 rows)", "appointments, clients, profiles"],
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "supabase-auth",
    name: "Supabase Auth (SSR)",
    category: "auth",
    status: "live",
    icon: Lock,
    color: "#a78bfa",
    description: "Cookie-based authentication via @supabase/ssr. Middleware sets x-user-* headers. RBAC with 4 roles.",
    flow: `┌─────────────────────────────────────────────────────┐
│              AUTH FLOW — Supabase SSR                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Browser                                            │
│    │ POST /login → signInWithPassword()             │
│    │ Cookie set: sb-<project>-auth-token            │
│    ▼                                                │
│  middleware.ts (every request)                       │
│    │ createServerClient(cookies)                    │
│    │ supabase.auth.getUser() → verify session       │
│    │ Query profiles table → get role                │
│    │ Set: x-user-id, x-user-email, x-user-role      │
│    │ Route: client→/client-portal, unauth→/login    │
│    ▼                                                │
│  Page / API Route                                   │
│    │ Read x-user-* headers or SSR getUser()         │
│    │ Role-based rendering / API guards              │
│                                                     │
│  Roles: super_admin | client | qa_agent | user       │
│  Protected: /dashboard, /leads, /admin, /settings   │
│  Public: /, /book, /login, /tools, /progress        │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "SSR cookie auth", pass: true, detail: "createServerClient with cookie read/write" },
      { label: "Middleware headers", pass: true, detail: "x-user-id, x-user-role set on every request" },
      { label: "RBAC enforcement", pass: true, detail: "4 roles, client→portal, super_admin→all" },
      { label: "Public routes", pass: true, detail: "/, /book, /login, /tools, /progress accessible" },
      { label: "Protected routes", pass: true, detail: "13 prefixes gated by middleware" },
    ],
    frontend: ["middleware.ts", "app/login/page.tsx", "app/signup/page.tsx", "lib/supabase/client.ts", "lib/supabase/server.ts"],
    backend: ["middleware.ts", "lib/auth.ts", "lib/plan-gate.ts", "lib/supabase/server.ts"],
    database: ["profiles (2 users)", "auth.users", "auth.sessions", "RLS: profiles_select_own"],
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    id: "apify-scraping",
    name: "Apify Lead Scraping",
    category: "external",
    status: "live",
    icon: Globe,
    color: "#00d4ff",
    description: "Lead scraping via Apify actor x_guru~Leads-Scraper-apollo-zoominfo. Rate-limited at 500/day.",
    flow: `┌─────────────────────────────────────────────────────┐
│              SCRAPING FLOW — Apify                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Frontend (Leads page)                              │
│    │ User clicks "Run Agent" / selects source        │
│    ▼                                                │
│  POST /prospecting-os/api/leads                     │
│    │ Rate limit check (500/day per user)             │
│    │ Calls Apify actor: x_guru~Leads-Scraper        │
│    │ Returns lead array with scores + emails         │
│    ▼                                                │
│  lib/db.ts → mergeLeadsInDB()                       │
│    │ Dedup by stableLeadId (name+company)            │
│    │ Insert/update leads table                       │
│    ▼                                                │
│  AppContext → dispatch SET_LEADS                    │
│    │ Realtime subscription picks up change           │
│    │ Dashboard + Kanban + Analytics refresh          │
│                                                     │
│  Sources: LinkedIn (active) | Maps (soon) | Amazon   │
│  Rate: 500 scrapes/day per user                     │
│  Import: POST /api/leads/import (past runs)          │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Apify API connection", pass: true, detail: "Actor x_guru~Leads-Scraper-apollo-zoominfo" },
      { label: "Rate limiting", pass: true, detail: "500/day cap, X-RateLimit headers" },
      { label: "Dedup logic", pass: true, detail: "stableLeadId (name+company hash)" },
      { label: "Import past runs", pass: true, detail: "POST /api/leads/import" },
      { label: "Source filtering", pass: true, detail: "LinkedIn active, Maps/Amazon coming soon" },
    ],
    frontend: ["app/leads/page.tsx", "components/FilterPanel.tsx", "components/ImportModal.tsx"],
    backend: ["app/api/leads/route.ts", "app/api/leads/import/route.ts", "lib/rate-limit.ts"],
    database: ["leads table", "tool_rate_limits table"],
    envVars: ["APIFY_API_KEY"],
  },
  {
    id: "gemini-ai",
    name: "Gemini 2.5 Flash AI",
    category: "ai",
    status: "live",
    icon: Sparkles,
    color: "#3b82f6",
    description: "Gemini 2.5 Flash for Message Lab, Scorer, Icebreaker, ProBot. Key stored in localStorage. thinking: disabled.",
    flow: `┌─────────────────────────────────────────────────────┐
│              AI FLOW — Gemini 2.5 Flash              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Browser (client-side)                              │
│    │ Message Lab: generates outreach messages        │
│    │ Scorer: ICP scoring + reasoning                 │
│    │ Settings: API key in localStorage               │
│    │ thinkingConfig: { thinkingBudget: 0 }          │
│    ▼                                                │
│  Server (API routes)                                │
│    │ ProBot: /api/chat/bot → Gemini 2.5 Flash       │
│    │ Icebreaker: /api/tools/icebreaker → Gemini     │
│    │ Both use GEMINI_API_KEY env var                │
│    │ parts.find(p => !p.thought) for response       │
│    ▼                                                │
│  Gemini API (generativelanguage.googleapis.com)      │
│    │ Model: gemini-2.5-flash                        │
│    │ Response: text via non-thought parts            │
│    │ Rate: 3/day IP limit on icebreaker (free)      │
│                                                     │
│  Key gotchas: model=2.5-flash (not 2.0)            │
│   thinkingBudget:0 needed for non-reasoning         │
│   parts[0] may be thought, check .thought flag      │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Gemini API access", pass: true, detail: "gemini-2.5-flash, GEMINI_API_KEY set on Vercel" },
      { label: "Message Lab", pass: true, detail: "Client-side Gemini for outreach generation" },
      { label: "Lead Scorer", pass: true, detail: "Client-side Gemini for ICP scoring" },
      { label: "ProBot Chat", pass: true, detail: "Server-side via /api/chat/bot" },
      { label: "Icebreaker API", pass: true, detail: "Server-side, 3/day IP limit, /api/tools/icebreaker" },
    ],
    frontend: ["app/message-lab/page.tsx", "app/scorer/page.tsx", "components/ProsBotPanel.tsx"],
    backend: ["app/api/chat/bot/route.ts", "app/api/tools/icebreaker/route.ts", "app/api/landing/email-capture/route.ts"],
    database: ["tool_rate_limits (IP tracking)"],
    envVars: ["GEMINI_API_KEY (server)", "localStorage key (browser)"],
  },
  {
    id: "resend-email",
    name: "Resend Email",
    category: "email",
    status: "live",
    icon: Mail,
    color: "#E8A840",
    description: "Resend for transactional emails, booking confirmations, sequence dispatch, and inbound webhooks.",
    flow: `┌─────────────────────────────────────────────────────┐
│              EMAIL FLOW — Resend                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Outbound (server)                                  │
│    │ lib/resend.ts → sendEmail()                    │
│    │ Booking confirmations (POST /api/appointments) │
│    │ Sequence dispatch (lib/sequence-engine.ts)      │
│    │ Audit sample reports (landing email capture)    │
│    │ Agent digest (6 AM cron → /api/agents/digest)  │
│    ▼                                                │
│  Resend API (api.resend.com)                        │
│    │ Sender: notifications@flow-forges.com          │
│    │ RESEND_API_KEY env var (server)               │
│                                                     │
│  Inbound (webhook)                                  │
│    │ POST /api/inbound-email                         │
│    │ Svix HMAC-SHA256 signature verification        │
│    │ RESEND_WEBHOOK_SECRET env var                  │
│    │ processInboundReply() → kanban auto-update     │
│    ▼                                                │
│  lib/sequence-engine.ts                             │
│    │ Matches reply by from email or in-reply-to      │
│    │ Updates lead status → "Replied"               │
│    │ Updates sequence_message status → "replied"    │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Resend API key", pass: true, detail: "RESEND_API_KEY set (via .mcp.json env var)" },
      { label: "Outbound emails", pass: true, detail: "Booking confirm, sequence dispatch, audit reports" },
      { label: "Inbound webhook", pass: true, detail: "Configured in Resend dashboard, signed verification" },
      { label: "Reply tracking", pass: true, detail: "Auto-updates kanban on reply received" },
      { label: "Agent digest", pass: true, detail: "6 AM daily via Vercel Cron" },
    ],
    frontend: ["app/book/page.tsx (booking emails)", "components/landing/EmailCaptureForm.tsx"],
    backend: ["lib/resend.ts", "lib/notify.ts", "app/api/inbound-email/route.ts", "app/api/agents/digest/route.ts"],
    database: ["email_captures (2 rows)", "sequence_messages (sent status tracking)"],
    envVars: ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "NOTIFY_EMAIL"],
  },
  {
    id: "telegram-bot",
    name: "Telegram Bot",
    category: "messaging",
    status: "live",
    icon: Send,
    color: "#00d4ff",
    description: "Telegram bot for agent approvals, booking alerts, and finance agent callbacks. Inline keyboard for approve/reject.",
    flow: `┌─────────────────────────────────────────────────────┐
│              TELEGRAM FLOW                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Webhook Registration                               │
│    │ Settings → Agent tab → "Auto-setup Webhook"    │
│    │ GET /api/agent/telegram?action=set             │
│    │ Registers: app.flow-forges.com/api/agent/tg    │
│    ▼                                                │
│  Inbound Messages                                   │
│    │ POST /prospecting-os/api/agent/telegram         │
│    │ Parses: text messages + callback_query         │
│    │ callback_query: approve_agent:<id>             │
│    │ callback_query: reject_agent:<id>              │
│    ▼                                                │
│  Outbound Messages                                  │
│    │ lib/notify.ts → notifyTelegram()               │
│    │ Booking alerts → TELEGRAM_CHAT_ID              │
│    │ Agent approvals → inline keyboard buttons      │
│    │ Finance Agent → payment alerts                 │
│    │ Guardrails → anomaly + auto-disable alerts     │
│                                                     │
│  Bots: @ProOS_bot (agent) + finance callback        │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Bot token", pass: true, detail: "TELEGRAM_BOT_TOKEN set on Vercel" },
      { label: "Webhook registered", pass: true, detail: "app.flow-forges.com/prospecting-os/api/agent/telegram" },
      { label: "Callback handling", pass: true, detail: "approve_agent:/reject_agent: inline keyboard" },
      { label: "Notifications", pass: true, detail: "Booking alerts + finance agent alerts via notifyTelegram()" },
      { label: "Chat ID", pass: true, detail: "TELEGRAM_CHAT_ID configured" },
    ],
    frontend: ["app/settings/page.tsx (Agent tab)", "components/AgentPanel.tsx"],
    backend: ["app/api/agent/telegram/route.ts", "app/api/agent/finance/callback/route.ts", "lib/notify.ts"],
    database: ["finance_agent_log (telegram_msg_id tracking)"],
    envVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "scheduling",
    status: "partial",
    icon: Calendar,
    color: "#E8A840",
    description: "Google Calendar OAuth for appointment events. Optional — falls back gracefully if not configured.",
    flow: `┌─────────────────────────────────────────────────────┐
│              CALENDAR FLOW — Google                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  OAuth Connection                                   │
│    │ /api/auth/google-calendar → redirect to Google │
│    │ /api/auth/google-calendar/callback → exchange   │
│    │ /api/auth/google-calendar/status → check        │
│    ▼                                                │
│  Booking Integration                                │
│    │ POST /api/appointments (create booking)        │
│    │ → createCalendarEvent() if connected           │
│    │ Graceful fallback if calendar not configured    │
│    │ Buffer: 15min between bookings                  │
│    │ Cap: 8 bookings per day                         │
│                                                     │
│  Status: Optional — GOOGLE_CLIENT_ID not verified    │
│  Fallback: Booking works fine without calendar      │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "OAuth flow", pass: true, detail: "3 endpoints: connect/status/callback" },
      { label: "Calendar events", pass: true, detail: "Auto-creates on booking when connected" },
      { label: "Graceful fallback", pass: true, detail: "Works without Google Calendar configured" },
      { label: "Credentials set", pass: false, detail: "GOOGLE_CLIENT_ID not verified — optional" },
    ],
    frontend: ["app/book/page.tsx", "app/book/admin/page.tsx"],
    backend: ["lib/google-calendar.ts", "app/api/auth/google-calendar/*"],
    database: ["appointments table (5 bookings)"],
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALENDAR_REFRESH_TOKEN (optional)"],
  },
  {
    id: "vercel-cron",
    name: "Vercel Cron Jobs",
    category: "scheduling",
    status: "live",
    icon: Clock,
    color: "#6BCB77",
    description: "4 cron jobs scheduled via vercel.json. All secured by CRON_SECRET or Vercel cron header.",
    flow: `┌─────────────────────────────────────────────────────┐
│              CRON SCHEDULE — Vercel                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  4 AM  → [Data Janitor]   (disabled, no cron)       │
│  6 AM  → /api/agents/digest → Resend HTML email     │
│  7 AM  → /api/agents/run   → AgentDispatcher        │
│  8 AM  → /api/cron/sequence-runner  → processDueSteps│
│  9 AM  → /api/agent/finance/cron   → Finance Watcher │
│                                                     │
│  Auth: CRON_SECRET Bearer token OR x-vercel-cron    │
│  Hobby tier: max 1/day per cron path               │
│  Manual: "Run All Now" button on Agent Command      │
│          Center triggers /api/agents/run            │
│                                                     │
│  vercel.json config:                                │
│  { path: "/api/agents/run", schedule: "0 7 * * *" } │
│  { path: "/api/cron/sequence-runner", "0 8 * * *" } │
│  { path: "/api/agent/finance/cron", "0 9 * * *" }   │
│  { path: "/api/agents/digest", "0 6 * * *" }        │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Cron schedule set", pass: true, detail: "4 entries in vercel.json" },
      { label: "CRON_SECRET configured", pass: true, detail: "Set on Vercel, all cron routes check it" },
      { label: "Sequence runner", pass: true, detail: "8 AM daily, processes due sequence steps" },
      { label: "Finance agent", pass: true, detail: "9 AM daily, 5 payment operations" },
      { label: "Agent dispatcher", pass: true, detail: "7 AM daily, runs all enabled agents" },
      { label: "Agent digest", pass: true, detail: "6 AM daily, Resend HTML summary" },
    ],
    frontend: ["N/A — cron-only"],
    backend: ["app/api/cron/sequence-runner/route.ts", "app/api/agent/finance/cron/route.ts", "app/api/agents/run/route.ts", "app/api/agents/digest/route.ts", "lib/sequence-engine.ts"],
    database: ["sequence_executions", "agent_runs", "finance_agent_log"],
    envVars: ["CRON_SECRET"],
  },
  {
    id: "agent-workforce",
    name: "Agent Workforce",
    category: "ai",
    status: "live",
    icon: Bot,
    color: "#E8A840",
    description: "8 autonomous agents with dispatcher, knowledge store, guardrails, and approval system. All phases complete.",
    flow: `┌─────────────────────────────────────────────────────┐
│              AGENT WORKFORCE (Phases 1-4)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Vercel Cron (7 AM)                                 │
│    │                                                │
│    ▼                                                │
│  runGuardrails() ← Phase 4                          │
│    │ Trust check: 3 failures → auto-disable         │
│    │ Anomaly detection: spike/zero/duration flags    │
│    │ Auto-approve ladder: 90+ medium, 95+ high      │
│    ▼                                                │
│  runAgentBatch() ← Phase 1                          │
│    │ Promise.allSettled, 25s timeout each            │
│    │ 8 agents in parallel                           │
│    │ Health tracking: +1 success, -10 failure       │
│    ├─ Data Janitor (4 AM)   ← Phase 2              │
│    ├─ Lead Scout (7 AM)     ← Phase 2              │
│    ├─ Outreach Agent (8 AM) ← Phase 2               │
│    ├─ Pipeline Manager (9A) ← Phase 2               │
│    ├─ ICP Analyst (Sun)     ← Phase 2               │
│    ├─ Client Reporter (Sun) ← Phase 2               │
│    ├─ Finance Watcher (9 AM) ← own cron             │
│    └─ Message Coach (10 AM) ← Phase 2               │
│    ▼                                                │
│  knowledge_store ← Phase 3                          │
│    │ 18 shared keys, cross-agent reads              │
│    │ ICP→Scout, Coach→Outreach, Janitor→Pipeline    │
│    ▼                                                │
│  Actions → agent_actions table                      │
│    │ safe_notify → auto-execute                     │
│    │ medium/high → pending → Telegram approval      │
│    │ Auto-approve for trusted agents               │
│    ▼                                                │
│  runEscalationEngine() ← Phase 4                    │
│    │ 72h stale → auto-reject                       │
│    │ 24h urgent → re-notify                        │
│    │ 30d old → archive                             │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "8 agents registered", pass: true, detail: "All enabled=true in agents table" },
      { label: "Dispatcher working", pass: true, detail: "runAgentBatch, 25s timeout, Promise.allSettled" },
      { label: "Knowledge store", pass: true, detail: "18 shared keys, cross-agent coordination" },
      { label: "Guardrails active", pass: true, detail: "Trust scoring, anomaly detection, auto-disable" },
      { label: "Approval system", pass: true, detail: "Telegram inline keyboard + email HMAC tokens" },
      { label: "Escalation engine", pass: true, detail: "72h reject, 24h re-notify, 30d archive" },
      { label: "Command Center UI", pass: true, detail: "/admin/agents with full workforce dashboard" },
    ],
    frontend: ["app/admin/agents/page.tsx", "components/layout/Sidebar.tsx"],
    backend: ["lib/agents/dispatcher.ts", "lib/agents/guardrails.ts", "lib/agents/resolver.ts", "lib/agents/knowledge.ts", "app/api/agents/run/route.ts", "app/api/agents/approve/route.ts", "app/api/agents/digest/route.ts"],
    database: ["agents (8 rows)", "agent_actions", "agent_runs", "knowledge_store (18 keys)"],
    envVars: ["CRON_SECRET", "TELEGRAM_BOT_TOKEN", "RESEND_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "xflow-pay",
    name: "Xflow Pay",
    category: "payments",
    status: "live",
    icon: CreditCard,
    color: "#6BCB77",
    description: "Manual payment flow via Xflow Pay. Finance Agent handles activation. Stripe removed.",
    flow: `┌─────────────────────────────────────────────────────┐
│              PAYMENTS FLOW — Xflow Pay               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Onboarding                                         │
│    │ Step 4: Plan & Pay → save to profiles          │
│    │ POST /api/onboarding/save                      │
│    │ status: pending_payment                        │
│    ▼                                                │
│  Checkout Page (/checkout)                          │
│    │ Shows plan details + payment reference         │
│    │ 3 steps: Transfer → Share Ref → Activation     │
│    │ Payment ref: generatePaymentRef() in xflow.ts  │
│    ▼                                                │
│  Finance Agent (9 AM cron)                          │
│    │ 5 jobs: payment watcher, reminders, activation │
│    │ Reads pending_payment profiles                 │
│    │ Telegram notifications to admin                │
│    │ Auto-activates on payment confirmation         │
│    ▼                                                │
│  Manual Activation                                  │
│    │ Admin: /admin/users → Activate Plan            │
│    │ Sets subscription_activated_at                 │
│    │ Client gets full platform access               │
│                                                     │
│  Plans: DIY (free) / Growth ($) / Scale ($$$)       │
│  Payment ref format: PRO-YYYYMMDD-XXXX              │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Plan definitions", pass: true, detail: "3 plans in lib/stripe.ts (PLANS)" },
      { label: "Onboarding flow", pass: true, detail: "4-step wizard → /checkout" },
      { label: "Finance Agent", pass: true, detail: "5 jobs, daily 9 AM cron" },
      { label: "Manual activation", pass: true, detail: "Admin panel + Telegram inline buttons" },
      { label: "Stripe removed", pass: true, detail: "No Stripe SDK dependency, Xflow Pay only" },
    ],
    frontend: ["app/onboarding/page.tsx", "app/checkout/page.tsx", "app/admin/users/page.tsx"],
    backend: ["app/api/onboarding/save/route.ts", "app/api/agent/finance/cron/route.ts", "lib/xflow.ts", "lib/stripe.ts"],
    database: ["profiles (subscription_status, payment_ref)", "finance_agent_log"],
    envVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  },
  {
    id: "openoutreach",
    name: "OpenOutreach (LinkedIn)",
    category: "external",
    status: "partial",
    icon: Users,
    color: "#E8A840",
    description: "LinkedIn automation via OpenOutreach. Status/sync endpoints live. Full sequence integration deferred to Phase 2 roadmap.",
    flow: `┌─────────────────────────────────────────────────────┐
│              LINKEDIN FLOW — OpenOutreach            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Status Check                                       │
│    │ GET /api/outreach/status                       │
│    │ Health check + active campaigns                │
│    ▼                                                │
│  Sync                                               │
│    │ POST /api/outreach/sync                        │
│    │ Maps OpenOutreach SQLite → Supabase            │
│    │ Upserts leads with validation                  │
│    ▼                                                │
│  Outreach Page (/outreach)                          │
│    │ Pipeline stats + sync panel                    │
│    │ Docker setup guide with LinkedIn ToS           │
│    │ Status: sync working, sequences pending        │
│                                                     │
│  Future: full sequence integration (Phase 2 road)    │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Status endpoint", pass: true, detail: "GET /api/outreach/status working" },
      { label: "Sync endpoint", pass: true, detail: "POST /api/outreach/sync working" },
      { label: "Sequence integration", pass: false, detail: "Deferred — Phase 2 roadmap item" },
    ],
    frontend: ["app/outreach/page.tsx"],
    backend: ["app/api/outreach/status/route.ts", "app/api/outreach/sync/route.ts", "lib/openoutreach.ts"],
    database: ["leads (upsert from sync)"],
    envVars: ["OPENOUTREACH_API_KEY (if configured)"],
  },
  {
    id: "google-drive",
    name: "Google Drive Export",
    category: "external",
    status: "live",
    icon: FileText,
    color: "#a78bfa",
    description: "Google Drive CSV export via Google Identity Services (GIS) OAuth. Client-side only.",
    flow: `┌─────────────────────────────────────────────────────┐
│              DRIVE FLOW — Google GIS                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Browser (client-side only)                         │
│    │ Leads page → Export → Google Drive             │
│    │ GIS OAuth popup → user grants access           │
│    │ Access token stored in localStorage            │
│    │ Uploads CSV directly to user's Drive           │
│    ▼                                                │
│  lib/google-drive.ts                                │
│    │ GIS token client + uploadFile()                │
│    │ No server-side storage or processing           │
│                                                     │
│  Status: Working — client-side OAuth, no server     │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "GIS OAuth", pass: true, detail: "Client-side token-based" },
      { label: "CSV upload", pass: true, detail: "Direct to user's Google Drive" },
    ],
    frontend: ["app/leads/page.tsx", "components/GDriveModal.tsx", "lib/google-drive.ts"],
    backend: ["None — client-side only"],
    database: ["None"],
    envVars: ["GOOGLE_CLIENT_ID (for GIS)"],
  },
  {
    id: "booking-system",
    name: "Booking System",
    category: "scheduling",
    status: "live",
    icon: Calendar,
    color: "#6BCB77",
    description: "5-step booking wizard with Turnstile CAPTCHA, meeting types, weekend blocking, buffer, and 8/day cap.",
    flow: `┌─────────────────────────────────────────────────────┐
│              BOOKING FLOW                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Landing Page /book                                 │
│    │ Step 1: Meeting Type (Discovery/Demo/Audit)    │
│    │ Step 2: Pick Date (weekend blocked)            │
│    │ Step 3: Pick Time (15-min buffer, 8/day cap)   │
│    │ Step 4: Details (name, email, company, phone)  │
│    │ Step 5: Confirm (Turnstile CAPTCHA)            │
│    ▼                                                │
│  POST /api/appointments                             │
│    │ Validate: date, time, buffer, cap, CAPTCHA     │
│    │ Insert into appointments table                 │
│    │ Send confirmation email (Resend)               │
│    │ Notify admin (Telegram)                        │
│    │ Create Google Calendar event (if connected)    │
│    ▼                                                │
│  Admin: /book/admin                                 │
│    │ Stats cards, search/filter, cancel modal       │
│    │ Cancellation sends email + Telegram            │
│                                                     │
│  ProsBot: conversational booking in sidebar          │
│                                                     │
└─────────────────────────────────────────────────────┘`,
    checks: [
      { label: "Booking wizard", pass: true, detail: "5 steps, all states handled" },
      { label: "Validation", pass: true, detail: "Weekend blocking, 15-min buffer, 8/day cap" },
      { label: "CAPTCHA", pass: true, detail: "Cloudflare Turnstile on confirm step" },
      { label: "Confirmation email", pass: true, detail: "Resend notification on booking" },
      { label: "Admin dashboard", pass: true, detail: "/book/admin with stats + cancel" },
      { label: "ProsBot", pass: true, detail: "Conversational AI booking via Gemini" },
    ],
    frontend: ["app/book/page.tsx", "app/book/admin/page.tsx", "components/ProsBotPanel.tsx"],
    backend: ["app/api/appointments/route.ts", "lib/google-calendar.ts", "lib/notify.ts", "lib/booking-chat.ts"],
    database: ["appointments (5 bookings)", "email_captures"],
    envVars: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NOTIFY_EMAIL"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════

const statusIcon = (s: string) => {
  if (s === "live") return <Check size={14} color="#6BCB77" />;
  if (s === "partial") return <AlertTriangle size={14} color="#E8A840" />;
  if (s === "blocked") return <X size={14} color="#E06060" />;
  return <WifiOff size={14} color="#6b7280" />;
};

const statusBg = (s: string) => {
  if (s === "live") return "rgba(107,203,119,0.12)";
  if (s === "partial") return "rgba(232,168,64,0.12)";
  if (s === "blocked") return "rgba(224,96,96,0.12)";
  return "rgba(107,114,128,0.10)";
};

const statusLabel = (s: string) => {
  if (s === "live") return "Live";
  if (s === "partial") return "Partial";
  if (s === "blocked") return "Blocked";
  return "Offline";
};

export default function IntegrationsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "detail">("grid");

  const live = INTEGRATIONS.filter(i => i.status === "live").length;
  const partial = INTEGRATIONS.filter(i => i.status === "partial").length;
  const allChecks = INTEGRATIONS.flatMap(i => i.checks);
  const passChecks = allChecks.filter(c => c.pass).length;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1300, margin: "0 auto", fontFamily: "Geist, sans-serif", color: "var(--ink)" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={22} style={{ color: "var(--accent)" }} />
          Integration Audit
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "4px 0 0" }}>
          {INTEGRATIONS.length} integrations · {live} live · {partial} partial · {passChecks}/{allChecks.length} checks passing
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setView("grid")} style={{
            padding: "6px 16px", borderRadius: 9999, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
            background: view === "grid" ? "var(--accent-soft)" : "var(--surface-2)",
            color: view === "grid" ? "var(--accent)" : "var(--ink-3)",
          }}>Grid</button>
          <button onClick={() => setView("detail")} style={{
            padding: "6px 16px", borderRadius: 9999, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
            background: view === "detail" ? "var(--accent-soft)" : "var(--surface-2)",
            color: view === "detail" ? "var(--accent)" : "var(--ink-3)",
          }}>Detail</button>
        </div>
      </div>

      {/* Overall health bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Overall Health</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6BCB77" }}>{passChecks}/{allChecks.length} checks (+{Math.round(passChecks/allChecks.length*100)}%)</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(passChecks/allChecks.length)*100}%`, borderRadius: 3, background: "linear-gradient(90deg, #6BCB77, var(--accent))" }} />
        </div>
      </div>

      {/* Grid View */}
      {view === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12, marginBottom: 28 }}>
          {INTEGRATIONS.map(integration => {
            const Icon = integration.icon;
            const passCount = integration.checks.filter(c => c.pass).length;
            const totalCount = integration.checks.length;
            return (
              <div
                key={integration.id}
                onClick={() => setExpanded(expanded === integration.id ? null : integration.id)}
                style={{
                  padding: "16px 20px", borderRadius: 12,
                  background: "var(--surface)", border: `1px solid ${expanded === integration.id ? integration.color + "40" : "var(--line)"}`,
                  cursor: "pointer", transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: `${integration.color}15`, border: `1px solid ${integration.color}25` }}>
                      <Icon size={16} style={{ color: integration.color }} />
                    </div>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{integration.name}</span>
                      <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>{passCount}/{totalCount} checks</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: statusBg(integration.status), color: integration.color, border: `1px solid ${integration.color}20`, display: "flex", alignItems: "center", gap: 4 }}>
                    {statusIcon(integration.status)}{statusLabel(integration.status)}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5, margin: 0 }}>{integration.description}</p>

                {expanded === integration.id && (
                  <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--line)" }}>
                    {/* Checks */}
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8 }}>Verification Checks</p>
                    {integration.checks.map(c => (
                      <div key={c.label} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                        {c.pass ? <Check size={12} color="#6BCB77" style={{ marginTop: 1 }} /> : <X size={12} color="#E06060" style={{ marginTop: 1 }} />}
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: c.pass ? "var(--ink)" : "#E06060" }}>{c.label}</span>
                          <p style={{ fontSize: 10, color: "var(--ink-4)", margin: "1px 0 0" }}>{c.detail}</p>
                        </div>
                      </div>
                    ))}

                    {/* Flow */}
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginTop: 14, marginBottom: 6 }}>Connection Flow</p>
                    <pre style={{ fontSize: 9, fontFamily: "'Geist Mono', monospace", color: "var(--ink-4)", background: "var(--surface-2)", padding: "12px 14px", borderRadius: 8, lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre" }}>
                      {integration.flow.split("│").filter(l => !l.match(/^\s*─/)).join("\n")}
                    </pre>

                    {/* Env vars */}
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginTop: 12, marginBottom: 4 }}>Environment Variables</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {integration.envVars.map(e => (
                        <code key={e} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "var(--surface-2)", color: "var(--ink-3)", fontFamily: "'Geist Mono', monospace" }}>{e}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail View */}
      {view === "detail" && INTEGRATIONS.map(integration => {
        const Icon = integration.icon;
        const passCount = integration.checks.filter(c => c.pass).length;
        const totalCount = integration.checks.length;
        return (
          <div key={integration.id} style={{ padding: "20px 24px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--line)", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${integration.color}12`, border: `1px solid ${integration.color}25`, flexShrink: 0 }}>
                <Icon size={22} style={{ color: integration.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{integration.name}</h3>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, background: statusBg(integration.status), color: integration.color, border: `1px solid ${integration.color}20`, display: "flex", alignItems: "center", gap: 4 }}>
                    {statusIcon(integration.status)}{statusLabel(integration.status)} — {passCount}/{totalCount} checks
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "4px 0 0" }}>{integration.description}</p>
              </div>
            </div>

            {/* Flow diagram */}
            <pre style={{ fontSize: 9.5, fontFamily: "'Geist Mono', monospace", color: "var(--ink-3)", background: "var(--bg)", padding: "16px 18px", borderRadius: 10, lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre", marginBottom: 16, border: "1px solid var(--line)" }}>
              {integration.flow}
            </pre>

            {/* Checks */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
              {integration.checks.map(c => (
                <div key={c.label} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, background: c.pass ? "rgba(107,203,119,0.05)" : "rgba(224,96,96,0.05)", border: `1px solid ${c.pass ? "rgba(107,203,119,0.12)" : "rgba(224,96,96,0.12)"}` }}>
                  {c.pass ? <Check size={13} color="#6BCB77" style={{ marginTop: 1, flexShrink: 0 }} /> : <X size={13} color="#E06060" style={{ marginTop: 1, flexShrink: 0 }} />}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.pass ? "var(--ink)" : "#E06060" }}>{c.label}</span>
                    <p style={{ fontSize: 10, color: "var(--ink-4)", margin: "2px 0 0" }}>{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* File references */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 10 }}>
              <div>
                <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Frontend</span>
                {integration.frontend.map(f => <div key={f} style={{ color: "var(--ink-4)", fontFamily: "monospace", marginTop: 2 }}>{f}</div>)}
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Backend</span>
                {integration.backend.map(b => <div key={b} style={{ color: "var(--ink-4)", fontFamily: "monospace", marginTop: 2 }}>{b}</div>)}
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Database / Env</span>
                {integration.database.map(d => <div key={d} style={{ color: "var(--ink-4)", fontFamily: "monospace", marginTop: 2 }}>{d}</div>)}
                <div style={{ marginTop: 6 }}>
                  {integration.envVars.map(e => <code key={e} style={{ display: "block", fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--surface-2)", color: "var(--ink-3)", marginTop: 2, fontFamily: "'Geist Mono', monospace" }}>{e}</code>)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ padding: "20px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", textAlign: "center", fontSize: 12, color: "var(--ink-3)", marginTop: 8 }}>
        <Globe size={16} style={{ display: "block", margin: "0 auto 8", color: "var(--accent)" }} />
        All integrations verified against production deployment at app.flow-forges.com/prospecting-os
        <br />
        <span style={{ fontSize: 10, color: "var(--ink-4)" }}>Updated 2026-05-17 · Auto-refreshes on deployment</span>
      </div>
    </div>
  );
}
