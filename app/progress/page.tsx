import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface ModuleStatus {
  name: string;
  route: string;
  status: "live" | "partial" | "placeholder" | "legacy";
  notes?: string;
}

interface RoadmapItem {
  action: string;
  where: string;
  done: boolean;
}

interface BugItem {
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  description: string;
}

// ─── Data (auto-generated from codebase analysis) ───────────────────────

const MODULES: ModuleStatus[] = [
  // Core app pages
  { name: "Landing Page", route: "/", status: "live" },
  { name: "Login", route: "/login", status: "live" },
  { name: "Signup", route: "/signup", status: "live" },
  { name: "Onboarding Wizard", route: "/onboarding", status: "live" },
  { name: "Checkout / Billing", route: "/checkout", status: "live" },
  { name: "Booking Wizard", route: "/book", status: "live" },
  { name: "Booking Admin", route: "/book/admin", status: "live" },
  { name: "Dashboard", route: "/dashboard", status: "live" },
  { name: "Lead Intelligence", route: "/leads", status: "live" },
  { name: "Message Lab", route: "/message-lab", status: "live" },
  { name: "Lead Scorer", route: "/scorer", status: "live" },
  { name: "Sequence Builder", route: "/sequences", status: "live" },
  { name: "Kanban Pipeline", route: "/kanban", status: "live" },
  { name: "Analytics", route: "/analytics", status: "live" },
  { name: "Client Manager", route: "/clients", status: "live" },
  { name: "LinkedIn Outreach", route: "/outreach", status: "live" },
  { name: "Settings", route: "/settings", status: "live" },
  // Admin
  { name: "User Management", route: "/admin/users", status: "live" },
  { name: "User Detail", route: "/admin/users/[id]", status: "live" },
  { name: "Finance Agent", route: "/agent/finance", status: "live" },
  // Client Portal
  { name: "Client Overview", route: "/client-portal", status: "live" },
  { name: "Client Leads", route: "/client-portal/leads", status: "live" },
  { name: "Client Icebreakers", route: "/client-portal/icebreakers", status: "live" },
  { name: "Client Analytics", route: "/client-portal/analytics", status: "live" },
  { name: "Client Sequences", route: "/client-portal/sequences", status: "live" },
  { name: "Client Slack", route: "/client-portal/slack", status: "live" },
  { name: "Client Billing", route: "/client-portal/billing", status: "live" },
  { name: "Client Settings", route: "/client-portal/settings", status: "live" },
  // Tools
  { name: "Free Pipeline Audit", route: "/tools/free-audit", status: "live" },
  { name: "Icebreaker Generator", route: "/tools/icebreaker-generator", status: "live" },
  // Legacy Portal (modernized — now uses API routes with supabaseAdmin)
  { name: "Portal Dashboard", route: "/portal", status: "live", notes: "Modernized — fetches via /api/portal/stats + /api/portal/leads" },
  { name: "Portal Login", route: "/portal/login", status: "live", notes: "bcrypt verify_portal_password RPC" },
  { name: "Portal Leads", route: "/portal/leads", status: "live", notes: "Modernized — fetches via /api/portal/leads" },
  { name: "Portal Billing", route: "/portal/billing", status: "live", notes: "Live finance_agent_log data" },
];

const API_ROUTES: { name: string; route: string; status: "live" | "partial" }[] = [
  { name: "Leads Scrape", route: "/api/leads", status: "live" },
  { name: "Leads Import", route: "/api/leads/import", status: "live" },
  { name: "Email Capture", route: "/api/leads/capture", status: "live" },
  { name: "Appointments CRUD", route: "/api/appointments", status: "live" },
  { name: "Google Calendar OAuth", route: "/api/auth/google-calendar/*", status: "live" },
  { name: "Outreach Status/Sync", route: "/api/outreach/*", status: "live" },
  { name: "Sequence Runner (Cron)", route: "/api/cron/sequence-runner", status: "live" },
  { name: "Sequence Launch/Cancel", route: "/api/sequence/*", status: "live" },
  { name: "Inbound Email (Resend)", route: "/api/inbound-email", status: "live" },
  { name: "Variant Stats", route: "/api/analytics/variant-stats", status: "live" },
  { name: "Business Analytics", route: "/api/analytics/business", status: "live" },
  { name: "Telegram Bot", route: "/api/agent/telegram", status: "live" },
  { name: "Finance Cron/Callback/Stats", route: "/api/agent/finance/*", status: "live" },
  { name: "Onboarding Save", route: "/api/onboarding/save", status: "live" },
  { name: "Admin Users CRUD", route: "/api/admin/users/*", status: "live" },
  { name: "Client Portal API", route: "/api/client-portal/*", status: "live" },
  { name: "Landing Email Capture", route: "/api/landing/email-capture", status: "live" },
  { name: "Icebreaker API", route: "/api/tools/icebreaker", status: "live" },
  { name: "Audit Request API", route: "/api/tools/audit-request", status: "live" },
  { name: "ProBot Chat", route: "/api/chat/bot", status: "live" },
  { name: "Portal Leads API", route: "/api/portal/leads", status: "live" },
  { name: "Portal Stats API", route: "/api/portal/stats", status: "live" },
];

