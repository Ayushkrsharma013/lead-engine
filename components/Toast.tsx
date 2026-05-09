"use client";

import { AlertCircle, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { cn } from "@/lib/utils";

export default function ToastContainer() {
  const { state, dispatch } = useApp();
  const toast = state.toast;

  if (!toast) return null;

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-fade-up z-[9999] max-w-sm",
        toast.type === "success" && "bg-accent-green/10 border-accent-green/25 text-accent-green",
        toast.type === "error" && "bg-red-500/10 border-red-500/25 text-red-400",
        toast.type === "warn" && "bg-accent-orange/10 border-accent-orange/25 text-accent-orange",
      )}
    >
      {toast.type === "error" && <AlertCircle size={14} className="shrink-0" />}
      {toast.type === "success" && <CheckCircle2 size={14} className="shrink-0" />}
      {toast.type === "warn" && <AlertTriangle size={14} className="shrink-0" />}
      <span className="flex-1">{toast.msg}</span>
      <button
        onClick={() => dispatch({ type: "SET_TOAST", payload: null })}
        className="shrink-0 hover:opacity-70 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
}
