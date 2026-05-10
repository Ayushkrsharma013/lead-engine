"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  GitBranch, Save, Trash2, GripVertical, Plus, Users, Copy, Check,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { saveSequence as saveSeq, deleteSequence as delSeq } from "@/lib/db";
import type { SequenceStep, Sequence } from "@/lib/types";

const DEFAULT_STEPS: SequenceStep[] = [
  { day: 0, channel: "linkedin", type: "Connection Request", template: "Hi {{first_name}}, I came across your profile while researching {{industry}} leaders and was impressed by your work at {{company}}. Would love to connect.", active: true },
  { day: 3, channel: "linkedin", type: "Follow-up DM", template: "Hey {{first_name}}, wanted to follow up on my connection request. I help companies like {{company}} with their growth strategy. Worth a quick chat?", active: true },
  { day: 5, channel: "email", type: "Cold Email", template: "Subject: Quick question about {{company}}\n\nHi {{first_name}},\n\nI noticed {{company}} is doing great work in {{industry}}. I help similar companies with [your offer].\n\nWould a 15-min call make sense?", active: true },
  { day: 8, channel: "email", type: "Follow-up Email", template: "Hi {{first_name}}, just bumping this up in case it got buried. Let me know if you'd like to connect.", active: true },
  { day: 12, channel: "email", type: "Breakup Email", template: "Hi {{first_name}}, last note from me — should I close your file? No hard feelings either way.", active: true },
];

