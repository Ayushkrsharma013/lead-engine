"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: string;
  icon?: ReactNode;
  loading?: boolean;
}

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  confirmLabel = "Confirm",
  confirmColor = "#ef4444",
  icon,
  loading = false,
}: ConfirmationModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm animate-fade-in"
        style={{
          background: "var(--surface-elev)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${confirmColor}15` }}
          >
            {icon || <AlertTriangle size={18} style={{ color: confirmColor }} />}
          </div>
          <div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>{title}</h2>
            {subtitle && (
              <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>{subtitle}</p>
            )}
          </div>
        </div>
        <p className="text-[12px] mb-5" style={{ color: "var(--ink-4)" }}>
          {description}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-10 rounded-full text-[13px] font-semibold transition-colors"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-full text-[13px] font-semibold transition-opacity"
            style={{
              background: confirmColor,
              color: "#fff",
              border: "none",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
