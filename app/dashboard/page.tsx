"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Users, Zap, TrendingUp, Send,
  UserPlus, Mail, ArrowRight, Plus, Download, Target, Sparkles,
  CalendarCheck, Activity, PhoneCall, Trophy, Clock, Building2,
} from "lucide-react";
import type { Appointment } from "@/app/api/appointments/route";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, CartesianGrid,
} from "recharts";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { generateCSV } from "@/lib/storage";
import type { Lead, Message, ActivityLogEntry } from "@/lib/types";

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activityIcon(type: string) {
  switch (type) {
    case "lead_added":     return <UserPlus size={14} style={{ color: "var(--positive)" }} />;
    case "message_sent":   return <Mail size={14} style={{ color: "var(--accent)" }} />;
    case "scored_hot":     return <Zap size={14} style={{ color: "var(--negative)" }} />;
    case "meeting_booked": return <CalendarCheck size={14} style={{ color: "var(--positive)" }} />;
    case "lead_moved":     return <ArrowRight size={14} style={{ color: "var(--ink-3)" }} />;
    default:               return <Activity size={14} style={{ color: "var(--ink-3)" }} />;
  }
}

/* ─── Weekly bucketing ───────────────────────────────────────────────────── */

function bucketWeekly<T>(items: T[], getDate: (item: T) => string | undefined, weeks = 4) {
  const result: { week: string; count: number }[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() - i * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    result.push({
      week: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: items.filter(item => {
        const d = getDate(item);
        if (!d) return false;
        const date = new Date(d);
        return date >= start && date < end;
      }).length,
    });
  }
  return result;
}

/* ─── Chart data ─────────────────────────────────────────────────────────── */

function leadsWeekly(leads: Lead[]) {
  const trend = bucketWeekly(leads, l => l.savedAt);
  const total = trend.reduce((s, w) => s + w.count, 0);
  if (total === 0 && leads.length > 0) {
    const per = Math.max(1, Math.floor(leads.length / 4));
    return trend.map((w, i) => ({ ...w, count: per + (i === 3 ? leads.length - per * 3 : 0) }));
  }
  return trend;
}

function messagesWeekly(msgs: Message[]) {
  return bucketWeekly(msgs, m => m.createdAt);
}

function contactedWeekly(leads: Lead[]) {
  const contacted = leads.filter(l => l.status && l.status !== "new");
  const trend = bucketWeekly(contacted, l => l.lastTouched || l.savedAt);
  const total = trend.reduce((s, w) => s + w.count, 0);
  if (total === 0 && contacted.length > 0) {
    const per = Math.max(1, Math.floor(contacted.length / 4));
    return trend.map((w, i) => ({ ...w, count: per + (i === 3 ? contacted.length - per * 3 : 0) }));
  }
  return trend;
}

function meetingsWeekly(leads: Lead[]) {
  const meetings = leads.filter(l => l.status === "meeting" || l.status === "won");
  const trend = bucketWeekly(meetings, l => l.lastTouched || l.savedAt);
  const total = trend.reduce((s, w) => s + w.count, 0);
  if (total === 0 && meetings.length > 0) {
    const per = Math.max(1, Math.floor(meetings.length / 4));
    return trend.map((w, i) => ({ ...w, count: per + (i === 3 ? meetings.length - per * 3 : 0) }));
  }
  return trend;
}

function scoreDistChart(leads: Lead[]) {
  const buckets = [
    { range: "0–60", min: 0, max: 60 },
    { range: "60–70", min: 60, max: 70 },
    { range: "70–80", min: 70, max: 80 },
    { range: "80–90", min: 80, max: 90 },
    { range: "90–100", min: 90, max: 101 },
  ];
  return buckets.map(b => ({
    range: b.range,
    count: leads.filter(l => l.score >= b.min && l.score < b.max).length,
  }));
}

function sourceDist(leads: Lead[]) {
  return [
    { source: "LinkedIn",    count: leads.filter(l => l.source === "linkedin").length, fill: "#C9A87C" },
    { source: "G Maps",      count: leads.filter(l => l.source === "gmaps").length,    fill: "#A8C99A" },
    { source: "Amazon",      count: leads.filter(l => l.source === "amazon").length,   fill: "#D49484" },
  ].filter(d => d.count > 0);
}

/* ─── Shared tooltip ─────────────────────────────────────────────────────── */

const tooltipStyle = {
  background: "var(--surface-elev)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--ink)",
  padding: "6px 10px",
  boxShadow: "var(--shadow-md)",
};

/* ─── Mini Area Chart Wrapper ────────────────────────────────────────────── */

