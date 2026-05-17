// lib/agents/client-reporter.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";
import { writeKnowledge } from "./knowledge";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOT_LEAD_THRESHOLD = 80;

export class ClientReporterAgent implements AgentModule {
  name = "client-reporter";
  displayName = "Client Reporter";
  description = "Auto-generates client portal updates and reports";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const actionsToQueue: AgentAction[] = [];
    let safeActionsExecuted = 0;

    try {
      // ── Step 1: Get all active clients ────────────────────────────────────
      const { data: clients, error: clientsError } = await supabaseAdmin
        .from("clients")
        .select("*")
        .eq("status", "active");

      if (clientsError) throw clientsError;

      if (!clients || clients.length === 0) {
        return {
          outcome: "success",
          log: "No active clients found. No reports generated.",
          safeActionsExecuted: 0,
          actionsToQueue: [],
        };
      }

      const clientIds = clients.map((c) => c.id);
      const oneWeekAgo = new Date(Date.now() - ONE_WEEK_MS).toISOString();

      // ── Step 2: Get all leads belonging to any active client ──────────────
      const { data: allLeads, error: leadsError } = await supabaseAdmin
        .from("leads")
        .select("*")
        .in("client_id", clientIds);

      if (leadsError) throw leadsError;

      // Group leads by client_id
      const leadsByClient = new Map<string, typeof allLeads>();
      for (const lead of allLeads || []) {
        const cid = lead.client_id;
        if (!cid) continue;
        if (!leadsByClient.has(cid)) leadsByClient.set(cid, []);
        leadsByClient.get(cid)!.push(lead);
      }

      let totalLeadsManaged = 0;
      let totalNewThisWeek = 0;
      let clientsAtRisk = 0;
      const atRiskClientIds: string[] = [];

      // ── Step 3: Per-client stats and actions ──────────────────────────────
      for (const client of clients) {
        const clientLeads = leadsByClient.get(client.id) || [];

        const total = clientLeads.length;
        const newThisWeek = clientLeads.filter(
          (l) => l.saved_at && l.saved_at > oneWeekAgo
        ).length;
        const hot = clientLeads.filter(
          (l) => (l.score ?? 0) >= HOT_LEAD_THRESHOLD
        ).length;
        const contacted = clientLeads.filter(
          (l) =>
            l.status === "contacted" &&
            l.last_touched &&
            l.last_touched > oneWeekAgo
        ).length;
        const meetings = clientLeads.filter(
          (l) => l.status === "meeting"
        ).length;
        const avgScore =
          total > 0
            ? Math.round(
                clientLeads.reduce((s, l) => s + (l.score ?? 0), 0) / total
              )
            : 0;

        totalLeadsManaged += total;
        totalNewThisWeek += newThisWeek;

        // Queue MEDIUM risk: weekly report for human review before sending
        actionsToQueue.push({
          type: "client_weekly_report",
          description: `Weekly report for ${client.name} (${client.company}): ${total} leads, ${newThisWeek} new, ${hot} hot, ${meetings} meetings`,
          payload: {
            clientId: client.id,
            clientName: client.name,
            company: client.company,
            stats: {
              total,
              newThisWeek,
              hot,
              contacted,
              meetings,
              avgScore,
            },
          },
          riskLevel: "medium",
        });

        // At-risk detection: clients with 0 new leads this week
        if (newThisWeek === 0) {
          actionsToQueue.push({
            type: "client_at_risk",
            description: `${client.company} had 0 new leads this week — may need attention`,
            payload: {
              clientId: client.id,
              clientName: client.name,
              company: client.company,
            },
            riskLevel: "safe_notify",
          });
          safeActionsExecuted++;
          clientsAtRisk++;
          atRiskClientIds.push(client.id);
        }
      }

      // ── Step 4: Build summary log ─────────────────────────────────────────
      const reportCount = clients.length;
      const log = [
        `Generated reports for ${reportCount} active ${reportCount === 1 ? "client" : "clients"}.`,
        `${totalLeadsManaged} total leads managed,`,
        `${totalNewThisWeek} new this week.`,
        `${clientsAtRisk} ${clientsAtRisk === 1 ? "client" : "clients"} at risk (0 new leads).`,
      ].join(" ");

      try { await writeKnowledge("at_risk_clients", atRiskClientIds, "client-reporter"); } catch { /* ignore */ }
      try { await writeKnowledge("weekly_lead_count", totalNewThisWeek, "client-reporter"); } catch { /* ignore */ }
      try { await writeKnowledge("active_client_count", clients.length, "client-reporter"); } catch { /* ignore */ }

      return {
        outcome: "success",
        log,
        safeActionsExecuted,
        actionsToQueue,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        outcome: "failed",
        log: `Client Reporter failed: ${message}`,
        safeActionsExecuted,
        actionsToQueue,
      };
    }
  }
}
