"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/AppContext";
import type { UserProfile, PlanKey } from "@/lib/types";

export default function ClientSlackPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const { dispatch } = useApp();

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

  const handleSave = async () => {
    if (!profile?.id) return;
    const trimmed = webhookUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("https://hooks.slack.com/services/")) {
      dispatch({
        type: "SET_TOAST",
        payload: {
          msg: "Webhook URL must start with https://hooks.slack.com/services/",
          type: "error",
        },
      });
      return;
    }
    const client = createClient();
    const { error } = await client
      .from("client_workspaces")
      .update({ slack_webhook: trimmed })
      .eq("client_user_id", profile.id);
    if (error) {
      dispatch({ type: "SET_TOAST", payload: { msg: "Failed to save webhook", type: "error" } });
    } else {
      setSaved(true);
      dispatch({ type: "SET_TOAST", payload: { msg: "Webhook saved", type: "success" } });
      setTimeout(() => setSaved(false), 3000);
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
    <PlanGate module="slack-digest" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="growth">
      <div className="max-w-lg space-y-4 animate-fade-in">
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

          <button onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold transition-all"
            style={{ background: saved ? "var(--positive)" : "var(--accent)", color: "#000" }}>
            {saved ? <><Check size={14} /> Saved</> : "Save Webhook"}
          </button>

          <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>
            Your account manager can also configure this for you.
          </p>
        </div>
      </div>
    </PlanGate>
  );
}
