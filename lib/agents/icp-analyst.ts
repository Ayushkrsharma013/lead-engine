// lib/agents/icp-analyst.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";
import { writeKnowledge } from "./knowledge";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

/** Group leads by a key extractor and return {key, total, converted, rate}. */
function groupConversion(
  leads: Array<{ status?: string; [k: string]: unknown }>,
  extractKey: (l: Record<string, unknown>) => string
): Array<{ key: string; total: number; converted: number; rate: number }> {
  const map = new Map<string, { total: number; converted: number }>();

  for (const raw of leads) {
    const key = extractKey(raw as Record<string, unknown>);
    if (!key) continue;
    const entry = map.get(key) ?? { total: 0, converted: 0 };
    entry.total++;
    const status = String(raw.status ?? "");
    if (status === "meeting" || status === "won") {
      entry.converted++;
    }
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([key, v]) => ({ key, total: v.total, converted: v.converted, rate: pct(v.converted, v.total) }))
    .sort((a, b) => b.total - a.total);
}

export class IcpAnalystAgent implements AgentModule {
  name = "icp-analyst";
  displayName = "ICP Analyst";
  description = "Score calibration and ICP pattern detection";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const actionsToQueue: AgentAction[] = [];
    let safeActionsExecuted = 0;
    const logLines: string[] = [];
    let outcome: "success" | "partial" = "success";

    try {
      // ── Fetch leads with outreach history (contacted → won) ────────────────
      const outreachStatuses = ["contacted", "replied", "meeting", "won"];
      const { data: outreachLeads, error: outreachError } = await supabaseAdmin
        .from("leads")
        .select("id, industry, company_size, source, status, score, saved_at")
        .in("status", outreachStatuses);

      if (outreachError) throw outreachError;

      const allContacted = outreachLeads ?? [];

      // ── 1. Conversion stats by industry ─────────────────────────────────────
      const byIndustry = groupConversion(allContacted, (l) =>
        String(l.industry ?? "").trim()
      );

      const topIndustry = byIndustry.length > 0 ? byIndustry[0] : null;
      const lowPerforming = byIndustry.filter((g) => g.rate < 5 && g.total >= 3);
      const highPerforming = byIndustry.filter((g) => g.rate > 30 && g.total >= 3);

      // ── 2. Conversion stats by company_size ─────────────────────────────────
      const byCompanySize = groupConversion(allContacted, (l) =>
        String(l.company_size ?? "").trim()
      );

      // ── 3. Conversion stats by source ───────────────────────────────────────
      const bySource = groupConversion(allContacted, (l) =>
        String(l.source ?? "").trim()
      );

      const bestSource = bySource.length > 0
        ? bySource.reduce((a, b) => (a.rate >= b.rate ? a : b))
        : null;

      // ── 4. Suggest ICP adjustments — deprioritize low performers ─────────────
      for (const group of lowPerforming) {
        actionsToQueue.push({
          type: "deprioritize_industry",
          description: `Consider deprioritizing ${group.key} — ${group.rate}% conversion (${group.converted}/${group.total})`,
          payload: {
            industry: group.key,
            conversionRate: group.rate,
            total: group.total,
            converted: group.converted,
          },
          riskLevel: "medium",
        });
      }

      // ── 5. Suggest ICP adjustments — safe-notify high performers ─────────────
      for (const group of highPerforming) {
        actionsToQueue.push({
          type: "high_performing_industry",
          description: `High-performing industry: ${group.key} at ${group.rate}% conversion — increase lead volume here`,
          payload: {
            industry: group.key,
            conversionRate: group.rate,
            total: group.total,
            converted: group.converted,
          },
          riskLevel: "safe_notify",
        });
        safeActionsExecuted++;
      }

      // ── 6. Top 3 performing segments (industry + company_size combos) ───────
      const comboGroups = new Map<string, { total: number; converted: number }>();
      for (const lead of allContacted) {
        const industry = String(lead.industry ?? "").trim();
        const size = String(lead.company_size ?? "").trim();
        if (!industry) continue;
        const key = size ? `${industry} + ${size}` : industry;
        const entry = comboGroups.get(key) ?? { total: 0, converted: 0 };
        entry.total++;
        if (lead.status === "meeting" || lead.status === "won") {
          entry.converted++;
        }
        comboGroups.set(key, entry);
      }

      const topSegments = Array.from(comboGroups.entries())
        .map(([key, v]) => ({ key, total: v.total, converted: v.converted, rate: pct(v.converted, v.total) }))
        .filter((s) => s.total >= 2)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 3);

