"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Search, Loader2, AlertTriangle, Ban, CheckCircle, Trash2,
  ExternalLink, ChevronLeft, ChevronRight, DollarSign, BarChart3,
  UserCheck, Filter,
} from "lucide-react";

interface ClientRow {
  id: string; email: string; name: string; plan: string;
  subscription_status: string; is_active: boolean; created_at: string;
  workspace_id: string | null; leads_count: number;
  leads_generation_status: string; icp_locked: boolean;
}

interface Metrics {
  totalClients: number; activeSubscriptions: number;
  mrr: number; totalLeadsManaged: number;
}

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  micro: { bg: "rgba(107,203,119,0.08)", text: "#6BCB77" },
  pilot: { bg: "rgba(232,168,64,0.08)", text: "#E8A840" },
  growth: { bg: "rgba(0,180,255,0.08)", text: "#00b4ff" },
  scale: { bg: "rgba(168,85,247,0.08)", text: "#a855f7" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(34,197,94,0.08)", text: "#22c55e" },
  trial: { bg: "rgba(0,180,255,0.08)", text: "#00b4ff" },
  past_due: { bg: "rgba(239,68,68,0.08)", text: "#ef4444" },
  suspended: { bg: "rgba(234,179,8,0.08)", text: "#eab308" },
  canceled: { bg: "rgba(128,128,128,0.08)", text: "#808080" },
  inactive: { bg: "rgba(128,128,128,0.08)", text: "#808080" },
  pending_payment: { bg: "rgba(232,168,64,0.08)", text: "#E8A840" },
};

export default function AdminClientsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ClientRow | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const limit = 10;

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    if (statusFilter) params.set("status", statusFilter);

    setLoading(true);
    const [metricsRes, clientsRes] = await Promise.all([
      fetch("/prospecting-os/api/admin/clients/metrics"),
      fetch(`/prospecting-os/api/admin/clients?${params}`),
    ]);

    if (metricsRes.ok) setMetrics(await metricsRes.json());
    if (clientsRes.ok) {
      const d = await clientsRes.json();
      setClients(d.clients || []);
      setTotalCount(d.count || 0);
    }
    setLoading(false);
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchData(); }, 400);
  };

  const handleFilterChange = () => {
    setPage(1);
    setTimeout(() => fetchData(), 50);
  };

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id);
    const res = await fetch("/prospecting-os/api/admin/clients", {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "delete" ? {} : { id, action }),
    });
    setActionLoading(null);
    if (res.ok) {
      setToast(`${action === "suspend" ? "Suspended" : action === "activate" ? "Activated" : "Deleted"} successfully`);
      setTimeout(() => setToast(""), 2500);
      await fetchData();
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="max-w-6xl space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>Client Manager</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Manage all client accounts, subscriptions, and access
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Total Clients", value: metrics.totalClients.toLocaleString(), color: "#00b4ff" },
            { icon: UserCheck, label: "Active Subscriptions", value: metrics.activeSubscriptions.toLocaleString(), color: "#22c55e" },
            { icon: DollarSign, label: "MRR", value: `$${metrics.mrr.toLocaleString()}`, color: "#E8A840" },
            { icon: BarChart3, label: "Leads Managed", value: metrics.totalLeadsManaged.toLocaleString(), color: "#a855f7" },
          ].map(c => (
            <div key={c.label} className="rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div className="flex items-center gap-2.5 mb-2">
                <c.icon size={16} style={{ color: c.color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>{c.label}</span>
              </div>
              <p className="text-[24px] font-bold" style={{ color: "var(--ink)" }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl px-3 h-10"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Search size={14} style={{ color: "var(--ink-4)" }} />
          <input
            type="text" placeholder="Search clients..."
            value={search} onChange={e => handleSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[13px]"
            style={{ color: "var(--ink)" }}
          />
        </div>

        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); handleFilterChange(); }}
          className="h-10 rounded-xl px-3 text-[12px] font-medium"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }}>
          <option value="">All Plans</option>
          <option value="micro">Micro-Offer</option>
          <option value="pilot">Founder's Pilot</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
        </select>

        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); handleFilterChange(); }}
          className="h-10 rounded-xl px-3 text-[12px] font-medium"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="past_due">Past Due</option>
          <option value="suspended">Suspended</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Users size={40} style={{ color: "var(--ink-4)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-semibold" style={{ color: "var(--ink-2)" }}>No clients found</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--ink-4)" }}>Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Client", "Plan", "Status", "Leads", "Joined", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(c => {
                  const pc = PLAN_COLORS[c.plan] || PLAN_COLORS.pilot;
                  const sc = STATUS_COLORS[c.subscription_status || "inactive"];
                  return (
                    <tr key={c.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.01)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{c.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{c.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.text}20` }}>
                          {c.plan === "pilot" ? "Pilot" : c.plan === "growth" ? "Growth" : c.plan === "scale" ? "Scale" : "Micro"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.text}20` }}>
                          {(c.subscription_status || "inactive").replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                        {c.leads_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-4)" }}>
                        {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* View Portal */}
                          <a href={`/prospecting-os/client-portal/login`} target="_blank" rel="noreferrer"
                            className="p-1.5 rounded-lg transition-colors" title="View Portal"
                            style={{ color: "var(--ink-3)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,180,255,0.08)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <ExternalLink size={14} />
                          </a>

                          {/* Suspend / Activate */}
                          {c.subscription_status === "active" || c.subscription_status === "trial" ? (
                            <button onClick={() => handleAction(c.id, "suspend")} disabled={actionLoading === c.id}
                              className="p-1.5 rounded-lg transition-colors" title="Suspend"
                              style={{ color: "#eab308", background: "transparent", border: "none", cursor: "pointer" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(234,179,8,0.08)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                              {actionLoading === c.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                            </button>
                          ) : (
                            <button onClick={() => handleAction(c.id, "activate")} disabled={actionLoading === c.id}
                              className="p-1.5 rounded-lg transition-colors" title="Activate"
                              style={{ color: "#22c55e", background: "transparent", border: "none", cursor: "pointer" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.08)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                              {actionLoading === c.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            </button>
                          )}

                          {/* Delete */}
                          <button onClick={() => setConfirmDelete(c)}
                            className="p-1.5 rounded-lg transition-colors" title="Delete"
                            style={{ color: "#ef4444", background: "transparent", border: "none", cursor: "pointer" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: "var(--ink-4)" }}>
                Page {page} of {totalPages} · {totalCount} clients
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: page <= 1 ? "var(--ink-4)" : "var(--ink)", opacity: page <= 1 ? 0.4 : 1, background: "transparent", border: "none", cursor: page <= 1 ? "default" : "pointer" }}>
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: page >= totalPages ? "var(--ink-4)" : "var(--ink)", opacity: page >= totalPages ? 0.4 : 1, background: "transparent", border: "none", cursor: page >= totalPages ? "default" : "pointer" }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
                <AlertTriangle size={18} style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>Delete Client?</h2>
                <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>{confirmDelete.name} · {confirmDelete.email}</p>
              </div>
            </div>
            <p className="text-[12px] mb-5" style={{ color: "var(--ink-4)" }}>
              This will cancel the subscription and deactivate the account. Leads and workspace data will be preserved.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 h-10 rounded-full text-[13px] font-semibold"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => { handleAction(confirmDelete.id, "delete"); setConfirmDelete(null); }}
                className="flex-1 h-10 rounded-full text-[13px] font-semibold"
                style={{ background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium"
          style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", color: "var(--ink)", boxShadow: "var(--shadow-md)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
