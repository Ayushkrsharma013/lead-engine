"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { PageTransition } from "@/components/ui/PageTransition";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Slack, MessageCircle, Globe, Webhook, Check, X, Loader2, Trash2, Plug } from "lucide-react";
import type { PlanKey } from "@/lib/types";

interface ConnectorConfig {
  type: string;
  label: string;
  icon: typeof Slack;
  fields: { key: string; label: string; placeholder: string }[];
}

const CONNECTORS: ConnectorConfig[] = [
  { type: "slack", label: "Slack", icon: Slack, fields: [{ key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/..." }] },
  { type: "telegram", label: "Telegram", icon: MessageCircle, fields: [{ key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-DEF..." }, { key: "chat_id", label: "Chat ID", placeholder: "-100123456" }] },
  { type: "discord", label: "Discord", icon: Globe, fields: [{ key: "webhook_url", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/..." }] },
  { type: "webhook", label: "Webhook", icon: Webhook, fields: [{ key: "url", label: "URL", placeholder: "https://your-app.com/webhook" }, { key: "secret", label: "Secret (optional)", placeholder: "shared-secret" }] },
];

export default function ConnectorsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<PlanKey | null>(null);
  const [role, setRole] = useState<string>("");
  const [configured, setConfigured] = useState<Record<string, unknown>>({});
  const [modalType, setModalType] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (!meRes.ok) { setLoading(false); return; }
      const me = await meRes.json();
      setPlan(me.profile?.plan || null);
      setRole(me.profile?.role || "");

      const connRes = await fetch("/prospecting-os/api/client-portal/connectors");
      if (connRes.ok) {
        const d = await connRes.json();
        setConfigured(d.connectorConfig || {});
      }
      setLoading(false);
    }
    init();
  }, []);

  const openModal = (type: string) => {
    setModalType(type);
    const existing = (configured[type] || {}) as Record<string, string>;
    setFormValues(existing);
  };

  const handleSave = async () => {
    if (!modalType) return;
    setSaving(true);
    const res = await fetch("/prospecting-os/api/client-portal/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: modalType, config: formValues }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      setConfigured(d.connectorConfig || {});
      setModalType(null);
      setToast(`${modalType} connected!`);
      setTimeout(() => setToast(""), 2500);
    } else {
      const d = await res.json();
      setToast(d.error || "Failed to save");
      setTimeout(() => setToast(""), 3000);
    }
  };

  const handleDisconnect = async (type: string) => {
    if (!confirm(`Disconnect ${type}?`)) return;
    const res = await fetch(`/prospecting-os/api/client-portal/connectors?type=${type}`, { method: "DELETE" });
    if (res.ok) {
      const d = await res.json();
      setConfigured(d.connectorConfig || {});
      setToast(`${type} disconnected`);
      setTimeout(() => setToast(""), 2500);
    }
  };

  if (loading) {
    return (
      <PageTransition className="max-w-3xl space-y-4">
        <CardSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CardSkeleton /><CardSkeleton />
        </div>
      </PageTransition>
    );
  }

  return (
    <PlanGate module="connector-marketplace" plan={plan} role={role}>
      <PageTransition className="max-w-3xl space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Connector Marketplace</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Connect your outreach notifications to external services
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CONNECTORS.map((c, i) => {
            const isConfigured = !!configured[c.type];
            const Icon = c.icon;
            return (
              <motion.div
                key={c.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-xl p-5"
                style={{
                  background: "var(--surface)",
                  border: isConfigured ? "2px solid rgba(34,197,94,0.2)" : "1px solid var(--line)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <Icon size={18} style={{ color: isConfigured ? "#22c55e" : "var(--ink-2)" }} />
                    <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{c.label}</span>
                  </div>
                  {isConfigured ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <Check size={10} /> Connected
                    </span>
                  ) : <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>Not connected</span>}
                </div>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => openModal(c.type)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-3 py-2 rounded-full text-[11px] font-semibold transition-all"
                    style={{ background: "#E84A0A", color: "#fff", border: "none", cursor: "pointer" }}>
                    {isConfigured ? "Edit" : "Configure"}
                  </motion.button>
                  {isConfigured && (
                    <motion.button
                      onClick={() => handleDisconnect(c.type)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-3 py-2 rounded-full text-[11px] font-semibold transition-all"
                      style={{ background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
                      <Trash2 size={12} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {modalType && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              onClick={(e) => { if (e.target === e.currentTarget) setModalType(null); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl p-6 w-full max-w-md"
                style={{ background: "var(--surface-elev)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>
                    Configure {CONNECTORS.find(c => c.type === modalType)?.label}
                  </h2>
                  <button onClick={() => setModalType(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}>
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-3">
                  {CONNECTORS.find(c => c.type === modalType)?.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--ink-3)" }}>{f.label}</label>
                      <input type="text" value={formValues[f.key] || ""} onChange={e => setFormValues({ ...formValues, [f.key]: e.target.value })} placeholder={f.placeholder}
                        className="w-full h-10 rounded-xl px-3 text-[13px]" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)", outline: "none" }} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 h-10 rounded-full text-[13px] font-semibold flex items-center justify-center gap-2"
                    style={{ background: "#E84A0A", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Configuration
                  </button>
                </div>
              </motion.div>
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
