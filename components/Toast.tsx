"use client";

import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useApp } from "@/lib/AppContext";

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    color: "var(--accent-green)",
    bg: "rgba(0,255,136,0.08)",
    border: "rgba(0,255,136,0.2)",
    glow: "0 0 20px rgba(0,255,136,0.12)",
  },
  error: {
    icon: AlertCircle,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
    glow: "0 0 20px rgba(239,68,68,0.12)",
  },
  warn: {
    icon: AlertTriangle,
    color: "var(--accent-orange)",
    bg: "rgba(255,107,53,0.08)",
    border: "rgba(255,107,53,0.2)",
    glow: "0 0 20px rgba(255,107,53,0.12)",
  },
  info: {
    icon: Info,
    color: "var(--accent-blue)",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.2)",
    glow: "0 0 20px rgba(0,212,255,0.12)",
  },
};

export default function ToastContainer() {
  const { state, dispatch } = useApp();
  const toast = state.toast;

  if (!toast) return null;

  const cfg = TOAST_CONFIG[toast.type as keyof typeof TOAST_CONFIG] || TOAST_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] animate-toast-in"
      role="alert"
      aria-live="polite"
    >
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-xl max-w-[340px] min-w-[240px] relative overflow-hidden"
        style={{
          background: `rgba(13,13,18,0.92)`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${cfg.border}`,
          boxShadow: `var(--shadow-lg), ${cfg.glow}`,
        }}
      >
        {/* Left color accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
          style={{ background: cfg.color }}
        />

        {/* Icon */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: cfg.bg }}
        >
          <Icon size={14} style={{ color: cfg.color }} />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text)" }}>
            {toast.msg}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={() => dispatch({ type: "SET_TOAST", payload: null })}
          className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors mt-0.5"
          style={{ color: "var(--muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
