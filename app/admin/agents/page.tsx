"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Cpu, Play, Check, X, Clock, RefreshCw, Bot, AlertTriangle,
  HardDrive, Search, Send, Workflow, BarChart3, FileText, MessageSquare,
} from "lucide-react";

interface AgentRow {
  id: string; name: string; display_name: string; description: string;
  enabled: boolean; schedule: string; last_run_at: string | null;
  last_run_status: string | null; health_score: number;
  auto_approve_level: string; consecutive_failures: number;
  config: Record<string, unknown>;
}
interface AgentActionRow {
  id: string; agent_name: string; batch_run_id: string; action_type: string;
  description: string; payload: Record<string, unknown>; risk_level: string;
  status: string; notified_via: string[]; created_at: string;
}
interface AgentRunRow {
  id: string; agent_name: string; batch_run_id: string; started_at: string;
  completed_at: string | null; duration_ms: number | null; outcome: string;
  safe_actions_count: number; risky_actions_queued: number; log: string;
}

const AGENT_COLORS: Record<string, string> = {
  "data-janitor": "#6BCB77",
  "lead-scout": "#E8A840",
  "outreach-agent": "#4FC3F7",
  "pipeline-manager": "#7C4DFF",
  "finance-watcher": "#FF7043",
  "icp-analyst": "#4DB6AC",
  "client-reporter": "#F06292",
  "message-coach": "#9575CD",
};

const AGENT_ICONS: Record<string, LucideIcon> = {
  "data-janitor": HardDrive,
  "lead-scout": Search,
  "outreach-agent": Send,
  "pipeline-manager": Workflow,
  "finance-watcher": Bot,
  "icp-analyst": BarChart3,
  "client-reporter": FileText,
  "message-coach": MessageSquare,
};

const statusDot = (s: string | null) => {
  if (!s) return "#555";
  if (s === "success" || s === "skipped") return "#6BCB77";
  if (s === "failed" || s === "disabled_by_guardrails") return "#E06060";
  return "#E8A840";
};

const riskColor = (r: string) =>
  r === "high" ? "#E06060" : r === "medium" ? "#E8A840" : "#3b82f6";

const actionStatusColor = (st: string) => {
  if (st === "approved" || st === "executed") return "#6BCB77";
  if (st === "rejected") return "#E06060";
  if (st === "pending") return "#E8A840";
  return "#3b82f6";
};

const relativeTime = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

const cardBorder = "rgba(201,168,124,0.07)";
const cardBorderHover = "rgba(201,168,124,0.16)";

