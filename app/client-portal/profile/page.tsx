"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Shield, Calendar, Loader2, LogOut, Settings, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PlanKey } from "@/lib/types";
import { PLAN_MODULES } from "@/lib/plan-modules";
import type { PlanTier } from "@/lib/plan-modules";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/prospecting-os/api/client-portal/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setProfile(d.profile); setWorkspace(d.workspace); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/client-portal/login");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;
  if (!profile) return <div className="text-center py-20"><p style={{ color: "var(--ink-3)" }}>Failed to load profile</p></div>;

  const plan = (profile.plan || "pilot") as PlanTier;
  const modules = PLAN_MODULES[plan] || PLAN_MODULES.pilot;

  return (
    <div className="p-4 lg:p-6">
    <div className="max-w-2xl space-y-4">
      {/* Avatar + Name */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.05}} className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-[20px] font-bold"
          style={{ background: "linear-gradient(135deg, rgba(232,66,10,0.20), rgba(232,66,10,0.08))", color: "var(--accent)", border: "2px solid rgba(232,66,10,0.25)" }}>
          {(profile.display_name as string || profile.email as string || "U").charAt(0).toUpperCase()}
        </div>
        <h2 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>{profile.display_name as string || "User"}</h2>
        <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>{profile.email as string}</p>
      </motion.div>

      {/* Details */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.10}} className="rounded-xl divide-y" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        {[
          { icon: User, label: "Role", value: (profile.role === "super_admin" ? "Super Admin" : profile.role === "client" ? "Client" : profile.role as string) || "User" },
          { icon: Shield, label: "Plan", value: plan === "micro" ? "Micro-Offer" : plan === "pilot" ? "Founder's Pilot" : plan === "growth" ? "Growth" : "Scale" },
          { icon: Calendar, label: "Member since", value: new Date((profile.created_at as string) || Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" }) },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-3 px-5 py-3">
            <row.icon size={15} style={{ color: "var(--ink-4)" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--ink-3)", width: 100 }}>{row.label}</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{row.value}</span>
          </div>
        ))}
      </motion.div>

      {/* Plan Modules */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.15}} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>Your Plan Includes</h3>
        <div className="flex flex-wrap gap-2">
          {modules.map((m, i) => (
            <motion.span key={m} initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} transition={{delay:0.18+i*0.03}}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: "rgba(34,197,94,0.06)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.12)" }}>
              {m}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.20}} className="flex gap-3">
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={() => router.push("/client-portal/settings")}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-[13px] font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", cursor: "pointer" }}>
          <Settings size={14} /> Settings
        </motion.button>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={() => router.push("/client-portal/billing")}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-[13px] font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", cursor: "pointer" }}>
          <CreditCard size={14} /> Billing
        </motion.button>
      </motion.div>
      <motion.button initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.24}} whileHover={{scale:1.02}} whileTap={{scale:0.97}}
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-full text-[13px] font-semibold"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", cursor: "pointer" }}>
        <LogOut size={14} /> Sign Out
      </motion.button>
    </div>
    </div>
  );
}