const ROADMAP: RoadmapItem[] = [
  { action: "Enable leaked password protection", where: "Supabase Auth (blocked on free tier)", done: false },
  { action: "Configure Resend inbound webhook", where: "Resend dashboard → Webhooks", done: true },
  { action: "Set CRON_SECRET env var on Vercel", where: "Vercel → lead-engine → Env Variables", done: true },
  { action: "Set SENTRY_DSN env var (optional)", where: "Vercel", done: false },
  { action: "Add GEMINI_API_KEY env var", where: "Vercel", done: true },
];

const BUGS: BugItem[] = [];

const FUTURE: string[] = [
  "CRM integrations (HubSpot/Salesforce) — deferred, build in-house",
  "OpenOutreach sequence integration — connect LinkedIn steps to engine",
  "Email open/bounce tracking via Resend webhooks",
  "Automated winner selection in A/B testing",
  "Client portal billing history",
  "Multi-currency MRR tracking",
];

// ─── Agentic Workforce ──────────────────────────────────────────────────

interface AgentTask {
  num: number;
  task: string;
  done: boolean;
  commit?: string;
}

interface AgentRosterEntry {
  agent: string;
  slug: string;
  schedule: string;
  status: "live" | "stub";
}

interface RiskRule {
  action: string;
  level: "safe_notify" | "medium" | "high";
  execution: string;
}

const AGENT_TASKS: AgentTask[] = [
  { num: 1, task: "DB migration — agents, agent_actions, agent_runs + RLS + 8 seed rows", done: true, commit: "127f1e0" },
  { num: 2, task: "lib/agents/types.ts + lib/agents/tokens.ts (HMAC-SHA256)", done: true, commit: "1384ee0" },
  { num: 3, task: "lib/agents/dispatcher.ts — runAgentBatch, parallel execution, health score", done: true, commit: "479761c" },
  { num: 4, task: "7 stub agent modules in lib/agents/", done: true, commit: "14467ba" },
  { num: 5, task: "Finance Watcher integration — writes to agent_runs", done: true, commit: "2c0a58d" },
  { num: 6, task: "/api/agents/run cron endpoint (CRON_SECRET auth, maxDuration 300)", done: true, commit: "0ca3e0b" },
  { num: 7, task: "lib/agents/resolver.ts + /api/agents/approve GET endpoint (HMAC tokens)", done: true, commit: "d6e5abc" },
  { num: 8, task: "Telegram webhook callback_query handler (approve_agent/reject_agent)", done: true, commit: "8be44bd" },
  { num: 9, task: "/api/agents/digest daily email cron (6 AM)", done: true, commit: "383c6ec" },
  { num: 10, task: "/admin/agents Full Mission Control UI", done: true, commit: "50b95ef" },
  { num: 11, task: "Sidebar link + vercel.json cron entries (7 AM run + 6 AM digest)", done: true, commit: "current" },
];

const AGENT_ROSTER: AgentRosterEntry[] = [
  { agent: "Lead Scout", slug: "lead-scout", schedule: "7 AM daily", status: "stub" },
  { agent: "Outreach Agent", slug: "outreach-agent", schedule: "8 AM daily", status: "stub" },
  { agent: "Pipeline Manager", slug: "pipeline-manager", schedule: "9 AM daily", status: "stub" },
  { agent: "ICP Analyst", slug: "icp-analyst", schedule: "Sun 8 AM", status: "stub" },
  { agent: "Client Reporter", slug: "client-reporter", schedule: "Sun 8 AM", status: "stub" },
  { agent: "Finance Watcher", slug: "finance-watcher", schedule: "9 AM daily", status: "live" },
  { agent: "Data Janitor", slug: "data-janitor", schedule: "4 AM daily", status: "stub" },
  { agent: "Message Coach", slug: "message-coach", schedule: "10 AM daily", status: "stub" },
];

