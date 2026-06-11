"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, ExternalLink, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { PageTransition } from "@/components/ui/PageTransition";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
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
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/prospecting-os/api/client-portal/leads?${params}`);
      if (res.ok) {
        const d = await res.json();
        setLeads(d.leads || []);
        setCount(d.count || 0);
      }
      setLoading(false);
    }
    fetchLeads();
  }, [page, effectiveScoreMin, search]);

  const totalPages = Math.ceil(count / limit);

  return (
    <PlanGate module="leads" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="pilot">
      <Watermark email={profile?.email || ""} />
      <PageTransition className="max-w-5xl space-y-4" style={{ position: "relative", zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="flex items-center justify-between flex-wrap gap-3"
        >
          <div>
            <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>My Leads</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{count.toLocaleString()} leads in your workspace</p>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="h-9 pl-9 pr-3 rounded-lg text-[12px] outline-none w-48"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
            />
          </div>
        </motion.div>

        {/* View tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex items-center gap-2"
        >
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
        </motion.div>

        {/* Score filter */}
        {view === "all" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <span className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>Min Score:</span>
            {[0, 40, 60, 80].map(s => (
              <button key={s} onClick={() => { setScoreMin(s); setPage(1); }}
                className="px-3 py-1 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: scoreMin === s ? "rgba(232,74,10,0.10)" : "transparent",
                  color: scoreMin === s ? "#E84A0A" : "var(--ink-3)",
                  border: `1px solid ${scoreMin === s ? "rgba(232,74,10,0.25)" : "var(--line)"}`,
                }}>
                {s === 0 ? "All" : `${s}+`}
              </button>
            ))}
          </motion.div>
        )}

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <TableSkeleton rows={8} cols={5} key="skeleton" />
            ) : leads.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-10 text-center"
              >
                <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                  {view === "hot" ? "No hot leads yet — scores update daily." : "No leads match your filters."}
                </p>
              </motion.div>
            ) : (
              <motion.table
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    {["Name", "Title", "Company", "LinkedIn", "Score"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => {
                    const sc = scoreColor(l.score);
                    return (
                      <motion.tr
                        key={l.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        style={{ borderBottom: "1px solid var(--line)" }}
                        whileHover={{ background: "rgba(237,234,226,0.02)" }}
                      >
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
                      </motion.tr>
                    );
                  })}
                </tbody>
              </motion.table>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-1.5"
          >
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink-3)", cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <motion.button
                key={i}
                onClick={() => setPage(i + 1)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-8 h-8 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: page === i + 1 ? "#E84A0A" : "transparent",
                  color: page === i + 1 ? "#fff" : "var(--ink-3)",
                  border: page === i + 1 ? "none" : "1px solid var(--line)",
                  cursor: "pointer",
                }}>
                {i + 1}
              </motion.button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink-3)", cursor: page === totalPages ? "not-allowed" : "pointer" }}
            >
              <ChevronRight size={14} />
            </button>
          </motion.div>
        )}
      </PageTransition>
    </PlanGate>
  );
}
