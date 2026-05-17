"use client";

import { useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portal-auth";
import { Users, Zap, TrendingUp, Mail, CalendarCheck } from "lucide-react";
import type { Lead } from "@/lib/types";

interface PortalStats {
  total: number;
  hot: number;
  contacted: number;
  meetings: number;
  avgScore: number;
}

const cardBg = "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))";
const cardBorder = "1px solid rgba(201,168,124,0.07)";

export default function PortalDashboard() {
  const { state } = usePortalAuth();
  const { client } = state;
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setError(null);
    (async () => {
      try {
        const basePath = window.location.pathname.startsWith("/prospecting-os") ? "/prospecting-os" : "";
        const [statsRes, leadsRes] = await Promise.all([
          fetch(`${basePath}/api/portal/stats?client_id=${encodeURIComponent(client.id)}`),
          fetch(`${basePath}/api/portal/leads?client_id=${encodeURIComponent(client.id)}`),
        ]);
        if (!statsRes.ok) throw new Error(`Stats fetch failed: ${statsRes.statusText}`);
        if (!leadsRes.ok) throw new Error(`Leads fetch failed: ${leadsRes.statusText}`);
        const statsData = await statsRes.json();
        const leadsData = await leadsRes.json();
        setStats(statsData);
        setLeads(Array.isArray(leadsData) ? (leadsData as Lead[]) : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
      setLoading(false);
    })();
  }, [client]);

  if (!client) return null;

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-5">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Welcome back, {client.name}</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{client.company} · {client.industry} · Active client</p>
        </div>
        <div className="rounded-xl p-8 text-center" style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
          <p className="text-[12px]" style={{ color: "var(--negative)" }}>Failed to load dashboard data. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Leads", value: stats ? stats.total.toLocaleString() : "—", icon: Users, color: "var(--accent)" },
    { label: "Hot Leads", value: stats ? String(stats.hot) : "—", icon: Zap, color: "var(--negative)" },
    { label: "Contacted", value: stats ? String(stats.contacted) : "—", icon: Mail, color: "var(--info)" },
    { label: "Avg Score", value: stats ? String(stats.avgScore) : "—", icon: TrendingUp, color: "var(--positive)" },
    { label: "Meetings", value: stats ? String(stats.meetings) : "—", icon: CalendarCheck, color: "var(--positive)" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Welcome back, {client.name}</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{client.company} · {client.industry} · Active client</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {statCards.map(stat => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>{stat.label}</span>
              <stat.icon size={13} style={{ color: stat.color }} />
            </div>
            <div className="text-[24px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>{loading ? "—" : stat.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>Recent Leads</h3>
          <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>{leads.length} total</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No leads assigned yet. Your account manager will add leads soon.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Name", "Title", "Company", "Score", "Status"].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 10).map(l => (
                <tr key={l.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  <td className="px-5 py-2.5 text-[12px] font-medium" style={{ color: "var(--ink)" }}>{l.name}</td>
                  <td className="px-5 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.title}</td>
                  <td className="px-5 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.company}</td>
                  <td className="px-5 py-2.5">
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                      style={l.score >= 80 ? { background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.18)" }
                        : l.score >= 60 ? { background: "rgba(201,168,124,0.08)", color: "var(--accent)", border: "1px solid rgba(201,168,124,0.15)" }
                          : { background: "rgba(212,148,132,0.08)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.15)" }}>
                      {l.score}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-[11px] capitalize" style={{ color: "var(--ink-3)" }}>{l.status || "new"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
