import * as React from "react";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: "live" | "paused" | "draft" | "active" | "inactive";
  label?: string;
  className?: string;
}

const statusConfig = {
  live:    { bg: "var(--positive-soft)", text: "var(--positive)", dot: "var(--positive)", border: false },
  active:  { bg: "var(--positive-soft)", text: "var(--positive)", dot: "var(--positive)", border: false },
  paused:  { bg: "var(--info-soft)",     text: "var(--info)",     dot: "var(--info)",     border: false },
  draft:   { bg: "var(--surface-2)",     text: "var(--ink-3)",    dot: "var(--ink-3)",    border: true },
  inactive:{ bg: "var(--surface-2)",     text: "var(--ink-3)",    dot: "var(--ink-3)",    border: true },
} as const;

export function StatusPill({ status, label, className }: StatusPillProps) {
  const cfg = statusConfig[status];
  const displayLabel = label || status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-0.5",
        "text-[11px] font-medium",
        className
      )}
      style={{
        background: cfg.bg,
        color: cfg.text,
        ...(cfg.border ? { border: "1px solid var(--line)" } : {}),
      }}
    >
      <span
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ background: cfg.dot }}
      />
      {displayLabel}
    </span>
  );
}