      for (const seg of topSegments) {
        actionsToQueue.push({
          type: "top_performing_segment",
          description: `Top segment: ${seg.key} — ${seg.rate}% conversion (${seg.converted}/${seg.total})`,
          payload: {
            segment: seg.key,
            conversionRate: seg.rate,
            total: seg.total,
            converted: seg.converted,
          },
          riskLevel: "safe_notify",
        });
        safeActionsExecuted++;
      }

      // ── 7. Score threshold analysis ─────────────────────────────────────────
      const { data: scoredLeads, error: scoredError } = await supabaseAdmin
        .from("leads")
        .select("score, status")
        .not("score", "is", null)
        .neq("score", 0);

      if (scoredError) throw scoredError;

      const convertedScores: number[] = [];
      const nonConvertedScores: number[] = [];

      for (const lead of scoredLeads ?? []) {
        const score = Number(lead.score ?? 0);
        if (score <= 0) continue;
        const status = String(lead.status ?? "");
        if (status === "meeting" || status === "won") {
          convertedScores.push(score);
        } else if (outreachStatuses.includes(status)) {
          nonConvertedScores.push(score);
        }
      }

      const avgConverted =
        convertedScores.length > 0
          ? Math.round(convertedScores.reduce((a, b) => a + b, 0) / convertedScores.length)
          : 0;

      const avgNonConverted =
        nonConvertedScores.length > 0
          ? Math.round(nonConvertedScores.reduce((a, b) => a + b, 0) / nonConvertedScores.length)
          : 0;

      const gap = avgConverted - avgNonConverted;

      if (gap > 15 && avgConverted > 0) {
        actionsToQueue.push({
          type: "adjust_score_threshold",
          description: `Suggested min_score threshold: ${avgConverted} (current avg for converted: ${avgConverted}, non-converted: ${avgNonConverted}, gap: ${gap} points)`,
          payload: {
            suggestedThreshold: avgConverted,
            avgConvertedScore: avgConverted,
            avgNonConvertedScore: avgNonConverted,
            gap,
          },
          riskLevel: "medium",
        });
        safeActionsExecuted++;
      }

      // ── 8. Weekly summary stats ─────────────────────────────────────────────
      const sevenDaysAgo = daysAgo(7);
      const fourteenDaysAgo = daysAgo(14);

      // Leads added this week
      const { count: leadsThisWeek, error: weekErr } = await supabaseAdmin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("saved_at", sevenDaysAgo);

      if (weekErr) throw weekErr;

      // Leads added last week
      const { count: leadsLastWeek, error: lastWeekErr } = await supabaseAdmin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("saved_at", fourteenDaysAgo)
        .lt("saved_at", sevenDaysAgo);

      if (lastWeekErr) throw lastWeekErr;

      // Conversion rate this week (leads with outreach status created this week)
      const { data: thisWeekOutreach, error: twErr } = await supabaseAdmin
        .from("leads")
        .select("status")
        .in("status", outreachStatuses)
        .gte("updated_at", sevenDaysAgo);

      if (twErr) throw twErr;

      const thisWeekConverted = (thisWeekOutreach ?? []).filter(
        (l) => l.status === "meeting" || l.status === "won"
      ).length;
      const thisWeekTotal = thisWeekOutreach?.length ?? 0;
      const thisWeekRate = pct(thisWeekConverted, thisWeekTotal);

