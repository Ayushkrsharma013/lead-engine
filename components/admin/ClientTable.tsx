"use client";

import { ExternalLink, Ban, CheckCircle, Trash2, Loader2 } from "lucide-react";

export interface ClientRow {
  id: string; email: string; name: string; plan: string;
  subscription_status: string; is_active: boolean; created_at: string;
  workspace_id: string | null; leads_count: number;
  leads_generation_status: string; icp_locked: boolean;
}

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  micro:  { bg: "rgba(107,203,119,0.07)",  text: "#6BCB77", border: "rgba(107,203,119,0.18)" },
  pilot:  { bg: "rgba(232,168,64,0.07)",   text: "#E8A840", border: "rgba(232,168,64,0.18)" },
  growth: { bg: "rgba(0,180,255,0.07)",    text: "#00b4ff", border: "rgba(0,180,255,0.18)" },
  scale:  { bg: "rgba(168,85,247,0.07)",   text: "#a855f7", border: "rgba(168,85,247,0.18)" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active:          { bg: "rgba(34,197,94,0.07)",   text: "#22c55e", border: "rgba(34,197,94,0.18)" },
  trial:           { bg: "rgba(0,180,255,0.07)",   text: "#00b4ff", border: "rgba(0,180,255,0.18)" },
  past_due:        { bg: "rgba(239,68,68,0.07)",   text: "#ef4444", border: "rgba(239,68,68,0.18)" },
  suspended:       { bg: "rgba(234,179,8,0.07)",   text: "#eab308", border: "rgba(234,179,8,0.18)" },
  canceled:        { bg: "rgba(128,128,128,0.07)", text: "#808080", border: "rgba(128,128,128,0.18)" },
  inactive:        { bg: "rgba(128,128,128,0.07)", text: "#808080", border: "rgba(128,128,128,0.18)" },
  pending_payment: { bg: "rgba(232,168,64,0.07)",  text: "#E8A840", border: "rgba(232,168,64,0.18)" },
};

const AVATAR_COLORS = ["#e8420a", "#00b4ff", "#6BCB77", "#E8A840", "#a855f7", "#e879f9", "#f97316"];

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function getAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

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
          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            {["Client", "Plan", "Status", "Leads", "Joined", "Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((c, idx) => {
            const pc = PLAN_COLORS[c.plan] || PLAN_COLORS.pilot;
            const sc = STATUS_COLORS[c.subscription_status || "inactive"];
            const isActive = c.subscription_status === "active" || c.subscription_status === "trial";
            const avatarColor = getAvatarColor(c.name);
            const initials = getInitials(c.name);
            const isLast = idx === clients.length - 1;
            return (
              <tr
                key={c.id}
                className="transition-colors duration-150 group"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--line)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Client */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{
                        background: `${avatarColor}14`,
                        color: avatarColor,
                        border: `1px solid ${avatarColor}28`,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{c.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>{c.email}</p>
                    </div>
                  </div>
                </td>
                {/* Plan */}
                <td className="px-4 py-3">
                  <span
                    className="px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide"
                    style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
                  >
                    {planLabel(c.plan)}
                  </span>
                </td>
                {/* Status */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: sc.text, boxShadow: `0 0 4px ${sc.text}60` }}
                    />
                    <span
                      className="px-2.5 py-1 rounded-md text-[10px] font-semibold capitalize"
                      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                    >
                      {(c.subscription_status || "inactive").replace("_", " ")}
                    </span>
                  </span>
                </td>
                {/* Leads */}
                <td className="px-4 py-3">
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                    {c.leads_count.toLocaleString()}
                  </span>
                </td>
                {/* Joined */}
                <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
                  {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onViewPortal(c)}
                      className="p-1.5 rounded-lg transition-all duration-150"
                      title="View portal as client"
                      style={{ color: "var(--ink-3)", background: "transparent", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,180,255,0.1)"; e.currentTarget.style.color = "#00b4ff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
                    >
                      <ExternalLink size={14} />
                    </button>

                    {isActive ? (
                      <button
                        onClick={() => onSuspendClick(c)}
                        disabled={actionLoading === c.id}
                        className="p-1.5 rounded-lg transition-all duration-150"
                        title="Suspend client"
                        style={{ color: "var(--ink-3)", background: "transparent", border: "none", cursor: actionLoading === c.id ? "default" : "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(234,179,8,0.1)"; e.currentTarget.style.color = "#eab308"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
                      >
                        {actionLoading === c.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                      </button>
                    ) : (
                      <button
                        onClick={() => onActivateClick(c)}
                        disabled={actionLoading === c.id}
                        className="p-1.5 rounded-lg transition-all duration-150"
                        title="Activate client"
                        style={{ color: "var(--ink-3)", background: "transparent", border: "none", cursor: actionLoading === c.id ? "default" : "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; e.currentTarget.style.color = "#22c55e"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
                      >
                        {actionLoading === c.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      </button>
                    )}

                    <button
                      onClick={() => onDelete(c)}
                      className="p-1.5 rounded-lg transition-all duration-150"
                      title="Delete client"
                      style={{ color: "var(--ink-3)", background: "transparent", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#ef4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-3)"; }}
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
