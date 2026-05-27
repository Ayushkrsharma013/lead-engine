"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Zap, TrendingUp, Mail, CalendarCheck, Download, ChevronRight, MessageSquare, GitBranch, BarChart3, Slack, Layers, Settings, Inbox } from "lucide-react";
import type { UserProfile, PlanKey, ClientWorkspace } from "@/lib/types";
import { UpgradeCTA } from "@/components/client-portal/UpgradeCTA";

const cardBg = "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))";

interface DashboardData {
  profile: UserProfile | null;
  workspace: ClientWorkspace | null;
  allowedModules: string[];
  plan: PlanKey;
  core: { total: number; hot: number; contacted: number; avgScore: number; meetings: number };
  recentLeads: Array<{ id: string; name: string; title: string; company: string; industry: string; score: number; status: string }>;
  industryBreakdown: Array<{ industry: string; count: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  icebreakers: Array<{ leadName: string; company: string; body: string }>;
  slackConfigured: boolean;
  weeklyFlow: Array<{ day: string; count: number }>;
  activeSequences: number;
  conversionFunnel: Array<{ stage: string; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  new: "var(--ink-3)",
  contacted: "var(--info)",
  replied: "var(--accent-blue)",
  hot: "var(--negative)",
  meeting: "var(--accent)",
  won: "var(--positive)",
  lost: "var(--ink-4)",
};

const FUNNEL_COLORS = [
  "var(--ink-3)",
  "var(--info)",
  "var(--accent-blue)",
  "var(--negative)",
  "var(--accent)",
  "var(--positive)",
  "var(--ink-4)",
];

// Defends against CSV/formula injection (=, +, -, @, tab, CR) and escapes quotes.
function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const needsPrefix = /^[=+\-@\t\r]/.test(s);
  const safe = (needsPrefix ? "'" + s : s).replace(/"/g, '""');
  return `"${safe}"`;
}

function PipelineInsight({ core }: { core: { total: number; hot: number; contacted: number; avgScore: number; meetings: number } }) {
  if (core.total === 0) return null;
  const hotRate = Math.round((core.hot / core.total) * 100);
  const contactRate = Math.round((core.contacted / core.total) * 100);

  let verdict = "";
  let color = "var(--accent)";
  if (hotRate >= 20) { verdict = `${hotRate}% of your leads are hot — strong ICP match.`; color = "var(--positive)"; }
  else if (hotRate >= 10) { verdict = `${hotRate}% hot leads. ICP is working — room to refine.`; color = "var(--accent)"; }
  else { verdict = "Hot lead rate is low. Your account manager will review the ICP on the next call."; color = "var(--info)"; }

  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{
      background: "linear-gradient(135deg, rgba(232,168,64,0.04), rgba(232,168,64,0.01))",
      border: "1px solid rgba(232,168,64,0.10)",
    }}>
      <TrendingUp size={14} style={{ color, marginTop: 1, flexShrink: 0 }} />
      <div>
        <p className="text-[11px] font-semibold mb-0.5" style={{ color: "var(--ink)" }}>Pipeline Snapshot</p>
        <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>{verdict}</p>
        <p className="text-[10px] mt-1.5" style={{ color: "var(--ink-4)" }}>
          {contactRate}% contacted &nbsp;·&nbsp; avg score {core.avgScore}/100 &nbsp;·&nbsp; {core.meetings} meeting{core.meetings !== 1 ? "s" : ""} booked
        </p>
      </div>
    </div>
  );
}

