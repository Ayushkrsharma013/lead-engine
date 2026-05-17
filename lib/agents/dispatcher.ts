// lib/agents/dispatcher.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentRow, AgentActionRow } from "./types";

// Import stub agents (will be populated in Task 4)
import { LeadScoutAgent } from "./lead-scout";
import { OutreachAgent } from "./outreach-agent";
import { PipelineManagerAgent } from "./pipeline-manager";
import { IcpAnalystAgent } from "./icp-analyst";
import { ClientReporterAgent } from "./client-reporter";
import { DataJanitorAgent } from "./data-janitor";
import { MessageCoachAgent } from "./message-coach";

// Finance Watcher is NOT here — it has its own cron at 9 AM
const AGENT_REGISTRY: AgentModule[] = [
  new LeadScoutAgent(),
  new OutreachAgent(),
  new PipelineManagerAgent(),
  new IcpAnalystAgent(),
  new ClientReporterAgent(),
  new DataJanitorAgent(),
  new MessageCoachAgent(),
];

const AGENT_TIMEOUT_MS = 25_000;

async function getEnabledAgentSlugs(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("name")
    .eq("enabled", true);
  if (error) throw new Error(`Failed to fetch enabled agents: ${error.message}`);
  return (data ?? []).map((r: Pick<AgentRow, "name">) => r.name);
}

async function getAgentConfig(name: string): Promise<Record<string, unknown>> {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("config")
    .eq("name", name)
    .single();
  return (data as Pick<AgentRow, "config"> | null)?.config ?? {};
}

async function runWithTimeout(
  agent: AgentModule,
  config: Record<string, unknown>,
): Promise<{ result: AgentResult; durationMs: number }> {
  const startMs = Date.now();
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Agent timed out after ${AGENT_TIMEOUT_MS}ms`)), AGENT_TIMEOUT_MS)
  );
  const result = await Promise.race([agent.run(config), timeout]);
  return { result, durationMs: Date.now() - startMs };
}

async function sendTelegramWithButtons(
  text: string,
  actionId: string,
): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: "Approve", callback_data: `approve_agent:${actionId}` },
          { text: "Reject",  callback_data: `reject_agent:${actionId}` },
        ]],
      },
    }),
  });

  const data = await res.json() as { ok: boolean; result?: { message_id: number } };
  return data.ok && data.result ? String(data.result.message_id) : null;
}

async function sendTelegramText(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => undefined);
}

async function updateAgentHealthScore(agentName: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("agent_runs")
    .select("outcome")
    .eq("agent_name", agentName)
    .order("created_at", { ascending: false })
    .limit(7);

  if (!data || data.length === 0) return;

  const score = Math.round(
    (data.reduce((sum: number, r: { outcome: string }) => {
      if (r.outcome === "success") return sum + 1;
      if (r.outcome === "partial") return sum + 0.5;
      return sum;
    }, 0) / Math.max(data.length, 1)) * 100
  );

  await supabaseAdmin
    .from("agents")
    .update({ health_score: score })
    .eq("name", agentName);
}

export async function runAgentBatch(): Promise<void> {
  const batchRunId = crypto.randomUUID();
  const enabledSlugs = await getEnabledAgentSlugs();
  const toRun = AGENT_REGISTRY.filter(a => enabledSlugs.includes(a.name));

  if (toRun.length === 0) return;

  // Run all agents in parallel, never let one throw — catch inside each
  const settled = await Promise.allSettled(
    toRun.map(async (agent) => {
      const config = await getAgentConfig(agent.name);
      const startedAt = new Date().toISOString();

      let result: AgentResult;
      let durationMs: number;
      let runError: string | undefined;

      try {
        ({ result, durationMs } = await runWithTimeout(agent, config));
      } catch (err) {
        durationMs = AGENT_TIMEOUT_MS;
        result = { outcome: "failed", log: "", safeActionsExecuted: 0, actionsToQueue: [] };
        runError = err instanceof Error ? err.message : String(err);
      }

      const completedAt = new Date().toISOString();

      // Write agent_run
      await supabaseAdmin.from("agent_runs").insert({
        agent_name: agent.name,
        batch_run_id: batchRunId,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        outcome: runError ? "failed" : result.outcome,
        safe_actions_count: result.safeActionsExecuted,
        risky_actions_queued: result.actionsToQueue.filter(
          a => a.riskLevel !== "safe_notify"
        ).length,
        log: result.log,
        error: runError ?? null,
      });

      // Process actionsToQueue
      for (const action of result.actionsToQueue) {
        const isPending = action.riskLevel !== "safe_notify";
        const initialStatus = isPending ? "pending" : "notified";

        const { data: inserted } = await supabaseAdmin
          .from("agent_actions")
          .insert({
            agent_name: agent.name,
            batch_run_id: batchRunId,
            action_type: action.type,
            description: action.description,
            payload: action.payload,
            risk_level: action.riskLevel,
            status: initialStatus,
            notified_via: [],
          } satisfies Omit<AgentActionRow, "id" | "telegram_msg_id" | "approved_by" | "created_at" | "resolved_at">)
          .select("id")
          .single();

        if (!inserted) continue;

        // Telegram: always for medium/high; safe_notify only for hot_lead_alert type
        const shouldTelegram =
          isPending ||
          action.type === "hot_lead_alert" ||
          action.type === "agent_error";

        if (shouldTelegram) {
          const riskLabel = action.riskLevel === "high" ? "HIGH RISK" : "Needs Approval";
          const text = isPending
            ? `[${agent.displayName}] — ${riskLabel}\n\n${action.description}\n\nRisk: ${action.riskLevel}`
            : `[${agent.displayName}] — ${action.description}`;

          if (isPending) {
            const msgId = await sendTelegramWithButtons(text, inserted.id);
            if (msgId) {
              await supabaseAdmin
                .from("agent_actions")
                .update({ telegram_msg_id: msgId, notified_via: ["telegram"] })
                .eq("id", inserted.id);
            }
          } else {
            await sendTelegramText(text);
            await supabaseAdmin
              .from("agent_actions")
              .update({ notified_via: ["telegram"] })
              .eq("id", inserted.id);
          }
        }
      }

      // Update agents table
      await supabaseAdmin.from("agents").update({
        last_run_at: completedAt,
        last_run_status: runError ? "failed" : result.outcome,
      }).eq("name", agent.name);

      await updateAgentHealthScore(agent.name);

      // Error alert to Telegram
      if (runError) {
        await sendTelegramText(`[${agent.displayName}] — Failed\n\n${runError.slice(0, 200)}`);
      }
    })
  );

  // Log any unexpected Promise.allSettled rejections (shouldn't happen — inner try/catch)
  for (const s of settled) {
    if (s.status === "rejected") {
      console.error("[dispatcher] Unexpected rejection:", s.reason);
    }
  }
}
