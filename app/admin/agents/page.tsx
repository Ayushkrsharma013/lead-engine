// app/admin/agents/page.tsx
import { supabaseAdmin } from "@/lib/supabase";
import { headers } from "next/headers";
import type { AgentRow, AgentActionRow, AgentRunRow } from "@/lib/agents/types";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  // Auth check — super_admin only
  const hdrs = await headers();
  const role = hdrs.get("x-user-role");
  if (role !== "super_admin") {
    return (
      <div style={{ padding: "40px", color: "#E06060", fontFamily: "monospace" }}>
        Access denied. Super admin only.
      </div>
    );
  }

  // Fetch all data in parallel
  const [agentsRes, actionsRes, runsRes] = await Promise.all([
    supabaseAdmin.from("agents").select("*").order("display_name").returns<AgentRow[]>(),
    supabaseAdmin
      .from("agent_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<AgentActionRow[]>(),
    supabaseAdmin
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40)
      .returns<AgentRunRow[]>(),
  ]);

  const agents  = agentsRes.data  ?? [];
  const actions = actionsRes.data ?? [];
  const runs    = runsRes.data    ?? [];

  const pendingActions = actions.filter(a => a.status === "pending");
  const notifActions   = actions.filter(a => a.status !== "pending");

  // Colours
  const statusColor = (s: string | null) => {
    if (!s)              return "#555";
    if (s === "success") return "#6BCB77";
    if (s === "failed")  return "#E06060";
    return "#E8A840";
  };
  const riskColor = (r: string) =>
    r === "high" ? "#E06060" : r === "medium" ? "#E8A840" : "#3b82f6";

  const channelLabel = (via: string[]) => {
    if (via.includes("telegram") && via.includes("email")) return "Telegram + Email";
    if (via.includes("telegram")) return "Telegram";
    if (via.includes("email")) return "Email";
    return "Internal";
  };
  const channelColor = (via: string[]) => {
    if (via.includes("telegram") && via.includes("email")) return "#a78bfa";
    if (via.includes("telegram")) return "#00d4ff";
    if (via.includes("email")) return "#6BCB77";
    return "#555";
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto", fontFamily: "Geist, sans-serif" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#EBEBEB", margin: 0, letterSpacing: "-0.02em" }}>
            Agent Command Center
          </h1>
          <p style={{ fontSize: 12, color: "#555", margin: "4px 0 0" }}>
            {agents.filter(a => a.enabled).length} of {agents.length} agents enabled &middot;{" "}
            {pendingActions.length > 0
              ? <span style={{ color: "#E8A840" }}>{pendingActions.length} pending approval{pendingActions.length !== 1 ? "s" : ""}</span>
              : "no pending approvals"}
          </p>
        </div>
        <form action="/prospecting-os/api/agents/run" method="GET">
          <button
            type="submit"
            style={{
              padding: "8px 16px", background: "rgba(232,168,64,0.12)",
              border: "1px solid rgba(232,168,64,0.3)", borderRadius: 7,
              color: "#E8A840", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Run All Now
          </button>
        </form>
      </div>

      {/* Agent Workforce grid */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Agent Workforce
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 28 }}>
        {agents.map(agent => {
          const dotColor = !agent.last_run_status
            ? "#3b82f6"
            : statusColor(agent.last_run_status);
          const lastRun = agent.last_run_at
            ? new Date(agent.last_run_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
            : "Never run";
          const latestRun = runs.find(r => r.agent_name === agent.name);
          return (
            <div key={agent.id} style={{
              padding: "12px 14px", background: "#0A0A0A",
              border: `1px solid ${
                agent.last_run_status === "failed"
                  ? "rgba(224,96,96,0.2)"
                  : pendingActions.some(a => a.agent_name === agent.name)
                  ? "rgba(232,168,64,0.2)"
                  : "rgba(255,255,255,0.06)"
              }`,
              borderRadius: 9,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#EBEBEB" }}>{agent.display_name}</span>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
              </div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>
                {agent.enabled ? `Last: ${lastRun}` : "Disabled — Phase 2"}
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {latestRun ? (latestRun.log.split("\n")[0]?.slice(0, 60) ?? "—") : "—"}
              </div>
              {agent.enabled && (
                <div style={{ marginTop: 6, fontSize: 10, color: statusColor(agent.last_run_status) }}>
                  health: {agent.health_score}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending Approvals */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Pending Approvals{pendingActions.length > 0 && (
          <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(232,168,64,0.15)", color: "#E8A840" }}>
            {pendingActions.length}
          </span>
        )}
      </p>
      {pendingActions.length === 0 ? (
        <div style={{ padding: "14px 16px", background: "#0A0A0A", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", color: "#444", fontSize: 12, marginBottom: 28 }}>
          No pending approvals — agents are either all clear or awaiting their next run.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
          {pendingActions.map(action => (
            <div key={action.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", background: "rgba(232,168,64,0.03)",
              border: "1px solid rgba(232,168,64,0.18)", borderRadius: 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: "rgba(124,58,237,0.15)", color: "#a78bfa", flexShrink: 0,
              }}>{action.agent_name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: `${riskColor(action.risk_level)}18`, color: riskColor(action.risk_level),
                flexShrink: 0,
              }}>{action.risk_level}</span>
              <span style={{ flex: 1, fontSize: 12, color: "#CCC" }}>{action.description}</span>
              <span style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>
                {new Date(action.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{ fontSize: 11, color: "#888", flexShrink: 0 }}>Review in Telegram or via email link</span>
            </div>
          ))}
        </div>
      )}

      {/* Notifications Log */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Notifications Log
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
        {notifActions.length === 0 ? (
          <div style={{ padding: "14px 16px", background: "#0A0A0A", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", color: "#444", fontSize: 12 }}>
            No notifications sent yet.
          </div>
        ) : notifActions.map(action => (
          <div key={action.id} style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            padding: "10px 14px", background: "#0A0A0A",
            border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, flexShrink: 0, marginTop: 1,
              background: `${channelColor(action.notified_via)}15`, color: channelColor(action.notified_via),
            }}>{channelLabel(action.notified_via)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#CCC", marginBottom: 2 }}>{action.description}</div>
              <div style={{ fontSize: 10, color: "#444" }}>
                {action.agent_name} &middot; {new Date(action.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} &middot; {action.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#444", textTransform: "uppercase", marginBottom: 10 }}>
        Activity Feed
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {runs.length === 0 ? (
          <div style={{ padding: "14px 16px", background: "#0A0A0A", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", color: "#444", fontSize: 12 }}>
            No runs yet. The first run will happen at 7 AM tomorrow (or click Run All Now above).
          </div>
        ) : runs.map(run => (
          <div key={run.id} style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
              background: statusColor(run.outcome),
            }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, color: "#EBEBEB", fontSize: 12 }}>{run.agent_name}</span>
              {" "}
              <span style={{ fontSize: 12, color: "#888" }}>{run.log || "(no log)"}</span>
            </div>
            <span style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>
              {new Date(run.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
