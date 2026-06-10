"use client";

import type { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}

export default function MetricsCard({ icon: Icon, label, value, color }: MetricsCardProps) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <Icon size={16} style={{ color }} />
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>
          {label}
        </span>
      </div>
      <p className="text-[24px] font-bold" style={{ color: "var(--ink)" }}>
        {value}
      </p>
    </div>
  );
}
