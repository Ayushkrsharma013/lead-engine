"use client";

import { useState, useEffect } from "react";
import {
  Briefcase, Plus, X, DollarSign, Mail, Copy, Check,
  Users, TrendingUp, Building2, Layers, Archive, ChevronDown, ChevronRight,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import type { PlanKey } from "@/lib/types";

const PLANS: { key: PlanKey; label: string }[] = [
  { key: "diy", label: "DIY Setup" },
  { key: "growth", label: "Managed Growth" },
  { key: "scale", label: "Managed Scale" },
];

interface ClientStats {
  totalLeads: number;
  hotLeads: number;
  contacted: number;
  meetings: number;
  activeSequences: number;
  totalPipelineValue: number;
}

interface ClientRow {
  id: string;
  userId: string;
  name: string;
  company: string;
  industry: string;
  email: string;
  plan: PlanKey;
  status: string;
  monthlyRetainer: number;
  portalUsername: string;
  createdAt: string;
  stats: ClientStats;
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--positive, #22c55e)",
  inactive: "var(--ink-4, #6b6b80)",
};

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

export default function ClientsPage() {
  const { dispatch } = useApp();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formIndustry, setFormIndustry] = useState("");
  const [formRetainer, setFormRetainer] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPlan, setFormPlan] = useState<PlanKey>("diy");

  // Credentials result
  const [newCredentials, setNewCredentials] = useState<{
    clientId: string;
    username: string;
    tempPassword: string;
  } | null>(null);
  const [credCopied, setCredCopied] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      const res = await fetch("/prospecting-os/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch { /* keep existing data */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  const resetForm = () => {
    setFormName(""); setFormCompany(""); setFormIndustry(""); setFormRetainer("");
    setFormEmail(""); setFormPlan("diy"); setNewCredentials(null);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/prospecting-os/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          company: formCompany,
          industry: formIndustry,
          monthlyRetainer: parseInt(formRetainer) || 0,
          email: formEmail.trim(),
          plan: formPlan,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create client");

      setNewCredentials(data.credentials);
      showToast(`Client "${data.client.name}" added`);

      // Refresh from API
      await fetchClients();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save client", "error");
    }
    setSaving(false);
  };

  const handleArchive = async (client: ClientRow) => {
    try {
      const newStatus = client.status === "active" ? "inactive" : "active";
      await fetch(`/prospecting-os/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: newStatus } : c));
      showToast(newStatus === "active" ? "Client reactivated" : "Client archived");
    } catch { showToast("Failed to update", "error"); }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCredCopied(label);
    setTimeout(() => setCredCopied(null), 2000);
  };

  const selected = clients.find(c => c.id === selectedId);

  // ── Compute aggregate stats ──────────────────────────
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === "active").length;
  const totalMRR = clients
    .filter(c => c.status === "active")
    .reduce((s, c) => s + (c.monthlyRetainer || 0), 0);
  const totalLeadsManaged = clients.reduce((s, c) => s + c.stats.totalLeads, 0);

  const planBadge = (plan?: string) => {
    if (!plan) return null;
    const label = plan === "diy" ? "DIY" : plan === "growth" ? "Growth" : plan === "scale" ? "Scale" : plan;
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold"
        style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}>
        {label}
      </span>
    );
  };

  return (
    <>
      <TopBar title="Client Manager" subtitle={`${activeClients} active · ${formatCurrency(totalMRR)} MRR`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ── Stat cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Clients", value: totalClients, icon: Briefcase,            color: "var(--ink)" },
            { label: "Active",        value: activeClients, icon: Users,               color: "var(--positive)" },
            { label: "Monthly MRR",   value: formatCurrency(totalMRR), icon: DollarSign, color: "var(--accent)" },
            { label: "Leads Managed", value: totalLeadsManaged, icon: Layers,           color: "var(--accent-blue)" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--ink-3)" }}>
                  {s.label}
                </span>
                <s.icon size={13} style={{ color: s.color }} />
              </div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Header bar ──────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            {totalClients === 0 ? "No clients yet. Add your first client." : `${totalClients} client${totalClients !== 1 ? "s" : ""}`}
          </p>
          <button
            onClick={() => { setShowAdd(true); resetForm(); }}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "rgba(232,168,64,0.12)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}
          >
            <Plus size={14} /> Add Client
          </button>
        </div>

        {/* ── Client list ──────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase size={32} className="mx-auto mb-3" style={{ color: "var(--ink-3)", opacity: 0.5 }} />
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>No clients yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>Add your first client to start managing leads</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map(c => {
              const expanded = selectedId === c.id;
              return (
                <div key={c.id}>
                  {/* Client row */}
                  <button
                    onClick={() => setSelectedId(expanded ? null : c.id)}
                    className="w-full text-left rounded-xl p-4 transition-all hover:translate-x-0.5"
                    style={{
                      background: expanded ? "var(--surface2)" : "var(--surface)",
                      border: `1px solid ${expanded ? "rgba(232,168,64,0.20)" : "var(--border)"}`,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "rgba(0,212,255,0.12)", color: "var(--accent-blue)" }}>
                        {getInitials(c.name)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{c.name}</span>
                          {planBadge(c.plan)}
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[c.status] || "var(--ink-4)" }} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {c.company && <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--ink-3)" }}><Building2 size={10} />{c.company}</span>}
                          {c.industry && <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>{c.industry}</span>}
                          {c.email && <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>{c.email}</span>}
                        </div>
                      </div>

                      {/* Stats pills */}
                      <div className="hidden md:flex items-center gap-2">
                        <div className="text-center px-2.5">
                          <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>{c.stats.totalLeads}</div>
                          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--ink-4)" }}>Leads</div>
                        </div>
                        {c.stats.hotLeads > 0 && (
                          <div className="text-center px-2.5">
                            <div className="text-sm font-bold" style={{ color: "var(--negative)" }}>{c.stats.hotLeads}</div>
                            <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--ink-4)" }}>Hot</div>
                          </div>
                        )}
                        {c.stats.activeSequences > 0 && (
                          <div className="text-center px-2.5">
                            <div className="text-sm font-bold" style={{ color: "var(--accent-blue)" }}>{c.stats.activeSequences}</div>
                            <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--ink-4)" }}>Seq</div>
                          </div>
                        )}
                        <div className="text-center px-2.5">
                          <div className="text-sm font-bold" style={{ color: "var(--accent)" }}>{formatCurrency(c.monthlyRetainer)}</div>
                          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--ink-4)" }}>MRR</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleArchive(c)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.04]"
                          title={c.status === "active" ? "Archive" : "Reactivate"}
                          style={{ color: "var(--ink-4)" }}
                        >
                          <Archive size={13} />
                        </button>
                      </div>

                      {/* Expand chevron */}
                      <div style={{ color: "var(--ink-4)" }}>
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {expanded && selected && (
                    <div className="mx-1 rounded-b-xl p-5 space-y-5 animate-fade-up"
                      style={{ background: "var(--surface)", border: "1px solid rgba(232,168,64,0.12)", borderTop: "none" }}>
                      {/* Detail header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{selected.name}</h3>
                            {planBadge(selected.plan)}
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{
                                background: selected.status === "active" ? "rgba(34,197,94,0.10)" : "rgba(107,107,128,0.10)",
                                color: selected.status === "active" ? "var(--positive)" : "var(--ink-4)",
                              }}>
                              {selected.status}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                            {[selected.company, selected.industry, selected.email].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-4)" }}>Monthly Retainer</div>
                            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>${selected.monthlyRetainer.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        {[
                          { label: "Total Leads",    value: selected.stats.totalLeads,       color: "var(--ink)" },
                          { label: "Hot Leads",      value: selected.stats.hotLeads,          color: "var(--negative)" },
                          { label: "Contacted",       value: selected.stats.contacted,          color: "var(--info)" },
                          { label: "Meetings",       value: selected.stats.meetings,           color: "var(--accent)" },
                          { label: "Active Sequences", value: selected.stats.activeSequences,  color: "var(--accent-blue)" },
                          { label: "Pipeline Value", value: selected.stats.totalPipelineValue, color: "var(--positive)" },
                        ].map(s => (
                          <div key={s.label} className="rounded-lg p-3 text-center"
                            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                            <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--ink-4)" }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Quick metadata */}
                      <div className="flex flex-wrap gap-4 text-[11px]" style={{ color: "var(--ink-4)" }}>
                        <span>Portal: <span style={{ color: "var(--ink-3)" }}>{selected.portalUsername || "—"}</span></span>
                        <span>Created: <span style={{ color: "var(--ink-3)" }}>{selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : "—"}</span></span>
                        <span>Client ID: <span className="font-mono text-[10px]" style={{ color: "var(--ink-3)" }}>{selected.id.slice(0, 8)}...</span></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════ Add Client Modal ═══════════════ */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!saving) setShowAdd(false); }}>
          <div className="w-[440px] max-w-[95vw] bg-surface border border-line rounded-xl shadow-2xl p-6 space-y-4 animate-fade-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Add Client</h3>
              <button onClick={() => setShowAdd(false)} className="text-ink-3 hover:text-ink" disabled={saving}><X size={14} /></button>
            </div>

            {newCredentials ? (
              <div className="space-y-3">
                <div className="rounded-lg p-4 space-y-2" style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--accent-blue)" }}>Client Created — Credentials Sent via Email</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Client ID", value: newCredentials.clientId },
                      { label: "Username", value: newCredentials.username },
                      { label: "Temporary Password", value: newCredentials.tempPassword },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between bg-white/[0.04] rounded-md px-3 py-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-4)" }}>{item.label}</p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: "var(--ink)" }}>{item.value}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(item.value, item.label)}
                          className="transition-colors" style={{ color: "var(--ink-3)" }}
                        >
                          {credCopied === item.label ? <Check size={13} style={{ color: "var(--positive)" }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setShowAdd(false); resetForm(); }}
                  className="w-full h-9 rounded-md text-sm transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", color: "var(--ink-3)" }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <input type="text" placeholder="Client name *" value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-line px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40" />
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
                    <input type="email" placeholder="Email ID *" value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      className="w-full h-9 rounded-md bg-white/5 border border-line pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40" />
                  </div>
                  <input type="text" placeholder="Company" value={formCompany}
                    onChange={e => setFormCompany(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-line px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40" />
                  <input type="text" placeholder="Industry" value={formIndustry}
                    onChange={e => setFormIndustry(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-line px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40" />
                  <div className="relative">
                    <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
                    <input type="number" placeholder="Monthly Retainer" value={formRetainer}
                      onChange={e => setFormRetainer(e.target.value)}
                      className="w-full h-9 rounded-md bg-white/5 border border-line pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] block mb-1.5" style={{ color: "var(--ink-4)" }}>Subscription Plan</label>
                    <div className="flex gap-1.5">
                      {PLANS.map(p => (
                        <button
                          key={p.key}
                          onClick={() => setFormPlan(p.key)}
                          className={`flex-1 h-8 rounded-md text-xs font-medium transition-all ${
                            formPlan === p.key
                              ? "bg-accent/20 text-accent border border-accent/30"
                              : "bg-white/[0.04] text-ink-3 border border-line hover:text-ink"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSave} disabled={!formName.trim() || !formEmail.trim() || saving}
                    className="flex-1 h-9 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
                    style={{ background: "rgba(232,168,64,0.15)", color: "var(--accent)" }}>
                    {saving ? "Creating..." : "Save Client"}
                  </button>
                  <button onClick={() => setShowAdd(false)} disabled={saving}
                    className="flex-1 h-9 rounded-md text-sm transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", color: "var(--ink-3)" }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
