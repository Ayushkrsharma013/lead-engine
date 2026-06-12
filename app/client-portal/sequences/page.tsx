"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import { GitBranch, Plus, Play, Pause, Trash2, Loader2, X, Layers, Mail, Link, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { PlanKey } from "@/lib/types";

interface SequenceStep { type: "email" | "linkedin_dm" | "delay"; subject?: string; body?: string; delay_days?: number; }
interface Sequence { id: string; name: string; steps: SequenceStep[]; status: string; created_at: string; }

const CS: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
};

const STEP_TYPES = [
  { key: "email" as const, label: "Email", icon: Mail, color: "#6BCB77" },
  { key: "linkedin_dm" as const, label: "LinkedIn DM", icon: Link, color: "#E84A0A" },
  { key: "delay" as const, label: "Wait / Delay", icon: Clock, color: "#E8A840" },
];

function emptyStep(type: SequenceStep["type"]): SequenceStep {
  if (type === "delay") return { type: "delay", delay_days: 2 };
  return { type, subject: "", body: "" };
}

export default function ClientSequencesPage() {
  const [profile, setProfile] = useState<{ plan?: PlanKey; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchSeq = async () => {
    const r = await fetch("/prospecting-os/api/client-portal/sequences");
    if (r.ok) setSequences((await r.json()).sequences || []);
  };

  useEffect(() => {
    (async () => {
      const r = await fetch("/prospecting-os/api/client-portal/me");
      if (r.ok) setProfile((await r.json()).profile);
      await fetchSeq();
      setLoading(false);
    })();
  }, []);

  const openCreate = () => {
    setFormName("");
    setSteps([{ type: "email", subject: "", body: "" }]);
    setShowForm(true);
  };

  const addStep = (type: SequenceStep["type"]) => {
    setSteps([...steps, emptyStep(type)]);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...steps];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setSteps(next);
  };

  const updateStep = (idx: number, patch: Partial<SequenceStep>) => {
    const next = [...steps];
    next[idx] = { ...next[idx], ...patch };
    setSteps(next);
  };

  const create = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const r = await fetch("/prospecting-os/api/client-portal/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, steps }),
    });
    setSaving(false);
    if (r.ok) {
      setShowForm(false);
      setFormName("");
      setSteps([]);
      await fetchSeq();
      setToast("Sequence created");
      setTimeout(() => setToast(""), 2500);
    }
  };

  const toggle = async (s: Sequence) => {
    await fetch(`/prospecting-os/api/client-portal/sequences?id=${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s.status === "active" ? "draft" : "active" }),
    });
    await fetchSeq();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this sequence?")) return;
    await fetch(`/prospecting-os/api/client-portal/sequences?id=${id}`, { method: "DELETE" });
    await fetchSeq();
    setToast("Sequence deleted");
    setTimeout(() => setToast(""), 2500);
  };

  usePortalHeader({
    title: "Sequences",
    description: `${sequences.length} outreach ${sequences.length === 1 ? "sequence" : "sequences"}`,
    actions: (
      <motion.button
        onClick={openCreate}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer"
        style={{ background: "#E84A0A", color: "#fff", border: "none" }}
      >
        <Plus size={13} /> New Sequence
      </motion.button>
    ),
  });

  const stepCount = (s: Sequence) => (s.steps as SequenceStep[])?.length || 0;

  return (
    <PlanGate module="sequences" plan={profile?.plan || null} role={profile?.role} requiredPlan="pilot">
      <div className="p-4 lg:p-6 space-y-3">
        {/* ─── Create / Edit Modal ─── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
                className="rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4"
                style={CS}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>New Sequence</h2>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setShowForm(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "transparent", color: "var(--ink-3)" }}
                  >
                    <X size={15} />
                  </motion.button>
                </div>

                {/* Name */}
                <label className="text-[10px] font-semibold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Sequence Name</label>
                <input
                  type="text" value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Q3 Outreach — SaaS Founders"
                  autoFocus
                  className="w-full h-10 rounded-xl px-3 text-[13px] mb-4"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }}
                />

                {/* Steps */}
                <label className="text-[10px] font-semibold uppercase tracking-[0.10em] mb-2 block" style={{ color: "var(--ink-4)" }}>
                  Steps ({steps.length})
                </label>
                <div className="space-y-2 mb-3">
                  {steps.map((step, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="rounded-xl p-3"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(232,74,10,0.12)", color: "#E84A0A" }}>{idx + 1}</span>
                          <span className="text-[11px] font-semibold" style={{ color: "var(--ink)" }}>
                            {STEP_TYPES.find(t => t.key === step.type)?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="p-1 rounded disabled:opacity-30" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)" }}><ChevronUp size={12} /></button>
                          <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="p-1 rounded disabled:opacity-30" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)" }}><ChevronDown size={12} /></button>
                          <button onClick={() => removeStep(idx)} className="p-1 rounded hover:bg-white/[0.05]" style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={11} /></button>
                        </div>
                      </div>

                      {step.type === "delay" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>Wait</span>
                          <input type="number" min={1} max={30} value={step.delay_days || 2}
                            onChange={(e) => updateStep(idx, { delay_days: parseInt(e.target.value) || 1 })}
                            className="w-14 h-7 rounded-lg text-center text-[11px]" style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
                          <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>days</span>
                        </div>
                      ) : (
                        <>
                          {step.type === "email" && (
                            <input type="text" value={step.subject || ""} onChange={(e) => updateStep(idx, { subject: e.target.value })}
                              placeholder="Subject line" className="w-full h-8 rounded-lg px-2.5 text-[11px] mb-2"
                              style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }} />
                          )}
                          <textarea value={step.body || ""} onChange={(e) => updateStep(idx, { body: e.target.value })}
                            placeholder={step.type === "email" ? "Email body…" : "LinkedIn message…"}
                            rows={2} className="w-full rounded-lg px-2.5 py-1.5 text-[11px] resize-none"
                            style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }} />
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Add step buttons */}
                <div className="flex gap-1.5 mb-4">
                  {STEP_TYPES.map(st => (
                    <button key={st.key} onClick={() => addStep(st.key)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border-none cursor-pointer transition-colors hover:bg-white/[0.06]"
                      style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                      <st.icon size={11} style={{ color: st.color }} /> {st.label}
                    </button>
                  ))}
                </div>

                {/* Create button */}
                <button
                  onClick={create}
                  disabled={saving || !formName.trim() || steps.length === 0}
                  className="w-full h-10 rounded-full text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer border-none"
                  style={{ background: "#E84A0A", color: "#fff", opacity: saving || !formName.trim() ? 0.6 : 1 }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Create Sequence
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Sequence List ─── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E84A0A] rounded-full" />
          </div>
        ) : sequences.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-10 text-center" style={CS}>
            <Layers size={36} style={{ color: "var(--ink-4)", opacity: 0.3, margin: "0 auto 14px" }} />
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-2)" }}>No sequences yet</p>
            <p className="text-[11px] mt-1 mb-5" style={{ color: "var(--ink-4)" }}>Create your first outreach sequence with email & LinkedIn steps.</p>
            <motion.button onClick={openCreate} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="px-4 py-2 rounded-full text-[11px] font-semibold flex items-center gap-1.5 mx-auto border-none cursor-pointer"
              style={{ background: "#E84A0A", color: "#fff" }}>
              <Plus size={13} /> Create Sequence
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {sequences.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.01 }}
                className="rounded-xl"
                style={{
                  ...CS,
                  border: s.status === "active" ? "1px solid rgba(34,197,94,0.20)" : CS.border,
                }}
              >
                {/* Header row */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(232,74,10,0.08)", border: "1px solid rgba(232,74,10,0.15)" }}>
                      <GitBranch size={14} style={{ color: "#E84A0A" }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{s.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--ink-4)" }}>
                        {stepCount(s)} steps · {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                      style={{
                        background: s.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                        color: s.status === "active" ? "#22c55e" : "var(--ink-4)",
                      }}>
                      {s.status}
                    </span>
                    <motion.button onClick={() => toggle(s)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      className="p-1 rounded border-none cursor-pointer" style={{ background: "none", color: "var(--ink-3)" }}>
                      {s.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                    </motion.button>
                    <motion.button onClick={() => del(s.id)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      className="p-1 rounded border-none cursor-pointer" style={{ background: "none", color: "var(--ink-4)" }}>
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </div>

                {/* Expanded steps */}
                <AnimatePresence>
                  {expanded[s.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        {(s.steps as SequenceStep[])?.map((step, j) => {
                          const st = STEP_TYPES.find(t => t.key === step.type);
                          const Icon = st?.icon || Mail;
                          return (
                            <div key={j} className="flex items-start gap-2.5 py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                                style={{ background: "rgba(232,74,10,0.10)", color: "#E84A0A" }}>{j + 1}</span>
                              <Icon size={12} className="mt-0.5 shrink-0" style={{ color: st?.color || "var(--ink-4)" }} />
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold" style={{ color: "var(--ink-2)" }}>{st?.label}</p>
                                {step.type === "delay" ? (
                                  <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>Wait {step.delay_days} days</p>
                                ) : (
                                  <>
                                    {step.subject && <p className="text-[11px] font-medium truncate" style={{ color: "var(--ink)" }}>{step.subject}</p>}
                                    <p className="text-[10px] truncate" style={{ color: "var(--ink-4)" }}>{step.body || "(no content)"}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── Toast ─── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl text-[12px] font-medium flex items-center gap-2"
              style={{ background: "rgba(30,30,30,0.92)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff" }}
            >
              <Check size={14} style={{ color: "#6BCB77" }} /> {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PlanGate>
  );
}
