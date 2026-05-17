// lib/agents/guardrails.ts
// Phase 4 — Trust scoring, anomaly detection, auto-approve ladder, pre-flight check.
// Runs BEFORE the dispatcher to gate agent execution.

import { supabaseAdmin } from "@/lib/supabase";

interface AgentHealth {
  name: string;
  health_score: number;
  consecutive_failures: number;
  auto_approve_level: string;
  avg_safe_actions: number;
  avg_risky_actions: number;
  avg_duration_ms: number;
  enabled: boolean;
}

interface AnomalyFlag {
  agent: string;
  reason: string;
  current: number;
  baseline: number;
}

export interface GuardrailsReport {
  passed: boolean;
  flags: AnomalyFlag[];
  autoDisabled: string[];
  autoApprovedAgents: string[];
  log: string;
}

export async function runGuardrails(): Promise<GuardrailsReport> {
  const flags: AnomalyFlag[] = [];
  const autoDisabled: string[] = [];
  const autoApprovedAgents: string[] = [];

  // 1. Fetch all enabled agents with health data
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("name, enabled, health_score, consecutive_failures, auto_approve_level")
    .eq("enabled", true);

  if (!agents) return { passed: true, flags: [], autoDisabled: [], autoApprovedAgents: [], log: "No agents found" };

  // 2. Compute 7-day averages for each agent
  for (const agent of agents) {
    const health = await computeHealth(agent.name);

    // Trust check: 3 consecutive failures → auto-disable
    if (health.consecutive_failures >= 3) {
      await supabaseAdmin.from("agents").update({ enabled: false, consecutive_failures: 0, last_run_status: "disabled_by_guardrails" }).eq("name", agent.name);
      autoDisabled.push(agent.name);
      continue;
    }

    // Auto-approve ladder
    if (health.health_score >= 95 && health.consecutive_failures === 0) {
      await supabaseAdmin.from("agents").update({ auto_approve_level: "high" }).eq("name", agent.name);
      autoApprovedAgents.push(`${agent.name}:high`);
    } else if (health.health_score >= 90 && health.consecutive_failures === 0) {
      await supabaseAdmin.from("agents").update({ auto_approve_level: "medium" }).eq("name", agent.name);
      autoApprovedAgents.push(`${agent.name}:medium`);
    }

    // Anomaly detection: compare last run to 7-day average
    if (health.avg_safe_actions > 0) {
      const { data: lastRun } = await supabaseAdmin
        .from("agent_runs")
        .select("safe_actions_count, risky_actions_queued, duration_ms")
        .eq("agent_name", agent.name)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastRun) {
        const run = lastRun as { safe_actions_count: number; risky_actions_queued: number; duration_ms: number | null };

        // Flag if safe actions deviate >3x from baseline
        if (health.avg_safe_actions > 5 && run.safe_actions_count > health.avg_safe_actions * 3) {
          flags.push({ agent: agent.name, reason: "safe_actions spike", current: run.safe_actions_count, baseline: Math.round(health.avg_safe_actions) });
        }
        if (health.avg_safe_actions > 10 && run.safe_actions_count === 0) {
          flags.push({ agent: agent.name, reason: "zero safe actions", current: 0, baseline: Math.round(health.avg_safe_actions) });
        }

        // Flag if duration >5x normal
        if (health.avg_duration_ms > 0 && run.duration_ms && run.duration_ms > health.avg_duration_ms * 5) {
          flags.push({ agent: agent.name, reason: "duration spike", current: run.duration_ms, baseline: Math.round(health.avg_duration_ms) });
        }
      }
    }
  }

  const logParts: string[] = [];
  if (autoDisabled.length > 0) logParts.push(`${autoDisabled.length} agents auto-disabled (${autoDisabled.join(",")})`);
  if (autoApprovedAgents.length > 0) logParts.push(`${autoApprovedAgents.length} auto-approved (${autoApprovedAgents.join(",")})`);
  if (flags.length > 0) logParts.push(`${flags.length} anomaly flags`);
  if (logParts.length === 0) logParts.push("All agents healthy");

  return {
    passed: autoDisabled.length === 0,
    flags,
    autoDisabled,
    autoApprovedAgents,
    log: logParts.join(". "),
  };
}

async function computeHealth(agentName: string): Promise<AgentHealth> {
  const { data: agent } = await supabaseAdmin.from("agents").select("*").eq("name", agentName).single();

  const { data: runs } = await supabaseAdmin
    .from("agent_runs")
    .select("outcome, safe_actions_count, risky_actions_queued, duration_ms")
    .eq("agent_name", agentName)
    .order("created_at", { ascending: false })
    .limit(7);

  const safeActions = runs?.map(r => r.safe_actions_count) || [];
  const riskyActions = runs?.map(r => r.risky_actions_queued) || [];
  const durations = runs?.map(r => r.duration_ms).filter(Boolean) as number[] || [];

  return {
    name: agentName,
    health_score: agent?.health_score || 100,
    consecutive_failures: agent?.consecutive_failures || 0,
    auto_approve_level: agent?.auto_approve_level || "off",
    avg_safe_actions: safeActions.length ? safeActions.reduce((a, b) => a + b, 0) / safeActions.length : 0,
    avg_risky_actions: riskyActions.length ? riskyActions.reduce((a, b) => a + b, 0) / riskyActions.length : 0,
    avg_duration_ms: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    enabled: agent?.enabled || false,
  };
}
