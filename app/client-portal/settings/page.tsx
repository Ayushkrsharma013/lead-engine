"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Lock } from "lucide-react";
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
    // Use API route for saving
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
      setToast("Preferences saved");
    }
    setTimeout(() => setToast(""), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Settings</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
          {icpLocked
            ? "ICP is locked for your plan. Contact support to make changes."
            : "Configure your ICP preferences and scoring thresholds"}
        </p>
        {icpLocked && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}>
            <Lock size={10} /> ICP Locked
          </div>
        )}
      </div>

      {/* Industries */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>Target Industries</h3>
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_OPTIONS.map(ind => (
            <button key={ind} onClick={() => toggleIndustry(ind)}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
              style={{
                background: targetIndustries.includes(ind) ? "var(--accent-soft)" : "transparent",
                color: targetIndustries.includes(ind) ? "var(--accent-ink)" : "var(--ink-3)",
                border: `1px solid ${targetIndustries.includes(ind) ? "rgba(232,168,64,0.25)" : "var(--line)"}`,
              }}>
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Min Score */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>Minimum Lead Score: {minScore}</h3>
        <input type="range" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))}
          className="w-full" style={{ accentColor: "var(--accent)" }} />
        <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--ink-4)" }}>
          <span>0</span><span>50</span><span>100</span>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold transition-all disabled:opacity-40"
        style={{ background: "var(--accent)", color: "#000" }}>
        {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
        Save Preferences
      </button>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium animate-toast-in"
          style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)", color: "var(--ink)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
