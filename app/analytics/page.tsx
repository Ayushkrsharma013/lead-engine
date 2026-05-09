"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart2, TrendingUp, Zap, Users, CheckCircle2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";

type DateRange = "7d" | "30d" | "90d" | "all";

const BUCKET_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#00ff88"];
const PIE_COLORS = ["#00d4ff", "#7c3aed", "#ff6b35", "#00ff88", "#f59e0b"];

function filterByDate<T extends { savedAt?: string; createdAt?: string; fetchedAt?: string }>(items: T[], range: DateRange): T[] {
  if (range === "all") return items;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 86400000;
  return items.filter(i => {
    const d = i.savedAt || i.createdAt || i.fetchedAt;
    return d ? new Date(d).getTime() >= cutoff : true;
  });
}

export default function AnalyticsPage() {
  const { state } = useApp();
  const { leads, messages } = state;
  const [range, setRange] = useState<DateRange>("30d");

  const filteredLeads = useMemo(() => filterByDate(leads, range), [leads, range]);
  const filteredMessages = useMemo(() => filterByDate(messages, range), [messages, range]);

  const hotLeads = filteredLeads.filter(l => l.score > 80).length;
  const wonDeals = filteredLeads.filter(l => l.status === "won").length;

  // Weekly leads added (last 8 weeks)
  const weeklyData = useMemo(() => {
    const weeks: Record<string, number> = {};
    const now = Date.now();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now - (i + 1) * 7 * 86400000);
      const end = new Date(now - i * 7 * 86400000);
      const key = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      weeks[key] = filteredLeads.filter(l => {
        const d = l.savedAt ? new Date(l.savedAt).getTime() : 0;
        return d >= start.getTime() && d < end.getTime();
      }).length;
    }
    return Object.entries(weeks).map(([name, count]) => ({ name, count }));
  }, [filteredLeads]);

  // Channel breakdown
  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of filteredMessages) {
      const key = m.messageType.replace(/_/g, " ");
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredMessages]);

  // Score distribution
  const scoreData = useMemo(() => {
    const buckets = [
      { name: "0-20", min: 0, max: 20 },
      { name: "20-40", min: 20, max: 40 },
      { name: "40-60", min: 40, max: 60 },
      { name: "60-80", min: 60, max: 80 },
      { name: "80-100", min: 80, max: 100 },
    ];
    return buckets.map(b => ({
      name: b.name,
      count: filteredLeads.filter(l => l.score >= b.min && l.score < (b.name === "80-100" ? 101 : b.max)).length,
    }));
  }, [filteredLeads]);

  // Pipeline funnel
  const funnelData = useMemo(() => {
    const statuses = ["new", "contacted", "replied", "hot", "meeting", "won"];
    const labels = ["Total", "Contacted", "Replied", "Hot", "Meeting", "Won"];
    return statuses.map((s, i) => ({
      name: labels[i],
      count: s === "new" ? filteredLeads.length : filteredLeads.filter(l => l.status === s || (s === "won" && l.kanbanColumn === "Closed Won")).length,
    }));
  }, [filteredLeads]);

  const RANGES: DateRange[] = ["7d", "30d", "90d", "all"];

  return (
    <>
      <TopBar title="Analytics" subtitle="Pipeline metrics and performance" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Date filter pills */}
        <div className="flex items-center gap-1.5">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                range === r ? "bg-accent-blue text-black" : "text-muted hover:text-text bg-white/[0.04]"
              }`}
            >
              {r === "all" ? "All" : r.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-4 gap-4">
          <MiniStat label="Leads Added" value={filteredLeads.length} icon={<Users size={14} />} color="#00d4ff" />
          <MiniStat label="Messages Sent" value={filteredMessages.length} icon={<TrendingUp size={14} />} color="#7c3aed" />
          <MiniStat label="Hot Leads" value={hotLeads} icon={<Zap size={14} />} color="#ff6b35" />
          <MiniStat label="Won Deals" value={wonDeals} icon={<CheckCircle2 size={14} />} color="#00ff88" />
        </div>

        {/* 2×2 Chart Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Weekly Leads Added */}
          <ChartCard title="Weekly Leads Added">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }} />
                <Bar dataKey="count" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Outreach Channels */}
          <ChartCard title="Outreach Channels">
            {channelData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {channelData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }} />
                  <Legend formatter={(v) => <span className="text-[11px] text-muted">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Score Distribution */}
          <ChartCard title="ICP Score Distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {scoreData.map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Pipeline Funnel */}
          <ChartCard title="Pipeline Funnel">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "var(--muted)", fontSize: 10 }} width={70} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }} />
                <Bar dataKey="count" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-text mb-3">{title}</h3>
      {children}
    </div>
  );
}

function MiniStat({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="text-lg font-bold text-text tabular-nums">{value.toLocaleString()}</div>
        <div className="text-[10px] text-muted">{label}</div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-[200px] text-xs text-muted">No data for this period</div>;
}
