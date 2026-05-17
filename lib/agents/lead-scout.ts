// lib/agents/lead-scout.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";
import { readKnowledge, readKnowledgeNumber, readKnowledgeList, writeKnowledge } from "./knowledge";

const HOT_LEAD_THRESHOLD = 80;

/** High-value industries that get a scoring bonus. */
const HIGH_VALUE_INDUSTRIES = new Set([
  "technology",
  "finance",
  "healthcare",
  "software",
  "fintech",
  "health",
  "tech",
  "banking",
  "insurance",
  "medical",
  "it",
  "information technology",
  "financial services",
  "biotech",
  "pharmaceuticals",
  "saas",
  "cybersecurity",
]);

/**
 * Compute a basic ICP score for a single lead row (snake_case DB columns).
 * Each criterion adds points; total is capped at 100.
 */
function computeIcpScore(
  lead: {
    email_status?: string;
    linkedin?: string;
    website?: string;
    company_size?: string;
    industry?: string;
    title?: string;
    source?: string;
  },
  topLeadSources: string[],
  highPerfIndustries: string[]
): number {
  let score = 0;

  // Has verified email: +20
  if (lead.email_status === "verified") score += 20;

  // Has LinkedIn URL: +15
  if (lead.linkedin && lead.linkedin.trim().length > 0) score += 15;

  // Has company website: +10
  if (lead.website && lead.website.trim().length > 0) score += 10;

  // Company size known (not empty): +10
  if (lead.company_size && lead.company_size.trim().length > 0) score += 10;

  // Industry is Technology/Finance/Healthcare or similar (from knowledge store or hardcoded): +10
  const industriesToCheck =
    highPerfIndustries.length > 0
      ? new Set(highPerfIndustries.map((i) => i.toLowerCase().trim()))
      : HIGH_VALUE_INDUSTRIES;
  if (
    lead.industry &&
    industriesToCheck.has(lead.industry.toLowerCase().trim())
  ) {
    score += 10;
  }

  // Source is in top-performing sources (from knowledge store): +5
  if (lead.source && topLeadSources.includes(lead.source.toLowerCase().trim())) {
    score += 5;
  }

  // Has title (not empty): +5
  if (lead.title && lead.title.trim().length > 0) score += 5;

  return Math.min(100, score);
}

export class LeadScoutAgent implements AgentModule {
  name = "lead-scout";
  displayName = "Lead Scout";
  description = "Daily Apify scrape, dedup, and ICP scoring";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const actionsToQueue: AgentAction[] = [];
    let safeActionsExecuted = 0;

    try {
      // ── Knowledge store reads (shared coordination) ────────────────────────
      const minScoreThreshold = await readKnowledgeNumber("min_score_threshold", 60).catch(() => 60);
      const topLeadSources = await readKnowledgeList("top_lead_sources").catch(() => []);
      const highPerfIndustries = await readKnowledgeList("high_perf_industries").catch(() => []);

      // ── Step 1: Score unscored leads ──────────────────────────────────────
      // Find leads where score is 0 or NULL
      const { data: unscoredLeads, error: unscoredError } = await supabaseAdmin
        .from("leads")
        .select(
          "id, email_status, linkedin, website, company_size, industry, title, name, company, source"
        )
        .or("score.eq.0,score.is.null");

      if (unscoredError) throw unscoredError;

      const scoreUpdates: Array<{ id: string; score: number }> = [];
      let totalScore = 0;

      for (const lead of unscoredLeads || []) {
        const score = computeIcpScore(lead, topLeadSources, highPerfIndustries);
        if (score > 0) {
          scoreUpdates.push({ id: lead.id, score });
          totalScore += score;
        }
      }

      // Batch-update scores in parallel
      if (scoreUpdates.length > 0) {
        const now = new Date().toISOString();
        await Promise.all(
          scoreUpdates.map((u) =>
            supabaseAdmin
              .from("leads")
              .update({ score: u.score, updated_at: now, last_touched: now })
              .eq("id", u.id)
          )
        );
        safeActionsExecuted += scoreUpdates.length;
      }

      const scoredCount = scoreUpdates.length;
      const avgScore =
        scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

      // ── Step 2: Detect hot leads ──────────────────────────────────────────
      const hotThreshold = await readKnowledgeNumber("hot_lead_threshold", 80).catch(() => 80);
      const { data: hotLeads, error: hotError } = await supabaseAdmin
        .from("leads")
        .select("id, name, company, score")
        .gte("score", hotThreshold)
        .eq("status", "new");

      if (hotError) throw hotError;

      for (const lead of hotLeads || []) {
        actionsToQueue.push({
          type: "hot_lead_detected",
          description: `Hot lead detected: ${lead.name} at ${lead.company} — score ${lead.score}. Ready for outreach.`,
          payload: {
            leadId: lead.id,
            name: lead.name,
            company: lead.company,
            score: lead.score,
          },
          riskLevel: "medium",
        });
      }

      // ── Step 3: Classify new leads ────────────────────────────────────────
      const { data: unclassifiedLeads, error: unclassifiedError } =
        await supabaseAdmin
          .from("leads")
          .select("id")
          .is("status", null);

      if (unclassifiedError) throw unclassifiedError;

      if (unclassifiedLeads && unclassifiedLeads.length > 0) {
        const ids = unclassifiedLeads.map((l) => l.id);
        const now = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin
          .from("leads")
          .update({
            status: "new",
            kanban_column: "New",
            last_touched: now,
            updated_at: now,
          })
          .in("id", ids);

        if (updateError) throw updateError;
        safeActionsExecuted += ids.length;
      }

      const classifiedCount = unclassifiedLeads?.length || 0;

      // ── Step 4: Daily summary stats ───────────────────────────────────────
      const { count: totalLeads, error: totalError } = await supabaseAdmin
        .from("leads")
        .select("*", { count: "exact", head: true });

      if (totalError) throw totalError;

      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const { count: newToday, error: newTodayError } = await supabaseAdmin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gt("saved_at", oneDayAgo);

      if (newTodayError) throw newTodayError;

      const { count: hotCount, error: hotCountError } = await supabaseAdmin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("score", hotThreshold);

      if (hotCountError) throw hotCountError;

      const { count: needsAttention, error: needsAttentionError } =
        await supabaseAdmin
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("status", "new")
          .gt("score", minScoreThreshold);

      if (needsAttentionError) throw needsAttentionError;

      // ── Build summary log ─────────────────────────────────────────────────
      const parts: string[] = [];
      parts.push(
        `Scored ${scoredCount} leads${scoredCount > 0 ? ` (avg score ${avgScore})` : ""}`
      );
      parts.push(`found ${hotLeads?.length || 0} hot leads`);
      parts.push(`classified ${classifiedCount} new leads`);
      parts.push(
        `Pipeline: ${totalLeads ?? 0} total, ${newToday ?? 0} added today, ${hotCount ?? 0} hot, ${needsAttention ?? 0} needing attention.`
      );

      // ── Knowledge store writes (shared coordination) ─────────────────────
      await writeKnowledge("hot_lead_threshold", hotThreshold, "lead-scout").catch(() => {});
      await writeKnowledge("new_leads_today", newToday, "lead-scout").catch(() => {});
      await writeKnowledge("total_hot_leads", hotLeads?.length ?? 0, "lead-scout").catch(() => {});

      return {
        outcome: "success",
        log: parts.join(", "),
        safeActionsExecuted,
        actionsToQueue,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        outcome: "failed",
        log: `Lead Scout failed: ${message}`,
        safeActionsExecuted,
        actionsToQueue,
      };
    }
  }
}
