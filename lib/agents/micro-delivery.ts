// lib/agents/micro-delivery.ts
// Watches the $997 micro-offer fulfillment SLA: 50 leads within 5 business days.
// Flags overdue activations so a human can intervene before churn.

import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";

const MICRO_LEAD_QUOTA = 50;
const MICRO_BUSINESS_DAYS_SLA = 4; // alert at day-4 to give 1 day buffer before day-5 deadline

/** Subtract N business days (skip Sat=6, Sun=0) and return ISO timestamp. */
function businessDaysAgo(days: number): string {
  const d = new Date();
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d.toISOString();
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "[no-email]";
  const at = email.indexOf("@");
  if (at < 2) return "[masked]";
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}

interface OverdueRow {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_activated_at: string | null;
  delivered: number;
}

export async function processOverdueMicroDeliveries(): Promise<{
  flagged: OverdueRow[];
  log: string;
}> {
  const cutoffIso = businessDaysAgo(MICRO_BUSINESS_DAYS_SLA);

  // 1) All active micro-plan profiles activated >= 4 business days ago
  const { data: candidates, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, subscription_activated_at, plan, subscription_status")
    .eq("plan", "micro")
    .eq("subscription_status", "active")
    .not("subscription_activated_at", "is", null)
    .lte("subscription_activated_at", cutoffIso);

  if (error) {
    return {
      flagged: [],
      log: `query failed: ${error.message}`,
    };
  }

  if (!candidates || candidates.length === 0) {
    return { flagged: [], log: "No micro-plan profiles past SLA window." };
  }

  // 2) Per profile: count delivered leads (user_id-scoped)
  const flagged: OverdueRow[] = [];
  for (const p of candidates) {
    const userId = p.id as string;
    const { count, error: countError } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) continue;
    const delivered = count ?? 0;
    if (delivered < MICRO_LEAD_QUOTA) {
      flagged.push({
        id: userId,
        email: (p.email as string | null) ?? null,
        full_name: (p.full_name as string | null) ?? null,
        subscription_activated_at:
          (p.subscription_activated_at as string | null) ?? null,
        delivered,
      });
    }
  }

  return {
    flagged,
    log: `${candidates.length} micro profiles past SLA window, ${flagged.length} under quota.`,
  };
}

export class MicroDeliveryAgent implements AgentModule {
  name = "micro-delivery";
  displayName = "Micro Delivery Watcher";
  description = "Alerts on overdue $997 micro-offer fulfillment (50 leads in 5 business days)";

  async run(_config: Record<string, unknown>): Promise<AgentResult> {
    const actionsToQueue: AgentAction[] = [];
    let safeActionsExecuted = 0;

    try {
      const { flagged, log } = await processOverdueMicroDeliveries();

      for (const row of flagged) {
        const boughtIso = row.subscription_activated_at;
        const boughtDate = boughtIso
          ? new Date(boughtIso).toISOString().slice(0, 10)
          : "unknown";
        const masked = maskEmail(row.email);
        const description = `OVERDUE MICRO DELIVERY — ${masked} bought ${boughtDate}, ${row.delivered}/${MICRO_LEAD_QUOTA} leads delivered. Manual intervention required.`;

        actionsToQueue.push({
          type: "micro_delivery_overdue",
          description,
          payload: {
            profileId: row.id,
            email: row.email,
            fullName: row.full_name,
            activatedAt: boughtIso,
            delivered: row.delivered,
            quota: MICRO_LEAD_QUOTA,
          },
          riskLevel: "medium",
        });
      }

      safeActionsExecuted = 0;

      return {
        outcome: "success",
        log: `${log} ${flagged.length} overdue alerts queued.`,
        safeActionsExecuted,
        actionsToQueue,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        outcome: "failed",
        log: `Micro Delivery Watcher failed: ${message}`,
        safeActionsExecuted,
        actionsToQueue,
      };
    }
  }
}
