"use client";

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, max, label, className = "" }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>{label}</span>
          <span className="text-[11px] font-bold" style={{ color: "var(--ink)" }}>{value}/{max}</span>
        </div>
      )}
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%", borderRadius: 999,
            width: `${pct}%`,
            background: pct >= 100 ? "var(--positive)" : "var(--accent)",
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}
