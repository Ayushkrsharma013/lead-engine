"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ChevronDown, MessageSquare } from "lucide-react";
import { PageTitle } from "@/components/ui/PageTitle";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

interface EnrichedLead { id: string; name: string; company: string; score: number; icebreakers: Array<{ id: string; body: string; subject: string; tone: string }>; }

function Watermark({ email }: { email: string }) {
  if (!email) return null;
  const lines: string[] = [];
  for (let row = 0; row < 20; row++) for (let col = 0; col < 6; col++) lines.push(`<span style="position:absolute;top:${row * 80 + (col % 3) * 25}px;left:${col * 280 + (row % 4) * 40}px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.03);white-space:nowrap;pointer-events:none;transform:rotate(-15deg);font-family:monospace;">${email} · CONFIDENTIAL</span>`);
  return <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: lines.join("") }} />;
}

export default function ClientIcebreakersPage() {
  const [leads, setLeads] = useState<EnrichedLead[]>([]); const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null); const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null); const [toast, setToast] = useState("");

  useEffect(() => { async function init() { const meRes = await fetch("/prospecting-os/api/client-portal/me"); if (meRes.ok) { const d = await meRes.json(); setProfile(d.profile); } const leadsRes = await fetch("/prospecting-os/api/client-portal/icebreakers"); if (leadsRes.ok) { const d = await leadsRes.json(); setLeads(d.leads || []); } setLoading(false); } init(); }, []);

  const handleCopy = async (text: string, id: string) => { await navigator.clipboard.writeText(text); setCopiedId(id); setToast("Icebreaker copied to clipboard"); setTimeout(() => { setCopiedId(null); setToast(""); }, 2500); };

  return (
    <PlanGate module="icebreakers" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="growth">
      <Watermark email={profile?.email || ""} />
      <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ position: "relative", zIndex: 1 }}>
        <PageTitle title="Icebreakers" description="AI-generated icebreakers for your top leads (score 60+)" />

        {leads.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-12 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <MessageSquare size={40} style={{ color: "var(--ink-4)", opacity: 0.3, margin: "0 auto 16px" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--ink-2)" }}>No icebreakers available yet</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--ink-4)" }}>Leads with scores above 60 will appear here with AI-generated icebreaker messages.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead, i) => (
              <motion.div key={lead.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                  <div><p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{lead.name || "—"}</p><p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>{lead.company || "—"} · Score: {lead.score}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(232,74,10,0.08)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.15)" }}>{lead.icebreakers.length} icebreaker{lead.icebreakers.length !== 1 ? "s" : ""}</span>
                    <motion.div animate={{ rotate: expandedId === lead.id ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={14} style={{ color: "var(--ink-4)" }} /></motion.div>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedId === lead.id && lead.icebreakers.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "1px solid var(--line)" }}>
                        {lead.icebreakers.map(ib => (
                          <motion.div key={ib.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="p-3 rounded-lg relative group" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(232,74,10,0.08)", color: "#E84A0A" }}>{ib.tone || "friendly"}</span>
                              {ib.subject && <span className="text-[11px] font-medium" style={{ color: "var(--ink-2)" }}>{ib.subject}</span>}
                              <button onClick={(e) => { e.stopPropagation(); handleCopy(ib.body, ib.id); }} className="ml-auto p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100" style={{ color: copiedId === ib.id ? "var(--positive)" : "var(--ink-4)", background: "transparent", border: "none", cursor: "pointer" }} title="Copy icebreaker">{copiedId === ib.id ? <Check size={12} /> : <Copy size={12} />}</button>
                            </div>
                            <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>{ib.body?.length > 250 ? ib.body.slice(0, 250) + "..." : ib.body}</p>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium" style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", color: "var(--ink)", boxShadow: "var(--shadow-md)" }}>{toast}</motion.div>}</AnimatePresence>
      </div>
    </PlanGate>
  );
}
