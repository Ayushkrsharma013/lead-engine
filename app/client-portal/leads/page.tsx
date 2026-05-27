"use client";

import { useEffect, useState } from "react";
import { Download, Flame } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

interface LeadRow { id: string; name: string; title: string; company: string; industry: string; score: number; status?: string; email: string; location?: string }

function scoreColor(score: number) {
  if (score >= 80) return { bg: "rgba(107,203,119,0.10)", text: "var(--positive)", border: "rgba(107,203,119,0.18)" };
  if (score >= 60) return { bg: "rgba(0,180,255,0.08)", text: "var(--accent-blue)", border: "rgba(0,180,255,0.18)" };
  if (score >= 40) return { bg: "rgba(232,168,64,0.10)", text: "var(--accent)", border: "rgba(232,168,64,0.18)" };
  return { bg: "rgba(224,96,96,0.08)", text: "var(--negative)", border: "rgba(224,96,96,0.18)" };
}

// Defends against CSV/formula injection (=, +, -, @, tab, CR) and escapes quotes.
function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const needsPrefix = /^[=+\-@\t\r]/.test(s);
  const safe = (needsPrefix ? "'" + s : s).replace(/"/g, '""');
  return `"${safe}"`;
}

export default function ClientLeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [scoreMin, setScoreMin] = useState(0);
  const [view, setView] = useState<"all" | "hot">("all");
  const [hotCount, setHotCount] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const limit = 50;

  const effectiveScoreMin = view === "hot" ? 80 : scoreMin;

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
      }
      const hotRes = await fetch("/prospecting-os/api/client-portal/leads?limit=1&score_min=80");
      if (hotRes.ok) {
        const d = await hotRes.json();
        setHotCount(d.count || 0);
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (effectiveScoreMin > 0) params.set("score_min", String(effectiveScoreMin));
      const res = await fetch(`/prospecting-os/api/client-portal/leads?${params}`);
      if (res.ok) {
        const d = await res.json();
        setLeads(d.leads || []);
        setCount(d.count || 0);
      }
      setLoading(false);
    }
    fetchLeads();
  }, [page, effectiveScoreMin]);

  const totalPages = Math.ceil(count / limit);

  const handleExportCSV = async () => {
    const params = new URLSearchParams({ limit: "1000" });
    if (effectiveScoreMin > 0) params.set("score_min", String(effectiveScoreMin));
    const res = await fetch(`/prospecting-os/api/client-portal/leads?${params}`);
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
    a.href = url; a.download = view === "hot" ? "hot-leads.csv" : "my-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PlanGate module="leads-view" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="pilot">
      <div className="max-w-5xl space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>My Leads</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{count.toLocaleString()} leads in your workspace</p>
          </div>
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all"
            style={{ background: "var(--accent)", color: "#000" }}>
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-2">
          <button onClick={() => { setView("all"); setPage(1); setScoreMin(0); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: view === "all" ? "var(--surface)" : "transparent",
              color: view === "all" ? "var(--ink)" : "var(--ink-3)",
              border: `1px solid ${view === "all" ? "var(--line)" : "transparent"}`,
            }}>
            All Leads
          </button>
          <button onClick={() => { setView("hot"); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: view === "hot" ? "rgba(224,96,96,0.08)" : "transparent",
              color: view === "hot" ? "#e06060" : "var(--ink-3)",
              border: `1px solid ${view === "hot" ? "rgba(224,96,96,0.20)" : "transparent"}`,
            }}>
            <Flame size={12} />
            Hot Leads
            {hotCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "rgba(224,96,96,0.15)", color: "#e06060" }}>
                {hotCount}
              </span>
            )}
          </button>
        </div>

        {/* Score filter (only shown in All view) */}
        {view === "all" && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>Min Score:</span>
            {[0, 40, 60, 80].map(s => (
              <button key={s} onClick={() => { setScoreMin(s); setPage(1); }}
                className="px-3 py-1 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: scoreMin === s ? "var(--accent-soft)" : "transparent",
                  color: scoreMin === s ? "var(--accent-ink)" : "var(--ink-3)",
                  border: `1px solid ${scoreMin === s ? "rgba(232,168,64,0.25)" : "var(--line)"}`,
                }}>
                {s === 0 ? "All" : `${s}+`}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {loading ? (
            <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>Loading...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>
              {view === "hot" ? "No hot leads yet — scores update daily." : "No leads match your filters."}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Name", "Title", "Company", "Industry", "Score", "Status"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(l => {
                  const sc = scoreColor(l.score);
                  return (
                    <tr key={l.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <td className="px-4 py-2.5 text-[12px] font-medium" style={{ color: "var(--ink)" }}>{l.name || "—"}</td>
                      <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.title || "—"}</td>
                      <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.company || "—"}</td>
                      <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.industry || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                          {l.score}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] capitalize" style={{ color: "var(--ink-3)" }}>{l.status || "new"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className="w-8 h-8 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: page === i + 1 ? "var(--accent)" : "transparent",
                  color: page === i + 1 ? "#000" : "var(--ink-3)",
                  border: page === i + 1 ? "none" : "1px solid var(--line)",
                }}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </PlanGate>
  );
}
