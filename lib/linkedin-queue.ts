// lib/linkedin-queue.ts
import { supabaseAdmin } from "./supabase";

export interface LinkedInQueueItem {
  id: string;
  leadId: string;
  sequenceExecutionId?: string;
  actionType: "connection_request" | "dm" | "follow_up" | "profile_view";
  message?: string;
  linkedinProfileUrl: string;
  status: "pending" | "executing" | "done" | "failed" | "skipped";
  scheduledFor: string;
  executedAt?: string;
  error?: string;
  userId?: string;
  createdAt: string;
}

export interface LinkedInDailyStats {
  date: string;
  connectionsSent: number;
  dmsSent: number;
  profileViews: number;
  lastRunAt?: string;
}

export interface QueueStatus {
  pending: number;
  executing: number;
  done: number;
  failed: number;
  total: number;
}

export async function enqueueLinkedInAction(params: {
  leadId: string;
  linkedinProfileUrl: string;
  actionType: LinkedInQueueItem["actionType"];
  message?: string;
  scheduledFor?: Date;
  sequenceExecutionId?: string;
  userId?: string;
}): Promise<LinkedInQueueItem> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_queue")
    .insert({
      lead_id: params.leadId,
      linkedin_profile_url: params.linkedinProfileUrl,
      action_type: params.actionType,
      message: params.message ?? null,
      scheduled_for: (params.scheduledFor ?? new Date()).toISOString(),
      sequence_execution_id: params.sequenceExecutionId ?? null,
      user_id: params.userId ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToItem(data as Record<string, unknown>);
}

export async function getQueueStatus(): Promise<QueueStatus> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_queue")
    .select("status");

  if (error) throw error;

  const counts: QueueStatus = { pending: 0, executing: 0, done: 0, failed: 0, total: 0 };
  for (const row of (data ?? []) as { status: string }[]) {
    counts.total++;
    const s = row.status as keyof QueueStatus;
    if (s in counts) counts[s]++;
  }
  return counts;
}

export async function getPendingActions(limit = 20): Promise<LinkedInQueueItem[]> {
  const { data, error } = await supabaseAdmin
    .from("linkedin_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToItem);
}

export async function markActionExecuting(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "executing" })
    .eq("id", id);
  if (error) throw error;
}

export async function markActionDone(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "done", executed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markActionFailed(id: string, errorMsg: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "failed", error: errorMsg, executed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Reset actions stuck in "executing" for > 10 minutes (crashed runner recovery)
export async function resetStuckExecuting(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("linkedin_queue")
    .update({ status: "pending" })
    .eq("status", "executing")
    .lt("created_at", tenMinutesAgo);
}

export async function getTodayStats(): Promise<LinkedInDailyStats> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabaseAdmin
    .from("linkedin_daily_stats")
    .select("*")
    .eq("date", today)
    .maybeSingle();

  return data
    ? rowToStats(data as Record<string, unknown>)
    : { date: today, connectionsSent: 0, dmsSent: 0, profileViews: 0 };
}

export async function isAlreadyQueued(
  leadId: string,
  actionType: LinkedInQueueItem["actionType"]
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("linkedin_queue")
    .select("id")
    .eq("lead_id", leadId)
    .eq("action_type", actionType)
    .in("status", ["pending", "executing"])
    .limit(1);
  return ((data as unknown[]) ?? []).length > 0;
}

function rowToItem(row: Record<string, unknown>): LinkedInQueueItem {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    sequenceExecutionId: row.sequence_execution_id ? String(row.sequence_execution_id) : undefined,
    actionType: row.action_type as LinkedInQueueItem["actionType"],
    message: row.message ? String(row.message) : undefined,
    linkedinProfileUrl: String(row.linkedin_profile_url),
    status: row.status as LinkedInQueueItem["status"],
    scheduledFor: String(row.scheduled_for),
    executedAt: row.executed_at ? String(row.executed_at) : undefined,
    error: row.error ? String(row.error) : undefined,
    userId: row.user_id ? String(row.user_id) : undefined,
    createdAt: String(row.created_at),
  };
}

function rowToStats(row: Record<string, unknown>): LinkedInDailyStats {
  return {
    date: String(row.date),
    connectionsSent: Number(row.connections_sent ?? 0),
    dmsSent: Number(row.dms_sent ?? 0),
    profileViews: Number(row.profile_views ?? 0),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
  };
}
