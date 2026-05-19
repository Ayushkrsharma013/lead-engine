// lib/agents/resolver.ts
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { enqueueLinkedInAction } from "@/lib/linkedin-queue";
import type { AgentActionRow } from "./types";

// ── Action Dispatch ────────────────────────────────────────────────────────────

async function dispatchAction(action: AgentActionRow): Promise<string> {
  const p = action.payload as Record<string, unknown>;

  switch (action.action_type) {

    case "launch_sequence": {
      const leadId = String(p.leadId ?? "");
      if (!leadId) throw new Error("launch_sequence payload missing leadId");

      const { data: seqs, error: seqErr } = await supabaseAdmin
        .from("sequences")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(1);
      if (seqErr) throw new Error(`Could not fetch sequences: ${seqErr.message}`);
      if (!seqs?.length) throw new Error("No sequences available to launch");

      const sequenceId = String(seqs[0].id);
      const sequenceName = String(seqs[0].name);

      const { data: existing } = await supabaseAdmin
        .from("sequence_executions")
        .select("id")
        .eq("sequence_id", sequenceId)
        .eq("lead_id", leadId)
        .in("status", ["active", "paused"])
        .maybeSingle();
      if (existing) return `${String(p.leadName ?? "Lead")} already running on "${sequenceName}"`;

      const { error: insertErr } = await supabaseAdmin
        .from("sequence_executions")
        .insert({
          sequence_id: sequenceId,
          lead_id: leadId,
          status: "active",
          variant: "A",
          current_step: 0,
        });
      if (insertErr) throw new Error(`Failed to create execution: ${insertErr.message}`);

      return `Sequence "${sequenceName}" launched for ${String(p.leadName ?? leadId)}`;
    }

    case "follow_up": {
      const leadId = String(p.leadId ?? "");
      if (!leadId) throw new Error("follow_up payload missing leadId");
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ notes: `[Agent] Follow-up flagged ${new Date().toLocaleDateString()}` })
        .eq("id", leadId);
      if (error) throw new Error(`Failed to flag follow-up: ${error.message}`);
      return `Follow-up flagged for ${String(p.leadName ?? leadId)}`;
    }

    case "unstuck_recommendation": {
      const leadId = String(p.leadId ?? "");
      if (!leadId) throw new Error("unstuck_recommendation payload missing leadId");
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ notes: `[Agent] Stuck ${String(p.stuckDays ?? "?")} days in ${String(p.column ?? "unknown")}` })
        .eq("id", leadId);
      if (error) throw new Error(`Failed to update lead notes: ${error.message}`);
      return `Stuck note added for ${String(p.leadName ?? leadId)}`;
    }

    case "archive_won_lost":
    case "archive_invalid_emails":
    case "archive_stale_lead": {
      const leadIds = Array.isArray(p.leadIds) ? p.leadIds.map(String) : [];
      if (!leadIds.length) throw new Error(`${action.action_type} payload missing leadIds`);
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ status: "archived" })
        .in("id", leadIds);
      if (error) throw new Error(`Failed to archive leads: ${error.message}`);
      return `${leadIds.length} lead(s) archived`;
    }

    case "adjust_score_threshold": {
      const threshold = Number(p.suggestedThreshold ?? 0);
      if (!threshold) throw new Error("adjust_score_threshold payload missing suggestedThreshold");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, icp_preferences")
        .eq("role", "super_admin")
        .maybeSingle();
      if (!profile) throw new Error("No super_admin profile found");
      const current = (profile.icp_preferences as Record<string, unknown>) ?? {};
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ icp_preferences: { ...current, score_threshold: threshold } })
        .eq("id", profile.id);
      if (error) throw new Error(`Failed to update ICP threshold: ${error.message}`);
      return `ICP score threshold updated to ${threshold}`;
    }

    case "client_weekly_report": {
      const clientId = String(p.clientId ?? "");
      if (!clientId) throw new Error("client_weekly_report payload missing clientId");
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("name, email, company")
        .eq("id", clientId)
        .maybeSingle();
      if (!client?.email) throw new Error(`Client ${clientId} has no email on file`);

      const stats = (p.stats as Record<string, number>) ?? {};
      const company = String(p.company ?? client.company ?? "");
      const html = `
        <h2>Weekly Report — ${company}</h2>
        <ul>
          <li>Total leads: <strong>${stats.total ?? 0}</strong></li>
          <li>New this week: <strong>${stats.newThisWeek ?? 0}</strong></li>
          <li>Hot leads: <strong>${stats.hot ?? 0}</strong></li>
          <li>Contacted: <strong>${stats.contacted ?? 0}</strong></li>
          <li>Meetings booked: <strong>${stats.meetings ?? 0}</strong></li>
          <li>Avg score: <strong>${stats.avgScore ?? 0}</strong></li>
        </ul>
        <p>View your full dashboard: <a href="https://app.flow-forges.com/prospecting-os/client-portal">Client Portal</a></p>
      `;
      const result = await sendEmail({
        to: client.email,
        subject: `Weekly Prospecting Report — ${company}`,
        html,
      });
      if (!result.ok) throw new Error(`Resend failed: ${result.error}`);
      return `Weekly report sent to ${client.email}`;
    }

    case "auto_enroll_hot_leads": {
      const leadIds = Array.isArray(p.lead_ids) ? p.lead_ids.map(String) : [];
      if (!leadIds.length) throw new Error("auto_enroll_hot_leads payload missing lead_ids");
      const sequenceId = p.sequence_id ? String(p.sequence_id) : null;

      let seqId = sequenceId;
      let seqName = "default sequence";
      if (!seqId) {
        const { data: seqs, error: seqErr } = await supabaseAdmin
          .from("sequences")
          .select("id, name")
          .order("created_at", { ascending: false })
          .limit(1);
        if (seqErr) throw new Error(`Could not fetch sequences: ${seqErr.message}`);
        if (!seqs?.length) throw new Error("No sequences available to enroll leads into");
        seqId = String(seqs[0].id);
        seqName = String(seqs[0].name);
      } else {
        const { data: seq } = await supabaseAdmin
          .from("sequences")
          .select("name")
          .eq("id", seqId)
          .single();
        if (seq) seqName = String((seq as { name: string }).name);
      }

      const { data: existing } = await supabaseAdmin
        .from("sequence_executions")
        .select("lead_id")
        .eq("sequence_id", seqId)
        .in("lead_id", leadIds)
        .in("status", ["active", "paused"]);
      const existingIds = new Set((existing ?? []).map((e: Record<string, unknown>) => String(e.lead_id)));
      const newIds = leadIds.filter(id => !existingIds.has(id));
      if (newIds.length === 0) return `All ${leadIds.length} hot leads already enrolled in "${seqName}"`;

      const rows = newIds.map(leadId => ({
        sequence_id: seqId,
        lead_id: leadId,
        status: "active",
        variant: "A",
        current_step: 0,
      }));
      const { error: insErr } = await supabaseAdmin.from("sequence_executions").insert(rows);
      if (insErr) throw new Error(`Failed to enroll leads: ${insErr.message}`);
      return `${newIds.length} hot lead${newIds.length !== 1 ? "s" : ""} enrolled in "${seqName}"`;
    }

    case "queue_linkedin_connections": {
      const candidates = Array.isArray(p.candidates) ? p.candidates : [];
      if (!candidates.length) throw new Error("queue_linkedin_connections payload missing candidates");

      let queued = 0;
      for (const c of candidates as Array<Record<string, unknown>>) {
        const leadId = String(c.leadId ?? "");
        const profileUrl = String(c.profileUrl ?? "");
        if (!leadId || !profileUrl) continue;
        try {
          await enqueueLinkedInAction({
            leadId,
            linkedinProfileUrl: profileUrl,
            actionType: "connection_request",
            message: c.message ? String(c.message) : undefined,
          });
          queued++;
        } catch {
          // continue with remaining candidates
        }
      }
      return `Queued ${queued} LinkedIn connection request${queued !== 1 ? "s" : ""}`;
    }

    case "queue_linkedin_dm": {
      const leadId = String(p.leadId ?? "");
      const profileUrl = String(p.profileUrl ?? "");
      const message = String(p.message ?? "");
      if (!leadId || !profileUrl) throw new Error("queue_linkedin_dm payload missing leadId or profileUrl");

      await enqueueLinkedInAction({
        leadId,
        linkedinProfileUrl: profileUrl,
        actionType: "dm",
        message: message || undefined,
      });
      return `LinkedIn DM queued for ${String(p.leadName ?? leadId)}`;
    }

    // Informational types — no DB changes, just mark executed
    case "resolve_duplicates":
    case "deprioritize_industry":
    case "high_performing_industry":
    case "top_performing_segment":
    case "variant_improvement":
    case "high_performer_notice":
    case "stale_template":
      return `Acknowledged: ${action.description}`;

    default:
      console.warn(`[resolver] Unknown action_type: ${action.action_type} — marking executed`);
      return `No dispatch handler for "${action.action_type}"`;
  }
}

