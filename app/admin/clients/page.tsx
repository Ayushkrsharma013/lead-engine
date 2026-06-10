"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Search, ChevronLeft, ChevronRight,
  DollarSign, BarChart3, UserCheck, RotateCcw, X,
  UserPlus,
} from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import type { DropdownOption } from "@/components/ui/CustomDropdown";
import CountUp from "@/components/ui/CountUp";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ClientTable from "@/components/admin/ClientTable";
import AddClientModal from "@/components/admin/AddClientModal";
import type { ClientRow } from "@/components/admin/ClientTable";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface Metrics {
  totalClients: number;
  activeSubscriptions: number;
  mrr: number;
  totalLeadsManaged: number;
}

interface SuspensionTarget {
  client: ClientRow;
  action: "suspend" | "activate";
}

/* ─── Dropdown option builders ─────────────────────────────────────────────── */

const PLAN_OPTIONS: DropdownOption[] = [
  { value: "", label: "All Plans" },
  { value: "micro", label: "Micro-Offer" },
  { value: "pilot", label: "Founder's Pilot" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
];

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "past_due", label: "Past Due" },
  { value: "suspended", label: "Suspended" },
  { value: "canceled", label: "Canceled" },
];

const PAGE_SIZE_OPTIONS: DropdownOption[] = [
  { value: "10", label: "10 / page" },
  { value: "25", label: "25 / page" },
  { value: "50", label: "50 / page" },
];

