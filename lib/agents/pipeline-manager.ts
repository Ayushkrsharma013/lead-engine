// lib/agents/pipeline-manager.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";

const ACTIVE_COLUMNS = ["New", "Contacted", "Replied", "Hot Lead", "Meeting Booked"];
const COLUMN_ORDER = ["New", "Contacted", "Replied", "Hot Lead", "Meeting Booked", "Closed Won", "Closed Lost"];

export class PipelineManagerAgent implements AgentModule {
  name = "pipeline-manager";
  displayName = "Pipeline Manager";
  description = "Kanban health, stale lead detection, cleanup";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const actionsToQueue: AgentAction[] = [];
    let safeCount = 0;
    const logLines: string[] = [];
    let outcome: "success" | "partial" = "success";

    const now = new Date().toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── 1. Column health stats (before any mutations) ───────────────────────
    let columnStats: Record<string, number> = {};
    try {
      const { data: allLeads, error: allErr } = await supabaseAdmin
        .from("leads")
        .select("kanban_column");

      if (allErr) throw allErr;

      columnStats = {};
      for (const row of allLeads || []) {
        const col: string = row.kanban_column || "New";
        columnStats[col] = (columnStats[col] || 0) + 1;
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Column-health scan failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // ── 2. Auto-advance contacted leads ─────────────────────────────────────
    // Leads in kanban_column = 'Contacted' that have sequence_messages
    // sent within the last 2 days. Ensure status is 'contacted'.
    let advancedContacted = 0;
    try {
      const { data: recentMessages, error: msgErr } = await supabaseAdmin
        .from("sequence_messages")
        .select("lead_id")
        .gt("created_at", twoDaysAgo);

      if (msgErr) throw msgErr;

      if (recentMessages && recentMessages.length > 0) {
        const distinctLeadIds: string[] = [...new Set(recentMessages.map((r: Record<string, unknown>) => String(r.lead_id)))];

        const { data: contactedLeads, error: clErr } = await supabaseAdmin
          .from("leads")
          .select("id, status")
          .in("id", distinctLeadIds)
          .eq("kanban_column", "Contacted");

        if (clErr) throw clErr;

        if (contactedLeads && contactedLeads.length > 0) {
          const toUpdate = contactedLeads
            .filter((l) => l.status !== "contacted")
            .map((l) => l.id);

          if (toUpdate.length > 0) {
            const { error: updErr } = await supabaseAdmin
              .from("leads")
              .update({ status: "contacted", last_touched: now, updated_at: now })
              .in("id", toUpdate);

            if (updErr) throw updErr;
            advancedContacted = toUpdate.length;
            safeCount += advancedContacted;
          }
        }
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Contacted advance failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // ── 3. Auto-advance replied leads ──────────────────────────────────────
    // Find leads where sequence_messages.status = 'replied' in last 3 days.
    // Move to kanban_column = 'Replied' and status = 'replied'.
    let advancedReplied = 0;
    try {
      const { data: repliedMessages, error: rmErr } = await supabaseAdmin
        .from("sequence_messages")
        .select("lead_id")
        .eq("status", "replied")
        .gt("created_at", threeDaysAgo);

      if (rmErr) throw rmErr;

      if (repliedMessages && repliedMessages.length > 0) {
        const distinctLeadIds: string[] = [...new Set(repliedMessages.map((r: Record<string, unknown>) => String(r.lead_id)))];

        // Only advance leads not already in 'Replied'
        const { data: toAdvance, error: taErr } = await supabaseAdmin
          .from("leads")
          .select("id")
          .in("id", distinctLeadIds)
          .neq("kanban_column", "Replied");

        if (taErr) throw taErr;

        if (toAdvance && toAdvance.length > 0) {
          const ids = toAdvance.map((r) => r.id);
          const { error: updErr } = await supabaseAdmin
            .from("leads")
            .update({
              kanban_column: "Replied",
              status: "replied",
              last_touched: now,
              updated_at: now,
            })
            .in("id", ids);

          if (updErr) throw updErr;
          advancedReplied = ids.length;
          safeCount += advancedReplied;
        }
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Replied advance failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // ── 4. Identify stuck leads (>14 days same column) ─────────────────────
    // Queue medium-risk unstuck_recommendation actions for leads whose
    // last_touched is older than 14 days and are still in an active column.
    let stuckCount = 0;
    try {
      const { data: stuckLeads, error: stuckErr } = await supabaseAdmin
        .from("leads")
        .select("id, name, company, kanban_column, last_touched")
        .not("last_touched", "is", null)
        .lt("last_touched", fourteenDaysAgo)
        .in("kanban_column", ACTIVE_COLUMNS);

      if (stuckErr) throw stuckErr;

      for (const lead of stuckLeads || []) {
        const column: string = lead.kanban_column || "New";
        const touchedAt = new Date(lead.last_touched || now).getTime();
        const daysStuck = Math.floor(
          (Date.now() - touchedAt) / (24 * 60 * 60 * 1000)
        );

        actionsToQueue.push({
          type: "unstuck_recommendation",
          description: `${lead.name} at ${lead.company} stuck in ${column} for ${daysStuck} days`,
          payload: {
            leadId: lead.id,
            currentColumn: column,
            daysStuck,
          },
          riskLevel: "medium",
        });
        stuckCount++;
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Stuck-lead scan failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // ── 5. Auto-archive won/lost (>30 days untouched) ──────────────────────
    // Leads with status = 'won' or 'lost' AND last_touched > 30 days.
    // If more than 10 candidates, mark as HIGH risk.
    let archiveCount = 0;
    try {
      const { data: archiveCandidates, error: archErr } = await supabaseAdmin
        .from("leads")
        .select("id, name, company, kanban_column, status, last_touched")
        .in("status", ["won", "lost"])
        .not("last_touched", "is", null)
        .lt("last_touched", thirtyDaysAgo);

      if (archErr) throw archErr;

      if (archiveCandidates && archiveCandidates.length > 0) {
        archiveCount = archiveCandidates.length;
        const leadIds = archiveCandidates.map((l) => l.id);
        const riskLevel: "medium" | "high" =
          archiveCount > 10 ? "high" : "medium";

        actionsToQueue.push({
          type: "archive_won_lost",
          description: `${archiveCount} lead(s) with status won/lost untouched for 30+ days. Queue for archival.`,
          payload: { count: archiveCount, leadIds },
          riskLevel,
        });
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Archive scan failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // ── Build summary log ─────────────────────────────────────────────────
    // Format: "Pipeline: 45 in New, 30 Contacted, 12 Replied, 8 Hot Lead,
    //          5 Meeting Booked, 3 Closed Won, 1 Closed Lost.
    //          Advanced 18 contacted, 7 replied. 4 leads stuck >14 days."
    const distParts = COLUMN_ORDER.filter(
      (col) => (columnStats[col] || 0) > 0
    ).map((col) => `${columnStats[col]} in ${col}`);

    const summaryParts: string[] = [];
    summaryParts.push(`Pipeline: ${distParts.join(", ")}`);
    summaryParts.push(
      `Advanced ${advancedContacted} contacted, ${advancedReplied} replied`
    );

    if (stuckCount > 0) {
      summaryParts.push(`${stuckCount} leads stuck >14 days`);
    }

    if (logLines.length === 0 && advancedContacted === 0 && advancedReplied === 0) {
      logLines.push("No pipeline actions needed.");
    }

    return {
      outcome,
      log: summaryParts.join(". ") + (logLines.length > 0 ? `; ${logLines.join("; ")}` : ""),
      safeActionsExecuted: safeCount,
      actionsToQueue,
    };
  }
}