// ── Resolve ───────────────────────────────────────────────────────────────────

export async function resolveAgentAction(
  actionId: string,
  approved: boolean,
  approvedBy: string,
): Promise<{ success: boolean; message: string }> {
  const { data: action, error } = await supabaseAdmin
    .from("agent_actions")
    .select("*")
    .eq("id", actionId)
    .single<AgentActionRow>();

  if (error || !action) {
    return { success: false, message: `Action not found: ${actionId}` };
  }
  if (action.status !== "pending") {
    return { success: false, message: `Already resolved: ${action.status}` };
  }

  let message = "";
  let finalStatus: "executed" | "rejected" | "failed" = "rejected";

  if (approved) {
    try {
      message = await dispatchAction(action);
      finalStatus = "executed";
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
      finalStatus = "failed";
    }
  } else {
    message = `Rejected by ${approvedBy}`;
  }

  await supabaseAdmin.from("agent_actions").update({
    status: finalStatus,
    approved_by: approvedBy,
    resolved_at: new Date().toISOString(),
  }).eq("id", actionId);

  // Edit the original Telegram message to show resolution
  if (action.telegram_msg_id) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const label = finalStatus === "executed" ? "Approved & Executed"
                  : finalStatus === "failed"   ? "Dispatch Failed"
                  : "Rejected";
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(action.telegram_msg_id, 10),
          text: `[${action.agent_name}] — ${label}\n\n${action.description}\n\nResolved by: ${approvedBy}\n${message}`,
        }),
      }).catch(() => undefined);
    }
  }

  return { success: finalStatus !== "failed", message };
}

// ── Escalation Engine ─────────────────────────────────────────────────────────

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

  const { data: rejectedData } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "rejected", resolved_at: now })
    .eq("status", "pending")
    .lt("created_at", threeDaysAgo)
    .select("id");
  const autoRejected = rejectedData?.length || 0;

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

  const { data: archivedData } = await supabaseAdmin
    .from("agent_actions")
    .delete()
    .in("status", ["executed", "rejected", "failed"])
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