const VARIABLES = ["{{first_name}}", "{{company}}", "{{industry}}", "{{title}}"];

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

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  // Load existing sequence into editor
  const loadSequence = (seq: Sequence) => {
    setName(seq.name);
    setSteps(seq.steps);
    setEditingId(seq.id);
    setAssignedIds(seq.assignedLeadIds || []);
  };

  const resetForm = () => {
    setName("");
    setSteps(DEFAULT_STEPS.map(s => ({ ...s })));
    setEditingId(null);
    setAssignedIds([]);
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
    } catch {
      showToast("Failed to save", "error");
    }
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

  // Step mutations
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

  // Native HTML5 drag-and-drop reorder
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
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Name + Actions */}
          <div className="flex items-center gap-3">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="My LinkedIn Outreach Sequence"
              className="flex-1 h-11 rounded-lg bg-surface2 border border-line px-4 text-lg font-semibold text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-accent-blue/40"
            />
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 h-11 px-5 rounded-lg bg-accent/20 text-accent text-sm font-semibold hover:bg-accent/30 disabled:opacity-40 transition-colors"
            >
              <Save size={14} /> Save
            </button>
            <div className="relative">
              <button
                onClick={() => setShowAssign(!showAssign)}
                className="flex items-center gap-2 h-11 px-4 rounded-lg border border-line text-sm text-ink-3 hover:text-ink hover:bg-white/[0.04] transition-colors"
              >
                <Users size={14} /> Assign ({assignedIds.length})
              </button>
              {showAssign && (
                <div className="absolute right-0 top-12 w-72 bg-surface border border-line rounded-lg shadow-xl z-50 p-3 max-h-64 overflow-y-auto space-y-1">
                  {leads.length === 0 ? (
                    <p className="text-xs text-ink-3 text-center py-4">No leads available</p>
                  ) : (
                    leads.map(l => {
                      const sel = assignedIds.includes(l.id);
                      return (
                        <button key={l.id} onClick={() => toggleAssign(l.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${sel ? "bg-accent/10 text-accent" : "text-ink hover:bg-white/[0.04]"}`}>
                          {sel && <Check size={10} />}
                          <span className={sel ? "" : "ml-[18px]"}>{l.name} — {l.company}</span>
                        </button>
                      );
                    })
                  )}
                  <button onClick={() => setShowAssign(false)} className="w-full text-[10px] text-ink-3 text-center pt-1 hover:text-ink">Close</button>
                </div>
              )}
            </div>
          </div>

          {/* Steps Timeline */}
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx}>
                {/* Connector line */}
                {idx > 0 && (
                  <div className="flex items-center gap-2 pl-8 mb-2">
                    <div className="w-px h-6 border-l border-dashed border-line ml-[22px]" />
                    <span className="text-[11px] text-ink-3">+{step.day - steps[idx - 1].day} days</span>
                  </div>
                )}

                {/* Step Card */}
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`bg-surface border rounded-lg p-4 transition-all ${dragIdx === idx ? "opacity-50 border-accent-blue" : "border-line"}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {/* Drag handle */}
                    <div className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink">
                      <GripVertical size={14} />
                    </div>

                    {/* Step label */}
                    <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Step {idx + 1}</span>

                    <div className="flex-1" />

                    {/* Active toggle */}
                    <button
                      onClick={() => updateStep(idx, { active: !step.active })}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${step.active ? "bg-positive/15 text-positive" : "bg-white/5 text-ink-3"}`}
                    >
                      {step.active ? "Active" : "Off"}
                    </button>

                    {/* Delete */}
                    <button onClick={() => removeStep(idx)} className="text-ink-3 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Day + Channel */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-ink-3">Day</label>
                      <input
                        type="number" min={0} value={step.day}
                        onChange={e => updateStep(idx, { day: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-16 h-7 rounded-md bg-white/5 border border-line px-2 text-xs text-ink focus:outline-none focus:border-accent-blue/40"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-ink-3">Channel</label>
                      <select
                        value={step.channel}
                        onChange={e => updateStep(idx, { channel: e.target.value as "linkedin" | "email" })}
                        className="h-7 rounded-md bg-white/5 border border-line px-2 text-xs text-ink focus:outline-none focus:border-accent-blue/40 appearance-none cursor-pointer"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                  </div>

                  {/* Template textarea */}
                  <textarea
                    value={step.template}
                    onChange={e => updateStep(idx, { template: e.target.value })}
                    rows={3}
                    className="w-full rounded-md bg-white/5 border border-line px-3 py-2 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40 resize-y font-mono"
                    placeholder="Write your message template…"
                    ref={el => {
                      if (el) (el as HTMLTextAreaElement & { _stepIdx?: number })._stepIdx = idx;
                    }}
                  />

                  {/* Variable chips */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[9px] text-ink-3 mr-1">Insert:</span>
                    {VARIABLES.map(v => (
                      <button
                        key={v}
                        onClick={(e) => {
                          const ta = (e.currentTarget as HTMLElement).closest(".bg-surface")?.querySelector("textarea") as HTMLTextAreaElement | null;
                          if (ta) insertAtCursor(ta, v);
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-line text-ink-3 hover:text-ink hover:bg-white/[0.08] transition-colors font-mono"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Step */}
          <button
            onClick={addStep}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-line text-ink-3 hover:text-ink hover:border-text/20 transition-colors text-sm"
          >
            <Plus size={14} /> Add Step
          </button>

          {/* Saved Sequences */}
          <div className="border-t border-line pt-6">
            <h3 className="text-sm font-semibold text-ink mb-3">Saved Sequences</h3>
            {sequences.length === 0 ? (
              <p className="text-sm text-ink-3 text-center py-8">No sequences yet. Create your first outreach cadence above.</p>
            ) : (
              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface2">
                    <tr className="text-left text-[10px] text-ink-3 uppercase tracking-wider">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Steps</th>
                      <th className="px-4 py-2.5 font-medium">Assigned</th>
                      <th className="px-4 py-2.5 font-medium">Created</th>
                      <th className="px-4 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sequences.map(seq => (
                      <tr key={seq.id} className="border-t border-line hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-2.5">
                          <button onClick={() => loadSequence(seq)} className="text-xs font-medium text-accent hover:text-accent/80 text-left">
                            {seq.name}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-ink-3">{seq.steps.length}</td>
                        <td className="px-4 py-2.5 text-xs text-ink-3">{seq.assignedLeadIds?.length || 0}</td>
                        <td className="px-4 py-2.5 text-xs text-ink-3">{seq.createdAt ? new Date(seq.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => loadSequence(seq)} className="text-[10px] text-ink-3 hover:text-ink px-1.5 py-0.5 rounded hover:bg-white/[0.04]">Edit</button>
                            <button onClick={() => handleDuplicate(seq)} className="text-[10px] text-ink-3 hover:text-ink px-1.5 py-0.5 rounded hover:bg-white/[0.04]"><Copy size={10} /></button>
                            <button onClick={() => setDeleteConfirm(seq.id)} className="text-[10px] text-ink-3 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-white/[0.04]"><Trash2 size={10} /></button>
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
          <div className="bg-surface border border-line rounded-xl p-6 shadow-2xl animate-fade-up" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-ink mb-1">Delete this sequence?</p>
            <p className="text-xs text-ink-3 mb-4">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-md bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-md bg-white/5 text-ink-3 text-xs hover:bg-white/[0.08]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
