"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Users,
  TrendingUp,
  XCircle,
  Search,
  X,
  Filter,
  ChevronDown,
  Zap,
} from "lucide-react";

const STATUS_OPTIONS = ["all", "confirmed", "cancelled", "rescheduled"] as const;
const TYPE_OPTIONS = ["all", "discovery", "demo", "technical", "strategy"] as const;

const TYPE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  demo: "Demo",
  technical: "Technical",
  strategy: "Strategy",
};

const TYPE_COLORS: Record<string, string> = {
  discovery: "#3b82f6",
  demo: "#e8420a",
  technical: "#7c3aed",
  strategy: "#22c55e",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#22c55e",
  cancelled: "#ef4444",
  rescheduled: "#f59e0b",
};

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminBookPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetch("/prospecting-os/api/appointments")
      .then((r) => r.json())
      .then((data: any[]) => {
        setAppointments(Array.isArray(data) ? data : []);
      })
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const { monday, sunday } = getWeekBounds();

    const totalBooked = appointments.filter((a) => a.status !== "cancelled").length;
    const cancelled = appointments.filter((a) => a.status === "cancelled").length;
    const today = appointments.filter((a) => a.date === todayStr && a.status !== "cancelled").length;

    const thisWeek = appointments.filter((a) => {
      if (a.status === "cancelled") return false;
      const d = new Date(a.date + "T00:00:00");
      return d >= monday && d <= sunday;
    }).length;

    return { totalBooked, cancelled, today, thisWeek };
  }, [appointments]);

  const filtered = useMemo(() => {
    let result = appointments;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((a) => a.type === typeFilter);
    }
    return result.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }, [appointments, search, statusFilter, typeFilter]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch("/prospecting-os/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cancelTarget.id, status: "cancelled" }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === cancelTarget.id ? { ...a, status: "cancelled" } : a))
        );
      }
    } catch {
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#0e0d0a",
        color: "#f5f4f1",
        fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
        "--bg-primary": "#0e0d0a",
        "--bg-card": "#1a1917",
        "--accent": "#e8420a",
        "--text-primary": "#f5f4f1",
        "--text-secondary": "#b0aeaa",
        "--text-tertiary": "#7a7875",
        "--border": "rgba(255,255,255,0.08)",
        "--border-card": "rgba(255,255,255,0.06)",
        "--success": "#22c55e",
        "--success-bg": "rgba(34,197,94,0.1)",
      } as React.CSSProperties}
    >
      <nav
        className="flex-shrink-0 z-50"
        style={{
          background: "rgba(14,13,10,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight no-underline"
            style={{ color: "var(--text-primary, #f5f4f1)" }}
          >
            <Zap size={18} style={{ color: "var(--accent, #e8420a)" }} />
            Prospecting<span style={{ color: "var(--accent, #e8420a)" }}>OS</span>
          </a>
          <h1 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
            Appointment Manager
          </h1>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span
              className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div
                className="rounded-2xl p-5"
                style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(34,197,94,0.1)" }}
                  >
                    <Calendar size={18} style={{ color: "#22c55e" }} />
                  </div>
                </div>
                <p className="text-2xl font-extrabold tracking-tight">{stats.totalBooked}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                  Total Booked
                </p>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(59,130,246,0.1)" }}
                  >
                    <TrendingUp size={18} style={{ color: "#3b82f6" }} />
                  </div>
                </div>
                <p className="text-2xl font-extrabold tracking-tight">{stats.thisWeek}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                  This Week
                </p>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(232,66,10,0.1)" }}
                  >
                    <Users size={18} style={{ color: "#e8420a" }} />
                  </div>
                </div>
                <p className="text-2xl font-extrabold tracking-tight">{stats.today}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                  Today
                </p>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(239,68,68,0.1)" }}
                  >
                    <XCircle size={18} style={{ color: "#ef4444" }} />
                  </div>
                </div>
                <p className="text-2xl font-extrabold tracking-tight">{stats.cancelled}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                  Cancelled
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3"
              style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}
            >
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-tertiary, #7a7875)" }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full h-9 rounded-xl pl-9 pr-3 text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                    color: "var(--text-primary, #f5f4f1)",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-tertiary, #7a7875)" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="relative">
                <Filter
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-tertiary, #7a7875)", pointerEvents: "none" }}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-xl pl-9 pr-8 text-sm outline-none appearance-none cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                    color: "var(--text-primary, #f5f4f1)",
                    fontFamily: "inherit",
                    minWidth: 130,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <option value="all" style={{ background: "#1a1917", color: "#f5f4f1" }}>All Status</option>
                  {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => (
                    <option key={s} value={s} style={{ background: "#1a1917", color: "#f5f4f1" }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-tertiary, #7a7875)", pointerEvents: "none" }}
                />
              </div>

              <div className="relative">
                <Filter
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-tertiary, #7a7875)", pointerEvents: "none" }}
                />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-9 rounded-xl pl-9 pr-8 text-sm outline-none appearance-none cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                    color: "var(--text-primary, #f5f4f1)",
                    fontFamily: "inherit",
                    minWidth: 130,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <option value="all" style={{ background: "#1a1917", color: "#f5f4f1" }}>All Types</option>
                  {TYPE_OPTIONS.filter((t) => t !== "all").map((t) => (
                    <option key={t} value={t} style={{ background: "#1a1917", color: "#f5f4f1" }}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-tertiary, #7a7875)", pointerEvents: "none" }}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <Calendar size={28} style={{ color: "var(--text-tertiary, #7a7875)" }} />
                </div>
                <p className="text-lg font-bold tracking-tight mb-1">No appointments yet</p>
                <p className="text-sm" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                  Bookings will appear here once prospects schedule demos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 font-medium">Time</th>
                      <th className="pb-3 pr-4 font-medium">Name</th>
                      <th className="pb-3 pr-4 font-medium hidden md:table-cell">Email</th>
                      <th className="pb-3 pr-4 font-medium hidden lg:table-cell">Company</th>
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr
                        key={a.id}
                        className="border-t transition-colors hover:opacity-90"
                        style={{ borderColor: "var(--border, rgba(255,255,255,0.08))" }}
                      >
                        <td className="py-3 pr-4 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} style={{ color: "var(--text-tertiary, #7a7875)" }} />
                            {formatDateShort(a.date)}
                          </div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                          {a.time}
                        </td>
                        <td className="py-3 pr-4 font-medium whitespace-nowrap">{a.name}</td>
                        <td className="py-3 pr-4 hidden md:table-cell" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                          {a.email}
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                          {a.company || "-"}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{
                              background: `${TYPE_COLORS[a.type] || "#6b6b80"}20`,
                              color: TYPE_COLORS[a.type] || "#6b6b80",
                            }}
                          >
                            {TYPE_LABELS[a.type] || a.type || "Demo"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{
                              background: `${STATUS_COLORS[a.status] || "#6b6b80"}18`,
                              color: STATUS_COLORS[a.status] || "#6b6b80",
                            }}
                          >
                            {a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : "Confirmed"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {a.status === "confirmed" && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch("/prospecting-os/api/appointments", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ id: a.id, status: "won" }),
                                      });
                                      if (res.ok) {
                                        setAppointments((prev) =>
                                          prev.map((ap) => (ap.id === a.id ? { ...ap, status: "won" } : a))
                                        );
                                      }
                                    } catch {}
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                                  style={{
                                    background: "rgba(34,197,94,0.1)",
                                    color: "#22c55e",
                                    border: "1px solid rgba(34,197,94,0.2)",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(34,197,94,0.2)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(34,197,94,0.1)";
                                  }}
                                >
                                  Mark Won
                                </button>
                                <button
                                  onClick={() => setCancelTarget(a)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                                  style={{
                                    background: "rgba(239,68,68,0.1)",
                                    color: "#ef4444",
                                    border: "1px solid rgba(239,68,68,0.2)",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                                  }}
                                >
                                  <X size={12} />
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelTarget(null);
          }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{
              background: "var(--bg-card, #1a1917)",
              border: "1px solid var(--border-card, rgba(255,255,255,0.06))",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.1)" }}
              >
                <XCircle size={20} style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Cancel Appointment</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-sm mb-6" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
              Cancel appointment for{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary, #f5f4f1)" }}>
                {cancelTarget.name}
              </span>{" "}
              on{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary, #f5f4f1)" }}>
                {formatDateShort(cancelTarget.date)}
              </span>{" "}
              at{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary, #f5f4f1)" }}>
                {cancelTarget.time}
              </span>
              ?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text-primary, #f5f4f1)",
                  border: "1px solid var(--border, rgba(255,255,255,0.08))",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#ef4444", color: "#fff" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#dc2626";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ef4444";
                }}
              >
                {cancelling ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Cancel Booking</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