      // Conversion rate last week
      const { data: lastWeekOutreach, error: lwErr } = await supabaseAdmin
        .from("leads")
        .select("status")
        .in("status", outreachStatuses)
        .gte("updated_at", fourteenDaysAgo)
        .lt("updated_at", sevenDaysAgo);

      if (lwErr) throw lwErr;

      const lastWeekConverted = (lastWeekOutreach ?? []).filter(
        (l) => l.status === "meeting" || l.status === "won"
      ).length;
      const lastWeekTotal = lastWeekOutreach?.length ?? 0;
      const lastWeekRate = pct(lastWeekConverted, lastWeekTotal);

      // ── Build summary log ───────────────────────────────────────────────────
      const parts: string[] = [];
      if (topIndustry) {
        parts.push(`Top industry: ${topIndustry.key} (${topIndustry.rate}% conv)`);
      }
      if (bestSource) {
        parts.push(`Best source: ${bestSource.key} (${bestSource.rate}% conv)`);
      }
      if (gap > 0) {
        parts.push(`Suggested threshold: ${avgConverted} (gap ${gap}pts)`);
      }
      parts.push(`${leadsThisWeek ?? 0} leads this week`);
      parts.push(`Conversion this week: ${thisWeekRate}% vs last week: ${lastWeekRate}%`);
      parts.push(
        `Industry segments: ${byIndustry.length}, low performers: ${lowPerforming.length}, high performers: ${highPerforming.length}`
      );
      parts.push(`Top segments identified: ${topSegments.length}`);

      // ── Log conversion detail for the log string ────────────────────────────
      logLines.push(`Analyzed ${allContacted.length} contacted leads`);
      logLines.push(
        `By industry: ${byIndustry.map((g) => `${g.key}=${g.rate}%`).join(", ")}`
      );
      logLines.push(
        `By source: ${bySource.map((g) => `${g.key}=${g.rate}%`).join(", ")}`
      );
      logLines.push(
        `By company_size: ${byCompanySize.map((g) => `${g.key}=${g.rate}%`).join(", ")}`
      );
      logLines.push(
        `Converted avg score: ${avgConverted}, Non-converted avg score: ${avgNonConverted}, gap: ${gap}`
      );
      if (lowPerforming.length > 0) {
        logLines.push(
          `Queued ${lowPerforming.length} deprioritization suggestion(s): ${lowPerforming.map((g) => g.key).join(", ")}`
        );
      }
      if (highPerforming.length > 0) {
        logLines.push(
          `Notified ${highPerforming.length} high-performing industr(ies): ${highPerforming.map((g) => g.key).join(", ")}`
        );
      }
      if (topSegments.length > 0) {
        logLines.push(
          `Top segments: ${topSegments.map((s) => s.key).join(" | ")}`
        );
      }

      // ── 9. Write to knowledge store ──────────────────────────────────────────
      const highPerfIndustries = highPerforming.map((g) => g.key);
      const topSources = [...bySource].sort((a, b) => b.rate - a.rate).map((g) => g.key);

      try { await writeKnowledge("min_score_threshold", avgConverted, "icp-analyst"); } catch { /* ignore */ }
      try { await writeKnowledge("high_perf_industries", highPerfIndustries, "icp-analyst"); } catch { /* ignore */ }
      try { await writeKnowledge("top_lead_sources", topSources, "icp-analyst"); } catch { /* ignore */ }

      return {
        outcome: "success",
        log: `ICP analysis complete. ${parts.join(". ")}. ${logLines.join("; ")}`,
        safeActionsExecuted,
        actionsToQueue,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        outcome: "failed",
        log: `ICP Analyst failed: ${message}`,
        safeActionsExecuted,
        actionsToQueue,
      };
    }
  }
}
