"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Plus, Search, MoreHorizontal, Copy, UserCheck,
  Eye, Edit2, Ban, X, Mail, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/stripe";
import type { UserProfile, PlanKey } from "@/lib/types";

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  super_admin: { bg: "rgba(0,180,255,0.08)", text: "var(--accent-blue)", border: "rgba(0,180,255,0.18)" },
  client: { bg: "rgba(107,203,119,0.08)", text: "var(--positive)", border: "rgba(107,203,119,0.18)" },
  qa_agent: { bg: "rgba(255,107,53,0.08)", text: "var(--negative)", border: "rgba(255,107,53,0.18)" },
  user: { bg: "rgba(128,128,128,0.08)", text: "var(--ink-3)", border: "rgba(128,128,128,0.18)" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(107,203,119,0.08)", text: "var(--positive)" },
  pending_payment: { bg: "rgba(232,168,64,0.10)", text: "var(--accent)" },
  cancelled: { bg: "rgba(224,96,96,0.08)", text: "var(--negative)" },
  inactive: { bg: "rgba(128,128,128,0.06)", text: "var(--ink-3)" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function avChip(email: string): string {
  return email.charAt(0).toUpperCase();
}

export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, mrr: 0 });
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | null>(null);
  const [toast, setToast] = useState("");

  // New user form state
  const [form, setForm] = useState({ email: "", display_name: "", role: "client", plan: "diy", notes: "", send_invite: true });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/prospecting-os/api/admin/users?${params}`);
      if (!res.ok) { setError("Failed to load users"); setLoading(false); return; }
      const data = await res.json();
      const allUsers = data.users as UserProfile[];
      setUsers(allUsers);

      const active = allUsers.filter(u => u.subscription_status === "active" && u.role === "client");
      const pending = allUsers.filter(u => u.subscription_status === "pending_payment");
      const mrr = active.reduce((sum, u) => {
        const plan = PLANS[(u.plan as PlanKey) || "diy"];
        if (!plan || plan.interval !== "month") return sum;
        return sum + plan.amount;
      }, 0);
      setStats({ total: allUsers.length, active: active.length, pending: pending.length, mrr });
    } catch { setError("Failed to load users"); }
    setLoading(false);
  }, [roleFilter, statusFilter, search]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/prospecting-os/login");
    });
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleActivate = async (id: string) => {
    const res = await fetch(`/prospecting-os/api/admin/users/${id}/activate`, { method: "POST" });
    if (res.ok) { setToast("Plan activated"); fetchUsers(); } else { setToast("Activation failed"); }
    setTimeout(() => setToast(""), 2500);
  };

  const handleImpersonate = async (id: string) => {
    const res = await fetch(`/prospecting-os/api/admin/users/${id}/impersonate`, { method: "POST" });
    const data = await res.json();
    if (data.url) {
      await navigator.clipboard.writeText(data.url);
      setToast("Impersonation link copied — open in incognito");
    }
    setTimeout(() => setToast(""), 2500);
  };

  const handleDeactivate = async (id: string) => {
    const res = await fetch(`/prospecting-os/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) { setToast("User deactivated"); fetchUsers(); }
    setTimeout(() => setToast(""), 2500);
  };

  const handleCreate = async () => {
    if (!form.email.trim()) return;
    setSubmitting(true);
    const res = await fetch("/prospecting-os/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setToast("User created");
      setModal(null);
      setForm({ email: "", display_name: "", role: "client", plan: "diy", notes: "", send_invite: true });
      fetchUsers();
    } else {
      const err = await res.json();
      setToast(err.error || "Creation failed");
    }
    setSubmitting(false);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Users</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Manage accounts, plans, and access
          </p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          <Plus size={14} /> Create User
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: "Total Users", value: String(stats.total), icon: Users },
          { label: "Active Clients", value: String(stats.active), icon: UserCheck },
          { label: "Pending Payment", value: String(stats.pending), icon: Loader2 },
          { label: "MRR", value: `$${(stats.mrr || 0).toLocaleString()}`, icon: Mail },
        ]).map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>{s.label}</span>
              <s.icon size={13} style={{ color: "var(--accent)" }} />
            </div>
            <div className="text-[24px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>
              {loading ? "—" : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3">
        {["all", "super_admin", "client", "qa_agent", "user"].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 capitalize"
            style={{
              background: roleFilter === r ? "var(--accent-soft)" : "transparent",
              color: roleFilter === r ? "var(--accent-ink)" : "var(--ink-3)",
              border: `1px solid ${roleFilter === r ? "rgba(232,168,64,0.25)" : "var(--line)"}`,
            }}>
            {r === "all" ? "All Roles" : r.replace("_", " ")}
          </button>
        ))}
        <div className="flex-1" />
        {["all", "active", "pending_payment", "cancelled"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 capitalize"
            style={{
              background: statusFilter === s ? "var(--accent-soft)" : "transparent",
              color: statusFilter === s ? "var(--accent-ink)" : "var(--ink-3)",
              border: `1px solid ${statusFilter === s ? "rgba(232,168,64,0.25)" : "var(--line)"}`,
            }}>
            {s === "all" ? "All Status" : s.replace(/_/g, " ")}
          </button>
        ))}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-48 h-8 rounded-lg text-[12px] pl-8 pr-3 outline-none transition-all duration-200"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
        </div>
      </div>

      {/* ── Table ── */}
      {error && <p className="text-[12px]" style={{ color: "var(--negative)" }}>{error}</p>}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              {["User", "Role", "Plan", "Status", "Activated", "Actions"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No users found</td></tr>
            ) : (
              users.map(u => {
                const rColors = ROLE_COLORS[u.role] || ROLE_COLORS.user;
                const sColors = STATUS_COLORS[u.subscription_status || "inactive"] || STATUS_COLORS.inactive;
                const isActive = u.subscription_status === "active";
                const isPending = u.subscription_status === "pending_payment";
                const plan = PLANS[(u.plan as PlanKey) || "diy"];

                return (
                  <tr key={u.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                          style={{ background: rColors.bg, color: rColors.text, border: `1px solid ${rColors.border}` }}>
                          {avChip(u.email)}
                        </div>
                        <div>
                          <p className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>{u.display_name || "—"}</p>
                          <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                        style={{ background: rColors.bg, color: rColors.text, border: `1px solid ${rColors.border}` }}>
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>
                        {plan?.name || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                        style={{ background: sColors.bg, color: sColors.text }}>
                        {(u.subscription_status || "inactive").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
                      {fmtDate(u.subscription_activated_at)}
                    </td>
                    <td className="px-4 py-3 relative">
                      <button onClick={() => setMenuOpen(menuOpen === u.id ? null : u.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.04]">
                        <MoreHorizontal size={14} style={{ color: "var(--ink-3)" }} />
                      </button>
                      {menuOpen === u.id && (
                        <div className="absolute right-4 top-full mt-1 z-50 rounded-xl p-1.5 min-w-[160px] animate-scale-in"
                          style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
                          <button onClick={() => { setMenuOpen(null); router.push(`/admin/users/${u.id}`); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors hover:bg-white/[0.04]"
                            style={{ color: "var(--ink-2)" }}>
                            <Eye size={13} /> View / Edit
                          </button>
                          {isPending && (
                            <button onClick={() => { setMenuOpen(null); handleActivate(u.id); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors hover:bg-white/[0.04]"
                              style={{ color: "var(--positive)" }}>
                              <UserCheck size={13} /> Activate Plan
                            </button>
                          )}
                          <button onClick={() => { setMenuOpen(null); handleImpersonate(u.id); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors hover:bg-white/[0.04]"
                            style={{ color: "var(--accent-ink)" }}>
                            <Copy size={13} /> Impersonate
                          </button>
                          {u.is_active && (
                            <button onClick={() => { setMenuOpen(null); handleDeactivate(u.id); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors hover:bg-white/[0.04]"
                              style={{ color: "var(--negative)" }}>
                              <Ban size={13} /> Deactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create User Modal ── */}
      {modal === "create" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setModal(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div className="relative w-full max-w-md rounded-3xl p-6 animate-scale-in"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>Create New User</h2>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-white/[0.05]">
                <X size={16} style={{ color: "var(--ink-3)" }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="user@company.com"
                  className="w-full h-10 rounded-xl px-3 text-[13px] outline-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Display Name</label>
                <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full h-10 rounded-xl px-3 text-[13px] outline-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full h-10 rounded-xl px-3 text-[13px] outline-none capitalize"
                    style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                    <option value="client">Client</option>
                    <option value="qa_agent">QA Agent</option>
                    <option value="user">User</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Plan</label>
                  <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}
                    className="w-full h-10 rounded-xl px-3 text-[13px] outline-none capitalize"
                    style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                    <option value="diy">DIY Setup</option>
                    <option value="growth">Managed Growth</option>
                    <option value="scale">Managed Scale</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Notes (internal)</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Optional admin notes..."
                  className="w-full rounded-xl px-3 py-2 text-[13px] outline-none resize-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
              </div>
              <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                <input type="checkbox" checked={form.send_invite} onChange={e => setForm({ ...form, send_invite: e.target.checked })}
                  style={{ accentColor: "var(--accent)" }} />
                Send invite email with magic link
              </label>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setModal(null)}
                className="flex-1 h-10 rounded-full text-[13px] font-medium transition-colors"
                style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink-3)" }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={submitting || !form.email.trim()}
                className="flex-1 h-10 rounded-full text-[13px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#000" }}>
                {submitting ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <>Create User <Plus size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium animate-toast-in"
          style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)", color: "var(--ink)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