export default function AgentCommandCenter() {
  const router = useRouter();
  const clock = useClock();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [actions, setActions] = useState<AgentActionRow[]>([]);
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/prospecting-os/api/admin/agents");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setAgents(data.agents || []);
      setActions(data.actions || []);
      setRuns(data.runs || []);
      setError("");
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleRunAll = async () => {
    setRunning(true);
    try {
      await fetch("/prospecting-os/api/agents/run");
      setTimeout(() => { fetchData(); setRunning(false); }, 3000);
    } catch {
      setRunning(false);
    }
  };

  const enabled = agents.filter((a) => a.enabled);
  const pendingActions = actions.filter((a) => a.status === "pending");
  const latestRuns = runs.slice(0, 20);
  const notifActions = actions.filter((a) => a.status !== "pending");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <RefreshCw size={22} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <>
      {/* TopBar — matching dashboard layout */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          height: 56,
          padding: "0 24px",
          borderBottom: "1px solid var(--line)",
          background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.4) 100%)",
        }}
      >
        <div>
          <h1 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            <Cpu size={16} style={{ display: "inline", marginRight: 8, verticalAlign: -2, color: "var(--accent)" }} />
            Agent Workforce
          </h1>
          <p className="text-[11px]" style={{ color: "var(--ink-4)", marginTop: 1 }}>
            {enabled.length}/{agents.length} online &middot; {pendingActions.length} pending &middot; {runs.length} runs
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--ink-2)", fontFamily: "monospace", letterSpacing: "0.04em" }}>
            {clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </span>
          <button onClick={handleRunAll} disabled={running} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9999,
            border: "none", cursor: running ? "not-allowed" : "pointer",
            background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: 13,
            opacity: running ? 0.5 : 1, transition: "opacity 0.2s",
          }}>
            {running ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={15} />}
            {running ? "Running..." : "Run All Now"}
          </button>
        </div>
      </div>

      {/* Content — matching dashboard scroll area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(224,96,96,0.08)", border: "1px solid rgba(224,96,96,0.15)", color: "#E06060", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Agent Grid — GraphCard-style cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 12 }}>
          {agents.map((agent) => {
            const color = AGENT_COLORS[agent.name] || "var(--accent)";
            const Icon = AGENT_ICONS[agent.name] || Bot;
            const r = 22;
            const circ = 2 * Math.PI * r;
            const off = circ - (Math.min(100, Math.max(0, agent.health_score)) / 100) * circ;

            return (
              <div
                key={agent.id}
                onClick={() => router.push(`/admin/agents/${agent.name}`)}
                className="rounded-xl p-5 flex flex-col transition-all duration-250 cursor-pointer group"
                style={{
                  background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
                  border: `1px solid ${cardBorder}`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  opacity: agent.enabled ? 1 : 0.45,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = cardBorderHover;
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(201,168,124,0.06)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = cardBorder;
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.25)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em] select-none"
                    style={{ color: "var(--ink-4)", opacity: 0.50 }}
                  >
                    {agent.display_name}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {agent.auto_approve_level !== "off" && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 9999, background: "rgba(59,130,246,0.10)", color: "#3b82f6" }}>
                        Auto-{agent.auto_approve_level}
                      </span>
                    )}
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(201,168,124,0.06)", border: "1px solid rgba(201,168,124,0.10)" }}
                    >
                      <Icon size={12} style={{ color: agent.enabled ? color : "var(--ink-4)" }} />
                    </div>
                  </div>
                </div>

                {/* Health ring + value */}
                <div className="flex items-center gap-4 mb-2">
                  <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                    <svg width={52} height={52} style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={26} cy={26} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={3} />
                      <circle cx={26} cy={26} r={r} fill="none" stroke={color} strokeWidth={3}
                        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
                        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
                        {agent.health_score}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[24px] font-bold tabular-nums leading-none" style={{ color: "var(--ink)" }}>
                      {agent.health_score}/100
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)", fontFamily: "monospace" }}>
                      {agent.schedule}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] mb-3" style={{ color: "var(--ink-3)", lineHeight: 1.4 }}>
                  {agent.description}
                </p>

                {/* Status footer */}
                <div className="flex items-center gap-2 mt-auto text-[10px]" style={{ color: "var(--ink-4)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusDot(agent.last_run_status), flexShrink: 0 }} />
                  <span>
                    {agent.last_run_status === "success" ? "Healthy" :
                     agent.last_run_status === "failed" ? "Failed" :
                     agent.last_run_status === "partial" ? "Partial" :
                     agent.last_run_status ? agent.last_run_status : "Never run"}
                  </span>
                  {agent.consecutive_failures > 0 && (
                    <span style={{ color: "#E06060", fontWeight: 600, marginLeft: "auto" }}>{agent.consecutive_failures}f</span>
                  )}
                  {agent.last_run_at && (
                    <span style={{ marginLeft: "auto" }}>{relativeTime(agent.last_run_at)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending Approvals */}
        <div className="rounded-xl p-5 transition-all duration-250"
          style={{ background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)", border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Pending Approvals ({pendingActions.length})
            </span>
          </div>
          {pendingActions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "14px 0", fontSize: 12, color: "var(--ink-3)" }}>
              <Check size={18} style={{ display: "block", margin: "0 auto 6", color: "#6BCB77" }} />
              All clear
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pendingActions.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <AlertTriangle size={16} style={{ color: riskColor(a.risk_level), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{a.description}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{a.agent_name}</span>
                      <span style={{ padding: "1px 6px", borderRadius: 9999, background: `${riskColor(a.risk_level)}15`, color: riskColor(a.risk_level) }}>{a.risk_level}</span>
                      <span>{relativeTime(a.created_at)}</span>
                      {a.notified_via?.length > 0 && <span>{a.notified_via.join(", ")}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notification Log */}
        <div className="rounded-xl p-5 transition-all duration-250"
          style={{ background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)", border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Notification Log ({notifActions.length})
            </span>
          </div>
          {notifActions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "14px 0", fontSize: 12, color: "var(--ink-3)" }}>No notifications yet</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    {["Action", "Agent", "Status", "Risk", "Channel", "Time"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notifActions.slice(0, 20).map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--ink)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--ink-3)", fontFamily: "monospace" }}>{a.agent_name}</td>
                      <td style={{ padding: "8px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: `${actionStatusColor(a.status)}15`, color: actionStatusColor(a.status) }}>{a.status}</span></td>
                      <td style={{ padding: "8px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: `${riskColor(a.risk_level)}15`, color: riskColor(a.risk_level) }}>{a.risk_level}</span></td>
                      <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--ink-3)" }}>{a.notified_via?.join(", ") || "—"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--ink-4)" }}>{relativeTime(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl p-5 transition-all duration-250"
          style={{ background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)", border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
              Activity Feed ({latestRuns.length})
            </span>
          </div>
          {latestRuns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "14px 0", fontSize: 12, color: "var(--ink-3)" }}>
              <Clock size={18} style={{ display: "block", margin: "0 auto 8", color: "var(--ink-4)" }} />
              No runs yet. First cron at 7 AM or click "Run All Now"
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {latestRuns.map((run) => {
                const color = AGENT_COLORS[run.agent_name] || "var(--accent)";
                return (
                  <div key={run.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot(run.outcome), marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "monospace" }}>{run.agent_name}</span>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: `${statusDot(run.outcome)}15`, color: statusDot(run.outcome) }}>{run.outcome}</span>
                        {run.duration_ms && <span style={{ fontSize: 10, color: "var(--ink-4)" }}>{(run.duration_ms / 1000).toFixed(1)}s</span>}
                      </div>
                      {run.log && <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 3 }}>{run.log.slice(0, 120)}{run.log.length > 120 ? "..." : ""}</div>}
                      <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4, display: "flex", gap: 12 }}>
                        <span>{run.safe_actions_count} safe</span>
                        <span>{run.risky_actions_queued} queued</span>
                        <span>{relativeTime(run.started_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
