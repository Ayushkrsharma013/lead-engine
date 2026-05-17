"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Play, RefreshCw, ArrowLeft, Bot, HardDrive, Search,
  Send, Workflow, BarChart3, FileText, MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid,
} from "recharts";
import type { AgentRow, AgentRunRow, AgentActionRow } from "@/lib/agents/types";

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

const cardBorder = "rgba(201,168,124,0.07)";

const relativeTime = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--text)",
  padding: "6px 10px",
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentName = String(params?.name ?? "");

  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [actions, setActions] = useState<AgentActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [configText, setConfigText] = useState("");
  const [configError, setConfigError] = useState("");
  const configInitRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/prospecting-os/api/admin/agents/${agentName}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setAgent(data.agent);
      setRuns(data.runs ?? []);
      setActions(data.actions ?? []);
      if (!configInitRef.current && data.agent?.config) {
        setConfigText(JSON.stringify(data.agent.config, null, 2));
        configInitRef.current = true;
      }
      setError("");
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [agentName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await fetch(`/prospecting-os/api/agents/run?agent=${agentName}`);
    } catch { /* ignore */ }

    pollCountRef.current = 0;
    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current++;
      await fetchData();
      if (pollCountRef.current >= 6) {
        stopPolling();
        setRunning(false);
      }
    }, 5000);
  };

  const handleToggle = async () => {
    if (!agent) return;
    setToggling(true);
    try {
      const res = await fetch(`/prospecting-os/api/admin/agents/${agentName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !agent.enabled }),
      });
      const data = await res.json();
      if (data.agent) setAgent(data.agent);
    } catch { /* ignore */ }
    setToggling(false);
  };

  const handleConfigSave = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configText);
      setConfigError("");
    } catch (e) {
      setConfigError("Invalid JSON: " + String(e));
      return;
    }
    try {
      await fetch(`/prospecting-os/api/admin/agents/${agentName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
    } catch { /* ignore */ }
  };

  useEffect(() => () => stopPolling(), []);

  const color = AGENT_COLORS[agentName] || "var(--accent-blue)";
  const Icon = AGENT_ICONS[agentName] || Bot;

  const actionDist: Record<string, number> = {};
  actions.forEach(a => { actionDist[a.action_type] = (actionDist[a.action_type] || 0) + 1; });
  const actionDistArr = Object.entries(actionDist)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxActionCount = Math.max(1, ...actionDistArr.map(([, c]) => c));

  const totalRuns = runs.length;
  const safeTotal = runs.reduce((s, r) => s + (r.safe_actions_count || 0), 0);
  const pendingCount = actions.filter(a => a.status === "pending").length;

  const healthScore = agent?.health_score ?? 0;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const off = circ - (Math.min(100, Math.max(0, healthScore)) / 100) * circ;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <RefreshCw size={22} style={{ animation: "spin 1s linear infinite", color: "var(--accent-blue)" }} />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ color: "#E06060", fontSize: 13 }}>{error || "Agent not found"}</div>
        <button onClick={() => router.push("/admin/agents")} style={{ marginTop: 12, fontSize: 12, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer" }}>
          ← Back to Command Center
        </button>
      </div>
    );
  }

  // Suppress unused var warning — Icon is used as JSX element below
  void Icon;

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" style={{
        height: 56, padding: "0 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/agents")}
            style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}
          >
            <ArrowLeft size={12} /> Agent Workforce
          </button>
          <span style={{ color: "var(--border)" }}>/</span>
          <div className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}66`, display: "inline-block" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{agent.display_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            disabled={toggling}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, fontWeight: 600,
              color: agent.enabled ? "#6BCB77" : "var(--muted)",
              background: "none", border: "none", cursor: "pointer", opacity: toggling ? 0.5 : 1,
            }}
          >
            <span style={{
              width: 36, height: 20, borderRadius: 10, position: "relative",
              background: agent.enabled ? "#6BCB77" : "var(--surface-2)",
              display: "inline-block", transition: "background 0.2s",
            }}>
              <span style={{
                position: "absolute", top: 3, width: 14, height: 14, borderRadius: "50%",
                background: "#fff",
                left: agent.enabled ? "calc(100% - 17px)" : 3,
                transition: "left 0.2s",
              }} />
            </span>
            {agent.enabled ? "Enabled" : "Disabled"}
          </button>

          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 18px", borderRadius: 9999,
              border: "none", cursor: running ? "not-allowed" : "pointer",
              background: "var(--accent-blue)", color: "#000", fontWeight: 700, fontSize: 13,
              opacity: running ? 0.5 : 1, transition: "opacity 0.2s",
            }}
          >
            {running
              ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <Play size={13} />}
            {running ? "Running..." : "Run Now"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Hero */}
        <div className="rounded-xl p-5 flex items-center gap-5" style={{
          background: "var(--surface)",
          border: `1px solid ${color}1a`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}>
          <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
            <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={32} cy={32} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={3.5} />
              <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={3.5}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
                style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "monospace" }}>{healthScore}</span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>{agent.display_name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, maxWidth: 500 }}>{agent.description}</div>
            <div style={{ display: "flex", gap: 28, marginTop: 12 }}>
              {[
                { val: totalRuns, label: "Total runs" },
                { val: safeTotal, label: "Safe actions" },
                { val: pendingCount, label: "Pending", highlight: pendingCount > 0 ? "#E8A840" : undefined },
                { val: agent.schedule, label: "Schedule" },
                { val: agent.auto_approve_level ?? "none", label: "Auto-approve", highlight: "#3b82f6" },
              ].map(({ val, label, highlight }) => (
                <div key={label}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: highlight ?? "var(--text)", fontVariantNumeric: "tabular-nums" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Health trend */}
          <div className="rounded-xl p-5" style={{
            background: "var(--surface)",
            border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", opacity: 0.7 }}>
              Recent Runs — Success / Fail
            </span>
            {runs.length > 0 ? (
              <ResponsiveContainer width="100%" height={100} style={{ marginTop: 8 }}>
                <AreaChart
                  data={runs.slice().reverse().map((run, i) => ({
                    i,
                    outcome: run.outcome === "success" ? 1 : run.outcome === "partial" ? 0.5 : 0,
                  }))}
                  margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
                >
                  <defs>
                    <linearGradient id={`health-grad-${agentName}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={[0, 1]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="outcome" stroke={color} strokeWidth={1.5}
                    fill={`url(#health-grad-${agentName})`} dot={false}
                    activeDot={{ r: 3, fill: color, stroke: "var(--bg)", strokeWidth: 1.5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}>No runs yet</div>
            )}
          </div>

          {/* Action type breakdown */}
          <div className="rounded-xl p-5" style={{
            background: "var(--surface)",
            border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", opacity: 0.7 }}>
              Action Types
            </span>
            {actionDistArr.length > 0 ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {actionDistArr.map(([type, count]) => (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--muted)", width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{type}</span>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(count / maxActionCount) * 100}%`, background: color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted)", width: 20, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}>No actions yet</div>
            )}
          </div>
        </div>

        {/* Run log + Config */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
          {/* Run log */}
          <div className="rounded-xl" style={{
            background: "var(--surface)",
            border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "18px 20px 12px" }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", opacity: 0.7 }}>
                Run Log — Last {runs.length}
              </span>
            </div>
            {runs.length === 0 ? (
              <div style={{ padding: "24px 20px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>No runs yet</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Outcome", "Duration", "Safe", "Queued", "Log", "When"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => {
                      const oc = run.outcome;
                      const ocColor = oc === "success" ? "#6BCB77" : oc === "failed" ? "#E06060" : "#E8A840";
                      return (
                        <tr key={run.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: `${ocColor}15`, color: ocColor, textTransform: "uppercase" }}>{oc}</span>
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>
                            {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{run.safe_actions_count}</td>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: run.risky_actions_queued > 0 ? "#E8A840" : "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{run.risky_actions_queued}</td>
                          <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--muted)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {run.log ? run.log.slice(0, 100) : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 10, color: "var(--muted)" }}>{relativeTime(run.started_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Config + Guardrails */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="rounded-xl p-5" style={{
              background: "var(--surface)",
              border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", opacity: 0.7 }}>Config</span>
              <textarea
                value={configText}
                onChange={e => setConfigText(e.target.value)}
                onBlur={handleConfigSave}
                rows={8}
                style={{
                  width: "100%", marginTop: 10, background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
                  fontSize: 11, fontFamily: "monospace", color: "var(--muted)",
                  lineHeight: 1.6, resize: "vertical",
                }}
                spellCheck={false}
              />
              {configError && <div style={{ fontSize: 10, color: "#E06060", marginTop: 4 }}>{configError}</div>}
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Saves on blur</div>
            </div>

            <div className="rounded-xl p-5" style={{
              background: "var(--surface)",
              border: `1px solid ${cardBorder}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)", opacity: 0.7 }}>Guardrails</span>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Auto-approve", val: agent.auto_approve_level ?? "none", highlight: "#3b82f6" },
                  { label: "Consecutive failures", val: String(agent.consecutive_failures ?? 0), highlight: (agent.consecutive_failures ?? 0) > 0 ? "#E06060" : "#6BCB77" },
                  { label: "Disable threshold", val: "3 failures" },
                  { label: "Health score", val: String(healthScore), highlight: color },
                ].map(({ label, val, highlight }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: highlight ?? "var(--muted)", fontFamily: "monospace" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
