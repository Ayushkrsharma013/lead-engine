// lib/agents/resolver.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentActionRow } from "./types";

export async function resolveAgentAction(
  actionId: string,
  approved: boolean,
  approvedBy: string,
): Promise<void> {
  const { data: action, error } = await supabaseAdmin
    .from("agent_actions")
    .select("*")
    .eq("id", actionId)
    .single<AgentActionRow>();

  if (error || !action) throw new Error(`Action not found: ${actionId}`);
  if (action.status !== "pending") throw new Error(`Already resolved: ${action.status}`);

  if (approved) {
    console.log(`[resolver] Executing ${action.action_type}`, action.payload);
    // Phase 2: dispatch based on action.action_type
  }

  await supabaseAdmin.from("agent_actions").update({
    status: approved ? "executed" : "rejected",
    approved_by: approvedBy,
    resolved_at: new Date().toISOString(),
  }).eq("id", actionId);

  // Edit the original Telegram message to show resolution
  if (action.telegram_msg_id) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(action.telegram_msg_id, 10),
          text: `[${action.agent_name}] — ${approved ? "Approved" : "Rejected"}\n\n${action.description}\n\nResolved by: ${approvedBy}`,
        }),
      }).catch(() => undefined);
    }
  }
}

export async function runEscalationEngine(): Promise<{
  autoRejected: number;
  escalated: number;
  archived: number;
  log: string;
}> {
  const now = new Date().toISOString();
  const threeDaysAgo = new Date(Date.now() - 72 * 3600_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  // 1. Auto-reject >72h pending
  const { data: rejectedData } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "rejected", resolved_at: now })
    .eq("status", "pending")
    .lt("created_at", threeDaysAgo)
    .select("id");
  const autoRejected = rejectedData?.length || 0;

  // 2. Escalate >24h pending (<72h)
  const { data: toEscalate } = await supabaseAdmin
    .from("agent_actions")
    .select("id, notified_via")
    .eq("status", "pending")
    .lt("created_at", oneDayAgo)
    .gt("created_at", threeDaysAgo);

  let escalated = 0;
  for (const action of (toEscalate || [])) {
    const channels = action.notified_via || [];
    await supabaseAdmin.from("agent_actions").update({
      notified_via: [...channels, "telegram_escalation"],
    }).eq("id", action.id);
    escalated++;
  }

  // 3. Archive >30 days resolved
  const { data: archivedData } = await supabaseAdmin
    .from("agent_actions")
    .delete()
    .in("status", ["executed", "rejected"])
    .lt("created_at", thirtyDaysAgo)
    .select("id");
  const archived = archivedData?.length || 0;

  const parts: string[] = [];
  if (autoRejected) parts.push(`auto-rejected ${autoRejected} stale`);
  if (escalated) parts.push(`escalated ${escalated} urgent`);
  if (archived) parts.push(`archived ${archived} old`);
  const log = parts.length ? parts.join(", ") : "No escalations needed";

  return { autoRejected, escalated, archived, log };
}
