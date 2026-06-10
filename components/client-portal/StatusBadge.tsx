"use client";

interface StatusBadgeProps {
  status: "pending" | "processing" | "ready" | "failed";
  className?: string;
}

const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  pending: { bg: "rgba(255,255,255,0.04)", dot: "#7a7875", text: "#b0aeaa" },
  processing: { bg: "rgba(0,180,255,0.08)", dot: "#00b4ff", text: "#00b4ff" },
  ready: { bg: "rgba(34,197,94,0.08)", dot: "#22c55e", text: "#22c55e" },
  failed: { bg: "rgba(239,68,68,0.08)", dot: "#ef4444", text: "#ef4444" },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${className}`}
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.dot}20` }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%", background: c.dot,
          animation: status === "processing" ? "pulse 1.5s infinite" : "none",
        }}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
