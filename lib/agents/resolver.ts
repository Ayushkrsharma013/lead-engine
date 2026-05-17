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