const RISK_CLASSIFICATION: RiskRule[] = [
  { action: "Update leads.kanban_column / score / status", level: "safe_notify", execution: "Auto" },
  { action: "Insert into activity_log / lead_activity_log", level: "safe_notify", execution: "Auto" },
  { action: "Flag lead as stale (update leads.notes)", level: "safe_notify", execution: "Auto" },
  { action: "Update agents.health_score", level: "safe_notify", execution: "Auto" },
  { action: "Launch a sequence for leads", level: "medium", execution: "Queue" },
  { action: "Send email / create campaign / modify sequence", level: "medium", execution: "Queue" },
  { action: "Archive leads", level: "medium", execution: "Queue" },
  { action: "Send client report", level: "medium", execution: "Queue" },
  { action: "Delete any record", level: "high", execution: "Queue" },
  { action: "Bulk status change (>10 leads)", level: "high", execution: "Queue" },
  { action: "Modify another agent's config", level: "high", execution: "Queue" },
];

const agentTasksDone = AGENT_TASKS.filter((t) => t.done).length;
const liveAgents = AGENT_ROSTER.filter((a) => a.status === "live").length;

// ─── Computed stats ────────────────────────────────────────────────────

const liveModules = MODULES.filter((m) => m.status === "live").length;
const partialModules = MODULES.filter((m) => m.status === "partial").length;
const placeholderModules = MODULES.filter((m) => m.status === "placeholder").length;
const legacyModules = MODULES.filter((m) => m.status === "legacy").length;
const liveApis = API_ROUTES.filter((a) => a.status === "live").length;
const doneRoadmap = ROADMAP.filter((r) => r.done).length;
const totalBugs = BUGS.length;
const highBugs = BUGS.filter((b) => b.severity === "high").length;
const mediumBugs = BUGS.filter((b) => b.severity === "medium").length;

const overallPct = Math.round(
  ((liveModules + liveApis) / (MODULES.length + API_ROUTES.length)) * 100
);

// ─── Read CLAUDE.md for last-updated timestamp ─────────────────────────

