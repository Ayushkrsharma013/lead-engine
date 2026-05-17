// lib/agents/types.ts

export interface AgentAction {
  type: string;
  description: string;
  payload: Record<string, unknown>;
  riskLevel: "safe_notify" | "medium" | "high";
}

export interface AgentResult {
  outcome: "success" | "partial" | "failed" | "skipped";
  log: string;
  safeActionsExecuted: number;
  actionsToQueue: AgentAction[];
}

export interface AgentModule {
  name: string;
  displayName: string;
  description: string;
  run(config: Record<string, unknown>): Promise<AgentResult>;
}

// DB row shapes (returned from Supabase queries)
export interface AgentRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  enabled: boolean;
  schedule: string;
  last_run_at: string | null;
  last_run_status: string | null;
  health_score: number;
  config: Record<string, unknown>;
  auto_approve_level?: string;
  consecutive_failures?: number;
  created_at: string;
}

export interface AgentRunRow {
  id: string;
  agent_name: string;
  batch_run_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  outcome: AgentResult["outcome"];
  safe_actions_count: number;
  risky_actions_queued: number;
  log: string;
  error: string | null;
  created_at: string;
}

export interface AgentActionRow {
  id: string;
  agent_name: string;
  batch_run_id: string;
  action_type: string;
  description: string;
  payload: Record<string, unknown>;
  risk_level: "safe_notify" | "medium" | "high";
  status: "pending" | "approved" | "rejected" | "executed" | "notified" | "failed";
  notified_via: string[];
  telegram_msg_id: string | null;
  approved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}
