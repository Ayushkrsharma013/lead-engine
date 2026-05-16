"use client";

import { useEffect, useState } from "react";
import { Users, Zap, TrendingUp, Mail, ArrowDown, Download } from "lucide-react";
import type { UserProfile, PlanKey, ClientWorkspace } from "@/lib/types";

const cardBg = "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))";

export default function ClientPortalOverview() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<ClientWorkspace | null>(null);
  const [leads, setLeads] = useState<Array<{ id: string; score: number; status?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (!meRes.ok) return;
      const meData = await meRes.json();
      setProfile(meData.profile);
      setWorkspace(meData.workspace);

      const leadsRes = await fetch("/prospecting-os/api/client-portal/leads?limit=100");
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.leads || []);
      }
      setLoading(false);
    }
    init();
  }, []);

  const total = leads.length;
  const hot = leads.filter(l => l.score >= 80).length;
  const contacted = leads.filter(l => l.status && l.status !== "new").length;
  const avgScore = total ? Math.round(leads.reduce((s, l) => s + l.score, 0) / total) : 0;

  const handleExportCSV = async () => {
    const res = await fetch("/prospecting-os/api/client-portal/leads?limit=1000");
    if (!res.ok) return;
    const data = await res.json();
    const rows: string[] = ["Name,Title,Company,Industry,Score,Status,Email"];
    for (const l of data.leads) {
      rows.push(`"${l.name}","${l.title}","${l.company}","${l.industry}",${l.score},"${l.status || "new"}","${l.email}"`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  const planLabel = profile?.plan === "diy" ? "DIY Setup" : profile?.plan === "growth" ? "Managed Growth" : profile?.plan === "scale" ? "Managed Scale" : "No plan";

  return (
    <div className="max-w-5xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
          Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
          {planLabel} · {total} leads delivered
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: "Total Leads", value: total.toLocaleString(), icon: Users, color: "var(--accent)" },
          { label: "Hot Leads (80+)", value: String(hot), icon: Zap, color: "var(--negative)" },
          { label: "Avg Score", value: String(avgScore), icon: TrendingUp, color: "var(--positive)" },
          { label: "Contacted", value: String(contacted), icon: Mail, color: "var(--info)" },
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

      {/* Export + Actions */}
      <div className="flex items-center gap-3">
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all"
          style={{ background: "var(--accent)", color: "#000" }}>
          <Download size={13} /> Export CSV
        </button>
        <a href="/prospecting-os/book"
          className="text-[12px] font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--ink-3)" }}>
          Need help? Book a call →
        </a>
      </div>

      {/* Hot leads preview */}
      {hot > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>Recent Hot Leads</h3>
            <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>{hot} total</span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Name", "Company", "Score", "Status"].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.filter(l => l.score >= 80).slice(0, 5).map(l => (
                <tr key={l.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  <td className="px-4 py-2.5 text-[12px] font-medium" style={{ color: "var(--ink)" }}>{(l as { name?: string }).name || "—"}</td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{(l as { company?: string }).company || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                      style={{ background: "rgba(107,203,119,0.10)", color: "var(--positive)", border: "1px solid rgba(107,203,119,0.18)" }}>
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
      {total === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <ArrowDown size={24} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
          <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--ink)" }}>No leads yet</p>
          <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
            Your leads will appear here once your account manager assigns them to your workspace.
          </p>
        </div>
      )}
    </div>
  );
}
