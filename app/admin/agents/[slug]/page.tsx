"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Cpu, ArrowLeft, RefreshCw, Check, X, Clock, AlertTriangle,
  Zap, Activity, Database, Brain, BarChart3, Play, Bot,
} from "lucide-react";

interface AgentData {
  agent: {
    id: string; name: string; display_name: string; description: string;
    enabled: boolean; schedule: string; last_run_at: string | null;
    last_run_status: string | null; health_score: number;
    auto_approve_level: string; consecutive_failures: number;
    config: Record<string, unknown>;
  };
  runs: Array<{
    id: string; agent_name: string; batch_run_id: string;
    started_at: string; completed_at: string | null; duration_ms: number | null;
    outcome: string; safe_actions_count: number; risky_actions_queued: number;
    log: string; error: string | null;
  }>;
  actions: Array<{
    id: string; agent_name: string; action_type: string; description: string;
    payload: Record<string, unknown>; risk_level: string; status: string;
    notified_via: string[]; created_at: string; resolved_at: string | null;
  }>;
  knowledge: Array<{
    id: string; key: string; value: unknown; agent: string; updated_at: string;
  }>;
  stats: {
    totalRuns: number; successRate: number; avgDurationMs: number;
    totalSafeActions: number; totalRiskyQueued: number;
    last7Days: number; successCount: number; failedCount: number;
  };
}

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

