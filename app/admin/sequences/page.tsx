"use client";

import { useState } from "react";
import {
  Save, Trash2, GripVertical, Plus, Users, Copy, Check, Play, FlaskConical, ChevronDown, ChevronUp, Zap, Trophy,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { Dropdown } from "@/components/ui/dropdown";
import { useApp } from "@/lib/AppContext";
import { saveSequence as saveSeq, deleteSequence as delSeq } from "@/lib/db";
import type { SequenceStep, Sequence, SequenceExecution } from "@/lib/types";

const DEFAULT_STEPS: SequenceStep[] = [
  { day: 0, channel: "linkedin", type: "Connection Request", template: "Hi {{first_name}}, I came across your profile while researching {{industry}} leaders and was impressed by your work at {{company}}. Would love to connect.", active: true },
  { day: 3, channel: "linkedin", type: "Follow-up DM", template: "Hey {{first_name}}, wanted to follow up on my connection request. I help companies like {{company}} with their growth strategy. Worth a quick chat?", active: true },
  { day: 5, channel: "email", type: "Cold Email", template: "Subject: Quick question about {{company}}\n\nHi {{first_name}},\n\nI noticed {{company}} is doing great work in {{industry}}. I help similar companies with [your offer].\n\nWould a 15-min call make sense?", active: true },
  { day: 8, channel: "email", type: "Follow-up Email", template: "Hi {{first_name}}, just bumping this up in case it got buried. Let me know if you'd like to connect.", active: true },
  { day: 12, channel: "email", type: "Breakup Email", template: "Hi {{first_name}}, last note from me — should I close your file? No hard feelings either way.", active: true },
];

const VARIABLES = ["{{first_name}}", "{{company}}", "{{industry}}", "{{title}}"];

const cardBg = "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)";
const cardBorder = "1px solid rgba(201,168,124,0.07)";
const brass = "#C9A87C";

function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export default function SequencesPage() {
  const { state, dispatch } = useApp();
  const { sequences, leads } = state;

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_STEPS.map((s, i) => ({ ...s, day: i * 3 })));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [executions, setExecutions] = useState<SequenceExecution[]>([]);
  const [launching, setLaunching] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [pausing, setPausing] = useState<string | null>(null);
  const [variantOpen, setVariantOpen] = useState<Set<number>>(new Set());
  const [variantStats, setVariantStats] = useState<Array<{ variant: string; sent: number; replied: number; replyRate: number }>>([]);
  const [abWinner, setAbWinner] = useState<{ variant: string; replyRate: number; sends: number; selectedAt: string; sequenceName: string } | null>(null);

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  const loadSequence = (seq: Sequence) => {
    setName(seq.name);
    setSteps(seq.steps);
    setEditingId(seq.id);
    setAssignedIds(seq.assignedLeadIds || []);
    setAbWinner(null);
    fetchExecutions(seq.id);
  };

  const resetForm = () => {
    setName("");
    setSteps(DEFAULT_STEPS.map(s => ({ ...s })));
    setEditingId(null);
    setAssignedIds([]);
    setExecutions([]);
  };

  const fetchExecutions = async (sequenceId: string) => {
    try {
      const { getSequenceExecutions } = await import("@/lib/db");
      const exs = await getSequenceExecutions(sequenceId);
      setExecutions(exs);
    } catch { setExecutions([]); }
    try {
      const res = await fetch(`/prospecting-os/api/analytics/variant-stats?sequenceId=${sequenceId}`);
      const data = await res.json() as { stats?: Array<{ variant: string; sent: number; replied: number; replyRate: number }> };
      if (data.stats) setVariantStats(data.stats);
    } catch { setVariantStats([]); }
    try {
      const res = await fetch(`/prospecting-os/api/agents/knowledge?key=ab_winner.${sequenceId}`);
      const data = await res.json() as { value?: { variant: string; replyRate: number; sends: number; selectedAt: string; sequenceName: string } | null };
      setAbWinner(data.value ?? null);
    } catch { setAbWinner(null); }
  };

  const handleLaunch = async () => {
    const seqId = editingId;
    if (!seqId) { showToast("Save the sequence first", "warn"); return; }

    setLaunching(true);
    try {
      const res = await fetch("/prospecting-os/api/sequence/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId: seqId }),
      });
      const data = await res.json() as { executions?: SequenceExecution[]; alreadyRunning?: number; error?: string };
      if (data.error) { showToast(data.error, "error"); return; }
      const exs = data.executions;
      const count = exs?.length || 0;
      const already = data.alreadyRunning ? ` (${data.alreadyRunning} already running)` : "";
      showToast(`Launched for ${count} leads${already}`);
      if (exs && exs.length > 0) setExecutions(prev => [...prev, ...exs]);
    } catch { showToast("Failed to launch", "error"); }
    setLaunching(false);
  };

  const [runningEngine, setRunningEngine] = useState(false);
  const handleRunEngine = async () => {
    setRunningEngine(true);
    try {
      const res = await fetch("/prospecting-os/api/cron/sequence-runner");
      const data = await res.json() as { processed?: number; sent?: number; skipped?: number; failed?: number; locked?: boolean };
      if (data.locked) { showToast("Engine is already running — wait a moment", "warn"); return; }
      showToast(`Sent: ${data.sent || 0} · Skipped: ${data.skipped || 0} · Failed: ${data.failed || 0}`);
      if (editingId) fetchExecutions(editingId);
    } catch { showToast("Engine run failed", "error"); }
    setRunningEngine(false);
  };

  const handleCancelExec = async (executionId?: string) => {
    setCancelling(executionId || "all");
    try {
      const body: Record<string, string> = { action: "cancel" };
      if (executionId) body.executionId = executionId;
      else body.sequenceId = editingId || "";

      const res = await fetch("/prospecting-os/api/sequence/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { showToast(data.error, "error"); return; }
      showToast(executionId ? "Execution cancelled" : "All executions cancelled");
      if (editingId) fetchExecutions(editingId);
    } catch { showToast("Failed to cancel", "error"); }
    setCancelling(null);
  };

  const handlePause = async (executionId: string) => {
    setPausing(executionId);
    try {
      const res = await fetch("/prospecting-os/api/sequence/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionId, action: "pause" }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { showToast(data.error, "error"); return; }
      showToast("Execution paused");
      setExecutions(prev => prev.map(e => e.id === executionId ? { ...e, status: "paused" as const } : e));
    } catch { showToast("Failed to pause", "error"); }
    setPausing(null);
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast("Please enter a sequence name", "warn"); return; }
    setSaving(true);
    try {
      const seq = await saveSeq({
        id: editingId || undefined,
        name: name.trim(),
        steps: steps.filter(s => s.active),
        assignedLeadIds: assignedIds,
      });
      dispatch({ type: "SAVE_SEQUENCE", payload: seq });
      showToast(`Sequence "${seq.name}" saved`);
      setEditingId(seq.id);
    } catch { showToast("Failed to save", "error"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await delSeq(id);
      dispatch({ type: "DELETE_SEQUENCE", payload: id });
      if (editingId === id) resetForm();
      showToast("Sequence deleted");
    } catch { showToast("Failed to delete", "error"); }
    setDeleteConfirm(null);
  };

  const handleDuplicate = (seq: Sequence) => {
    setName(`${seq.name} (copy)`);
    setSteps(seq.steps.map(s => ({ ...s })));
    setEditingId(null);
    setAssignedIds([]);
  };

  const updateStep = (idx: number, patch: Partial<SequenceStep>) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const addStep = () => {
    const lastDay = steps.length > 0 ? steps[steps.length - 1].day + 3 : 0;
    setSteps(prev => [...prev, { day: lastDay, channel: "email", type: "Follow-up", template: "", active: true }]);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setSteps(prev => {
      const next = [...prev];
      const [removed] = next.splice(dragIdx, 1);
      next.splice(idx, 0, removed);
      return next;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const toggleAssign = (leadId: string) => {
    setAssignedIds(prev => prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]);
  };

  return (
    <>
      <TopBar title="Sequence Builder" subtitle="Multi-step outreach cadences" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">

          {/* ── Name + Actions ── */}
          <div
            className="rounded-xl p-5"
            style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3 select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Sequence Details
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="My LinkedIn Outreach Sequence"
                className="flex-1 h-10 rounded-lg px-4 text-[15px] font-semibold outline-none transition-all duration-200"
                style={{
                  color: "var(--ink)", background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                }}
                onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"}
              />
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40"
                style={{
                  background: "linear-gradient(90deg, rgba(201,168,124,0.14), rgba(201,168,124,0.08))",
                  color: "var(--accent-ink)",
                  border: "1px solid rgba(201,168,124,0.22)",
                }}
                onMouseEnter={e => {
                  if (!saving) {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(201,168,124,0.15)";
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <Save size={14} /> Save
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching || !editingId}
                className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40"
                style={{
                  background: "linear-gradient(90deg, rgba(0,212,255,0.14), rgba(0,212,255,0.08))",
                  color: "var(--accent-blue)",
                  border: "1px solid rgba(0,212,255,0.22)",
                }}
              >
                <Play size={14} /> {launching ? "Launching..." : "Launch"}
              </button>
              <button
                onClick={handleRunEngine}
                disabled={runningEngine}
                className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40"
                style={{
                  background: "linear-gradient(90deg, rgba(0,255,136,0.10), rgba(0,255,136,0.05))",
                  color: "var(--accent-green)",
                  border: "1px solid rgba(0,255,136,0.18)",
                }}
              >
                <Zap size={14} /> {runningEngine ? "Running..." : "Run Engine"}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowAssign(!showAssign)}
                  className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium transition-all duration-200"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--line)",
                    color: "var(--ink-3)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.06)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.20)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
                  }}
                >
                  <Users size={14} /> Assign ({assignedIds.length})
                </button>
                {showAssign && (
                  <div
                    className="absolute right-0 top-12 w-72 rounded-xl z-50 p-3 max-h-64 overflow-y-auto space-y-0.5 animate-fade-in"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
                  >
                    {leads.length === 0 ? (
                      <p className="text-[12px] text-center py-4" style={{ color: "var(--ink-3)" }}>No leads available</p>
                    ) : (
                      leads.map(l => {
                        const sel = assignedIds.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleAssign(l.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-left transition-all duration-150"
                            style={sel
                              ? { background: "rgba(201,168,124,0.08)", color: "var(--accent-ink)" }
                              : { background: "transparent", color: "var(--ink-2)" }
                            }
                            onMouseEnter={e => {
                              if (!sel) (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.03)";
                            }}
                            onMouseLeave={e => {
                              if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent";
                            }}
                          >
                            {sel ? <Check size={10} /> : <span className="w-[10px]" />}
                            {l.name} — {l.company}
                          </button>
                        );
                      })
                    )}
                    <button onClick={() => setShowAssign(false)} className="w-full text-[11px] text-center pt-2 transition-colors duration-150" style={{ color: "var(--ink-3)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── A/B Winner Banner ── */}
          {abWinner && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{
                background: "linear-gradient(135deg, rgba(232,168,64,0.10) 0%, rgba(232,168,64,0.04) 100%)",
                border: "1px solid rgba(232,168,64,0.30)",
                boxShadow: "0 0 16px rgba(232,168,64,0.08)",
              }}
            >
              <Trophy size={18} style={{ color: "#E8A840", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8A840" }}>
                  Variant {abWinner.variant} selected as winner
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                  {abWinner.replyRate}% reply rate &middot; {abWinner.sends} sends &middot; auto-selected by Message Coach &middot; {new Date(abWinner.selectedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          {/* ── Variant Stats ── */}
          {variantStats.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{ background: cardBg, border: "1px solid rgba(124,58,237,0.15)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
            >
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3 select-none" style={{ color: "var(--accent-purple)", opacity: 0.8 }}>
                <FlaskConical size={11} className="inline mr-1" />
                A/B Variant Performance
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {variantStats.map(vs => (
                  <div
                    key={vs.variant}
                    className="rounded-lg p-3 text-center"
                    style={{
                      background: vs.replyRate >= (variantStats.reduce((max, v) => v.replyRate > max ? v.replyRate : max, 0)) && vs.sent > 0
                        ? "rgba(0,255,136,0.06)" : "var(--surface-2)",
                      border: vs.replyRate >= (variantStats.reduce((max, v) => v.replyRate > max ? v.replyRate : max, 0)) && vs.sent > 0
                        ? "1px solid rgba(0,255,136,0.18)" : "1px solid var(--line)",
                    }}
                  >
                    <p className="text-[13px] font-bold" style={{ color: "var(--accent-purple)" }}>
                      Variant {vs.variant}
                    </p>
                    <p className="text-[20px] font-bold mt-1 tabular-nums" style={{ color: "var(--ink)" }}>
                      {vs.replyRate}%
                    </p>
                    <p className="text-[9px] mt-0.5" style={{ color: "var(--ink-4)" }}>
                      {vs.replied}/{vs.sent} replies
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Execution Status ── */}
          {editingId && executions.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                  Execution Status
                </h3>
                <button
                  onClick={() => handleCancelExec()}
                  disabled={cancelling === "all"}
                  className="text-[10px] px-2 py-1 rounded-md font-medium transition-all duration-200"
                  style={{ background: "rgba(212,148,132,0.10)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.18)" }}
                >
                  {cancelling === "all" ? "Cancelling..." : "Cancel All"}
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {executions.map(exec => {
                  const lead = leads.find(l => l.id === exec.leadId);
                  return (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px]"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <span style={{ color: "var(--ink-2)" }}>
                        {lead?.name || exec.leadId} — Step {exec.currentStep + 1}/{steps.filter(s => s.active).length}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: exec.status === "active" ? "rgba(0,255,136,0.10)"
                              : exec.status === "paused" ? "rgba(245,158,11,0.10)"
                              : exec.status === "completed" ? "rgba(0,212,255,0.10)"
                              : "rgba(107,107,128,0.10)",
                            color: exec.status === "active" ? "var(--accent-green)"
                              : exec.status === "paused" ? "#f59e0b"
                              : exec.status === "completed" ? "var(--accent-blue)"
                              : "var(--muted)",
                          }}
                        >
                          {exec.status}
                        </span>
                        {exec.status === "active" && (
                          <button
                            onClick={() => handlePause(exec.id)}
                            disabled={pausing === exec.id}
                            className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                            style={{ color: "var(--ink-3)" }}
                          >
                            {pausing === exec.id ? "..." : "Pause"}
                          </button>
                        )}
                        {exec.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancelExec(exec.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                            style={{ color: "var(--ink-4)" }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Steps Timeline ── */}
          <div className="space-y-0">
            {steps.map((step, idx) => (
              <div key={idx}>
                {/* Connector */}
                {idx > 0 && (
                  <div className="flex items-center gap-2 pl-8 mb-1">
                    <div className="w-px h-5 border-l border-dashed ml-[22px]" style={{ borderColor: "var(--line)" }} />
                    <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>
                      +{step.day - steps[idx - 1].day} days
                    </span>
                  </div>
                )}

                {/* Step Card */}
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="rounded-xl p-4 transition-all duration-200"
                  style={{
                    background: cardBg,
                    border: dragIdx === idx ? "1px solid rgba(201,168,124,0.30)" : cardBorder,
                    boxShadow: dragIdx === idx ? "0 4px 16px rgba(201,168,124,0.08)" : "0 1px 3px rgba(0,0,0,0.25)",
                    opacity: dragIdx === idx ? 0.6 : 1,
                    transform: dragIdx === idx ? "scale(0.98)" : "scale(1)",
                  }}
                >
                  {/* Top bar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="cursor-grab active:cursor-grabbing transition-colors duration-150 rounded p-0.5"
                      style={{ color: "var(--ink-3)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}
                    >
                      <GripVertical size={14} />
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                      Step {idx + 1}
                    </span>

                    <div className="flex-1" />

                    {/* Active toggle */}
                    <button
                      onClick={() => updateStep(idx, { active: !step.active })}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-all duration-200"
                      style={step.active
                        ? { background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.18)" }
                        : { background: "rgba(237,234,226,0.03)", color: "var(--ink-4)", border: "1px solid var(--line)" }
                      }
                    >
                      {step.active ? "Active" : "Off"}
                    </button>

                    <button
                      onClick={() => removeStep(idx)}
                      className="transition-colors duration-150 rounded p-0.5"
                      style={{ color: "var(--ink-3)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--negative)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Day + Channel */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium" style={{ color: "var(--ink-4)" }}>Day</span>
                      <input
                        type="number" min={0} value={step.day}
                        onChange={e => updateStep(idx, { day: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-16 h-7 rounded-lg px-2 text-[12px] tabular-nums outline-none transition-all duration-200"
                        style={{
                          color: "var(--ink)", background: "var(--surface-2)",
                          border: "1px solid var(--line)",
                        }}
                        onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                        onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium" style={{ color: "var(--ink-4)" }}>Channel</span>
                      <Dropdown
                        options={[{ label: "LinkedIn", value: "linkedin" }, { label: "Email", value: "email" }]}
                        value={step.channel}
                        onChange={v => updateStep(idx, { channel: v as "linkedin" | "email" })}
                      />
                    </div>
                  </div>

                  {/* Template */}
                  <textarea
                    value={step.template}
                    onChange={e => updateStep(idx, { template: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-[12px] outline-none transition-all duration-200 resize-y font-mono"
                    style={{
                      color: "var(--ink)", background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                    }}
                    onFocus={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--accent)"}
                    onBlur={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--line)"}
                    placeholder="Write your message template…"
                  />

                  {/* Variable chips */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <span className="text-[9px] font-medium mr-1 select-none" style={{ color: "var(--ink-4)" }}>Insert:</span>
                    {VARIABLES.map(v => (
                      <button
                        key={v}
                        onClick={(e) => {
                          const ta = (e.currentTarget as HTMLElement).closest('[class*="rounded-xl"]')?.querySelector("textarea") as HTMLTextAreaElement | null;
                          if (ta) insertAtCursor(ta, v);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md font-mono transition-all duration-200"
                        style={{
                          background: "rgba(201,168,124,0.05)",
                          border: "1px solid rgba(201,168,124,0.10)",
                          color: "var(--ink-3)",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.12)";
                          (e.currentTarget as HTMLElement).style.color = "var(--accent-ink)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.05)";
                          (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {/* A/B Variant Toggle */}
                  <button
                    onClick={() => setVariantOpen(prev => {
                      const next = new Set(prev);
                      next.has(idx) ? next.delete(idx) : next.add(idx);
                      return next;
                    })}
                    className="flex items-center gap-1.5 mt-3 text-[10px] font-medium transition-all duration-200"
                    style={{ color: step.variants?.length ? "var(--accent-purple)" : "var(--ink-4)" }}
                  >
                    <FlaskConical size={11} />
                    A/B Variants {step.variants?.length ? `(${step.variants.length + 1} total)` : ""}
                    {variantOpen.has(idx) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>

                  {variantOpen.has(idx) && (
                    <div className="mt-2 space-y-2">
                      <p className="text-[9px]" style={{ color: "var(--ink-4)" }}>
                        Variants are assigned round-robin to leads on launch. Leave empty to use the main template for everyone (no A/B testing).
                      </p>
                      {(step.variants || [""]).map((variantText, vi) => (
                        <div key={vi} className="space-y-1">
                          <span className="text-[9px] font-bold" style={{ color: "var(--accent-purple)" }}>
                            Variant {String.fromCharCode(66 + vi)} {/* B, C, D... */}
                          </span>
                          <textarea
                            value={variantText}
                            onChange={e => {
                              const newVariants = [...(step.variants || [""])];
                              newVariants[vi] = e.target.value;
                              if (newVariants[vi].trim() === "" && vi === newVariants.length - 1) {
                                // Remove empty last variant
                                updateStep(idx, { variants: newVariants.slice(0, -1).filter(v => v.trim()) });
                              } else {
                                updateStep(idx, { variants: newVariants.filter(v => v.trim()) });
                              }
                            }}
                            rows={2}
                            className="w-full rounded-lg px-3 py-2 text-[12px] outline-none transition-all duration-200 resize-y font-mono"
                            style={{
                              color: "var(--ink)", background: "var(--surface-2)",
                              border: "1px solid var(--line)",
                            }}
                            onFocus={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--accent-purple)"}
                            onBlur={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--line)"}
                            placeholder={`Alternative template for variant ${String.fromCharCode(66 + vi)}...`}
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newVariants = [...(step.variants || [""]), ""];
                          updateStep(idx, { variants: newVariants });
                        }}
                        className="text-[10px] px-2 py-1 rounded-md font-medium transition-all duration-200"
                        style={{
                          background: "rgba(124,58,237,0.06)",
                          border: "1px solid rgba(124,58,237,0.15)",
                          color: "var(--accent-purple)",
                        }}
                      >
                        + Add Variant
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Add Step ── */}
          <button
            onClick={addStep}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-medium transition-all duration-200"
            style={{
              background: "transparent",
              border: "1px dashed var(--line)",
              color: "var(--ink-3)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.30)";
              (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
              (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.03)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
              (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Plus size={14} /> Add Step
          </button>

          {/* ── Saved Sequences ── */}
          <div className="pt-4" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4 select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Saved Sequences
            </h3>
            {sequences.length === 0 ? (
              <div
                className="rounded-xl p-8 text-center"
                style={{ background: cardBg, border: cardBorder }}
              >
                <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                  No sequences yet. Create your first outreach cadence above.
                </p>
              </div>
            ) : (
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
              >
                <table className="w-full">
                  <thead>
                    <tr className="text-left" style={{ borderBottom: "1px solid var(--line)" }}>
                      {["Name", "Steps", "Assigned", "Created", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] select-none" style={{ color: "var(--ink-4)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sequences.map(seq => (
                      <tr
                        key={seq.id}
                        className="transition-colors duration-150"
                        style={{ borderTop: "1px solid var(--line)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => loadSequence(seq)}
                            className="text-[13px] font-medium text-left transition-colors duration-150"
                            style={{ color: "var(--accent)" }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--accent-ink)"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--accent)"}
                          >
                            {seq.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[12px] tabular-nums" style={{ color: "var(--ink-3)" }}>{seq.steps.length}</td>
                        <td className="px-4 py-3 text-[12px] tabular-nums" style={{ color: "var(--ink-3)" }}>{seq.assignedLeadIds?.length || 0}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-4)" }}>
                          {seq.createdAt ? new Date(seq.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => loadSequence(seq)}
                              className="text-[11px] px-2 py-1 rounded-md transition-all duration-150"
                              style={{ color: "var(--ink-3)" }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
                                (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                                (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDuplicate(seq)}
                              className="text-[11px] px-2 py-1 rounded-md transition-all duration-150"
                              style={{ color: "var(--ink-3)" }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
                                (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                                (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                              }}
                            >
                              <Copy size={11} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(seq.id)}
                              className="text-[11px] px-2 py-1 rounded-md transition-all duration-150"
                              style={{ color: "var(--ink-3)" }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
                                (e.currentTarget as HTMLElement).style.color = "var(--negative)";
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                                (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div
            className="rounded-xl p-6 animate-fade-up"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[14px] font-bold mb-1" style={{ color: "var(--ink)" }}>Delete this sequence?</p>
            <p className="text-[12px] mb-5" style={{ color: "var(--ink-3)" }}>This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-all duration-200"
                style={{ background: "rgba(212,148,132,0.12)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.20)" }}
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-all duration-200"
                style={{ background: "transparent", color: "var(--ink-3)", border: "1px solid var(--line)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
