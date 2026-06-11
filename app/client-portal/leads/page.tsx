"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, ExternalLink, Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

interface LeadRow {
  id: string; name: string; title: string; company: string;
  linkedin_url: string; score: number; icp_match_reason?: string;
}

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
  const [search, setSearch] = useState("");
  const limit = 25;

  const effectiveScoreMin = view === "hot" ? 80 : scoreMin;

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) { const d = await meRes.json(); setProfile(d.profile); }
      const hotRes = await fetch("/prospecting-os/api/client-portal/leads?limit=1&score_min=80");
      if (hotRes.ok) { const d = await hotRes.json(); setHotCount(d.count || 0); }
    }
    init();
  }, []);

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (effectiveScoreMin > 0) params.set("score_min", String(effectiveScoreMin));
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/prospecting-os/api/client-portal/leads?${params}`);
      if (res.ok) { const d = await res.json(); setLeads(d.leads || []); setCount(d.count || 0); }
      setLoading(false);
    }
    fetchLeads();
  }, [page, effectiveScoreMin, search]);

  const totalPages = Math.ceil(count / limit);

  return (
    <PlanGate module="leads" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="pilot">
      <Watermark email={profile?.email || ""} />
      <div className="p-6 md:p-10 max-w-7xl mx-auto" style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6"
        >
          <div>
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>My Leads</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--ink-3)" }}>
              {count.toLocaleString()} leads in your workspace
            </p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search leads…"
              className="h-9 pl-9 pr-4 rounded-lg text-[12px] outline-none w-52 transition-colors"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
            />
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <button onClick={() => { setView("all"); setPage(1); setScoreMin(0); }}
              className="px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all"
              style={{
                background: view === "all" ? "var(--surface)" : "transparent",
                color: view === "all" ? "var(--ink)" : "var(--ink-3)",
              }}>
              All Leads
            </button>
            <button onClick={() => { setView("hot"); setPage(1); }}
              className="px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-1.5"
              style={{
                background: view === "hot" ? "var(--surface)" : "transparent",
                color: view === "hot" ? "#e06060" : "var(--ink-3)",
              }}>
              <Flame size={13} /> Hot
              {hotCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "rgba(224,96,96,0.12)", color: "#e06060" }}>{hotCount}</span>
              )}
            </button>
          </div>

          {view === "all" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>Score:</span>
              {[0, 40, 60, 80].map(s => (
                <button key={s} onClick={() => { setScoreMin(s); setPage(1); }}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    background: scoreMin === s ? "var(--accent-soft)" : "transparent",
                    color: scoreMin === s ? "var(--accent-ink)" : "var(--ink-3)",
                    border: `1px solid ${scoreMin === s ? "rgba(232,74,10,0.25)" : "var(--line)"}`,
                  }}>
                  {s === 0 ? "All" : `${s}+`}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          {loading ? (
            <div className="p-10 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>Loading…</div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={40} style={{ color: "var(--ink-4)", opacity: 0.3, margin: "0 auto 12px" }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--ink-3)" }}>
                {view === "hot" ? "No hot leads yet — scores update daily." : "No leads match your filters."}
              </p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead style={{ borderBottom: "1px solid var(--line)" }}>
                <tr>
                  {["Name", "Title", "Company", "LinkedIn", "Score"].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]"
                      style={{ color: "var(--ink-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l, i) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015, duration: 0.2 }}
                    style={{ borderBottom: "1px solid var(--line)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <td className="px-6 py-3 text-[13px] font-medium" style={{ color: "var(--ink)" }}>{l.name || "—"}</td>
                    <td className="px-6 py-3 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.title || "—"}</td>
                    <td className="px-6 py-3 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.company || "—"}</td>
                    <td className="px-6 py-3">
                      {l.linkedin_url ? (
                        <a href={l.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-medium no-underline transition-opacity hover:opacity-80"
                          style={{ color: "var(--accent-blue)" }}>
                          View <ExternalLink size={10} />
                        </a>
                      ) : <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>—</span>}
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md"
                        style={{
                          background: l.score >= 80 ? "rgba(107,203,119,0.10)" : l.score >= 60 ? "rgba(232,168,64,0.10)" : "rgba(255,255,255,0.04)",
                          color: l.score >= 80 ? "var(--positive)" : l.score >= 60 ? "var(--accent)" : "var(--ink-4)",
                          border: `1px solid ${l.score >= 80 ? "rgba(107,203,119,0.18)" : l.score >= 60 ? "rgba(232,168,64,0.18)" : "rgba(255,255,255,0.06)"}`,
                        }}>
                        {l.score}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="flex items-center justify-center gap-2 mt-6"
          >
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors"
              style={{ color: "var(--ink-3)", border: "1px solid var(--line)", background: "transparent" }}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <motion.button key={i} onClick={() => setPage(i + 1)}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="w-8 h-8 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: page === i + 1 ? "#E84A0A" : "transparent",
                  color: page === i + 1 ? "#fff" : "var(--ink-3)",
                  border: page === i + 1 ? "none" : "1px solid var(--line)",
                }}>
                {i + 1}
              </motion.button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors"
              style={{ color: "var(--ink-3)", border: "1px solid var(--line)", background: "transparent" }}>
              <ChevronRight size={14} />
            </button>
          </motion.div>
        )}
      </div>
    </PlanGate>
  );
}