export default function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "runs" | "actions" | "knowledge">("overview");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/prospecting-os/api/admin/agents/${slug}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setError("");
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); }, []);

  const handleToggle = async () => {
    if (!data) return;
    setToggling(true);
    try {
      const res = await fetch(`/prospecting-os/api/admin/agents/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !data.agent.enabled }),
      });
      const json = await res.json();
      if (json.agent) setData(prev => prev ? { ...prev, agent: { ...prev.agent, enabled: json.agent.enabled } } : prev);
    } catch { /* ignore */ }
    setToggling(false);
  };

  const handleRunNow = async () => {
    setRunning(true);
    try { await fetch(`/prospecting-os/api/agents/run?agent=${slug}`); } catch { /* ignore */ }
    pollCountRef.current = 0;
    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current++;
      await fetchData();
      if (pollCountRef.current >= 6) {
        clearInterval(pollTimerRef.current!);
        pollTimerRef.current = null;
        setRunning(false);
      }
    }, 5000);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
        {error || "Agent not found"}
      </div>
    );
  }

  const { agent, runs, actions, knowledge, stats } = data;
  const pendingActions = actions.filter((a) => a.status === "pending");
  const healthPct = agent.health_score;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (healthPct / 100) * circumference;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto", fontFamily: "Geist, sans-serif" }}>
      {/* Back nav + actions row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button
          onClick={() => router.push("/admin/agents")}
          className="flex items-center gap-1.5 bg-transparent border-none text-[var(--ink-3)] text-[12px] font-semibold cursor-pointer py-1.5 px-0 transition-colors duration-150 hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} /> Back to Command Center
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Enable/disable toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling || !data}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, fontWeight: 600,
              color: data?.agent.enabled ? "#6BCB77" : "var(--ink-4)",
              background: "none", border: "none", cursor: "pointer", opacity: toggling ? 0.5 : 1,
            }}
          >
            <span style={{
              width: 36, height: 20, borderRadius: 10, position: "relative",
              background: data?.agent.enabled ? "#6BCB77" : "var(--surface-2)",
              display: "inline-block", transition: "background 0.2s",
            }}>
              <span style={{
                position: "absolute", top: 3, width: 14, height: 14, borderRadius: "50%",
                background: "#fff",
                left: data?.agent.enabled ? "calc(100% - 17px)" : 3,
                transition: "left 0.2s",
              }} />
            </span>
            {data?.agent.enabled ? "Enabled" : "Disabled"}
          </button>
          {/* Run Now */}
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 9999,
              border: "none", cursor: running ? "not-allowed" : "pointer",
              background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: 13,
              opacity: running ? 0.5 : 1,
            }}
          >
            {running
              ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <Play size={13} />}
            {running ? "Running..." : "Run Now"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(224,96,96,0.08)", border: "1px solid rgba(224,96,96,0.15)", color: "#E06060", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 28 }}>
        {/* Health ring */}
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={32} cy={32} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={4} />
            <circle
              cx={32} cy={32} r={radius} fill="none"
              stroke={healthPct >= 90 ? "#6BCB77" : healthPct >= 60 ? "var(--accent)" : "#E06060"}
              strokeWidth={4} strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={24} style={{ color: agent.enabled ? "var(--accent)" : "var(--ink-4)" }} />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.03em" }}>
              {agent.display_name}
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 9999,
              background: agent.enabled ? "rgba(107,203,119,0.10)" : "rgba(255,255,255,0.03)",
              color: agent.enabled ? "#6BCB77" : "var(--ink-4)",
              border: `1px solid ${agent.enabled ? "rgba(107,203,119,0.18)" : "var(--line)"}`,
            }}>
              {agent.enabled ? "Online" : "Offline"}
            </span>
            {agent.auto_approve_level !== "off" && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 9999,
                background: "rgba(59,130,246,0.10)", color: "#3b82f6",
                border: "1px solid rgba(59,130,246,0.15)",
              }}>
                Auto-{agent.auto_approve_level}
              </span>
            )}
            {agent.consecutive_failures > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 9999,
                background: "rgba(224,96,96,0.10)", color: "#E06060",
                border: "1px solid rgba(224,96,96,0.15)",
              }}>
                {agent.consecutive_failures} failures
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "6px 0 0", lineHeight: 1.5 }}>
            {agent.description}
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10, color: "var(--ink-4)", fontFamily: "monospace" }}>
            <span>Schedule: {agent.schedule}</span>
            <span>Health: {agent.health_score}/100</span>
            {agent.last_run_at && <span>Last run: {relativeTime(agent.last_run_at)}</span>}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Runs (7d)", value: stats.last7Days, sub: `${stats.successRate}% success`, color: "var(--accent)" },
          { label: "Safe Actions", value: stats.totalSafeActions, sub: "Auto-executed", color: "#6BCB77" },
          { label: "Avg Duration", value: `${(stats.avgDurationMs / 1000).toFixed(1)}s`, sub: "Per run", color: "#3b82f6" },
          { label: "Pending", value: pendingActions.length, sub: pendingActions.length ? "Needs review" : "All clear", color: pendingActions.length ? "#E8A840" : "#6BCB77" },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            padding: "14px 16px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color, letterSpacing: "-0.02em" }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        {(["overview", "runs", "actions", "knowledge"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 18px", background: "none", border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, color: tab === t ? "var(--accent)" : "var(--ink-4)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              textTransform: "capitalize", transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t}
            {t === "actions" && pendingActions.length > 0 && (
              <span style={{
                marginLeft: 6, padding: "1px 6px", borderRadius: 9999, fontSize: 10,
                background: "rgba(232,168,64,0.12)", color: "var(--accent)",
              }}>
                {pendingActions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Health timeline */}
          <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Health History (Last 7 Days)
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
              {stats.last7Days === 0 ? (
                <span style={{ fontSize: 12, color: "var(--ink-4)" }}>No runs in the last 7 days</span>
              ) : (
                runs.slice(0, 7).reverse().map((run, i) => {
                  const h = run.outcome === "success" || run.outcome === "skipped" ? 60 : run.outcome === "failed" ? 16 : 30;
                  return (
                    <div key={run.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: "100%", height: h, borderRadius: "3px 3px 0 0",
                        background: run.outcome === "success" ? "#6BCB77" : run.outcome === "failed" ? "#E06060" : "var(--accent)",
                        opacity: 0.7, transition: "height 0.3s",
                      }} title={`${run.outcome}: ${run.log?.slice(0, 60)}`} />
                      <span style={{ fontSize: 8, color: "var(--ink-4)" }}>
                        {new Date(run.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Knowledge store summary */}
          <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Knowledge Store ({knowledge.length})
            </div>
            {knowledge.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--ink-4)" }}>No knowledge entries yet</span>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                {knowledge.slice(0, 6).map((k) => (
                  <div key={k.id} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", fontFamily: "monospace", marginBottom: 4 }}>
                      {k.key}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", wordBreak: "break-all", maxHeight: 40, overflow: "hidden" }}>
                      {typeof k.value === "string" ? k.value : JSON.stringify(k.value).slice(0, 120)}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--ink-4)", marginTop: 4 }}>{relativeTime(k.updated_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last run detail */}
          {runs[0] && (
            <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Last Run
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 2 }}>Status</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 9999,
                    background: `${statusDot(runs[0].outcome)}15`, color: statusDot(runs[0].outcome),
                  }}>
                    {runs[0].outcome}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 2 }}>Duration</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                    {runs[0].duration_ms ? `${(runs[0].duration_ms / 1000).toFixed(1)}s` : "—"}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 2 }}>Safe Actions</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6BCB77" }}>{runs[0].safe_actions_count}</span>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 2 }}>Queued</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{runs[0].risky_actions_queued}</span>
                </div>
              </div>
              {runs[0].log && (
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", lineHeight: 1.5 }}>
                  {runs[0].log}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "runs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {runs.length === 0 ? (
            <div style={{ padding: "24px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              <Clock size={20} style={{ display: "block", margin: "0 auto 8", color: "var(--ink-4)" }} />
              No runs recorded yet
            </div>
          ) : (
            runs.map((run) => (
              <div key={run.id} style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot(run.outcome), flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{run.outcome}</span>
                  <span style={{ fontSize: 10, color: "var(--ink-4)" }}>
                    {new Date(run.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {run.duration_ms && <span style={{ fontSize: 10, color: "var(--ink-4)" }}>{(run.duration_ms / 1000).toFixed(1)}s</span>}
                  <span style={{ fontSize: 10, color: "#6BCB77" }}>{run.safe_actions_count} safe</span>
                  <span style={{ fontSize: 10, color: "var(--accent)" }}>{run.risky_actions_queued} queued</span>
                </div>
                {expandedRun === run.id && (
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6 }}>
                    {run.log || "No log output"}
                    {run.error && (
                      <div style={{ marginTop: 8, color: "#E06060" }}>Error: {run.error}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "actions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {actions.length === 0 ? (
            <div style={{ padding: "24px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              <Check size={20} style={{ display: "block", margin: "0 auto 8", color: "#6BCB77" }} />
              No actions recorded yet
            </div>
          ) : (
            actions.map((a) => (
              <div key={a.id} style={{
                display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 10,
                background: a.status === "pending" ? "rgba(232,168,64,0.04)" : "var(--surface)",
                border: a.status === "pending" ? "1px solid rgba(232,168,64,0.15)" : "1px solid var(--line)",
              }}>
                {a.status === "pending" ? (
                  <AlertTriangle size={16} style={{ color: riskColor(a.risk_level), flexShrink: 0, marginTop: 2 }} />
                ) : a.status === "approved" || a.status === "executed" ? (
                  <Check size={16} style={{ color: "#6BCB77", flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <X size={16} style={{ color: "#E06060", flexShrink: 0, marginTop: 2 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{a.description}</span>
                    <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 9999, background: `${actionStatusColor(a.status)}15`, color: actionStatusColor(a.status), fontWeight: 600 }}>
                      {a.status}
                    </span>
                    <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 9999, background: `${riskColor(a.risk_level)}15`, color: riskColor(a.risk_level), fontWeight: 600 }}>
                      {a.risk_level}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "monospace" }}>{a.action_type}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", display: "flex", gap: 12 }}>
                    <span>{new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    {a.notified_via?.length > 0 && <span>Notified: {a.notified_via.join(", ")}</span>}
                    {a.resolved_at && <span>Resolved: {new Date(a.resolved_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "knowledge" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {knowledge.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", padding: "24px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              <Database size={20} style={{ display: "block", margin: "0 auto 8", color: "var(--ink-4)" }} />
              No knowledge store entries yet
            </div>
          ) : (
            knowledge.map((k) => (
              <div key={k.id} style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace", marginBottom: 8, wordBreak: "break-all" }}>
                  {k.key}
                </div>
                <div style={{
                  fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5,
                  padding: "8px 10px", borderRadius: 6, background: "var(--surface-2)",
                  fontFamily: "monospace", maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  {typeof k.value === "object" && k.value !== null
                    ? JSON.stringify(k.value, null, 2)
                    : String(k.value)}
                </div>
                <div style={{ fontSize: 9, color: "var(--ink-4)", marginTop: 6 }}>
                  Updated {relativeTime(k.updated_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
