"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

export default function ClientSlackPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
        setWebhookUrl(d.workspace?.slack_webhook || "");
      }
      setLoading(false);
    }
    init();
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSave = async () => {
    if (!profile?.id) return;
    const trimmed = webhookUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("https://hooks.slack.com/services/")) {
      showToast("URL must start with https://hooks.slack.com/services/");
      return;
    }
    setSaving(true);
    const res = await fetch("/prospecting-os/api/client-portal/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slack_webhook: trimmed }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      showToast("Webhook saved");
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error || "Failed to save webhook");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PlanGate module="integrations" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="growth">
      <div className="p-4 lg:p-6 max-w-lg space-y-4">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Slack Digest</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Get daily hot lead summaries delivered to your Slack workspace</p>
        </div>

        <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
              <Bell size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Slack Webhook</p>
              <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>We&apos;ll send daily digests to this channel</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.10em] mb-1.5 block" style={{ color: "var(--ink-4)" }}>Webhook URL</label>
            <input type="text" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full h-10 rounded-xl px-3 text-[13px] outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold transition-all disabled:opacity-40"
            style={{ background: saved ? "var(--positive)" : "var(--accent)", color: "#000", border: "none", cursor: "pointer" }}>
            {saved ? <><Check size={14} /> Saved</> : saving ? "Saving…" : "Save Webhook"}
          </button>

          <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>
            Your account manager can also configure this for you.
          </p>
        </div>
      </div>
      <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium" style={{background:"var(--surface-elev)",border:"1px solid var(--line)",color:"var(--ink)",boxShadow:"var(--shadow-md)"}}>{toast}</motion.div>}</AnimatePresence>
    </PlanGate>
  );
}
