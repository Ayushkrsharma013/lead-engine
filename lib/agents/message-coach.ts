// lib/agents/message-coach.ts

import type { AgentModule, AgentResult, AgentAction } from "./types";
import { supabaseAdmin } from "@/lib/supabase";

const supabase = supabaseAdmin;

interface VariantPerf {
  sequenceId: string;
  sequenceName: string;
  variant: string;
  sent: number;
  replied: number;
  replyRate: number;
}

export class MessageCoachAgent implements AgentModule {
  name = "message-coach";
  displayName = "Message Coach";
  description = "A/B winner detection and message refinement";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const actionsToQueue: AgentAction[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

    try {
      // ── 1. Fetch sequences for name resolution ────────────────────────────
      const { data: seqRows } = await supabase
        .from("sequences")
        .select("id, name");

      const sequenceNames = new Map<string, string>();
      for (const row of (seqRows || []) as Array<{ id: string; name: string }>) {
        sequenceNames.set(row.id, row.name);
      }

      // ── 2. Fetch all sequence_messages from the last 7 days ───────────────
      const { data: smRows, error: smErr } = await supabase
        .from("sequence_messages")
        .select("id, execution_id, variant, status, body, step_index, created_at")
        .gte("created_at", sevenDaysAgo);

      if (smErr) throw smErr;

      // ── 3. Map execution_id -> sequence_id ────────────────────────────────
      const execIdArray = (smRows || []).map((r: Record<string, unknown>) => String(r.execution_id));
      const execIds = Array.from(new Set(execIdArray));
      const execToSeq = new Map<string, string>();
      if (execIds.length > 0) {
        const { data: execRows } = await supabase
          .from("sequence_executions")
          .select("id, sequence_id")
          .in("id", execIds);

        for (const row of (execRows || []) as Array<{ id: string; sequence_id: string }>) {
          execToSeq.set(row.id, row.sequence_id);
        }
      }

      // ── 4. Aggregate variant stats and track step-level data ──────────────
      type StepKey = string; // "${seqId}::step${idx}"
      const variantBuckets = new Map<string, { sent: number; replied: number }>();
      const stepSendCounts = new Map<StepKey, { seqId: string; stepIndex: number; count: number }>();
      // All messages with resolved sequence_id for later lookups
      interface MsgRecord {
        id: string;
        sequenceId: string | undefined;
        stepIndex: number;
        status: string;
      }
      const msgsWithSeq: MsgRecord[] = [];

      for (const msg of (smRows || []) as Array<{
        id: string;
        execution_id: string;
        variant: string | null;
        status: string;
        body: string;
        step_index: number;
      }>) {
        const seqId = execToSeq.get(String(msg.execution_id));
        const variant = msg.variant || "A";
        const status = msg.status;

        msgsWithSeq.push({
          id: String(msg.id),
          sequenceId: seqId,
          stepIndex: Number(msg.step_index),
          status,
        });

        // Variant bucketing: only consider sent + replied (not failed/bounced/skipped)
        if (seqId && (status === "sent" || status === "replied")) {
          const key = `${seqId}::${variant}`;
          const bucket = variantBuckets.get(key) || { sent: 0, replied: 0 };
          bucket.sent++;
          if (status === "replied") bucket.replied++;
          variantBuckets.set(key, bucket);
        }

        // Step send tracking for stale template detection
        if (seqId && status === "sent") {
          const stepKey: StepKey = `${seqId}::step${msg.step_index}`;
          const entry = stepSendCounts.get(stepKey) || {
            seqId,
            stepIndex: Number(msg.step_index),
            count: 0,
          };
          entry.count++;
          stepSendCounts.set(stepKey, entry);
        }
      }

      // ── 5. Compute per-variant performance and identify best/worst ───────
      const variantPerfs: VariantPerf[] = [];

      for (const [key, bucket] of Array.from(variantBuckets.entries())) {
        const sepIdx = key.lastIndexOf("::");
        const seqId = key.slice(0, sepIdx);
        const variant = key.slice(sepIdx + 2);
        variantPerfs.push({
          sequenceId: seqId,
          sequenceName: sequenceNames.get(seqId) || "Unknown",
          variant,
          sent: bucket.sent,
          replied: bucket.replied,
          replyRate: bucket.sent > 0 ? Math.round((bucket.replied / bucket.sent) * 100) : 0,
        });
      }

      // Per-sequence best and worst variants
      const seqBest = new Map<string, VariantPerf>();
      const seqWorst = new Map<string, VariantPerf>();
      for (const vp of variantPerfs) {
        const best = seqBest.get(vp.sequenceId);
        if (!best || vp.replyRate > best.replyRate) seqBest.set(vp.sequenceId, vp);
        const worst = seqWorst.get(vp.sequenceId);
        if (!worst || vp.replyRate < worst.replyRate) seqWorst.set(vp.sequenceId, vp);
      }

      // ── 6. Queue variant improvement suggestions ─────────────────────────
      for (const vp of variantPerfs) {
        const best = seqBest.get(vp.sequenceId);
        if (!best) continue;

        // Low performer: < 5% reply rate with at least 3 sends (statistically meaningful)
        if (vp.replyRate < 5 && vp.sent >= 3) {
          actionsToQueue.push({
            type: "variant_improvement",
            description: `Sequence '${vp.sequenceName}' variant ${vp.variant} has ${vp.replyRate}% reply rate (${vp.sent} sent, ${vp.replied} replied). Consider replacing with top variant (${best.variant}, ${best.replyRate}% rate).`,
            payload: {
              sequenceId: vp.sequenceId,
              sequenceName: vp.sequenceName,
              variant: vp.variant,
              replyRate: vp.replyRate,
              sent: vp.sent,
              replied: vp.replied,
              bestVariant: best.variant,
              bestReplyRate: best.replyRate,
            },
            riskLevel: "medium",
          });
        }

        // High performer: > 20% reply rate — flag as reference
        if (vp.replyRate > 20 && vp.sent >= 5) {
          actionsToQueue.push({
            type: "high_performer_notice",
            description: `Sequence '${vp.sequenceName}' variant ${vp.variant} is a high performer at ${vp.replyRate}% reply rate (${vp.sent} sent, ${vp.replied} replied). Use as template for other sequences.`,
            payload: {
              sequenceId: vp.sequenceId,
              sequenceName: vp.sequenceName,
              variant: vp.variant,
              replyRate: vp.replyRate,
              sent: vp.sent,
              replied: vp.replied,
            },
            riskLevel: "safe_notify",
          });
        }
      }

      // ── 7. Overall message health (this week vs last week) ───────────────
      const thisWeekSent = msgsWithSeq.filter((m) => m.status === "sent").length;
      const thisWeekReplied = msgsWithSeq.filter((m) => m.status === "replied").length;
      const thisWeekRate =
        thisWeekSent > 0 ? Math.round((thisWeekReplied / thisWeekSent) * 100) : 0;

      // Last week data (days 14-7 ago)
      const { data: lastWeekRows } = await supabase
        .from("sequence_messages")
        .select("status")
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo);

      const lastWeekSent = ((lastWeekRows || []) as Array<{ status: string }>).filter(
        (r) => r.status === "sent",
      ).length;
      const lastWeekReplied = ((lastWeekRows || []) as Array<{ status: string }>).filter(
        (r) => r.status === "replied",
      ).length;
      const lastWeekRate =
        lastWeekSent > 0 ? Math.round((lastWeekReplied / lastWeekSent) * 100) : 0;

      const rateDiff = lastWeekRate > 0 ? thisWeekRate - lastWeekRate : 0;
      const diffStr =
        rateDiff >= 0 ? `up ${rateDiff}%` : `down ${Math.abs(rateDiff)}%`;

      // ── 8. Tone and message_type distribution (from messages table) ──────
      const { data: toneRows } = await supabase
        .from("messages")
        .select("tone")
        .gte("created_at", sevenDaysAgo);

      const toneCounts = new Map<string, number>();
      for (const row of (toneRows || []) as Array<{ tone: string }>) {
        const t = row.tone || "unknown";
        toneCounts.set(t, (toneCounts.get(t) || 0) + 1);
      }
      const sortedTones = Array.from(toneCounts.entries()).sort((a, b) => b[1] - a[1]);
      const bestTone = sortedTones[0] || null;

      const { data: typeRows } = await supabase
        .from("messages")
        .select("message_type")
        .gte("created_at", sevenDaysAgo);

      const typeCounts = new Map<string, number>();
      for (const row of (typeRows || []) as Array<{ message_type: string }>) {
        const mt = row.message_type || "cold_email";
        typeCounts.set(mt, (typeCounts.get(mt) || 0) + 1);
      }
      const sortedTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
      const bestType = sortedTypes[0] || null;

      // ── 9. Stale template detection ───────────────────────────────────────
      for (const [, entry] of Array.from(stepSendCounts.entries())) {
        if (entry.count >= 5) {
          const hasReplies = msgsWithSeq.some(
            (m) =>
              m.sequenceId === entry.seqId &&
              m.stepIndex === entry.stepIndex &&
              m.status === "replied",
          );
          if (!hasReplies) {
            const seqName = sequenceNames.get(entry.seqId) || "Unknown";
            actionsToQueue.push({
              type: "stale_template",
              description: `Template in '${seqName}' (step ${entry.stepIndex + 1}) has 0 replies after ${entry.count} sends — consider rewriting.`,
              payload: {
                sequenceId: entry.seqId,
                sequenceName: seqName,
                stepIndex: entry.stepIndex,
                sends: entry.count,
              },
              riskLevel: "medium",
            });
          }
        }
      }

      // ── 10. Build summary log ────────────────────────────────────────────
      const bestOverall =
        variantPerfs.length > 0
          ? [...variantPerfs].sort((a, b) => b.replyRate - a.replyRate)[0]
          : null;
      const worstOverall =
        variantPerfs.length > 0
          ? [...variantPerfs].sort((a, b) => a.replyRate - b.replyRate)[0]
          : null;

      let log = `Message analysis: ${thisWeekSent} sent this week, ${thisWeekRate}% reply rate`;
      if (lastWeekSent > 0) {
        log += ` (${diffStr} from last week, which was ${lastWeekSent} sent at ${lastWeekRate}%)`;
      }

      if (bestOverall && bestOverall.replyRate > 0) {
        log += `. Best variant: '${bestOverall.variant}' in '${bestOverall.sequenceName}' at ${bestOverall.replyRate}% (${bestOverall.replied}/${bestOverall.sent})`;
      }
      if (worstOverall && worstOverall.replyRate < 100 && worstOverall.sent >= 3) {
        log += `. Worst variant: '${worstOverall.variant}' in '${worstOverall.sequenceName}' at ${worstOverall.replyRate}% (${worstOverall.replied}/${worstOverall.sent})`;
      }
      if (bestTone) {
        log += `. Most used tone: '${bestTone[0]}' (${bestTone[1]} messages)`;
      }
      if (bestType) {
        log += `. Most used channel: '${bestType[0]}' (${bestType[1]} messages)`;
      }

      const staleCount = actionsToQueue.filter((a) => a.type === "stale_template").length;
      const variantImproveCount = actionsToQueue.filter(
        (a) => a.type === "variant_improvement",
      ).length;
      const highPerformerNoticeCount = actionsToQueue.filter(
        (a) => a.type === "high_performer_notice",
      ).length;

      log += `. ${variantImproveCount} improvement suggestions, ${staleCount} stale templates flagged`;

      if (highPerformerNoticeCount > 0) {
        log += `, ${highPerformerNoticeCount} high performers noted`;
      }

      return {
        outcome: "success",
        log,
        safeActionsExecuted: 0,
        actionsToQueue,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        outcome: "failed",
        log: `Message Coach error: ${errorMessage}`,
        safeActionsExecuted: 0,
        actionsToQueue: [],
      };
    }
  }
}