/* ─── Skeleton loader ──────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 rounded animate-pulse-slow" style={{ background: "var(--surface-2)" }} />
        <div className="h-3 w-48 rounded animate-pulse-slow" style={{ background: "var(--surface-2)" }} />
      </div>
      <div className="h-5 w-14 rounded-full animate-pulse-slow" style={{ background: "var(--surface-2)" }} />
      <div className="h-5 w-16 rounded-full animate-pulse-slow" style={{ background: "var(--surface-2)" }} />
      <div className="h-4 w-10 rounded animate-pulse-slow" style={{ background: "var(--surface-2)" }} />
      <div className="h-4 w-20 rounded animate-pulse-slow" style={{ background: "var(--surface-2)" }} />
      <div className="h-7 w-20 rounded animate-pulse-slow" style={{ background: "var(--surface-2)" }} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 animate-pulse-slow" style={{ background: "var(--surface)", border: "1px solid var(--line)", height: 100 }} />
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function AdminClientsPage() {
  /* State */
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  /* Modals */
  const [confirmDelete, setConfirmDelete] = useState<ClientRow | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<SuspensionTarget | null>(null);

  /* ── Data fetching ──────────────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    if (statusFilter) params.set("status", statusFilter);

    setLoading(true);
    setError("");

    try {
      const [metricsRes, clientsRes] = await Promise.all([
        fetch("/prospecting-os/api/admin/clients/metrics"),
        fetch(`/prospecting-os/api/admin/clients?${params}`),
      ]);

      if (!metricsRes.ok) throw new Error("Failed to load metrics");
      if (!clientsRes.ok) throw new Error("Failed to load clients");

      setMetrics(await metricsRes.json());
      const d = await clientsRes.json();
      setClients(d.clients || []);
      setTotalCount(d.count || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, planFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Search (debounced 300ms) ───────────────────────────────────────────── */

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); }, 300);
  };

  /* ── Filters ────────────────────────────────────────────────────────────── */

  const handleFilterChange = useCallback(() => {
    setPage(1);
  }, []);

  useEffect(() => {
    if (page === 1) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilter, statusFilter, limit]);

  const clearFilters = () => {
    setSearch("");
    setPlanFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const hasFilters = search || planFilter || statusFilter;

  /* ── Actions ────────────────────────────────────────────────────────────── */

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id);
    try {
      const res = await fetch("/prospecting-os/api/admin/clients", {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "delete" ? {} : { id, action }),
      });
      if (res.ok) {
        const labels: Record<string, string> = {
          suspend: "Suspended",
          activate: "Activated",
          delete: "Deleted",
        };
        setToast(`${labels[action] || action} successfully`);
        setTimeout(() => setToast(""), 2500);
        await fetchData();
      } else {
        setToast("Action failed. Try again.");
        setTimeout(() => setToast(""), 2500);
      }
    } finally {
      setActionLoading(null);
    }
  };

  /* ── View Portal (impersonate → magic link) ──────────────────────────────── */

  const handleViewPortal = async (client: ClientRow) => {
    try {
      const res = await fetch(`/prospecting-os/api/admin/users/${client.id}/impersonate`, {
        method: "POST",
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else setToast("Could not generate login link");
      } else {
        setToast("Failed to generate portal access. Try again.");
      }
      setTimeout(() => setToast(""), 2500);
    } catch {
      setToast("Network error. Try again.");
      setTimeout(() => setToast(""), 2500);
    }
  };

  /* ── Derived ────────────────────────────────────────────────────────────── */

  const totalPages = Math.ceil(totalCount / limit);

  /* ── Render ─────────────────────────────────────────────────────────────── */

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

        {/* Add Client button */}
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-semibold transition-all duration-300 hover:scale-105"
          style={{
            background: "#22c55e",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(34,197,94,0.2)",
          }}
        >
          <UserPlus size={15} />
          Add Client
        </button>
      </div>

      {/* Metrics Cards — with CountUp + hover scale */}
      {metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            className="rounded-xl p-5 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", cursor: "default" }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Users size={16} style={{ color: "#00b4ff" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>Total Clients</span>
            </div>
            <p className="text-[24px] font-bold" style={{ color: "var(--ink)" }}>
              <CountUp value={metrics.totalClients} />
            </p>
          </div>

          <div
            className="rounded-xl p-5 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", cursor: "default" }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <UserCheck size={16} style={{ color: "#22c55e" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>Active</span>
            </div>
            <p className="text-[24px] font-bold" style={{ color: "var(--ink)" }}>
              <CountUp value={metrics.activeSubscriptions} />
            </p>
          </div>

          <div
            className="rounded-xl p-5 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", cursor: "default" }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <DollarSign size={16} style={{ color: "#E8A840" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>MRR</span>
            </div>
            <p className="text-[24px] font-bold" style={{ color: "var(--ink)" }}>
              $<CountUp value={metrics.mrr} />
            </p>
          </div>

          <div
            className="rounded-xl p-5 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", cursor: "default" }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <BarChart3 size={16} style={{ color: "#a855f7" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>Leads</span>
            </div>
            <p className="text-[24px] font-bold" style={{ color: "var(--ink)" }}>
              <CountUp value={metrics.totalLeadsManaged} />
            </p>
          </div>
        </div>
      ) : loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div
          className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl px-3 h-10 transition-colors duration-150"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          <Search size={14} style={{ color: "var(--ink-4)" }} />
          <input
            type="text"
            placeholder="Search clients by name or email..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[13px]"
            style={{ color: "var(--ink)" }}
          />
        </div>

        {/* Plan filter */}
        <CustomDropdown
          options={PLAN_OPTIONS}
          value={planFilter}
          onChange={v => { setPlanFilter(v); handleFilterChange(); }}
          placeholder="All Plans"
          clearable
          width={170}
        />

        {/* Status filter */}
        <CustomDropdown
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={v => { setStatusFilter(v); handleFilterChange(); }}
          placeholder="All Status"
          clearable
          width={160}
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-[12px] font-medium transition-colors"
            style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink-3)", cursor: "pointer" }}
          >
            <RotateCcw size={12} /> Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <X size={16} style={{ color: "#ef4444" }} />
          <span className="text-[13px] font-medium" style={{ color: "#ef4444" }}>{error}</span>
          <button
            onClick={() => fetchData()}
            className="ml-auto text-[12px] font-semibold px-3 py-1 rounded-full"
            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "none", cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table / Loading / Empty */}
      {loading ? (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="flex px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
            {["Client", "Plan", "Status", "Leads", "Joined", "Actions"].map(h => (
              <div key={h} className="flex-1 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</div>
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : clients.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Users size={48} style={{ color: "var(--ink-4)", opacity: 0.3, margin: "0 auto 16px" }} />
          <p className="text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            {hasFilters ? "No clients match your filters" : "No clients yet"}
          </p>
          <p className="text-[12px] mt-1.5 mb-4" style={{ color: "var(--ink-4)" }}>
            {hasFilters ? "Try adjusting your search or filters above." : "Create your first client account to get started."}
          </p>
          {!hasFilters && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[13px] font-semibold transition-all duration-300 hover:scale-105"
              style={{ background: "#22c55e", color: "#fff", border: "none", cursor: "pointer" }}
            >
              <UserPlus size={15} /> Add Your First Client
            </button>
          )}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", cursor: "pointer" }}
            >
              <RotateCcw size={12} /> Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <ClientTable
            clients={clients}
            actionLoading={actionLoading}
            onAction={handleAction}
            onDelete={setConfirmDelete}
            onViewPortal={handleViewPortal}
            onSuspendClick={c => setConfirmSuspend({ client: c, action: "suspend" })}
            onActivateClick={c => setConfirmSuspend({ client: c, action: "activate" })}
          />

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CustomDropdown
                options={PAGE_SIZE_OPTIONS}
                value={String(limit)}
                onChange={v => setLimit(Number(v))}
                width={120}
              />
              <span className="text-[12px]" style={{ color: "var(--ink-4)" }}>
                {totalCount.toLocaleString()} clients total
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px]" style={{ color: "var(--ink-4)" }}>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      color: page <= 1 ? "var(--ink-4)" : "var(--ink)",
                      opacity: page <= 1 ? 0.4 : 1,
                      background: "transparent",
                      border: "none",
                      cursor: page <= 1 ? "default" : "pointer",
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      color: page >= totalPages ? "var(--ink-4)" : "var(--ink)",
                      opacity: page >= totalPages ? 0.4 : 1,
                      background: "transparent",
                      border: "none",
                      cursor: page >= totalPages ? "default" : "pointer",
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Add Client Modal ────────────────────────────────────────────────── */}
      <AddClientModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => { setToast("Client created successfully"); setTimeout(() => setToast(""), 2500); }}
      />

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      <ConfirmationModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) { handleAction(confirmDelete.id, "delete"); setConfirmDelete(null); }
        }}
        title="Delete Client?"
        subtitle={`${confirmDelete?.name || ""} · ${confirmDelete?.email || ""}`}
        description="This will permanently cancel the subscription and deactivate the account. Lead data and workspace records will be preserved for 30 days before permanent deletion."
        confirmLabel="Delete Client"
        confirmColor="#ef4444"
      />

      {/* ── Suspend / Activate Confirmation ────────────────────────────────── */}
      <ConfirmationModal
        open={!!confirmSuspend}
        onClose={() => setConfirmSuspend(null)}
        onConfirm={() => {
          if (confirmSuspend) { handleAction(confirmSuspend.client.id, confirmSuspend.action); setConfirmSuspend(null); }
        }}
        title={confirmSuspend?.action === "suspend" ? "Suspend Client?" : "Activate Client?"}
        subtitle={`${confirmSuspend?.client.name || ""} · ${confirmSuspend?.client.email || ""}`}
        description={
          confirmSuspend?.action === "suspend"
            ? "The client will lose access to their portal immediately. All data remains intact — this action is reversible."
            : "The client will regain full access to their portal. All subscriptions and leads will resume as before."
        }
        confirmLabel={confirmSuspend?.action === "suspend" ? "Suspend" : "Activate"}
        confirmColor={confirmSuspend?.action === "suspend" ? "#eab308" : "#22c55e"}
      />

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium animate-toast-in"
          style={{
            background: "var(--surface-elev)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