function IndustryBars({ data }: { data: { industry: string; count: number }[] }) {
  if (!data.length) return null;
  const max = data[0]?.count || 1;

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Industry Breakdown</h3>
      <div className="space-y-2.5">
        {data.map(({ industry, count }) => (
          <div key={industry} className="flex items-center gap-3">
            <span className="text-[11px] w-24 truncate shrink-0" style={{ color: "var(--ink-3)" }}>{industry}</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(count / max) * 100}%`, background: "var(--accent)", opacity: 0.7 }}
              />
            </div>
            <span className="text-[11px] font-semibold tabular-nums w-6 text-right" style={{ color: "var(--ink)" }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusGrid({ data }: { data: { status: string; count: number }[] }) {
  if (!data.length) return null;

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Pipeline Status</h3>
      <div className="grid grid-cols-4 gap-2">
        {data.map(({ status, count }) => (
          <div key={status} className="rounded-lg p-3 text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <div className="text-[18px] font-bold tabular-nums" style={{ color: STATUS_COLORS[status] || "var(--ink)" }}>{count}</div>
            <div className="text-[9px] capitalize mt-0.5" style={{ color: "var(--ink-4)" }}>{status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IcebreakersPreview({ data }: { data: { leadName: string; company: string; body: string }[] }) {
  if (!data.length) return null;

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex items-center gap-2">
        <MessageSquare size={13} style={{ color: "var(--accent)" }} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Latest Icebreakers</h3>
      </div>
      <div className="space-y-2">
        {data.map((ib, i) => (
          <div key={i} className="rounded-lg px-3 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold" style={{ color: "var(--ink)" }}>{ib.leadName}</span>
              {ib.company ? <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>@{ib.company}</span> : null}
            </div>
            <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: "var(--ink-3)" }}>{ib.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyFlow({ data }: { data: { day: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex items-center gap-2">
        <BarChart3 size={13} style={{ color: "var(--accent)" }} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Weekly Lead Flow</h3>
      </div>
      <div className="flex items-end gap-2 h-24">
        {data.map(({ day, count }) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--ink-3)" }}>{count}</span>
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.max((count / max) * 100, 4)}%`,
                background: "linear-gradient(180deg, var(--accent), rgba(232,168,64,0.15))",
                minHeight: 2,
              }}
            />
            <span className="text-[9px]" style={{ color: "var(--ink-4)" }}>{day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConversionFunnel({ data }: { data: { stage: string; count: number }[] }) {
  if (!data.length) return null;
  const top = data[0]?.count || 1;

  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex items-center gap-2">
        <Layers size={13} style={{ color: "var(--accent)" }} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Conversion Funnel</h3>
      </div>
      <div className="space-y-1.5">
        {data.map(({ stage, count }, i) => (
          <div key={stage} className="flex items-center gap-3">
            <span className="text-[10px] capitalize w-16 shrink-0" style={{ color: "var(--ink-4)" }}>{stage}</span>
            <div className="flex-1 h-5 rounded" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-full rounded flex items-center justify-end px-2 transition-all duration-500"
                style={{
                  width: `${Math.max((count / top) * 100, 2)}%`,
                  background: FUNNEL_COLORS[i] || "var(--accent)",
                  opacity: 0.8,
                }}
              >
                <span className="text-[10px] font-bold tabular-nums" style={{ color: "#fff" }}>{count}</span>
              </div>
            </div>
            {i < data.length - 1 && (
              <span className="text-[9px] font-medium w-10 text-right" style={{ color: "var(--ink-4)" }}>
                {top > 0 ? `${Math.round((count / top) * 100)}%` : "—"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientPortalOverview() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const res = await fetch("/prospecting-os/api/client-portal/dashboard");
      if (res.ok) {
        const data = await res.json();
        setDash(data);
      }
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  if (!dash || !dash.profile) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>Unable to load dashboard</p>
        <p className="text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>Please try refreshing the page.</p>
      </div>
    );
  }

  const { core, recentLeads, plan, industryBreakdown, statusBreakdown, icebreakers, slackConfigured, weeklyFlow, activeSequences, conversionFunnel } = dash;

  const planLabel = plan === "pilot"
    ? "Founder's Pilot"
    : plan === "growth"
    ? "Growth"
    : plan === "scale"
    ? "Scale"
    : plan === "micro"
    ? "Micro-Offer"
    : "No plan";
  const hasGrowth = dash.allowedModules.includes('icebreakers');
  const hasScale = dash.allowedModules.includes('sequences');

  const handleExportCSV = async () => {
    const res = await fetch("/prospecting-os/api/client-portal/leads?limit=1000");
    if (!res.ok) return;
    const data = await res.json();
    const rows: string[] = ["Name,Title,Company,Industry,Score,Status,Email"];
    for (const l of data.leads) {
      rows.push(
        [
          csvEscape(l.name),
          csvEscape(l.title),
          csvEscape(l.company),
          csvEscape(l.industry),
          csvEscape(l.score),
          csvEscape(l.status || "new"),
          csvEscape(l.email),
        ].join(",")
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
          Welcome back{dash.profile?.display_name ? `, ${dash.profile.display_name}` : ""}
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
          {planLabel} · {core.total} leads delivered
        </p>
      </div>

      {/* Core stat cards — all plans */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {([
          { label: "Total Leads", value: core.total.toLocaleString(), icon: Users, color: "var(--accent)" },
          { label: "Hot (80+)", value: String(core.hot), icon: Zap, color: "var(--negative)" },
          { label: "Avg Score", value: String(core.avgScore), icon: TrendingUp, color: "var(--positive)" },
          { label: "Contacted", value: String(core.contacted), icon: Mail, color: "var(--info)" },
          { label: "Meetings", value: String(core.meetings), icon: CalendarCheck, color: "var(--accent-blue)" },
        ]).map(stat => (
          <div key={stat.label} className="rounded-xl p-4"
            style={{ background: cardBg, border: "1px solid var(--line)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>{stat.label}</span>
              <stat.icon size={13} style={{ color: stat.color }} />
            </div>
            <div className="text-[24px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Actions row — all plans */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          <Download size={13} /> Export CSV
        </button>
        <Link href="/book" className="text-[12px] font-medium transition-opacity hover:opacity-80" style={{ color: "var(--ink-3)" }}>
          Need help? Book a call →
        </Link>
      </div>

      {/* Pipeline insight — all plans */}
      <PipelineInsight core={core} />

      {/* Upgrade CTA — pilot → growth */}
      {plan === "pilot" && <UpgradeCTA currentPlan={plan} targetPlan="growth" />}

      {/* Growth+ sections */}
      {hasGrowth && (
        <div className="grid grid-cols-2 gap-4">
          <IndustryBars data={industryBreakdown} />
          <StatusGrid data={statusBreakdown} />
        </div>
      )}

      {hasGrowth && <IcebreakersPreview data={icebreakers} />}

      {/* Slack status — Growth+ */}
      {hasGrowth && (
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3">
            <Slack size={14} style={{ color: slackConfigured ? "var(--positive)" : "var(--ink-4)" }} />
            <div>
              <p className="text-[11px] font-semibold" style={{ color: "var(--ink)" }}>Slack Digest</p>
              <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>
                {slackConfigured ? "Configured — daily digests active" : "Not configured yet"}
              </p>
            </div>
          </div>
          <Link
            href="/client-portal/slack"
            className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            {slackConfigured ? "Manage" : "Set Up"} <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* Upgrade CTA — growth → scale */}
      {plan === "growth" && <UpgradeCTA currentPlan={plan} targetPlan="scale" />}

      {/* Scale sections */}
      {hasScale && <WeeklyFlow data={weeklyFlow} />}

      {hasScale && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2">
              <GitBranch size={13} style={{ color: "var(--accent)" }} />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Active Sequences</h3>
            </div>
            <div className="text-[32px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>{activeSequences}</div>
            <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
              {activeSequences > 0 ? `${activeSequences} sequence${activeSequences !== 1 ? "s" : ""} running for your leads` : "No sequences running yet"}
            </p>
            <Link
              href="/client-portal/sequences"
              className="inline-flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              View sequences <ChevronRight size={12} />
            </Link>
          </div>
          <ConversionFunnel data={conversionFunnel} />
        </div>
      )}

      {/* Scale quick actions */}
      {hasScale && (
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label: "View Leads", href: "/client-portal/leads", icon: Users },
            { label: "Icebreakers", href: "/client-portal/icebreakers", icon: MessageSquare },
            { label: "Analytics", href: "/client-portal/analytics", icon: BarChart3 },
            { label: "Settings", href: "/client-portal/settings", icon: Settings },
          ].map(action => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-medium transition-all"
              style={{ background: "var(--surface-2)", color: "var(--ink-3)", border: "1px solid var(--line)" }}
            >
              <action.icon size={12} /> {action.label}
            </Link>
          ))}
        </div>
      )}

      {/* Recent leads table — all plans */}
      {recentLeads.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Recent Leads</h3>
            <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>{core.total} total</span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Name", "Company", "Industry", "Score", "Status"].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentLeads.slice(0, 5).map(l => (
                <tr key={l.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  <td className="px-4 py-2.5 text-[12px] font-medium" style={{ color: "var(--ink)" }}>{l.name || "—"}</td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.company || "—"}</td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.industry || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                      style={l.score >= 80
                        ? { background: "rgba(107,203,119,0.10)", color: "var(--positive)", border: "1px solid rgba(107,203,119,0.18)" }
                        : l.score >= 60
                          ? { background: "rgba(232,168,64,0.08)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.15)" }
                          : { background: "rgba(212,148,132,0.08)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.15)" }}>
                      {l.score}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] capitalize" style={{ color: "var(--ink-3)" }}>{l.status || "new"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {core.total === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Inbox size={24} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
          <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--ink)" }}>No leads yet</p>
          <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
            Your leads will appear here once your account manager assigns them to your workspace.
          </p>
        </div>
      )}
    </div>
  );
}
