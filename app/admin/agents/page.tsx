"use client";

import { useEffect, useState, useCallback } from "react";
import { Cpu, Play, Check, X, Clock, RefreshCw, Bot, AlertTriangle, Shield, Zap } from "lucide-react";

interface AgentRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  enabled: boolean;
  schedule: string;
  last_run_at: string | null;
  last_run_status: string | null;
  health_score: number;
  auto_approve_level: string;
  consecutive_failures: number;
  config: Record<string, unknown>;
}

interface AgentActionRow {
  id: string;
  agent_name: string;
  batch_run_id: string;
  action_type: string;
  description: string;
  payload: Record<string, unknown>;
  risk_level: string;
  status: string;
  notified_via: string[];
  created_at: string;
}

interface AgentRunRow {
  id: string;
  agent_name: string;
  batch_run_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  outcome: string;
  safe_actions_count: number;
  risky_actions_queued: number;
  log: string;
}

const s = (v: string) => v; // style anchor

export default function AgentCommandCenter() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [actions, setActions] = useState<AgentActionRow[]>([]);
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/prospecting-os/api/admin/agents");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
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

  const handleRunAll = async () => {
    setRunning(true);
    try {
      await fetch("/prospecting-os/api/agents/run");
      setTimeout(() => { fetchData(); setRunning(false); }, 3000);
    } catch {
      setRunning(false);
    }
  };

  const enabled = agents.filter(a => a.enabled);
  const pendingActions = actions.filter(a => a.status === "pending");
  const latestRuns = runs.slice(0, 20);
  const notifActions = actions.filter(a => a.status !== "pending");

  const statusDot = (s: string | null) => {
    if (!s) return "#555";
    if (s === "success" || s === "skipped") return "#6BCB77";
    if (s === "failed" || s === "disabled_by_guardrails") return "#E06060";
    return "#E8A840";
  };

  const statusLabel = (s: string | null) => {
    if (!s) return "Never run";
    if (s === "success") return "Healthy";
    if (s === "failed") return "Failed";
    if (s === "partial") return "Partial";
    if (s === "skipped") return "Skipped";
    if (s === "disabled_by_guardrails") return "Disabled";
    return s;
  };

  const riskColor = (r: string) =>
    r === "high" ? "#E06060" : r === "medium" ? "#E8A840" : "#3b82f6";

  const actionStatusColor = (st: string) => {
    if (st === "approved" || st === "executed") return "#6BCB77";
    if (st === "rejected") return "#E06060";
    if (st === "pending") return "#E8A840";
    return "#3b82f6";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto", fontFamily: "Geist, sans-serif" }}>
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(224,96,96,0.08)", border: "1px solid rgba(224,96,96,0.15)", color: "#E06060", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", margin: 0 }}>
            <Cpu size={22} style={{ display: "inline", marginRight: 10, verticalAlign: -4, color: "var(--accent)" }} />
            Agent Command Center
          </h1>
          <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "4px 0 0" }}>
            {enabled.length} of {agents.length} agents enabled · {pendingActions.length} pending approvals · {runs.length} total runs
          </p>
        </div>
        <button
          onClick={handleRunAll}
          disabled={running}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 22px", borderRadius: 9999, border: "none", cursor: running ? "not-allowed" : "pointer",
            background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: 13,
            opacity: running ? 0.5 : 1,
          }}
        >
          {running ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={15} />}
          {running ? "Running..." : "Run All Now"}
        </button>
      </div>

      {/* Agent Grid */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Digital Workforce
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 28 }}>
        {agents.map(agent => {
          const lastRun = runs.find(r => r.agent_name === agent.name);
          return (
            <div
              key={agent.id}
              style={{
                padding: "16px 18px", borderRadius: 12,
                background: "var(--surface)", border: "1px solid var(--line)",
                opacity: agent.enabled ? 1 : 0.45,
                transition: "opacity 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: agent.enabled ? "rgba(232,168,64,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${agent.enabled ? "rgba(232,168,64,0.15)" : "var(--line)"}`,
                  }}>
                    <Bot size={18} style={{ color: agent.enabled ? "var(--accent)" : "var(--ink-4)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{agent.display_name}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "monospace" }}>{agent.schedule}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 9999,
                  background: agent.enabled ? "rgba(107,203,119,0.10)" : "rgba(255,255,255,0.03)",
                  color: agent.enabled ? "#6BCB77" : "var(--ink-4)",
                  border: `1px solid ${agent.enabled ? "rgba(107,203,119,0.18)" : "var(--line)"}`,
                }}>
                  {agent.enabled ? "Online" : "Offline"}
                </span>
              </div>

              {/* Health bar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Health</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: agent.health_score >= 90 ? "#6BCB77" : agent.health_score >= 60 ? "var(--accent)" : "#E06060" }}>
                    {agent.health_score}/100
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 2, transition: "width 0.5s",
                    width: `${agent.health_score}%`,
                    background: agent.health_score >= 90 ? "#6BCB77" : agent.health_score >= 60 ? "var(--accent)" : "#E06060",
                  }} />
                </div>
              </div>

              {/* Status and details */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot(agent.last_run_status) }} />
                <span style={{ color: "var(--ink-3)" }}>{statusLabel(agent.last_run_status)}</span>
                {agent.auto_approve_level !== "off" && (
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 9999,
                    background: "rgba(59,130,246,0.10)", color: "#3b82f6",
                    border: "1px solid rgba(59,130,246,0.15)",
                  }}>
                    Auto-{agent.auto_approve_level}
                  </span>
                )}
                {agent.consecutive_failures > 0 && (
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 9999,
                    background: "rgba(224,96,96,0.10)", color: "#E06060",
                    border: "1px solid rgba(224,96,96,0.15)",
                  }}>
                    {agent.consecutive_failures} failures
                  </span>
                )}
              </div>
              {lastRun && (
                <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>
                  Last run: {new Date(lastRun.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {lastRun.log ? ` — ${lastRun.log.slice(0, 80)}${lastRun.log.length > 80 ? "…" : ""}` : ""}
                </div>
              )}
              {!lastRun && (
                <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>No runs yet — scheduled for {agent.schedule}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending Approvals */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Pending Approvals ({pendingActions.length})
      </h2>
      {pendingActions.length === 0 ? (
        <div style={{ padding: "20px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-3)", textAlign: "center", marginBottom: 28 }}>
          <Check size={18} style={{ display: "block", margin: "0 auto 8", color: "#6BCB77" }} />
          All clear — no pending approvals
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
          {pendingActions.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)" }}>
              <AlertTriangle size={16} style={{ color: riskColor(a.risk_level), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{a.description}</div>
                <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2, display: "flex", gap: 10 }}>
                  <span>{a.agent_name}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 9999, background: `${riskColor(a.risk_level)}15`, color: riskColor(a.risk_level) }}>{a.risk_level}</span>
                  <span>{new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notifications Log */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Notification Log ({notifActions.length})
      </h2>
      {notifActions.length === 0 ? (
        <div style={{ padding: "16px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-3)", textAlign: "center", marginBottom: 28 }}>
          No notifications sent yet
        </div>
      ) : (
        <div style={{ marginBottom: 28, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Action", "Agent", "Status", "Risk", "Channel", "Time"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifActions.slice(0, 20).map(a => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--ink-3)", fontFamily: "monospace" }}>{a.agent_name}</td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: `${actionStatusColor(a.status)}15`, color: actionStatusColor(a.status) }}>{a.status}</span></td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: `${riskColor(a.risk_level)}15`, color: riskColor(a.risk_level) }}>{a.risk_level}</span></td>
                  <td style={{ padding: "10px 12px", fontSize: 10, color: "var(--ink-3)" }}>{a.notified_via?.join(", ") || "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 10, color: "var(--ink-4)" }}>{new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity Feed */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Activity Feed ({latestRuns.length})
      </h2>
      {latestRuns.length === 0 ? (
        <div style={{ padding: "20px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
          <Clock size={18} style={{ display: "block", margin: "0 auto 8", color: "var(--ink-4)" }} />
          No runs yet — first cron is at 7 AM or click &quot;Run All Now&quot; above
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {latestRuns.map(run => (
            <div key={run.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot(run.outcome), marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{run.agent_name}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 9999, background: `${statusDot(run.outcome)}15`, color: statusDot(run.outcome) }}>{run.outcome}</span>
                  {run.duration_ms && <span style={{ fontSize: 10, color: "var(--ink-4)" }}>{(run.duration_ms / 1000).toFixed(1)}s</span>}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 3 }}>{run.log}</div>
                <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4, display: "flex", gap: 12 }}>
                  <span>{run.safe_actions_count} safe</span>
                  <span>{run.risky_actions_queued} queued</span>
                  <span>{new Date(run.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
