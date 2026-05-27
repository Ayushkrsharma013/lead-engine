"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import type { UserProfile, ClientWorkspace, PlanKey } from "@/lib/types";

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  super_admin: { bg: "rgba(0,180,255,0.08)", text: "var(--accent-blue)", border: "rgba(0,180,255,0.18)" },
  client: { bg: "rgba(107,203,119,0.08)", text: "var(--positive)", border: "rgba(107,203,119,0.18)" },
  qa_agent: { bg: "rgba(255,107,53,0.08)", text: "var(--negative)", border: "rgba(255,107,53,0.18)" },
  user: { bg: "rgba(128,128,128,0.08)", text: "var(--ink-3)", border: "rgba(128,128,128,0.18)" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function avChip(s: string): string {
  return s.charAt(0).toUpperCase();
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<ClientWorkspace | null>(null);
  const [activity, setActivity] = useState<Array<{ id: string; type: string; text: string; created_at: string }>>([]);
  const [qaSessions, setQaSessions] = useState<Array<{ id: string; surface: string; test_suite: string; status: string; started_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "plan" | "activity" | "qa">("profile");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [toast, setToast] = useState("");

  // Editable fields
  const [edit, setEdit] = useState({ display_name: "", role: "", plan: "", notes: "", is_active: true });

  // Confirmation modals
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [roleConfirmInput, setRoleConfirmInput] = useState("");
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);

  const fetchUser = useCallback(async () => {
    const res = await fetch(`/prospecting-os/api/admin/users/${userId}`);
    if (!res.ok) { router.push("/admin/users"); return; }
    const data = await res.json();
    setProfile(data.profile);
    setWorkspace(data.workspace);
    setActivity(data.activity || []);
    setQaSessions(data.qaSessions || []);
    setEdit({
      display_name: data.profile.display_name || "",
      role: data.profile.role || "client",
      plan: data.profile.plan || "",
      notes: data.profile.notes || "",
      is_active: data.profile.is_active !== false,
    });
    setLoading(false);
  }, [userId, router]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // 2.2 Split saves: profile fields only
  const doSaveProfile = async () => {
    setSavingProfile(true);
    const res = await fetch(`/prospecting-os/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: edit.display_name,
        role: edit.role,
        notes: edit.notes,
        is_active: edit.is_active,
      }),
    });
    if (res.ok) { setToast("Profile updated"); fetchUser(); }
    else { setToast("Update failed"); }
    setSavingProfile(false);
    setShowRoleConfirm(false);
    setRoleConfirmInput("");
    setTimeout(() => setToast(""), 2500);
  };

  // 2.1 Confirmation dialog for super_admin role change
  const handleSaveProfile = async () => {
    if (!profile) return;
    const isElevatingToSuperAdmin = edit.role === "super_admin" && profile.role !== "super_admin";
    if (isElevatingToSuperAdmin) {
      setShowRoleConfirm(true);
      return;
    }
    await doSaveProfile();
  };

  // 2.2 + 2.3 Split saves: plan only, with confirmation
  const handleSavePlan = () => {
    if (!profile) return;
    if (edit.plan && edit.plan !== profile.plan) {
      setShowPlanConfirm(true);
      return;
    }
    doSavePlan();
  };

  const doSavePlan = async () => {
    setSavingPlan(true);
    const res = await fetch(`/prospecting-os/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: edit.plan || null }),
    });
    if (res.ok) { setToast("Plan updated"); fetchUser(); }
    else { setToast("Plan update failed"); }
    setSavingPlan(false);
    setShowPlanConfirm(false);
    setTimeout(() => setToast(""), 2500);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const rColors = ROLE_COLORS[profile.role] || ROLE_COLORS.user;
  const plan = PLANS[(profile.plan as PlanKey) || "pilot"];
  void workspace;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5 animate-fade-in">
      {/* ── Back ── */}
      <button onClick={() => router.push("/admin/users")}
        className="flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-70" style={{ color: "var(--ink-3)" }}>
        <ArrowLeft size={14} /> Back to Users
      </button>

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold"
          style={{ background: rColors.bg, color: rColors.text, border: `2px solid ${rColors.border}` }}>
          {avChip(profile.email)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>{profile.display_name || profile.email}</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
              style={{ background: rColors.bg, color: rColors.text, border: `1px solid ${rColors.border}` }}>
              {profile.role.replace("_", " ")}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: profile.is_active !== false ? "rgba(107,203,119,0.08)" : "rgba(224,96,96,0.08)",
                color: profile.is_active !== false ? "var(--positive)" : "var(--negative)",
              }}>
              {profile.is_active !== false ? "Active" : "Deactivated"}
            </span>
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{profile.email} · Created {fmtDate(profile.created_at)}</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1" style={{ borderBottom: "1px solid var(--line)" }}>
        {(["profile", "plan", "activity", "qa"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2.5 text-[12px] font-medium capitalize transition-colors"
            style={{
              color: tab === t ? "var(--accent)" : "var(--ink-3)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ── */}
      {tab === "profile" && (
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Display Name</label>
            <input value={edit.display_name} onChange={e => setEdit({ ...edit, display_name: e.target.value })}
              className="w-full h-10 rounded-xl px-3 text-[13px] outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Role</label>
            <select value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}
              className="w-full h-10 rounded-xl px-3 text-[13px] outline-none capitalize"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}>
              <option value="super_admin">Super Admin</option>
              <option value="client">Client</option>
              <option value="qa_agent">QA Agent</option>
              <option value="user">User</option>
            </select>
            {edit.role === "super_admin" && profile.role !== "super_admin" && (
              <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: "var(--negative)" }}>
                <AlertTriangle size={12} /> Elevating to Super Admin grants full system access. Confirmation required.
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Notes</label>
            <textarea value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })}
              rows={3} className="w-full rounded-xl px-3 py-2 text-[13px] outline-none resize-none"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }} />
          </div>
          <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
            <input type="checkbox" checked={edit.is_active} onChange={e => setEdit({ ...edit, is_active: e.target.checked })}
              style={{ accentColor: "var(--accent)" }} />
            Active account
          </label>
          <button onClick={handleSaveProfile} disabled={savingProfile}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold transition-all disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#000" }}>
            {savingProfile ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
            Save Profile
          </button>
        </div>
      )}

      {/* ── Plan Tab ── */}
      {tab === "plan" && (
        <div className="space-y-4 max-w-lg">
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Current Plan</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                style={{
                  background: profile.subscription_status === "active" ? "rgba(107,203,119,0.08)" : "rgba(232,168,64,0.10)",
                  color: profile.subscription_status === "active" ? "var(--positive)" : "var(--accent)",
                }}>
                {(profile.subscription_status || "none").replace("_", " ")}
              </span>
            </div>
            <p className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>{plan?.name || "No plan"}</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>
              ${plan?.setupAmount?.toLocaleString()}{plan?.monthlyAmount ? ` + $${plan.monthlyAmount.toLocaleString()}/mo` : " one-time"}
            </p>
            {profile.payment_ref && (
              <p className="text-[11px] mt-2 font-mono" style={{ color: "var(--ink-4)" }}>Ref: {profile.payment_ref}</p>
            )}
            {profile.subscription_activated_at && (
              <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Activated: {fmtDate(profile.subscription_activated_at)}</p>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Change Plan</label>
            <select value={edit.plan} onChange={e => setEdit({ ...edit, plan: e.target.value })}
              className="w-full h-10 rounded-xl px-3 text-[13px] outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}>
              <option value="">No plan</option>
              <option value="pilot">Founder&apos;s Pilot — $1,499 setup + $499/mo</option>
              <option value="growth">Growth — $2,499 setup + $999/mo</option>
              <option value="scale">Scale — $4,999 setup + $1,999/mo</option>
              <option value="micro">Micro-Offer — $997 one-time</option>
            </select>
            {edit.plan && edit.plan !== profile.plan && (
              <p className="text-[11px] mt-1.5" style={{ color: "var(--accent)" }}>
                Plan change requires confirmation.
              </p>
            )}
          </div>
          <button onClick={handleSavePlan} disabled={savingPlan}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold transition-all disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#000" }}>
            {savingPlan ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
            Update Plan
          </button>
        </div>
      )}

      {/* ── Activity Tab ── */}
      {tab === "activity" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {activity.length === 0 ? (
            <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No activity yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Description</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {activity.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td className="px-4 py-2.5 text-[11px] font-medium capitalize" style={{ color: "var(--ink-2)" }}>{a.type?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--ink)" }}>{a.text}</td>
                    <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--ink-3)" }}>{fmtDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── QA Tab ── */}
      {tab === "qa" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {qaSessions.length === 0 ? (
            <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>No QA sessions yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Surface</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Suite</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {qaSessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td className="px-4 py-2.5 text-[11px] font-medium capitalize" style={{ color: "var(--ink-2)" }}>{s.surface?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--ink)" }}>{s.test_suite}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                        background: s.status === "passed" ? "rgba(107,203,119,0.08)" : s.status === "failed" ? "rgba(224,96,96,0.08)" : "rgba(128,128,128,0.08)",
                        color: s.status === "passed" ? "var(--positive)" : s.status === "failed" ? "var(--negative)" : "var(--ink-3)",
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px]" style={{ color: "var(--ink-3)" }}>{fmtDate(s.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Role Elevation Confirmation Modal ── */}
      {showRoleConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => { setShowRoleConfirm(false); setRoleConfirmInput(""); }}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(224,96,96,0.10)", color: "var(--negative)" }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>Elevate to Super Admin?</h3>
                <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>This grants full system access.</p>
              </div>
            </div>
            <p className="text-[12px]" style={{ color: "var(--ink-2)" }}>
              Type the user&apos;s email to confirm: <strong style={{ color: "var(--ink)" }}>{profile.email}</strong>
            </p>
            <input value={roleConfirmInput} onChange={e => setRoleConfirmInput(e.target.value)}
              autoFocus
              placeholder={profile.email}
              className="w-full h-10 rounded-xl px-3 text-[13px] outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => { setShowRoleConfirm(false); setRoleConfirmInput(""); }}
                className="px-4 py-2 rounded-full text-[12px] font-medium"
                style={{ background: "transparent", color: "var(--ink-3)", border: "1px solid var(--line)" }}>
                Cancel
              </button>
              <button onClick={doSaveProfile}
                disabled={roleConfirmInput.trim().toLowerCase() !== profile.email.toLowerCase() || savingProfile}
                className="px-5 py-2 rounded-full text-[12px] font-semibold disabled:opacity-40"
                style={{ background: "var(--negative)", color: "#fff" }}>
                {savingProfile ? "Saving…" : "Confirm Elevation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan Change Confirmation Modal ── */}
      {showPlanConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowPlanConfirm(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
            <h3 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>Change plan?</h3>
            <p className="text-[12px]" style={{ color: "var(--ink-2)" }}>
              Current: <strong>{PLANS[(profile.plan as PlanKey) || "pilot"]?.name || "No plan"}</strong>
              <br />
              New: <strong>{edit.plan ? PLANS[edit.plan as PlanKey]?.name : "No plan"}</strong>
            </p>
            <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
              Plan changes update the workspace and may affect billing. Continue?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowPlanConfirm(false)}
                className="px-4 py-2 rounded-full text-[12px] font-medium"
                style={{ background: "transparent", color: "var(--ink-3)", border: "1px solid var(--line)" }}>
                Cancel
              </button>
              <button onClick={doSavePlan} disabled={savingPlan}
                className="px-5 py-2 rounded-full text-[12px] font-semibold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#000" }}>
                {savingPlan ? "Saving…" : "Confirm Change"}
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