let lastUpdated = "Unknown";
try {
  const claudePath = join(process.cwd(), "CLAUDE.md");
  const claudeContent = readFileSync(claudePath, "utf-8");
  const dateMatch = claudeContent.match(/### (\d{4}-\d{2}-\d{2})/);
  if (dateMatch) lastUpdated = dateMatch[1];

  // Extract the latest session date
  const allDates = claudeContent.match(/### (\d{4}-\d{2}-\d{2})/g);
  if (allDates && allDates.length > 0) {
    lastUpdated = allDates[allDates.length - 1].replace("### ", "");
  }
} catch {
  // fallback
}

// ─── Styles ─────────────────────────────────────────────────────────────

const accent = "#E8A840";
const bg = "#000000";
const surface = "#0A0A0A";
const surface2 = "#0E0E0E";
const line = "rgba(255,255,255,.06)";
const ink = "#EBEBEB";
const ink2 = "#B0B0B0";
const ink3 = "#808080";
const ink4 = "#555555";
const green = "#6BCB77";
const red = "#E06060";
const blue = "#3b82f6";

const pillColors: Record<string, string> = {
  live: green,
  partial: accent,
  placeholder: red,
  legacy: ink3,
};

const sevColors: Record<string, string> = {
  high: red,
  medium: accent,
  low: blue,
};

// ─── Component ──────────────────────────────────────────────────────────

export default function ProgressPage() {
  return (
    <div
      style={{
        background: bg,
        color: ink,
        minHeight: "100vh",
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: ink,
              }}
            >
              Prospecting OS
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 9999,
                background: `rgba(107,203,119,0.12)`,
                color: green,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Live
            </span>
          </div>
          <p style={{ fontSize: 14, color: ink3, margin: 0 }}>
            Application Analysis & Progress Tracker — auto-updates when CLAUDE.md is pushed
          </p>
          <p style={{ fontSize: 12, color: ink3, margin: "4px 0 0" }}>
            Last CLAUDE.md update: {lastUpdated} &nbsp;|&nbsp;{" "}
            <a
              href="/prospecting-os"
              style={{ color: accent, textDecoration: "none" }}
            >
              app.flow-forges.com/prospecting-os
            </a>
          </p>
        </div>

        {/* Big stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <StatCard label="Overall Complete" value={`${overallPct}%`} color={green} />
          <StatCard label="Live Pages" value={String(liveModules)} color={green} sub={`/ ${MODULES.length} total`} />
          <StatCard label="Live APIs" value={String(liveApis)} color={blue} sub={`/ ${API_ROUTES.length} total`} />
          <StatCard label="Open Bugs" value={String(totalBugs)} color={highBugs > 0 ? red : green} sub={`${highBugs} high, ${mediumBugs} medium`} />
          <StatCard label="Config Tasks" value={`${doneRoadmap}/${ROADMAP.length}`} color={accent} sub="external setup" />
          <StatCard label="Agent Workforce" value={`${liveAgents}/${AGENT_ROSTER.length}`} color={blue} sub={`${agentTasksDone}/${AGENT_TASKS.length} tasks done`} />
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: ink2 }}>
              Overall Progress
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: accent }}>
              {overallPct}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: surface2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${overallPct}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${accent}, ${green})`,
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>

        {/* Pages grid */}
        <Section title="Application Pages" count={`${liveModules} live / ${MODULES.length} total`}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 8,
            }}
          >
            {MODULES.map((m) => (
              <div
                key={m.route}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: surface,
                  border: `1px solid ${line}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: pillColors[m.status],
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.name}
                  </div>
                  {m.notes && (
                    <div
                      style={{
                        fontSize: 11,
                        color: ink3,
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.notes}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: `${pillColors[m.status]}15`,
                    color: pillColors[m.status],
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* API Routes */}
        <Section title="API Routes" count={`${liveApis} live / ${API_ROUTES.length} total`}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 8,
            }}
          >
            {API_ROUTES.map((a) => (
              <div
                key={a.route}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: surface,
                  border: `1px solid ${line}`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: pillColors[a.status],
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: ink,
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: ink3,
                      marginTop: 2,
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {a.route}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: `${pillColors[a.status]}15`,
                    color: pillColors[a.status],
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Roadmap */}
        <Section title="External Configuration" count={`${doneRoadmap}/${ROADMAP.length} done`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ROADMAP.map((item) => (
              <div
                key={item.action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: surface,
                  border: `1px solid ${line}`,
                  opacity: item.done ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {item.done ? "✓" : "○"}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: item.done ? ink3 : ink,
                    textDecoration: item.done ? "line-through" : "none",
                  }}
                >
                  {item.action}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: ink3,
                    padding: "3px 10px",
                    borderRadius: 9999,
                    background: surface2,
                    flexShrink: 0,
                  }}
                >
                  {item.where}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Bugs */}
        <Section title="Known Issues" count={`${totalBugs} total`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {BUGS.map((bug, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: surface,
                  border: `1px solid ${line}`,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 9999,
                    background: `${sevColors[bug.severity]}18`,
                    color: sevColors[bug.severity],
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {bug.severity}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ink }}>
                    {bug.description}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: ink3,
                      marginTop: 3,
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {bug.file}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Future */}
        <Section title="Future Enhancements" count={`${FUTURE.length} planned`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FUTURE.map((item) => (
              <div
                key={item}
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: surface,
                  border: `1px solid ${line}`,
                  fontSize: 13,
                  color: ink2,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Agentic Workforce ──────────────────────────────────── */}
        <Section
          title="Agentic Workforce — Phase 1"
          count={`${liveAgents}/${AGENT_ROSTER.length} live · ${agentTasksDone}/${AGENT_TASKS.length} tasks done`}
        >
          {/* Architecture */}
          <div
            style={{
              marginBottom: 24,
              padding: 20,
              borderRadius: 12,
              background: surface,
              border: `1px solid ${line}`,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              lineHeight: 1.8,
              color: ink3,
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
            {`Vercel Cron (7 AM) ──▶ /api/agents/run ──▶ AgentDispatcher
                                              │ reads agents table (enabled only)
                                              │ runs lib/agents/*.ts in parallel
                                              │ 25s timeout per agent
                                              ├─▶ safeNotify → auto-execute
                                              └─▶ riskyActions → agent_actions (pending)
                                                                → Telegram inline keyboard
                                                                → Email approve/reject links

Vercel Cron (9 AM) ──▶ /api/agent/finance/cron ──▶ Finance Watcher
Vercel Cron (6 AM) ──▶ /api/agents/digest ──▶ Resend HTML email
/api/agent/telegram  ──▶ handles approve_agent:/reject_agent: callbacks
/api/agents/approve   ──▶ email one-click approve/reject (HMAC token)
/admin/agents         ──▶ Full Mission Control UI`}
          </div>

          {/* Agent Roster */}
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ink2,
              marginBottom: 12,
            }}
          >
            Agent Roster
          </h3>
          <div style={{ overflowX: "auto", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${line}` }}>
                  {["Agent", "Slug", "Schedule", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 14px",
                        textAlign: "left",
                        fontSize: 10,
                        fontWeight: 700,
                        color: ink4,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AGENT_ROSTER.map((a) => (
                  <tr
                    key={a.slug}
                    style={{ borderBottom: `1px solid ${line}` }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: ink,
                      }}
                    >
                      {a.agent}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 11,
                        color: ink3,
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      {a.slug}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 11,
                        color: ink2,
                      }}
                    >
                      {a.schedule}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 10px",
                          borderRadius: 9999,
                          background:
                            a.status === "live"
                              ? `${green}18`
                              : `${ink3}10`,
                          color: a.status === "live" ? green : ink3,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          border: `1px solid ${a.status === "live" ? green : ink3}20`,
                        }}
                      >
                        {a.status === "live" ? "Live" : "Stub"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phase 1 Tasks */}
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ink2,
              marginBottom: 12,
            }}
          >
            Phase 1 Implementation Tasks
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
            {AGENT_TASKS.map((t) => (
              <div
                key={t.num}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: surface,
                  border: `1px solid ${line}`,
                  opacity: t.done ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    background: t.done ? `${green}15` : `${accent}15`,
                    color: t.done ? green : accent,
                    flexShrink: 0,
                  }}
                >
                  {t.done ? "✓" : t.num}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.done ? ink3 : ink,
                    textDecoration: t.done ? "line-through" : "none",
                  }}
                >
                  {t.task}
                </span>
                {t.commit && (
                  <code
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: surface2,
                      color: ink4,
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {t.commit}
                  </code>
                )}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: t.done ? `${green}15` : `${accent}10`,
                    color: t.done ? green : accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t.done ? "Done" : "Pending"}
                </span>
              </div>
            ))}
          </div>

          {/* Risk Classification */}
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ink2,
              marginBottom: 12,
            }}
          >
            Safe vs Risky Action Classification
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${line}` }}>
                  {["Action", "Risk Level", "Execution"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 14px",
                        textAlign: "left",
                        fontSize: 10,
                        fontWeight: 700,
                        color: ink4,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RISK_CLASSIFICATION.map((r, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: `1px solid ${line}` }}
                  >
                    <td
                      style={{
                        padding: "9px 14px",
                        fontSize: 12,
                        color: ink,
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      {r.action}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background:
                            r.level === "safe_notify"
                              ? `${green}12`
                              : r.level === "medium"
                                ? `${accent}12`
                                : `${red}12`,
                          color:
                            r.level === "safe_notify"
                              ? green
                              : r.level === "medium"
                                ? accent
                                : red,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {r.level}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "9px 14px",
                        fontSize: 11,
                        fontWeight: 600,
                        color:
                          r.execution === "Auto" ? green : accent,
                      }}
                    >
                      {r.execution}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Footer */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: `1px solid ${line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: ink3 }}>
            Auto-updates when CLAUDE.md is pushed to main → Vercel deploy triggers → page refreshes
          </span>
          <div style={{ display: "flex", gap: 16 }}>
            <a
              href="/prospecting-os"
              style={{
                fontSize: 12,
                color: accent,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              App →
            </a>
            <a
              href="https://github.com/Ayushkrsharma013/lead-engine/blob/main/CLAUDE.md"
              target="_blank"
              rel="noopener"
              style={{
                fontSize: 12,
                color: accent,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              CLAUDE.md on GitHub →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: "20px 24px",
        borderRadius: 12,
        background: surface,
        border: `1px solid ${line}`,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: ink3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: ink3, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: ink,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        <span style={{ fontSize: 12, color: ink3 }}>{count}</span>
      </div>
      {children}
    </div>
  );
}
