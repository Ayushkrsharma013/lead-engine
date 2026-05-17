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
  // Legacy
  { name: "Portal (Legacy)", route: "/portal", status: "legacy", notes: "Superseded by /client-portal" },
  { name: "Portal Login (Legacy)", route: "/portal/login", status: "legacy" },
  { name: "Portal Leads (Legacy)", route: "/portal/leads", status: "legacy" },
  { name: "Portal Billing (Legacy)", route: "/portal/billing", status: "legacy", notes: "Superseded by /client-portal" },
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
];

const ROADMAP: RoadmapItem[] = [
  { action: "Enable leaked password protection", where: "Supabase Auth dashboard → Email provider", done: false },
  { action: "Configure Resend inbound webhook", where: "Resend dashboard → Webhooks", done: false },
  { action: "Set CRON_SECRET env var on Vercel", where: "Vercel → lead-engine → Env Variables", done: false },
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
