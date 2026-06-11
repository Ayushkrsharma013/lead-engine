"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { PageTransition } from "@/components/ui/PageTransition";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { UserPlus, Trash2, Loader2, Mail, Shield, Users } from "lucide-react";
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
    return (
      <PageTransition className="max-w-3xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </PageTransition>
    );
  }

  return (
    <PlanGate module="team-access" plan={profile?.plan || null} role={profile?.role} requiredPlan="scale">
      <PageTransition className="max-w-3xl space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <h1 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Users size={16} style={{ color: "#E84A0A" }} />
            Team Access
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Invite team members to collaborate on your workspace</p>
        </motion.div>

        {/* Invite form */}
        <AnimatedCard delay={0.1} className="p-5">
          <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <UserPlus size={14} style={{ color: "#E84A0A" }} /> Invite Member
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com"
              className="flex-1 h-10 rounded-xl px-3 text-[13px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }} />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="h-10 rounded-xl px-3 text-[13px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <motion.button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              whileHover={inviting ? {} : { scale: 1.03 }}
              whileTap={inviting ? {} : { scale: 0.97 }}
              className="px-4 h-10 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5 shrink-0"
              style={{ background: "#E84A0A", color: "#fff", border: "none", cursor: inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1 }}>
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Invite
            </motion.button>
          </div>
        </AnimatedCard>

        {/* Members list */}
        <AnimatePresence mode="wait">
          {members.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl p-10 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <Users size={40} style={{ color: "var(--ink-4)", margin: "0 auto 16px", opacity: 0.4 }} />
              <p className="text-[14px] font-medium" style={{ color: "var(--ink-2)" }}>No team members yet</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--ink-4)" }}>Invite colleagues to collaborate on your leads and sequences.</p>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {members.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold"
                      style={{ background: "rgba(232,74,10,0.10)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.20)" }}>
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
                  <motion.button
                    onClick={() => handleRemove(m.id)}
                    whileHover={{ scale: 1.1, color: "#ef4444" }}
                    whileTap={{ scale: 0.9 }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 4 }}>
                    <Trash2 size={14} />
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium"
              style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", color: "var(--ink)", boxShadow: "var(--shadow-md)" }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </PageTransition>
    </PlanGate>
  );
}
