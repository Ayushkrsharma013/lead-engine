"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Lock, Settings, AlertCircle } from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import type { UserProfile, PlanKey } from "@/lib/types";

const INDUSTRY_OPTIONS = [
  "Technology", "Healthcare", "Finance", "Manufacturing", "Retail",
  "Real Estate", "Education", "Energy", "Transportation", "Other",
];

export default function ClientSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [icpLocked, setIcpLocked] = useState(false);

  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState("");
  const [minScore, setMinScore] = useState(50);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
        setIcpLocked(!!d.workspace?.icp_locked);
        const icp = (d.workspace?.icp_config || {}) as Record<string, unknown>;
        setTargetIndustries((icp.industries as string[]) || []);
        setTargetLocations((icp.locations as string) || "");
        setMinScore((icp.minScore as number) || 50);
      }
      setLoading(false);
    }
    init();
  }, []);

  const toggleIndustry = (ind: string) => {
    if (icpLocked) return;
    if (targetIndustries.includes(ind)) {
      setTargetIndustries(targetIndustries.filter(i => i !== ind));
    } else {
      setTargetIndustries([...targetIndustries, ind]);
    }
  };

  const handleSave = async () => {
    if (icpLocked) {
      setToast("ICP is locked — contact support to make changes");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setSaving(true);
    const res = await fetch("/prospecting-os/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        icp: {
          industries: targetIndustries,
          locations: targetLocations,
          minScore,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setToast("Failed to save preferences");
    } else {
      setToast("Preferences saved successfully");
    }
    setTimeout(() => setToast(""), 2500);
  };

  if (loading) {
    return (
      <PageTransition className="max-w-lg space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="max-w-lg space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <h1 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--ink)" }}>
          <Settings size={16} style={{ color: "#E84A0A" }} />
          Settings
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
          {icpLocked
            ? "ICP is locked for your plan. Contact support to make changes."
            : "Configure your ICP preferences and scoring thresholds"}
        </p>
        {icpLocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "rgba(232,74,10,0.10)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.20)" }}
          >
            <Lock size={10} /> ICP Locked
          </motion.div>
        )}
      </motion.div>

      {/* Industries */}
      <AnimatedCard delay={0.1} className="p-5">
        <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--ink)" }}>
          Target Industries
          {icpLocked && <Lock size={10} style={{ color: "#E84A0A" }} />}
        </h3>
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_OPTIONS.map((ind, i) => (
            <motion.button
              key={ind}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + i * 0.02 }}
              whileHover={icpLocked ? {} : { scale: 1.05 }}
              whileTap={icpLocked ? {} : { scale: 0.95 }}
              onClick={() => toggleIndustry(ind)}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
              style={{
                background: targetIndustries.includes(ind) ? "rgba(232,74,10,0.10)" : "transparent",
                color: targetIndustries.includes(ind) ? "#E84A0A" : "var(--ink-3)",
                border: `1px solid ${targetIndustries.includes(ind) ? "rgba(232,74,10,0.25)" : "var(--line)"}`,
                cursor: icpLocked ? "not-allowed" : "pointer",
                opacity: icpLocked ? 0.6 : 1,
              }}>
              {ind}
            </motion.button>
          ))}
        </div>
      </AnimatedCard>

      {/* Min Score */}
      <AnimatedCard delay={0.15} className="p-5">
        <h3 className="text-[13px] font-semibold mb-4" style={{ color: "var(--ink)" }}>
          Minimum Lead Score: <span style={{ color: "#E84A0A" }}>{minScore}</span>
        </h3>
        <input
          type="range"
          min={0}
          max={100}
          value={minScore}
          onChange={e => setMinScore(Number(e.target.value))}
          disabled={icpLocked}
          className="w-full"
          style={{ accentColor: "#E84A0A", opacity: icpLocked ? 0.5 : 1, cursor: icpLocked ? "not-allowed" : "pointer" }}
        />
        <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--ink-4)" }}>
          <span>0</span><span>50</span><span>100</span>
        </div>
      </AnimatedCard>

      {/* Save button */}
      <motion.button
        onClick={handleSave}
        disabled={saving || icpLocked}
        whileHover={saving || icpLocked ? {} : { scale: 1.03 }}
        whileTap={saving || icpLocked ? {} : { scale: 0.97 }}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all disabled:opacity-40"
        style={{ background: "#E84A0A", color: "#fff", border: "none", cursor: saving || icpLocked ? "not-allowed" : "pointer" }}
      >
        {saving ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
          />
        ) : icpLocked ? (
          <Lock size={14} />
        ) : (
          <Save size={14} />
        )}
        {icpLocked ? "ICP Locked" : "Save Preferences"}
      </motion.button>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium flex items-center gap-2"
            style={{
              background: "var(--surface-elev)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-md)",
              color: toast.includes("Failed") ? "var(--negative)" : "var(--ink)",
            }}
          >
            {toast.includes("Failed") && <AlertCircle size={14} style={{ color: "var(--negative)" }} />}
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