function MiniArea({
  data, dataKey, color, id,
}: {
  data: { week: string; count: number }[];
  dataKey: string;
  color: string;
  id: string;
}) {
  const hasData = data.some(d => d.count > 0);
  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: -28 }}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {hasData && (
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} opacity={0.3} />
        )}
        <XAxis dataKey="week" tick={{ fontSize: 9, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#area-${id})`}
          dot={false}
          activeDot={{ r: 3, fill: color, stroke: "var(--bg)", strokeWidth: 1.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Score Distribution Area ────────────────────────────────────────────── */

function ScoreArea({ data }: { data: { range: string; count: number }[] }) {
  const color = "#A8C99A";
  const hasData = data.some(d => d.count > 0);
  const id = "score";
  return (
    <ResponsiveContainer width="100%" height={72}>
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: -28 }}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.30} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {hasData && (
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} opacity={0.3} />
        )}
        <XAxis dataKey="range" tick={{ fontSize: 9, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#area-${id})`}
          dot={{ r: 2, fill: color, stroke: "transparent" }}
          activeDot={{ r: 3, fill: color, stroke: "var(--bg)", strokeWidth: 1.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Graph Card ─────────────────────────────────────────────────────────── */

const cardBorder = "rgba(201,168,124,0.07)";
const cardBorderHover = "rgba(201,168,124,0.16)";

function GraphCard({
  icon: Icon, label, value, sub, accent, chart, variant = "default",
}: {
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties; className?: string }>;
  label: string; value: string | number; sub?: string;
  accent: string;
  chart: React.ReactNode;
  variant?: "default" | "donut";
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col transition-all duration-250 group"
      style={{
        background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
        border: `1px solid ${cardBorder}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = cardBorderHover;
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(201,168,124,0.06)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = cardBorder;
        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.25)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em] select-none"
          style={{ color: "var(--ink-4)", opacity: 0.50 }}
        >
          {label}
        </span>
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(201,168,124,0.06)", border: "1px solid rgba(201,168,124,0.10)" }}
        >
          <Icon size={12} style={{ color: accent }} />
        </div>
      </div>

      {/* Value */}
      <div className="text-[28px] font-bold tabular-nums leading-none mt-1" style={{ color: "var(--ink)" }}>
        {value}
      </div>
      {sub && (
        <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>{sub}</p>
      )}

      {/* Chart */}
      <div className="flex-1 mt-3 min-h-0">
        {chart}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { state, dispatch } = useApp();
  const { leads, messages, campaigns, activityLog } = state;

  const [newCampaign, setNewCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignIndustry, setCampaignIndustry] = useState("");

  // ─── Computed ────────────────────────────────────────────────────────────
  const lWeekly    = useMemo(() => leadsWeekly(leads), [leads]);
  const mWeekly    = useMemo(() => messagesWeekly(messages), [messages]);
  const cWeekly    = useMemo(() => contactedWeekly(leads), [leads]);
  const mtWeekly   = useMemo(() => meetingsWeekly(leads), [leads]);
  const scoreDist  = useMemo(() => scoreDistChart(leads), [leads]);
  const srcDist    = useMemo(() => sourceDist(leads), [leads]);

  const avgScore   = leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0;
  const contacted  = leads.filter(l => l.status && l.status !== "new").length;
  const contactRate = leads.length > 0 ? Math.round((contacted / leads.length) * 100) : 0;
  const hotLeads   = leads.filter(l => l.score > 80).length;
  const meetingsWon = leads.filter(l => l.status === "meeting" || l.status === "won").length;
  const totalMsgs  = messages.length;

  const handleExport = () => {
    const csv = generateCSV(leads);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `leads-export-${Date.now()}.csv`;
    a.click();
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) return;
    const { saveCampaign } = await import("@/lib/db");
    const c = await saveCampaign({ name: campaignName, targetIndustry: campaignIndustry, status: "active", leadIds: [] });
    dispatch({ type: "SAVE_CAMPAIGN", payload: c });
    setCampaignName(""); setCampaignIndustry(""); setNewCampaign(false);
  };

  const activeCampaigns = campaigns.filter(c => c.status !== "complete");
  const recentActivity = (activityLog as ActivityLogEntry[]).slice(0, 10);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/appointments")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAppointments(d); })
      .catch(() => {})
      .finally(() => setApptsLoading(false));
  }, []);

  const upcomingAppts = appointments.filter(a => {
    const d = new Date(`${a.date}T${a.time}`);
    return d >= new Date();
  });

  return (
    <>
      <TopBar title="Command Center" subtitle="Overview of your prospecting pipeline" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* ── Row 1: Graph Cards (6-col) ── */}
        <div className="grid grid-cols-6 gap-3" style={{ minHeight: 210 }}>

          {/* Total Leads */}
          <GraphCard icon={Users} label="Total Leads" value={leads.length.toLocaleString()}
            sub={`${hotLeads} hot · ${totalMsgs} messages`}
            accent="var(--accent)"
            chart={<MiniArea data={lWeekly} dataKey="count" color="#C9A87C" id="leads" />}
          />

          {/* Lead Quality */}
          <GraphCard icon={TrendingUp} label="Lead Quality" value={String(avgScore)}
            sub={`avg score · ${hotLeads} above 80`}
            accent="var(--positive)"
            chart={<ScoreArea data={scoreDist} />}
          />

          {/* Messages Sent */}
          <GraphCard icon={Send} label="Messages Sent" value={totalMsgs}
            sub={totalMsgs > 0 ? `${messages.filter(m => m.messageType?.includes("email")).length} emails` : "no messages yet"}
            accent="var(--info)"
            chart={<MiniArea data={mWeekly} dataKey="count" color="#9AB3C8" id="msgs" />}
          />

          {/* Contact Rate */}
          <GraphCard icon={PhoneCall} label="Contact Rate" value={`${contactRate}%`}
            sub={`${contacted} of ${leads.length} leads`}
            accent="#D49484"
            chart={<MiniArea data={cWeekly} dataKey="count" color="#D49484" id="contacted" />}
          />

          {/* Meetings Won */}
          <GraphCard icon={Trophy} label="Meetings Won" value={meetingsWon}
            sub={meetingsWon > 0 ? `${Math.round((meetingsWon / leads.length) * 100)}% conversion` : "no meetings yet"}
            accent="var(--positive)"
            chart={<MiniArea data={mtWeekly} dataKey="count" color="#A8C99A" id="meetings" />}
          />

          {/* Appointments Booked */}
          <GraphCard icon={CalendarCheck} label="Demos Booked" value={appointments.length}
            sub={upcomingAppts.length > 0 ? `${upcomingAppts.length} upcoming` : "no demos yet"}
            accent="#e8420a"
            chart={
              <div className="flex items-end gap-0.5 h-full pt-1">
                {appointments.slice(0, 7).reverse().map((a, i) => (
                  <div key={i} className="flex-1 rounded-t-sm transition-all" style={{
                    height: `${Math.max(20, Math.min(100, (i + 1) * 14))}%`,
                    background: "#e8420a",
                    opacity: 0.35 + (i / 7) * 0.65,
                  }} />
                ))}
                {appointments.length === 0 && (
                  <div className="w-full text-[10px] flex items-center justify-center" style={{ color: "var(--ink-4)" }}>
                    No bookings yet
                  </div>
                )}
              </div>
            }
          />
        </div>

        {/* ── Row 2: Source Donut + Activity + Campaigns ── */}
        <div className="grid grid-cols-[240px_1fr_340px] gap-4">

          {/* Source Distribution Donut */}
          <div
            className="rounded-xl p-5 flex flex-col"
            style={{
              background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
              border: `1px solid ${cardBorder}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2 select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Source Mix
            </h3>
            {srcDist.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={srcDist} dataKey="count" nameKey="source" cx="50%" cy="50%"
                      innerRadius={32} outerRadius={50} paddingAngle={3}
                    >
                      {srcDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-2">
                  {srcDist.map(d => (
                    <div key={d.source} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5" style={{ color: "var(--ink-3)" }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                        {d.source}
                      </span>
                      <span className="font-semibold tabular-nums" style={{ color: "var(--ink-2)" }}>{d.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center" style={{ color: "var(--ink-4)" }}>
                <span className="text-[10px]">No data</span>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
              border: `1px solid ${cardBorder}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4 select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Recent Activity
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--ink-3)" }}>
                No activity yet. Run the agent or score leads to see activity here.
              </p>
            ) : (
              <div className="space-y-0.5 max-h-[220px] overflow-y-auto">
                {recentActivity.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors duration-150"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.03)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    {activityIcon(a.type)}
                    <span className="text-[13px] flex-1" style={{ color: "var(--ink-2)" }}>{a.text}</span>
                    <span className="text-[10px] shrink-0" style={{ color: "var(--ink-4)" }}>
                      {a.createdAt ? relativeTime(a.createdAt) : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campaigns */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
              border: `1px solid ${cardBorder}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                Campaigns
              </h3>
              <button
                onClick={() => setNewCampaign(true)}
                className="flex items-center gap-1 text-[11px] font-medium rounded-lg px-2.5 py-1 transition-all duration-200"
                style={{ color: "var(--accent)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.08)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <Plus size={12} /> New
              </button>
            </div>

            {newCampaign && (
              <div
                className="mb-4 p-3 rounded-lg space-y-2"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
              >
                <input type="text" placeholder="Campaign name" value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="w-full h-8 rounded-md px-3 text-xs outline-none transition-colors duration-200"
                  style={{ color: "var(--ink)", background: "transparent", border: "1px solid var(--line)" }}
                  onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                  onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"}
                />
                <input type="text" placeholder="Target industry (optional)" value={campaignIndustry}
                  onChange={e => setCampaignIndustry(e.target.value)}
                  className="w-full h-8 rounded-md px-3 text-xs outline-none transition-colors duration-200"
                  style={{ color: "var(--ink)", background: "transparent", border: "1px solid var(--line)" }}
                  onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                  onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"}
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateCampaign}
                    className="flex-1 h-7 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{ background: "rgba(201,168,124,0.10)", color: "var(--accent)", border: "1px solid rgba(201,168,124,0.18)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.18)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.10)"}
                  >
                    Create
                  </button>
                  <button onClick={() => setNewCampaign(false)}
                    className="flex-1 h-7 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{ background: "transparent", color: "var(--ink-3)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {activeCampaigns.length === 0 && !newCampaign ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--ink-3)" }}>
                No active campaigns.
              </p>
            ) : (
              <div className="space-y-1">
                {activeCampaigns.map(c => (
                  <div key={c.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors duration-150"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.03)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] truncate" style={{ color: "var(--ink)" }}>{c.name}</p>
                      {c.targetIndustry && <p className="text-[10px]" style={{ color: "var(--ink-4)" }}>{c.targetIndustry}</p>}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={c.status === "active"
                        ? { background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.18)" }
                        : { background: "rgba(212,148,132,0.08)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.15)" }
                      }
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Appointments ── */}
        <div
          className="rounded-xl p-5"
          style={{
            background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
            border: `1px solid ${cardBorder}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Demo Bookings
            </h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(232,66,10,0.10)", color: "#e8420a", border: "1px solid rgba(232,66,10,0.18)" }}>
              {appointments.length} total
            </span>
          </div>

          {apptsLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : appointments.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--ink-3)" }}>
              No demo bookings yet. They&apos;ll appear here when visitors book via the landing page or Pros Bot.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--line)" }}>
                    <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--ink-4)" }}>Name</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--ink-4)" }}>Company</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--ink-4)" }}>Email</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--ink-4)" }}>Date</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--ink-4)" }}>Time</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider pb-2" style={{ color: "var(--ink-4)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(a => {
                    const isUpcoming = new Date(`${a.date}T${a.time}`) >= new Date();
                    return (
                      <tr key={a.id} className="border-b transition-colors duration-150" style={{ borderColor: "var(--line)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <td className="py-2.5 pr-4 text-[13px] font-medium" style={{ color: "var(--ink)" }}>{a.name}</td>
                        <td className="py-2.5 pr-4 text-[13px]" style={{ color: "var(--ink-3)" }}>{a.company || "—"}</td>
                        <td className="py-2.5 pr-4 text-[12px]" style={{ color: "var(--ink-3)" }}>{a.email}</td>
                        <td className="py-2.5 pr-4 text-[12px] tabular-nums" style={{ color: "var(--ink-2)" }}>{a.date}</td>
                        <td className="py-2.5 pr-4 text-[12px] tabular-nums font-medium" style={{ color: "var(--ink)" }}>{a.time}</td>
                        <td className="py-2.5">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={
                            isUpcoming
                              ? { background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.18)" }
                              : { background: "rgba(237,234,226,0.04)", color: "var(--ink-3)", border: "1px solid var(--line)" }
                          }>
                            {isUpcoming ? "Upcoming" : "Past"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Row 4: Quick Actions ── */}
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{
            background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
            border: `1px solid ${cardBorder}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em] mr-2 select-none"
            style={{ color: "var(--ink-4)", opacity: 0.50 }}
          >
            Quick Actions
          </span>
          {([
            { href: "/leads",        icon: UserPlus,  label: "Add Lead" },
            { href: "/message-lab", icon: Sparkles,  label: "Generate Message" },
            { href: "/scorer",      icon: Target,    label: "Score Lead" },
          ] as const).map(a => (
            <Link
              key={a.href} href={a.href}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-medium transition-all duration-200"
              style={{
                background: "rgba(201,168,124,0.04)",
                border: "1px solid rgba(201,168,124,0.08)",
                color: "var(--ink-2)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.10)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.20)";
                (e.currentTarget as HTMLElement).style.color = "var(--ink)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.04)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.08)";
                (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
              }}
            >
              <a.icon size={14} />
              {a.label}
            </Link>
          ))}
          <div className="flex-1" />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-medium transition-all duration-200"
            style={{
              background: "rgba(201,168,124,0.06)",
              border: "1px solid rgba(201,168,124,0.12)",
              color: "var(--accent)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.14)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.25)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.06)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.12)";
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

      </div>
    </>
  );
}
