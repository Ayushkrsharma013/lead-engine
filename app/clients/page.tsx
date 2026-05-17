"use client";

import { useState, useEffect } from "react";
import {
  Briefcase, Plus, FileText, Archive, X, DollarSign, Mail, Copy, Check, Globe,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { getClients, updateClient as updateClientDB } from "@/lib/db";
import type { Client, PlanKey } from "@/lib/types";

const PLANS: { key: PlanKey; label: string }[] = [
  { key: "diy", label: "DIY Setup" },
  { key: "growth", label: "Managed Growth" },
  { key: "scale", label: "Managed Scale" },
];

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
}

export default function ClientsPage() {
  const { state, dispatch } = useApp();
  const { leads, sequences } = state;

  const [clients, setClients] = useState<Client[]>([]);
  const [mode, setMode] = useState<"personal" | "agency">("personal");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    getClients().then(c => { setClients(c); setLoading(false); }).catch(() => setLoading(false));
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

      // Refresh client list
      const updated = await getClients();
      setClients(updated);
      dispatch({ type: "SAVE_CLIENT", payload: data.client });
      showToast(`Client "${data.client.name}" added`);

      // Show credentials
      setNewCredentials(data.credentials);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save client", "error");
    }
    setSaving(false);
  };

  const handleArchive = async (client: Client) => {
    try {
      await updateClientDB(client.id, { status: client.status === "active" ? "inactive" : "active" });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: c.status === "active" ? "inactive" as const : "active" as const } : c));
      showToast(client.status === "active" ? "Archived" : "Reactivated");
    } catch { showToast("Failed to update", "error"); }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCredCopied(label);
    setTimeout(() => setCredCopied(null), 2000);
  };

  const selected = clients.find(c => c.id === selectedId);
  const clientLeads = selected ? leads.filter(l => (l as unknown as Record<string, unknown>).client_id === selected.id) : [];
  const clientHotLeads = clientLeads.filter(l => l.score > 80).length;
  const clientSequences = sequences.filter(s => selected && s.assignedLeadIds?.some(id => clientLeads.some(l => l.id === id)));

  const generateReport = (client: Client) => {
    const now = new Date().toLocaleDateString();
    const repliedCount = clientLeads.filter(l => l.status === "replied").length;
    const unscored = clientLeads.filter(l => l.score === 0).length;
    const weekAgo = Date.now() - 7 * 86400000;
    const untouched = clientLeads.filter(l => {
      const lt = (l as unknown as Record<string, unknown>).last_touched;
      return lt ? new Date(String(lt)).getTime() < weekAgo : true;
    }).length;
    const topLeads = clientLeads.sort((a, b) => b.score - a.score).slice(0, 3);

    const report = `════════════════════════════════════
CLIENT REPORT — ${client.name}
Generated: ${now}
════════════════════════════════════

Pipeline Summary
├ Total Leads     : ${clientLeads.length}
├ Hot Leads (>80) : ${clientHotLeads}
├ In Sequence     : ${clientSequences.length}
├ Messages Sent   : ${0}
└ Meetings Booked : ${0}

Top Leads This Period
${topLeads.map((l, i) => `${i + 1}. ${l.name} — ${l.company} — Score: ${l.score}`).join("\n") || "  (none)"}

Recommended Actions
→ Follow up with ${repliedCount} leads in "Replied"
→ ${unscored} leads unscored — run AI scorer
→ ${untouched} leads untouched 7+ days

Monthly Retainer : $${client.monthlyRetainer.toLocaleString()}
════════════════════════════════════`;

    navigator.clipboard.writeText(report);
    showToast("Report copied to clipboard");
  };

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
      <TopBar title="Client Manager" subtitle="Manage client accounts and reports" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Mode toggle + Add */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-line">
            {(["personal", "agency"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-xs px-4 py-1.5 rounded-md font-medium transition-all ${
                  mode === m ? "bg-accent/20 text-accent" : "text-ink-3 hover:text-ink"
                }`}
              >
                {m === "personal" ? "Personal Mode" : "Agency Mode"}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowAdd(true); resetForm(); }}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-colors"
          >
            <Plus size={14} /> Add Client
          </button>
        </div>

        {/* Client List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase size={32} className="mx-auto text-ink-3/50 mb-3" />
            <p className="text-sm text-ink font-medium">No clients yet</p>
            <p className="text-xs text-ink-3 mt-1">Add your first client to start managing leads</p>
          </div>
        ) : (
          <div className="border border-line rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface2">
                <tr className="text-left text-[10px] text-ink-3 uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Industry</th>
                  <th className="px-4 py-2.5 font-medium">Plan</th>
                  <th className="px-4 py-2.5 font-medium">Leads</th>
                  <th className="px-4 py-2.5 font-medium">Retainer</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-t border-line hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-2.5">
                      <button onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} className="flex items-center gap-2.5 text-left">
                        <div className="w-7 h-7 rounded-full bg-info/20 text-info flex items-center justify-center text-[10px] font-bold">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-ink hover:text-accent transition-colors block">{c.name}</span>
                          {c.email && <span className="text-[10px] text-ink-4">{c.email}</span>}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-3">{c.company || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-3">{c.industry || "—"}</td>
                    <td className="px-4 py-2.5">{planBadge(c.plan)}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-3">{clientLeads.length}</td>
                    <td className="px-4 py-2.5 text-xs text-ink font-medium">${c.monthlyRetainer.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} className="text-[10px] text-accent hover:text-accent/80 px-1.5 py-0.5 rounded hover:bg-white/[0.04]">View</button>
                        <button onClick={() => generateReport(c)} className="text-[10px] text-ink-3 hover:text-ink px-1.5 py-0.5 rounded hover:bg-white/[0.04]"><FileText size={10} /></button>
                        <button onClick={() => handleArchive(c)} className="text-[10px] text-ink-3 hover:text-ink px-1.5 py-0.5 rounded hover:bg-white/[0.04]"><Archive size={10} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Client Detail */}
        {selected && (
          <div className="border border-line rounded-lg p-5 bg-surface space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">{selected.name}</h3>
                  {planBadge(selected.plan)}
                </div>
                <p className="text-xs text-ink-3">{selected.company} · {selected.industry}</p>
                {selected.email && <p className="text-xs text-ink-4 mt-0.5">{selected.email}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => generateReport(selected)} className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-info/10 text-info text-xs font-medium hover:bg-info/20 transition-colors">
                  <FileText size={12} /> Generate Report
                </button>
                <button onClick={() => setSelectedId(null)} className="text-ink-3 hover:text-ink"><X size={14} /></button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-ink">{clientLeads.length}</div>
                <div className="text-[10px] text-ink-3">Total Leads</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-negative">{clientHotLeads}</div>
                <div className="text-[10px] text-ink-3">Hot Leads</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-ink">{clientSequences.length}</div>
                <div className="text-[10px] text-ink-3">Sequences</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-positive">${selected.monthlyRetainer.toLocaleString()}</div>
                <div className="text-[10px] text-ink-3">Retainer</div>
              </div>
            </div>

            {/* Lead list for client */}
            {clientLeads.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-ink mb-2">Assigned Leads</h4>
                <div className="space-y-1">
                  {clientLeads.slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-2 rounded bg-surface2 border border-line text-xs">
                      <div>
                        <span className="text-ink font-medium">{l.name}</span>
                        <span className="text-ink-3 ml-2">{l.title} @ {l.company}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${l.score >= 80 ? "bg-positive/15 text-positive" : l.score >= 60 ? "bg-negative/15 text-negative" : "bg-red-500/15 text-red-400"}`}>
                        {l.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!saving) setShowAdd(false); }}>
          <div className="w-[440px] max-w-[95vw] bg-surface border border-line rounded-xl shadow-2xl p-6 space-y-4 animate-fade-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Add Client</h3>
              <button onClick={() => setShowAdd(false)} className="text-ink-3 hover:text-ink" disabled={saving}><X size={14} /></button>
            </div>

            {/* Credentials result */}
            {newCredentials ? (
              <div className="space-y-3">
                <div className="rounded-lg p-4 space-y-2" style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)" }}>
                  <p className="text-xs font-semibold text-accent-blue">Client Created — Credentials Sent via Email</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Client ID", value: newCredentials.clientId },
                      { label: "Username", value: newCredentials.username },
                      { label: "Temporary Password", value: newCredentials.tempPassword },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between bg-white/[0.04] rounded-md px-3 py-2">
                        <div>
                          <p className="text-[10px] text-ink-4 uppercase tracking-wider">{item.label}</p>
                          <p className="text-xs font-mono text-ink mt-0.5">{item.value}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(item.value, item.label)}
                          className="text-ink-3 hover:text-ink transition-colors"
                        >
                          {credCopied === item.label ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setShowAdd(false); resetForm(); }}
                  className="w-full h-9 rounded-md bg-white/5 text-ink-3 text-sm hover:bg-white/[0.08] transition-colors"
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
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
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
                    <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                    <input type="number" placeholder="Monthly Retainer" value={formRetainer}
                      onChange={e => setFormRetainer(e.target.value)}
                      className="w-full h-9 rounded-md bg-white/5 border border-line pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] block mb-1.5 text-ink-4">Subscription Plan</label>
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
                    className="flex-1 h-9 rounded-md bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 disabled:opacity-40 transition-colors">
                    {saving ? "Creating..." : "Save Client"}
                  </button>
                  <button onClick={() => setShowAdd(false)} disabled={saving}
                    className="flex-1 h-9 rounded-md bg-white/5 text-ink-3 text-sm hover:bg-white/[0.08] transition-colors">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
