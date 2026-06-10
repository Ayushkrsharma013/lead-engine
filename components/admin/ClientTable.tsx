"use client";

import { ExternalLink, Ban, CheckCircle, Trash2, Loader2 } from "lucide-react";

export interface ClientRow {
  id: string; email: string; name: string; plan: string;
  subscription_status: string; is_active: boolean; created_at: string;
  workspace_id: string | null; leads_count: number;
  leads_generation_status: string; icp_locked: boolean;
}

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  micro: { bg: "rgba(107,203,119,0.08)", text: "#6BCB77" },
  pilot: { bg: "rgba(232,168,64,0.08)", text: "#E8A840" },
  growth: { bg: "rgba(0,180,255,0.08)", text: "#00b4ff" },
  scale: { bg: "rgba(168,85,247,0.08)", text: "#a855f7" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(34,197,94,0.08)", text: "#22c55e" },
  trial: { bg: "rgba(0,180,255,0.08)", text: "#00b4ff" },
  past_due: { bg: "rgba(239,68,68,0.08)", text: "#ef4444" },
  suspended: { bg: "rgba(234,179,8,0.08)", text: "#eab308" },
  canceled: { bg: "rgba(128,128,128,0.08)", text: "#808080" },
  inactive: { bg: "rgba(128,128,128,0.08)", text: "#808080" },
  pending_payment: { bg: "rgba(232,168,64,0.08)", text: "#E8A840" },
};

function planLabel(plan: string): string {
  const map: Record<string, string> = {
    micro: "Micro", pilot: "Pilot", growth: "Growth", scale: "Scale",
  };
  return map[plan] || plan;
}

interface ClientTableProps {
  clients: ClientRow[];
  actionLoading: string | null;
  onAction: (id: string, action: string) => void;
  onDelete: (client: ClientRow) => void;
  onViewPortal: (client: ClientRow) => void;
  onSuspendClick: (client: ClientRow) => void;
  onActivateClick: (client: ClientRow) => void;
}

export default function ClientTable({
  clients,
  actionLoading,
  onAction,
  onDelete,
  onViewPortal,
  onSuspendClick,
  onActivateClick,
}: ClientTableProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--line)" }}>
            {["Client", "Plan", "Status", "Leads", "Joined", "Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map(c => {
            const pc = PLAN_COLORS[c.plan] || PLAN_COLORS.pilot;
            const sc = STATUS_COLORS[c.subscription_status || "inactive"];
            const isActive = c.subscription_status === "active" || c.subscription_status === "trial";
            return (
              <tr
                key={c.id}
                className="transition-colors duration-150"
                style={{ borderBottom: "1px solid var(--line)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.01)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Client */}
                <td className="px-4 py-3">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{c.email}</p>
                  </div>
                </td>
                {/* Plan */}
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.text}20` }}
                  >
                    {planLabel(c.plan)}
                  </span>
                </td>
                {/* Status */}
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: sc.text }}
                    />
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.text}20` }}
                    >
                      {(c.subscription_status || "inactive").replace("_", " ")}
                    </span>
                  </span>
                </td>
                {/* Leads */}
                <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  {c.leads_count.toLocaleString()}
                </td>
                {/* Joined */}
                <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-4)" }}>
                  {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onViewPortal(c)}
                      className="p-1.5 rounded-lg transition-colors"
                      title="View as Client"
                      style={{ color: "var(--ink-3)", background: "transparent", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,180,255,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <ExternalLink size={14} />
                    </button>

                    {isActive ? (
                      <button
                        onClick={() => onSuspendClick(c)}
                        disabled={actionLoading === c.id}
                        className="p-1.5 rounded-lg transition-colors"
                        title="Suspend"
                        style={{ color: "#eab308", background: "transparent", border: "none", cursor: actionLoading === c.id ? "default" : "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(234,179,8,0.08)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {actionLoading === c.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                      </button>
                    ) : (
                      <button
                        onClick={() => onActivateClick(c)}
                        disabled={actionLoading === c.id}
                        className="p-1.5 rounded-lg transition-colors"
                        title="Activate"
                        style={{ color: "#22c55e", background: "transparent", border: "none", cursor: actionLoading === c.id ? "default" : "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.08)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {actionLoading === c.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      </button>
                    )}

                    <button
                      onClick={() => onDelete(c)}
                      className="p-1.5 rounded-lg transition-colors"
                      title="Delete"
                      style={{ color: "#ef4444", background: "transparent", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
