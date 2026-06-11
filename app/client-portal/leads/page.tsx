"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, ExternalLink, Search, ChevronLeft, ChevronRight, Users, Copy, Check } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import type { UserProfile, PlanKey } from "@/lib/types";

interface LeadRow {
  id: string;
  name: string;
  title: string;
  company: string;
  linkedin_url: string;
  score: number;
  icebreaker: string | null;
}

function Watermark({ email }: { email: string }) {
  if (!email) return null;
  const lines: string[] = [];
  for (let r = 0; r < 20; r++)
    for (let c = 0; c < 6; c++)
      lines.push(
        `<span style="position:absolute;top:${r * 80 + (c % 3) * 25}px;left:${c * 280 + (r % 4) * 40}px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.03);white-space:nowrap;pointer-events:none;transform:rotate(-15deg);font-family:monospace;">${email} · CONFIDENTIAL</span>`
      );
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
  const [toast, setToast] = useState<string | null>(null);
  const limit = 25;
  const effMin = view === "hot" ? 8 : scoreMin;

  // Fetch profile + hot count on mount
  useEffect(() => {
    (async () => {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) setProfile((await meRes.json()).profile);
      const hotRes = await fetch("/prospecting-os/api/client-portal/leads?limit=1&score_min=8");
      if (hotRes.ok) setHotCount((await hotRes.json()).count || 0);
    })();
  }, []);

  // Fetch leads
  useEffect(() => {
    (async () => {
      setLoading(true);
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (effMin > 0) p.set("score_min", String(effMin));
      if (search.trim()) p.set("search", search.trim());
      const res = await fetch(`/prospecting-os/api/client-portal/leads?${p}`);
      if (res.ok) {
        const d = await res.json();
        setLeads(d.leads || []);
        setCount(d.count || 0);
      }
      setLoading(false);
    })();
  }, [page, effMin, search]);

  // Topbar — title + count only (no search)
  usePortalHeader({
    title: "My Leads",
    description: `${count.toLocaleString()} leads in your workspace`,
  });

  const copyIcebreaker = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Icebreaker copied to clipboard");
      setTimeout(() => setToast(null), 2200);
    } catch {
      // Fallback for non-HTTPS
      setToast("Could not copy — select & copy manually");
      setTimeout(() => setToast(null), 2200);
    }
  }, []);

  const totalPages = Math.ceil(count / limit);

  return (
    <PlanGate module="leads" plan={profile?.plan as PlanKey | null} role={profile?.role} requiredPlan="pilot">
      <Watermark email={profile?.email || ""} />

      <div className="h-full flex flex-col" style={{ position: "relative", zIndex: 1 }}>
        {/* Search + Filter Row */}
        <div className="flex items-center gap-3 px-4 lg:px-6 pt-4 pb-2 shrink-0">
          {/* Wide search */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, title, or company…"
              className="w-full h-9 pl-9 pr-3 rounded-lg text-[12px] outline-none transition-all focus:ring-2"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
            />
          </div>

          {/* Toggle + Score filter — aligned right */}
          <div className="flex items-center gap-2 ml-auto">
            {/* All / Hot toggle */}
            <div
              className="flex items-center rounded-lg p-0.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              <button
                onClick={() => {
                  setView("all");
                  setPage(1);
                  setScoreMin(0);
                }}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                style={{
                  background: view === "all" ? "var(--surface)" : "transparent",
                  color: view === "all" ? "var(--ink)" : "var(--ink-3)",
                }}
              >
                All
              </button>
              <button
                onClick={() => {
                  setView("hot");
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors"
                style={{
                  background: view === "hot" ? "var(--surface)" : "transparent",
                  color: view === "hot" ? "#e06060" : "var(--ink-3)",
                }}
              >
                <Flame size={12} />
                Hot
                {hotCount > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: "rgba(224,96,96,0.12)", color: "#e06060" }}
                  >
                    {hotCount}
                  </span>
                )}
              </button>
            </div>

            {/* Score quick-filters (only when "All" is active) */}
            {view === "all" && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium ml-1" style={{ color: "var(--ink-4)" }}>
                  Score:
                </span>
                {[0, 4, 6, 8].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setScoreMin(s);
                      setPage(1);
                    }}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors"
                    style={{
                      background: scoreMin === s ? "var(--accent-soft)" : "transparent",
                      color: scoreMin === s ? "var(--accent-ink)" : "var(--ink-3)",
                      border: `1px solid ${scoreMin === s ? "rgba(232,74,10,0.25)" : "var(--line)"}`,
                    }}
                  >
                    {s === 0 ? "All" : `${s}+`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table — glassmorphism */}
        <div className="flex-1 px-4 lg:px-6 pb-4 min-h-0">
          <div
            className="overflow-x-auto rounded-xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 32px rgba(0,0,0,0.12)",
              height: "100%",
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E84A0A] rounded-full"
                />
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Users size={36} style={{ color: "var(--ink-4)", opacity: 0.3, marginBottom: 12 }} />
                <p className="text-[13px] font-medium" style={{ color: "var(--ink-3)" }}>
                  {view === "hot" ? "No hot leads yet." : "No leads match your filters."}
                </p>
              </div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {["Name", "Title", "Company", "Score", "LinkedIn URL", "Icebreaker"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
                        style={{ color: "var(--ink-4)", minWidth: h === "Icebreaker" ? 220 : h === "Name" ? 140 : h === "Title" ? 160 : h === "Company" ? 140 : h === "LinkedIn URL" ? 110 : 80 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.015, duration: 0.2 }}
                      className="group"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      {/* Name */}
                      <td className="px-5 py-2.5 text-[12px] font-medium" style={{ color: "var(--ink)" }}>
                        {l.name || "—"}
                      </td>

                      {/* Title */}
                      <td className="px-5 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
                        {l.title || "—"}
                      </td>

                      {/* Company */}
                      <td className="px-5 py-2.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
                        {l.company || "—"}
                      </td>

                      {/* Score badge */}
                      <td className="px-5 py-2.5">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                          style={{
                            background:
                              l.score >= 8
                                ? "rgba(107,203,119,0.12)"
                                : l.score >= 6
                                ? "rgba(232,168,64,0.12)"
                                : "rgba(255,255,255,0.05)",
                            color:
                              l.score >= 8
                                ? "var(--positive)"
                                : l.score >= 6
                                ? "#E8A840"
                                : "var(--ink-4)",
                            border: `1px solid ${
                              l.score >= 8
                                ? "rgba(107,203,119,0.20)"
                                : l.score >= 6
                                ? "rgba(232,168,64,0.20)"
                                : "rgba(255,255,255,0.08)"
                            }`,
                          }}
                        >
                          {l.score}
                        </span>
                      </td>

                      {/* LinkedIn URL — hyperlink */}
                      <td className="px-5 py-2.5">
                        {l.linkedin_url ? (
                          <a
                            href={l.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium no-underline transition-all hover:underline"
                            style={{ color: "var(--accent-blue)" }}
                          >
                            View Profile
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                            —
                          </span>
                        )}
                      </td>

                      {/* Icebreaker — click to copy */}
                      <td className="px-5 py-2.5">
                        {l.icebreaker ? (
                          <button
                            onClick={() => copyIcebreaker(l.icebreaker!)}
                            className="text-left text-[11px] leading-relaxed cursor-pointer transition-all bg-transparent border-none p-0 max-w-[260px] truncate block hover:opacity-80"
                            style={{ color: "var(--ink-2)" }}
                            title="Click to copy icebreaker"
                          >
                            <span className="line-clamp-2" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {l.icebreaker}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                            —
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-4 shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-opacity"
              style={{ color: "var(--ink-3)", border: "1px solid var(--line)" }}
            >
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <motion.button
                key={i}
                onClick={() => setPage(i + 1)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-7 h-7 rounded-lg text-[11px] font-semibold transition-colors"
                style={{
                  background: page === i + 1 ? "#E84A0A" : "transparent",
                  color: page === i + 1 ? "#fff" : "var(--ink-3)",
                  border: page === i + 1 ? "none" : "1px solid var(--line)",
                }}
              >
                {i + 1}
              </motion.button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-opacity"
              style={{ color: "var(--ink-3)", border: "1px solid var(--line)" }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium shadow-lg"
            style={{
              background: "rgba(30,30,30,0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#fff",
            }}
          >
            <Check size={14} style={{ color: "#6BCB77" }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </PlanGate>
  );
}
