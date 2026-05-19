// lib/agents/outreach-agent.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";
import type { Lead } from "@/lib/types";
import { readKnowledge, readKnowledgeNumber, readKnowledgeRecord, writeKnowledge } from "./knowledge";
import { isAlreadyQueued } from "@/lib/linkedin-queue";

const QUALIFIED_SCORE_THRESHOLD = 60;
const HOT_SCORE_THRESHOLD = 80;
const FOLLOW_UP_DAYS = 3;

/**
 * Transform a raw snake_case DB row into a camelCase Lead object.
 * Inlined here so this module has no dependency on lib/db.ts transform helpers.
 */
function leadFromDB(row: Record<string, unknown>): Lead {
  const s = String(row.source || "linkedin");
  const validSources = new Set(["linkedin", "gmaps", "amazon"]);
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    title: String(row.title || ""),
    company: String(row.company || ""),
    industry: String(row.industry || ""),
    location: String(row.location || ""),
    email: String(row.email || ""),
    emailStatus: (["verified", "risky", "not_found"].includes(String(row.email_status))
      ? String(row.email_status) : "not_found") as Lead["emailStatus"],
    linkedin: String(row.linkedin || ""),
    website: String(row.website || ""),
    companySize: String(row.company_size || ""),
    score: Number(row.score ?? 0),
    source: validSources.has(s) ? s as Lead["source"] : "linkedin",
    savedAt: row.saved_at ? String(row.saved_at) : undefined,
    fetchedAt: row.fetched_at ? String(row.fetched_at) : undefined,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    kanbanColumn: row.kanban_column ? String(row.kanban_column) : "New",
    status: (["new", "contacted", "replied", "hot", "meeting", "won", "lost"].includes(String(row.status || ""))
      ? String(row.status) : undefined) as Lead["status"],
    notes: row.notes ? String(row.notes) : undefined,
    lastTouched: row.last_touched ? String(row.last_touched) : undefined,
  };
}

export class OutreachAgent implements AgentModule {
  name = "outreach-agent";
  displayName = "Outreach Agent";
  description = "Sequence execution, email sends, reply handling";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const actionsToQueue: AgentAction[] = [];
    let safeActionsExecuted = 0;

    try {
      // ── Knowledge coordination reads ─────────────────────────────────────────
      let bestTemplateIds: Record<string, unknown> = {};
      let hotScoreThreshold = HOT_SCORE_THRESHOLD;
      let minScoreThreshold = QUALIFIED_SCORE_THRESHOLD;
      let lastTouchedThreshold = FOLLOW_UP_DAYS;
      try { bestTemplateIds = await readKnowledgeRecord("best_template_ids"); } catch { /* ignore */ }
      try { hotScoreThreshold = await readKnowledgeNumber("hot_lead_threshold", HOT_SCORE_THRESHOLD); } catch { /* ignore */ }
      try { minScoreThreshold = await readKnowledgeNumber("min_score_threshold", QUALIFIED_SCORE_THRESHOLD); } catch { /* ignore */ }
      try { lastTouchedThreshold = await readKnowledgeNumber("follow_up_window_days", FOLLOW_UP_DAYS); } catch { /* ignore */ }

      // ── Step 1: Find qualified leads ─────────────────────────────────────────
      // Leads with score >= threshold, status = 'new', kanban_column = 'New'
      // These are ready for first contact.
      const { data: qualifiedRows, error: qualErr } = await supabaseAdmin
        .from("leads")
        .select("*")
        .gte("score", minScoreThreshold)
        .eq("status", "new")
        .eq("kanban_column", "New");

      if (qualErr) throw qualErr;

      const qualifiedLeads: Lead[] = (qualifiedRows || []).map(leadFromDB);

      // ── Step 2: Find leads needing follow-up ─────────────────────────────────
      // Leads where status = 'contacted' AND last_touched is older than 3 days.
      const followUpCutoff = new Date(
        Date.now() - lastTouchedThreshold * 86400000
      ).toISOString();

      const { data: followUpRows, error: followUpErr } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("status", "contacted")
        .lt("last_touched", followUpCutoff);

      if (followUpErr) throw followUpErr;

      const followUpLeads: Lead[] = (followUpRows || []).map(leadFromDB);

      // ── Step 3: Queue launch_sequence actions for qualified leads ────────────
      // Each qualified lead gets a medium-risk action that a human must approve.

      // Build a set of qualified lead IDs so we can deduplicate hot leads later.
      const queuedLeadIds = new Set<string>();

      for (const lead of qualifiedLeads) {
        queuedLeadIds.add(lead.id);
        actionsToQueue.push({
          type: "launch_sequence",
          description: `Launch outreach sequence for ${lead.name} at ${lead.company} (score: ${lead.score})`,
          payload: {
            leadId: lead.id,
            leadName: lead.name,
            leadCompany: lead.company,
            score: lead.score,
            bestTemplates: bestTemplateIds,
          },
          riskLevel: "medium",
        });
      }

      // ── Step 4: Find hot leads without activity ──────────────────────────────
      // Leads with score >= 80 and still in 'new' status — high priority.
      const { data: hotRows, error: hotErr } = await supabaseAdmin
        .from("leads")
        .select("*")
        .gte("score", hotScoreThreshold)
        .eq("status", "new")
        .eq("kanban_column", "New");

      if (hotErr) throw hotErr;

      const rawHotLeads: Lead[] = (hotRows || []).map(leadFromDB);

      // Queue hot lead actions, skipping any already queued from step 3.
      // Since hot leads (score >= 80) are a subset of qualified (score >= 60),
      // this prevents duplicates while emitting the priority label.
      for (const lead of rawHotLeads) {
        if (queuedLeadIds.has(lead.id)) continue;
        queuedLeadIds.add(lead.id);
        actionsToQueue.push({
          type: "launch_sequence",
          description: `PRIORITY: Launch outreach sequence for hot lead ${lead.name} at ${lead.company} (score: ${lead.score})`,
          payload: {
            leadId: lead.id,
            leadName: lead.name,
            leadCompany: lead.company,
            score: lead.score,
            priority: "hot",
            bestTemplates: bestTemplateIds,
          },
          riskLevel: "medium",
        });
      }

      // ── Step 5: Queue follow-up actions ──────────────────────────────────────
      for (const lead of followUpLeads) {
        actionsToQueue.push({
          type: "follow_up",
          description: `${lead.name} at ${lead.company} needs follow-up — last contacted ${lead.lastTouched ? new Date(lead.lastTouched).toLocaleDateString() : "unknown"}`,
          payload: {
            leadId: lead.id,
            leadName: lead.name,
            leadCompany: lead.company,
            lastTouched: lead.lastTouched,
            status: lead.status,
          },
          riskLevel: "medium",
        });
      }

      // ── Step 6: Count messages sent yesterday ────────────────────────────────
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

      const { count: sentYesterday, error: msgErr } = await supabaseAdmin
        .from("sequence_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", oneDayAgo);

      if (msgErr) throw msgErr;

      // Also count from the `messages` table (manual sends)
      const { count: manualYesterday, error: manualMsgErr } = await supabaseAdmin
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);

