"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { GitBranch, Plus, Play, Pause, Trash2, Loader2, X } from "lucide-react";
import type { PlanKey } from "@/lib/types";

interface Sequence {
  id: string; name: string; steps: unknown[]; schedule: Record<string, unknown> | null;
  status: string; created_at: string; updated_at: string;
}

export default function ClientSequencesPage() {
  const [profile, setProfile] = useState<{ plan?: PlanKey; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const fetchSequences = async () => {
    const res = await fetch("/prospecting-os/api/client-portal/sequences");
    if (res.ok) {
      const d = await res.json();
      setSequences(d.sequences || []);
    }
  };

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) { const d = await meRes.json(); setProfile(d.profile); }
      await fetchSequences();
      setLoading(false);
    }
    init();
  }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const res = await fetch("/prospecting-os/api/client-portal/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, steps: [], schedule: null }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setFormName("");
      await fetchSequences();
      setToast("Sequence created");
      setTimeout(() => setToast(""), 2500);
    }
  };

  const handleToggle = async (seq: Sequence) => {
    const newStatus = seq.status === "active" ? "draft" : "active";
    const res = await fetch(`/prospecting-os/api/client-portal/sequences?id=${seq.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) await fetchSequences();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sequence?")) return;
    await fetch(`/prospecting-os/api/client-portal/sequences?id=${id}`, { method: "DELETE" });
    await fetchSequences();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  return (
    <PlanGate module="sequences" plan={profile?.plan || null} role={profile?.role} requiredPlan="pilot">
      <div className="max-w-3xl space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Sequences</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Create and manage outreach sequences</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all"
            style={{ background: "var(--accent)", color: "#000", border: "none", cursor: "pointer" }}>
            <Plus size={14} /> New Sequence
          </button>
        </div>

        {/* Create form modal */}
        {showForm && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: "var(--surface-elev)", border: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>New Sequence</h2>
                <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}><X size={16} /></button>
              </div>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Sequence name" autoFocus
                className="w-full h-10 rounded-xl px-3 text-[13px] mb-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }} />
              <button onClick={handleCreate} disabled={saving || !formName.trim()}
                className="w-full h-10 rounded-full text-[13px] font-semibold flex items-center justify-center gap-2"
                style={{ background: "var(--accent)", color: "#000", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} Create
              </button>
            </div>
          </div>
        )}

        {sequences.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <GitBranch size={32} style={{ color: "var(--ink-4)", margin: "0 auto 12px" }} />
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>No sequences yet</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Create your first outreach sequence to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sequences.map(seq => (
              <div key={seq.id} className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: "var(--surface)", border: seq.status === "active" ? "1px solid rgba(34,197,94,0.2)" : "1px solid var(--line)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(232,168,64,0.08)", border: "1px solid rgba(232,168,64,0.15)" }}>
                    <GitBranch size={14} style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{seq.name}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-4)" }}>
                      {(seq.steps as unknown[] || []).length} steps · {new Date(seq.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      background: seq.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                      color: seq.status === "active" ? "#22c55e" : "var(--ink-4)",
                    }}>
                    {seq.status}
                  </span>
                  <button onClick={() => handleToggle(seq)} title={seq.status === "active" ? "Pause" : "Activate"}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 4 }}>
                    {seq.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button onClick={() => handleDelete(seq.id)} title="Delete"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium"
            style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", color: "var(--ink)", boxShadow: "var(--shadow-md)" }}>
            {toast}
          </div>
        )}
      </div>
    </PlanGate>
  );
}
