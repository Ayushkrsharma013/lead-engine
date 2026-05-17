// lib/agents/data-janitor.ts
import { supabaseAdmin } from "../supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";
import { writeKnowledge } from "./knowledge";

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // "2026-05-17"
}

export class DataJanitorAgent implements AgentModule {
  name = "data-janitor";
  displayName = "Data Janitor";
  description = "Lead dedup, archival, and DB health maintenance";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const today = todayDateStr();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const sixtyDaysAgo = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000
    ).toISOString();

    const actionsToQueue: AgentAction[] = [];
    let safeCount = 0;
    const logLines: string[] = [];
    let outcome: "success" | "partial" = "success";
    const now = new Date().toISOString();
    const duplicateDomainSet = new Set<string>();

    // ── 1. Stale leads (last_touched > 30 days or NULL) ───────────────────────
    try {
      const { data: staleLeads, error: staleErr } = await supabaseAdmin
        .from("leads")
        .select("id, notes, last_touched")
        .or(`last_touched.lt.${thirtyDaysAgo},last_touched.is.null`);

      if (staleErr) throw staleErr;

      if (staleLeads && staleLeads.length > 0) {
        let flaggedCount = 0;
        for (const lead of staleLeads) {
          const existingNotes: string = lead.notes ?? "";
          const staleMarker = `[STALE ${today}] `;
          // Only add marker if not already flagged in this run
          if (!existingNotes.includes(staleMarker)) {
            const { error: updateErr } = await supabaseAdmin
              .from("leads")
              .update({ notes: staleMarker + existingNotes, updated_at: now })
              .eq("id", lead.id);
            if (updateErr) throw updateErr;
            flaggedCount++;
          }
        }
        safeCount += flaggedCount;
        logLines.push(`Flagged ${flaggedCount} stale lead(s)`);
      } else {
        logLines.push("No stale leads found");
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Stale-lead scan failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // ── 2. Duplicate leads (same email, email_status = 'verified') ────────────
    try {
      const { data: verifiedLeads, error: dupErr } = await supabaseAdmin
        .from("leads")
        .select("id, email, score, saved_at, notes, name, company")
        .eq("email_status", "verified")
        .not("email", "is", null);

      if (dupErr) throw dupErr;

      if (verifiedLeads && verifiedLeads.length > 0) {
        // Group by normalized (lowercased, trimmed) email
        const groups = new Map<
          string,
          Array<(typeof verifiedLeads)[number]>
        >();
        for (const lead of verifiedLeads) {
          const email = (lead.email as string).toLowerCase().trim();
          if (!email) continue;
          const existing = groups.get(email) ?? [];
          existing.push(lead);
          groups.set(email, existing);
        }

        let dupCount = 0;
        let groupCount = 0;

        for (const [email, group] of groups) {
          if (group.length <= 1) continue;
          groupCount++;
          const domain = email.split("@")[1];
          if (domain) duplicateDomainSet.add(domain);

          // Keep the one with highest score; tiebreak by most recent saved_at
          const keep = group.reduce((best, cur) => {
            const curScore = Number(cur.score ?? 0);
            const bestScore = Number(best.score ?? 0);
            if (curScore !== bestScore) {
              return curScore > bestScore ? cur : best;
            }
            const curSaved = cur.saved_at
              ? new Date(cur.saved_at).getTime()
              : 0;
            const bestSaved = best.saved_at
              ? new Date(best.saved_at).getTime()
              : 0;
            return curSaved > bestSaved ? cur : best;
          });

          // Mark the others with [DUP of <keep_id>]
          for (const dup of group) {
            if (dup.id === keep.id) continue;
            const existingNotes: string = dup.notes ?? "";
            const dupMarker = `[DUP of ${keep.id}]`;
            if (!existingNotes.includes(dupMarker)) {
              const { error: dupUpdateErr } = await supabaseAdmin
                .from("leads")
                .update({
                  notes: existingNotes
                    ? existingNotes + " " + dupMarker
                    : dupMarker,
                  updated_at: now,
                })
                .eq("id", dup.id);
              if (dupUpdateErr) throw dupUpdateErr;
            }
            dupCount++;
          }
        }

        if (dupCount > 0) {
          actionsToQueue.push({
            type: "resolve_duplicates",
            description: `Found ${dupCount} duplicate lead(s) across ${groupCount} email group(s). Check [DUP of ...] markers in notes and merge or delete as appropriate.`,
            payload: { count: dupCount, groupCount },
            riskLevel: "medium",
          });
          logLines.push(
            `Found ${dupCount} duplicate lead(s) across ${groupCount} group(s)`
          );
        } else {
          logLines.push("No duplicate leads found");
        }
      } else {
        logLines.push("No verified leads to scan for duplicates");
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Duplicate scan failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // ── 3. Invalid emails (not_found + untouched > 60 days) ───────────────────
    try {
      const { data: invalidLeads, error: invalidErr } = await supabaseAdmin
        .from("leads")
        .select("id, email, name, notes, last_touched")
        .eq("email_status", "not_found")
        .lt("last_touched", sixtyDaysAgo);

      if (invalidErr) throw invalidErr;

      if (invalidLeads && invalidLeads.length > 0) {
        const riskLevel: "medium" | "high" =
          invalidLeads.length > 10 ? "high" : "medium";
        const leadIds = invalidLeads.map((l) => String(l.id));

        actionsToQueue.push({
          type: "archive_invalid_emails",
          description: `Found ${invalidLeads.length} lead(s) with invalid emails untouched for 60+ days, queued for archive review.`,
          payload: { count: invalidLeads.length, leadIds },
          riskLevel,
        });
        logLines.push(
          `Queued ${invalidLeads.length} invalid-email lead(s) for archive review (${riskLevel} risk)`
        );
      } else {
        logLines.push("No invalid-email leads to archive");
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(
        `Invalid-email scan failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // ── 4. Score decay (active leads not touched in 7+ days, -5 pts/week) ───────
    let decayedCount = 0;
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: decayLeads, error: decayErr } = await supabaseAdmin
        .from("leads")
        .select("id, score, notes, last_touched")
        .gt("score", 0)
        .or(`last_touched.lt.${sevenDaysAgo},last_touched.is.null`);

      if (decayErr) throw decayErr;

      if (decayLeads && decayLeads.length > 0) {
        for (const lead of decayLeads) {
          const existingNotes: string = lead.notes ?? "";
          // Skip if already decayed in the last 7 days
          const decayMatch = existingNotes.match(/\[DECAY (\d{4}-\d{2}-\d{2})\]/);
          if (decayMatch) {
            const lastDecayDate = new Date(decayMatch[1]);
            const daysSinceDecay = (Date.now() - lastDecayDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceDecay < 7) continue;
          }

          const currentScore = Number(lead.score ?? 0);
          const newScore = Math.max(0, currentScore - 5);
          const decayMarker = `[DECAY ${today}]`;
          // Replace old DECAY marker or append new one
          const updatedNotes = existingNotes.includes("[DECAY ")
            ? existingNotes.replace(/\[DECAY \d{4}-\d{2}-\d{2}\]/, decayMarker)
            : existingNotes ? existingNotes + " " + decayMarker : decayMarker;

          const { error: updateErr } = await supabaseAdmin
            .from("leads")
            .update({ score: newScore, notes: updatedNotes, updated_at: now })
            .eq("id", lead.id);
          if (updateErr) throw updateErr;
          decayedCount++;
        }
        logLines.push(`Decayed score on ${decayedCount} inactive lead(s) (-5 pts each)`);
        safeCount += decayedCount;
      } else {
        logLines.push("No leads require score decay");
      }
    } catch (err) {
      outcome = "partial";
      logLines.push(`Score decay failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const duplicateDomains = Array.from(duplicateDomainSet);

    try { await writeKnowledge("stale_window_days", 30, "data-janitor"); } catch { /* ignore */ }
    try { await writeKnowledge("dup_email_domains", duplicateDomains, "data-janitor"); } catch { /* ignore */ }
    try { await writeKnowledge("janitor.decayed_count", decayedCount, "data-janitor"); } catch { /* ignore */ }

    return {
      outcome,
      log: logLines.join("; "),
      safeActionsExecuted: safeCount,
      actionsToQueue,
    };
  }
}