      if (manualMsgErr) throw manualMsgErr;

      // ── Write findings to knowledge store ────────────────────────────────────
      try { await writeKnowledge("qualified_lead_count", qualifiedLeads.length, "outreach-agent"); } catch { /* ignore */ }
      try { await writeKnowledge("follow_up_count", followUpLeads.length, "outreach-agent"); } catch { /* ignore */ }
      try { await writeKnowledge("follow_up_window_days", lastTouchedThreshold, "outreach-agent"); } catch { /* ignore */ }

      // ── Step 7: LinkedIn connection candidates ────────────────────────────────
      // Find qualified leads with a LinkedIn URL not yet in the queue.
      // Build a batched action so the user approves the whole set at once.
      const linkedinCandidates: Array<{
        leadId: string;
        leadName: string;
        company: string;
        profileUrl: string;
        score: number;
      }> = [];

      for (const lead of qualifiedLeads) {
        if (!lead.linkedin) continue;
        const alreadyQueued = await isAlreadyQueued(lead.id, "connection_request").catch(() => false);
        if (alreadyQueued) continue;
        linkedinCandidates.push({
          leadId: lead.id,
          leadName: lead.name,
          company: lead.company,
          profileUrl: lead.linkedin,
          score: lead.score,
        });
        if (linkedinCandidates.length >= 10) break; // cap at 10/day
      }

      if (linkedinCandidates.length > 0) {
        const names = linkedinCandidates
          .slice(0, 3)
          .map(c => `${c.leadName} — ${c.company} (score ${c.score})`)
          .join(", ");
        const suffix = linkedinCandidates.length > 3 ? ` +${linkedinCandidates.length - 3} more` : "";
        actionsToQueue.push({
          type: "queue_linkedin_connections",
          description: `Queue ${linkedinCandidates.length} LinkedIn connection requests: ${names}${suffix}`,
          payload: { candidates: linkedinCandidates },
          riskLevel: "medium",
        });
      }

      // Write linkedin stats to knowledge store
      try {
        await writeKnowledge("outreach.linkedin_candidates_today", linkedinCandidates.length, "outreach-agent");
      } catch { /* ignore */ }

      // ── Build summary ────────────────────────────────────────────────────────
      const qualifiedCount = qualifiedLeads.length;
      const followUpCount = followUpLeads.length;
      const hotCount = rawHotLeads.length;
      const totalSentYesterday = (sentYesterday ?? 0) + (manualYesterday ?? 0);

      return {
        outcome: "success",
        log: `Found ${qualifiedCount} qualified leads ready for outreach, ${followUpCount} need follow-up, ${hotCount} hot leads with no activity. ${totalSentYesterday} messages sent yesterday (${sentYesterday ?? 0} via sequences, ${manualYesterday ?? 0} manual).`,
        safeActionsExecuted,
        actionsToQueue,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        outcome: "failed",
        log: `Outreach Agent failed: ${message}`,
        safeActionsExecuted,
        actionsToQueue,
      };
    }
  }
}
