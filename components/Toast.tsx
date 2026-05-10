"use client";

import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useApp } from "@/lib/AppContext";

const TOAST_CONFIG = {
  success: { icon: CheckCircle2, color: "var(--positive)", bg: "var(--positive-soft)", border: "var(--positive)/30" },
  error:   { icon: AlertCircle,  color: "var(--negative)", bg: "var(--negative-soft)", border: "var(--negative)/30" },
  warn:    { icon: AlertTriangle,color: "var(--info)",     bg: "var(--info-soft)",     border: "var(--info)/30" },
  info:    { icon: Info,         color: "var(--accent)",   bg: "var(--accent-soft)",   border: "var(--accent)/30" },
};

export default function ToastContainer() {
  const { state, dispatch } = useApp();
  const toast = state.toast;
  if (!toast) return null;

  const cfg = TOAST_CONFIG[toast.type as keyof typeof TOAST_CONFIG] || TOAST_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] animate-toast-in" role="alert" aria-live="polite">
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-xl max-w-[340px] min-w-[240px] relative overflow-hidden"
        style={{
          background: "var(--surface-elev)",
          border: "1px solid var(--line-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: cfg.color }} />
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
          <Icon size={14} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--ink)" }}>{toast.msg}</p>
        </div>
        <button
          onClick={() => dispatch({ type: "SET_TOAST", payload: null })}
          className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors mt-0.5 hover:bg-[var(--surface-2)]"
          style={{ color: "var(--ink-3)" }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
