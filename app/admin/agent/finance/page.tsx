"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, Users, Clock, UserPlus, BarChart2,
  Activity, CheckCircle2, Zap, RefreshCw,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";

interface FinanceStats {
  mrr: string;
  mrrRaw: number;
  activeCount: number;
  pendingCount: number;
  newThisMonth: number;
  mrrTrend: Array<{ month: string; mrr: number }>;
  activeClients: Array<{ id: string; email: string; plan: string; activatedAt: string | null }>;
  pendingClients: Array<{ id: string; email: string; plan: string; paymentRef: string | null; daysPending: number }>;
  recentLogs: Array<{ id: string; eventType: string; profileId: string; status: string; payload: unknown; telegramMsgId: number | null; createdAt: string }>;
}

const BASE = "/prospecting-os";

export default function FinanceAgentPage() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/agent/finance/stats`);
      const data = (await res.json()) as FinanceStats & { error?: string };
      if (!data.error) setStats(data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleActivate = async (profileId: string) => {
    setActivating(profileId);
    try {
      const res = await fetch(`${BASE}/api/agent/finance/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query: { data: `activate:${profileId}`, id: "web_dashboard" } }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setToast(`Activated successfully`);
        setTimeout(() => setToast(""), 3000);
        fetchStats();
      }
    } catch { /* silent */ }
    setActivating(null);
  };

  const cardBorder = "1px solid var(--border)";

  if (loading) {
    return (
      <>
        <TopBar title="Finance Agent" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      </>
    );
  }

  if (!stats) {
    return (
      <>
        <TopBar title="Finance Agent" subtitle="Access denied or not configured" />
        <div className="flex-1 flex items-center justify-center">
          <p style={{ color: "var(--muted)" }}>Unable to load finance data. Ensure you are a super_admin.</p>
        </div>
      </>
    );
  }

  const eventLabel = (type: string) => {
    switch (type) {
      case "payment_request": return "Payment Request";
      case "reminder_sent": return "Reminder";
      case "followup_sent": return "Follow-up Draft";
      case "monthly_summary": return "Monthly Summary";
      default: return type;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "actioned": return "var(--accent-green)";
      case "pending": return "#f59e0b";
      case "dismissed": return "var(--muted)";
      default: return "var(--muted)";
    }
  };

  return (
    <>
      <TopBar title="Finance Agent" subtitle="Autonomous payment operations & revenue monitoring" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-6 z-50 px-4 py-2 rounded-lg text-[13px] font-medium animate-fade-in"
            style={{ background: "var(--accent-green)", color: "#000" }}>
            {toast}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard icon={DollarSign} label="MRR" value={stats.mrr} sub={`${stats.activeCount} active clients`} color="var(--accent-green)" />
          <StatCard icon={Users} label="Active" value={String(stats.activeCount)} sub="paying clients" color="var(--accent-blue)" />
          <StatCard icon={Clock} label="Pending" value={String(stats.pendingCount)} sub="awaiting payment" color={stats.pendingCount > 0 ? "var(--accent-orange)" : "var(--muted)"} />
          <StatCard icon={UserPlus} label="New This Month" value={String(stats.newThisMonth)} sub="activations" color="var(--accent-purple)" />
        </div>

        {/* MRR Trend */}
        {stats.mrrTrend.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: cardBorder }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={14} style={{ color: "var(--muted)" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>MRR Trend</h3>
            </div>
            <div className="flex items-end gap-3 h-24">
              {stats.mrrTrend.map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
                    ${m.mrr.toLocaleString()}
                  </span>
                  <div
                    className="w-full rounded-t-md transition-all duration-500"
                    style={{
                      height: stats.mrrRaw > 0 ? `${Math.max(4, (m.mrr / stats.mrrRaw) * 100)}%` : "4px",
                      background: i === stats.mrrTrend.length - 1
                        ? "linear-gradient(180deg, var(--accent-green), rgba(0,255,136,0.2))"
                        : "linear-gradient(180deg, var(--muted), rgba(107,107,128,0.2))",
                    }}
                  />
                  <span className="text-[9px]" style={{ color: "var(--muted)" }}>{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Payment Table */}
        {stats.pendingClients.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: cardBorder }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: cardBorder }}>
              <Clock size={14} style={{ color: "var(--accent-orange)" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-orange)" }}>
                Pending Payment ({stats.pendingClients.length})
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: cardBorder }}>
                  {["Client", "Plan", "Ref", "Days Pending", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.pendingClients.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "var(--text)" }}>{p.email}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "var(--muted)" }}>{p.plan}</td>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "var(--muted)" }}>{p.paymentRef || "—"}</td>
                    <td className="px-4 py-3 text-[12px] tabular-nums" style={{ color: p.daysPending > 3 ? "var(--accent-orange)" : "var(--muted)" }}>
                      {p.daysPending}d
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleActivate(p.id)}
                        disabled={activating === p.id}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 flex items-center gap-1"
                        style={{
                          background: "rgba(0,255,136,0.10)",
                          border: "1px solid rgba(0,255,136,0.20)",
                          color: "var(--accent-green)",
                        }}
                      >
                        <Zap size={11} />
                        {activating === p.id ? "Activating..." : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Active Clients */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: cardBorder }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: cardBorder }}>
            <Users size={14} style={{ color: "var(--accent-blue)" }} />
            <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Active Clients ({stats.activeClients.length})
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: cardBorder }}>
                {["Client", "Plan", "Activated"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.activeClients.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>No active clients yet</td>
                </tr>
              ) : (
                stats.activeClients.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "var(--text)" }}>{c.email}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "var(--muted)" }}>{c.plan}</td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "var(--muted)" }}>
                      {c.activatedAt ? new Date(c.activatedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Agent Activity Log */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: cardBorder }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: cardBorder }}>
            <Activity size={14} style={{ color: "var(--muted)" }} />
            <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Agent Activity Log
            </h3>
            <button onClick={fetchStats} className="ml-auto p-1 rounded transition-colors" style={{ color: "var(--muted)" }}>
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {stats.recentLogs.map(log => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)", color: "var(--muted)" }}>
                  {eventLabel(log.eventType)}
                </span>
                <span className="text-[12px] flex-1 truncate" style={{ color: "var(--text)" }}>
                  {String((log.payload as Record<string, unknown>)?.email || log.profileId || "—")}
                </span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: `${statusColor(log.status)}15`, color: statusColor(log.status) }}
                >
                  {log.status}
                </span>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
      <span className="text-xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{value}</span>
      <span className="text-[10px]" style={{ color: "var(--muted)" }}>{sub}</span>
    </div>
  );
}
