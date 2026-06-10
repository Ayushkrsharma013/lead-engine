"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { UserPlus, Trash2, Loader2, Mail, Shield } from "lucide-react";
import type { PlanKey } from "@/lib/types";

interface TeamMember {
  id: string; user_id: string; email: string; role: string; invited_at: string; accepted_at: string | null;
}

export default function TeamAccessPage() {
  const [profile, setProfile] = useState<{ plan?: PlanKey; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState("");

  const fetchMembers = async () => {
    const res = await fetch("/prospecting-os/api/client-portal/team");
    if (res.ok) {
      const d = await res.json();
      setMembers(d.members || []);
    }
  };

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) { const d = await meRes.json(); setProfile(d.profile); }
      await fetchMembers();
      setLoading(false);
    }
    init();
  }, []);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    const res = await fetch("/prospecting-os/api/client-portal/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    setInviting(false);
    if (res.ok) {
      setEmail("");
      setToast("Member invited!");
      setTimeout(() => setToast(""), 2500);
      await fetchMembers();
    } else {
      const d = await res.json();
      setToast(d.error || "Failed to invite");
      setTimeout(() => setToast(""), 3000);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    await fetch(`/prospecting-os/api/client-portal/team?id=${id}`, { method: "DELETE" });
    await fetchMembers();
    setToast("Member removed");
    setTimeout(() => setToast(""), 2500);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  return (
    <PlanGate module="team-access" plan={profile?.plan || null} role={profile?.role} requiredPlan="scale">
      <div className="max-w-3xl space-y-4 animate-fade-in">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Team Access</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Invite team members to collaborate on your workspace</p>
        </div>

        {/* Invite form */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <UserPlus size={14} style={{ color: "var(--accent)" }} /> Invite Member
          </h3>
          <div className="flex gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com"
              className="flex-1 h-10 rounded-xl px-3 text-[13px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }} />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="h-10 rounded-xl px-3 text-[13px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={handleInvite} disabled={inviting || !email.trim()}
              className="px-4 h-10 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5"
              style={{ background: "var(--accent)", color: "#000", border: "none", cursor: inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1 }}>
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Invite
            </button>
          </div>
        </div>

        {/* Members list */}
        {members.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <Shield size={32} style={{ color: "var(--ink-4)", margin: "0 auto 12px" }} />
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>No team members yet</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Invite colleagues to collaborate on your leads and sequences.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold"
                    style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}>
                    {m.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Mail size={12} style={{ color: "var(--ink-4)" }} />
                      <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{m.email}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>
                      {m.role} · Invited {new Date(m.invited_at).toLocaleDateString()}
                      {m.accepted_at ? " · Accepted" : " · Pending"}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleRemove(m.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 4 }}>
                  <Trash2 size={14} />
                </button>
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
