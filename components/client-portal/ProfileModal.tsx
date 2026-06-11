"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Shield, Calendar, Loader2, LogOut, Settings, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PlanKey } from "@/lib/types";
import { PLAN_MODULES } from "@/lib/plan-modules";
import type { PlanTier } from "@/lib/plan-modules";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

const BACKDROP_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" as const } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const, delay: 0.1 } },
};

const PANEL_VARIANTS = {
  hidden: { x: "110%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.8 },
  },
  exit: {
    x: "110%",
    opacity: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 34, mass: 0.6 },
  },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.18 + i * 0.06, duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as const },
  }),
};

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/prospecting-os/api/client-portal/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setProfile(d.profile);
          setWorkspace(d.workspace);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose();
    router.replace("/client-portal/login");
  };

  const navigateTo = useCallback(
    (path: string) => {
      onClose();
      router.push(path);
    },
    [onClose, router]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="profile-backdrop"
            variants={BACKDROP_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 z-[100]"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          />

          {/* Panel */}
          <motion.div
            key="profile-panel"
            variants={PANEL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[101] flex flex-col shadow-2xl"
            style={{
              background: "var(--bg)",
              borderLeft: "1px solid var(--line)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 shrink-0"
              style={{ height: 56, borderBottom: "1px solid var(--line)" }}
            >
              <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
                My Profile
              </h2>
              <motion.button
                whileHover={{ scale: 1.08, background: "rgba(255,255,255,0.06)" }}
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors"
                style={{ background: "transparent", color: "var(--ink-3)" }}
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2
                    size={20}
                    className="animate-spin"
                    style={{ color: "var(--accent)" }}
                  />
                </div>
              ) : !profile ? (
                <div className="text-center py-20">
                  <p style={{ color: "var(--ink-3)" }}>Failed to load profile</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const plan = (profile.plan || "pilot") as PlanTier;
                    const modules = PLAN_MODULES[plan] || PLAN_MODULES.pilot;

                    return (
                      <>
                        {/* Avatar + Name */}
                        <motion.div
                          custom={0}
                          variants={ITEM_VARIANTS}
                          initial="hidden"
                          animate="visible"
                          className="rounded-xl p-6 text-center"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <div
                            className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-[20px] font-bold"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(232,66,10,0.20), rgba(232,66,10,0.08))",
                              color: "var(--accent)",
                              border: "2px solid rgba(232,66,10,0.25)",
                            }}
                          >
                            {(profile.display_name as string || (profile.email as string) || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <h2
                            className="text-[16px] font-bold"
                            style={{ color: "var(--ink)" }}
                          >
                            {(profile.display_name as string) || "User"}
                          </h2>
                          <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                            {profile.email as string}
                          </p>
                        </motion.div>

                        {/* Details */}
                        <motion.div
                          custom={1}
                          variants={ITEM_VARIANTS}
                          initial="hidden"
                          animate="visible"
                          className="rounded-xl divide-y"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          {[
                            {
                              icon: User,
                              label: "Role",
                              value:
                                profile.role === "super_admin"
                                  ? "Super Admin"
                                  : profile.role === "client"
                                  ? "Client"
                                  : (profile.role as string) || "User",
                            },
                            {
                              icon: Shield,
                              label: "Plan",
                              value:
                                plan === "micro"
                                  ? "Micro-Offer"
                                  : plan === "pilot"
                                  ? "Founder's Pilot"
                                  : plan === "growth"
                                  ? "Growth"
                                  : "Scale",
                            },
                            {
                              icon: Calendar,
                              label: "Member since",
                              value: new Date(
                                (profile.created_at as string) || Date.now()
                              ).toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                              }),
                            },
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center gap-3 px-5 py-3"
                            >
                              <row.icon size={15} style={{ color: "var(--ink-4)" }} />
                              <span
                                className="text-[12px] font-medium"
                                style={{ color: "var(--ink-3)", width: 100 }}
                              >
                                {row.label}
                              </span>
                              <span
                                className="text-[13px] font-semibold"
                                style={{ color: "var(--ink)" }}
                              >
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </motion.div>

                        {/* Plan Modules */}
                        <motion.div
                          custom={2}
                          variants={ITEM_VARIANTS}
                          initial="hidden"
                          animate="visible"
                          className="rounded-xl p-5"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <h3
                            className="text-[13px] font-semibold mb-3"
                            style={{ color: "var(--ink)" }}
                          >
                            Your Plan Includes
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {modules.map((m, i) => (
                              <motion.span
                                key={m}
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.22 + i * 0.03 }}
                                className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                                style={{
                                  background: "rgba(34,197,94,0.06)",
                                  color: "#22c55e",
                                  border: "1px solid rgba(34,197,94,0.12)",
                                }}
                              >
                                {m}
                              </motion.span>
                            ))}
                          </div>
                        </motion.div>

                        {/* Actions */}
                        <motion.div
                          custom={3}
                          variants={ITEM_VARIANTS}
                          initial="hidden"
                          animate="visible"
                          className="flex gap-3"
                        >
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigateTo("/client-portal/settings")}
                            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-[13px] font-semibold cursor-pointer"
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--line)",
                              color: "var(--ink)",
                            }}
                          >
                            <Settings size={14} /> Settings
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigateTo("/client-portal/billing")}
                            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-[13px] font-semibold cursor-pointer"
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--line)",
                              color: "var(--ink)",
                            }}
                          >
                            <CreditCard size={14} /> Billing
                          </motion.button>
                        </motion.div>

                        {/* Logout */}
                        <motion.button
                          custom={4}
                          variants={ITEM_VARIANTS}
                          initial="hidden"
                          animate="visible"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center gap-2 h-11 rounded-full text-[13px] font-semibold cursor-pointer"
                          style={{
                            background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            color: "#ef4444",
                          }}
                        >
                          <LogOut size={14} /> Sign Out
                        </motion.button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
