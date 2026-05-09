"use client";

import { useState, useEffect } from "react";
import {
  Briefcase, Plus, FileText, Archive, X, DollarSign,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { getClients, saveClient, updateClient as updateClientDB } from "@/lib/db";
import type { Client } from "@/lib/types";

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

  // Form
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formIndustry, setFormIndustry] = useState("");
  const [formRetainer, setFormRetainer] = useState("");

  useEffect(() => {
    getClients().then(c => { setClients(c); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  const resetForm = () => {
    setFormName(""); setFormCompany(""); setFormIndustry(""); setFormRetainer("");
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      const c = await saveClient({
        name: formName, company: formCompany, industry: formIndustry,
        monthlyRetainer: parseInt(formRetainer) || 0, status: "active",
      });
      setClients(prev => [c, ...prev]);
      dispatch({ type: "SAVE_CLIENT", payload: c });
      showToast(`Client "${c.name}" added`);
      setShowAdd(false);
      resetForm();
    } catch { showToast("Failed to save client", "error"); }
  };

  const handleArchive = async (client: Client) => {
    try {
      await updateClientDB(client.id, { status: client.status === "active" ? "inactive" : "active" });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: c.status === "active" ? "inactive" as const : "active" as const } : c));
      showToast(client.status === "active" ? "Archived" : "Reactivated");
    } catch { showToast("Failed to update", "error"); }
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

  return (
    <>
      <TopBar title="Client Manager" subtitle="Manage client accounts and reports" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Mode toggle + Add */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-border">
            {(["personal", "agency"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-xs px-4 py-1.5 rounded-md font-medium transition-all ${
                  mode === m ? "bg-accent-blue/20 text-accent-blue" : "text-muted hover:text-text"
                }`}
              >
                {m === "personal" ? "Personal Mode" : "Agency Mode"}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowAdd(true); resetForm(); }}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-blue/20 text-accent-blue text-sm font-medium hover:bg-accent-blue/30 transition-colors"
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
            <Briefcase size={32} className="mx-auto text-muted/50 mb-3" />
            <p className="text-sm text-text font-medium">No clients yet</p>
            <p className="text-xs text-muted mt-1">Add your first client to start managing leads</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface2">
                <tr className="text-left text-[10px] text-muted uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Industry</th>
                  <th className="px-4 py-2.5 font-medium">Leads</th>
                  <th className="px-4 py-2.5 font-medium">Retainer</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-2.5">
                      <button onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} className="flex items-center gap-2.5 text-left">
                        <div className="w-7 h-7 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-[10px] font-bold">
                          {getInitials(c.name)}
                        </div>
                        <span className="text-xs font-medium text-text hover:text-accent-blue transition-colors">{c.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">{c.company || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{c.industry || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{clientLeads.length}</td>
                    <td className="px-4 py-2.5 text-xs text-text font-medium">${c.monthlyRetainer.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} className="text-[10px] text-accent-blue hover:text-accent-blue/80 px-1.5 py-0.5 rounded hover:bg-white/[0.04]">View</button>
                        <button onClick={() => generateReport(c)} className="text-[10px] text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-white/[0.04]"><FileText size={10} /></button>
                        <button onClick={() => handleArchive(c)} className="text-[10px] text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-white/[0.04]"><Archive size={10} /></button>
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
          <div className="border border-border rounded-lg p-5 bg-surface space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text">{selected.name}</h3>
                <p className="text-xs text-muted">{selected.company} · {selected.industry}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => generateReport(selected)} className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-purple/10 text-accent-purple text-xs font-medium hover:bg-accent-purple/20 transition-colors">
                  <FileText size={12} /> Generate Report
                </button>
                <button onClick={() => setSelectedId(null)} className="text-muted hover:text-text"><X size={14} /></button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-text">{clientLeads.length}</div>
                <div className="text-[10px] text-muted">Total Leads</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-accent-orange">{clientHotLeads}</div>
                <div className="text-[10px] text-muted">Hot Leads</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-text">{clientSequences.length}</div>
                <div className="text-[10px] text-muted">Sequences</div>
              </div>
              <div className="bg-surface2 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-accent-green">${selected.monthlyRetainer.toLocaleString()}</div>
                <div className="text-[10px] text-muted">Retainer</div>
              </div>
            </div>

            {/* Lead list for client */}
            {clientLeads.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text mb-2">Assigned Leads</h4>
                <div className="space-y-1">
                  {clientLeads.slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-2 rounded bg-surface2 border border-border text-xs">
                      <div>
                        <span className="text-text font-medium">{l.name}</span>
                        <span className="text-muted ml-2">{l.title} @ {l.company}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${l.score >= 80 ? "bg-accent-green/15 text-accent-green" : l.score >= 60 ? "bg-accent-orange/15 text-accent-orange" : "bg-red-500/15 text-red-400"}`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-[420px] max-w-[95vw] bg-surface border border-border rounded-xl shadow-2xl p-6 space-y-4 animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Add Client</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted hover:text-text"><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Client name *" value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-border px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent-blue/40" />
              <input type="text" placeholder="Company" value={formCompany}
                onChange={e => setFormCompany(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-border px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent-blue/40" />
              <input type="text" placeholder="Industry" value={formIndustry}
                onChange={e => setFormIndustry(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-border px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent-blue/40" />
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="number" placeholder="Monthly Retainer" value={formRetainer}
                  onChange={e => setFormRetainer(e.target.value)}
                  className="w-full h-9 rounded-md bg-white/5 border border-border pl-8 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent-blue/40" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={!formName.trim()} className="flex-1 h-9 rounded-md bg-accent-blue/20 text-accent-blue text-sm font-medium hover:bg-accent-blue/30 disabled:opacity-40 transition-colors">Save Client</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 h-9 rounded-md bg-white/5 text-muted text-sm hover:bg-white/[0.08] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
