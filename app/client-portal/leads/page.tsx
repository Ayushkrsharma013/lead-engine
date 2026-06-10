"use client";

import { useEffect, useState } from "react";
import { Flame, ExternalLink } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

interface LeadRow {
  id: string; name: string; title: string; company: string;
  linkedin_url: string; score: number; icp_match_reason?: string;
}

function scoreColor(score: number) {
  if (score >= 80) return { bg: "rgba(107,203,119,0.10)", text: "var(--positive)", border: "rgba(107,203,119,0.18)" };
  if (score >= 60) return { bg: "rgba(0,180,255,0.08)", text: "var(--accent-blue)", border: "rgba(0,180,255,0.18)" };
  if (score >= 40) return { bg: "rgba(232,168,64,0.10)", text: "var(--accent)", border: "rgba(232,168,64,0.18)" };
  return { bg: "rgba(224,96,96,0.08)", text: "var(--negative)", border: "rgba(224,96,96,0.18)" };
}

/** Watermark overlay — semi-transparent repeating text */
function Watermark({ email }: { email: string }) {
  if (!email) return null;
  const lines: string[] = [];
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 6; col++) {
      lines.push(
        `<span style="position:absolute;top:${row * 80 + (col % 3) * 25}px;left:${col * 280 + (row % 4) * 40}px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.03);white-space:nowrap;pointer-events:none;transform:rotate(-15deg);font-family:monospace;">${email} · CONFIDENTIAL</span>`
      );
    }
  }
  return (
    <div
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: lines.join("") }}
    />
  );
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
  const limit = 25;

  const effectiveScoreMin = view === "hot" ? 80 : scoreMin;

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
      }
      // Hot count
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

  return (
    <PlanGate module="leads" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="pilot">
      <Watermark email={profile?.email || ""} />
      <div className="max-w-5xl space-y-4 animate-fade-in" style={{ position: "relative", zIndex: 1 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>My Leads</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{count.toLocaleString()} leads in your workspace</p>
          </div>
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

        {/* Score filter */}
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
                  {["Name", "Title", "Company", "LinkedIn", "Score"].map(h => (
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
                      <td className="px-4 py-2.5">
                        {l.linkedin_url ? (
                          <a href={l.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-medium transition-opacity hover:opacity-80 no-underline"
                            style={{ color: "var(--accent-blue)" }}>
                            View Profile <ExternalLink size={10} />
                          </a>
                        ) : <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                          {l.score}
                        </span>
                      </td>
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
