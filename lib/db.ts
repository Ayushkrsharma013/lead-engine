import { supabaseAdmin } from "./supabase";
const supabase = supabaseAdmin;
import { sanitizeLead } from "./storage";
import type {
  Lead, Message, Sequence, Campaign, Client,
  ActivityLogEntry, MergeResult, Stats,
  SequenceExecution, SequenceMessage,
} from "./types";

// ─── Transform helpers (snake_case ↔ camelCase) ────────────────────────────────

type LeadRow = Record<string, unknown>;

export function leadFromDB(row: LeadRow): Lead {
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
    status: (["new","contacted","replied","hot","meeting","won","lost"].includes(String(row.status || "")) ? String(row.status) : undefined) as Lead["status"],
    notes: row.notes ? String(row.notes) : undefined,
    lastTouched: row.last_touched ? String(row.last_touched) : undefined,
  };
}

function leadToDB(lead: Lead): Record<string, unknown> {
  return {
    id: lead.id,
    name: lead.name,
    title: lead.title,
    company: lead.company,
    industry: lead.industry,
    location: lead.location,
    email: lead.email,
    email_status: lead.emailStatus,
    linkedin: lead.linkedin,
    website: lead.website,
    company_size: lead.companySize,
    score: lead.score,
    source: lead.source,
    tags: lead.tags || [],
    kanban_column: lead.kanbanColumn || "New",
    status: lead.status || null,
    notes: lead.notes || null,
    last_touched: lead.lastTouched || new Date().toISOString(),
    saved_at: lead.savedAt || new Date().toISOString(),
    fetched_at: lead.fetchedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function messageFromDB(row: Record<string, unknown>): Message {
  return {
    id: String(row.id || ""),
    leadId: String(row.lead_id || ""),
    subject: String(row.subject || ""),
    body: String(row.body || ""),
    tone: String(row.tone || ""),
    messageType: String(row.message_type || "cold_email") as Message["messageType"],
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function sequenceFromDB(row: Record<string, unknown>): Sequence {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    steps: Array.isArray(row.steps) ? row.steps as Sequence["steps"] : [],
    assignedLeadIds: Array.isArray(row.assigned_lead_ids) ? row.assigned_lead_ids.map(String) : [],
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function campaignFromDB(row: Record<string, unknown>): Campaign {
  const status = String(row.status || "active");
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    targetIndustry: String(row.target_industry || ""),
    status: (["active", "paused", "complete"].includes(status)
      ? status : "active") as Campaign["status"],
    leadIds: Array.isArray(row.lead_ids) ? row.lead_ids.map(String) : [],
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function clientFromDB(row: Record<string, unknown>): Client {
  return {
    id: String(row.id || ""),
    userId: row.user_id ? String(row.user_id) : undefined,
    name: String(row.name || ""),
    company: String(row.company || ""),
    industry: String(row.industry || ""),
    monthlyRetainer: Number(row.monthly_retainer ?? 0),
    status: String(row.status || "active") as Client["status"],
    email: row.email ? String(row.email) : undefined,
    portalUsername: row.portal_username ? String(row.portal_username) : undefined,
    portalPassword: row.portal_password ? String(row.portal_password) : undefined,
    plan: (row.plan ? String(row.plan) : undefined) as Client["plan"],
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function activityFromDB(row: Record<string, unknown>): ActivityLogEntry {
  return {
    id: String(row.id || ""),
    type: String(row.type || "notification") as ActivityLogEntry["type"],
    text: String(row.text || ""),
    leadId: row.lead_id ? String(row.lead_id) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function sequenceExecutionFromDB(row: Record<string, unknown>): SequenceExecution {
  return {
    id: String(row.id || ""),
    sequenceId: String(row.sequence_id || ""),
    leadId: String(row.lead_id || ""),
    currentStep: Number(row.current_step ?? 0),
    status: String(row.status || "active") as SequenceExecution["status"],
    variant: String(row.variant || "A"),
    startedAt: row.started_at ? String(row.started_at) : new Date().toISOString(),
    lastActionAt: row.last_action_at ? String(row.last_action_at) : new Date().toISOString(),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function sequenceMessageFromDB(row: Record<string, unknown>): SequenceMessage {
  return {
    id: String(row.id || ""),
    executionId: String(row.execution_id || ""),
    leadId: String(row.lead_id || ""),
    stepIndex: Number(row.step_index ?? 0),
    channel: String(row.channel || "email") as SequenceMessage["channel"],
    subject: String(row.subject || ""),
    body: String(row.body || ""),
    status: String(row.status || "sent") as SequenceMessage["status"],
    resendId: row.resend_id ? String(row.resend_id) : undefined,
    variant: row.variant ? String(row.variant) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

// ─── Leads ──────────────────────────────────────────────────────────────────────

export async function fetchLeadsFromDB(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(leadFromDB);
}

export async function mergeLeadsInDB(incoming: Lead[]): Promise<MergeResult> {
  const existing = await fetchLeadsFromDB();
  let added = 0, updated = 0, rejected = 0;
  const now = new Date().toISOString();
  const toUpsert: Lead[] = [];
  const all = [...existing];

  for (const rawLead of incoming) {
    if (!rawLead || typeof rawLead !== "object") { rejected++; continue; }
    const lead = sanitizeLead(rawLead as unknown as Record<string, unknown>);
    const withTs: Lead = { ...lead, fetchedAt: now, savedAt: lead.savedAt || now };

    const dupIdx = all.findIndex(e => {
      if (e.id === withTs.id) return true;
      if (withTs.email && e.email && e.email === withTs.email) return true;
      if (withTs.linkedin && e.linkedin && e.linkedin === withTs.linkedin) return true;
      // Fallback: match by name + company when both email and linkedin are empty
      if (!withTs.email && !withTs.linkedin && !e.email && !e.linkedin) {
        const sameName = withTs.name && e.name && e.name.toLowerCase() === withTs.name.toLowerCase();
        const sameCompany = withTs.company && e.company && e.company.toLowerCase() === withTs.company.toLowerCase();
        if (sameName && sameCompany) return true;
      }
      return false;
    });

    if (dupIdx >= 0) {
      all[dupIdx] = { ...all[dupIdx], ...withTs, id: all[dupIdx].id, savedAt: all[dupIdx].savedAt };
      toUpsert.push(all[dupIdx]);
      updated++;
    } else {
      all.push(withTs);
      toUpsert.push(withTs);
      added++;
    }
  }

  // Only upsert leads that changed, not the entire table
  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("leads")
      .upsert(toUpsert.map(leadToDB), { onConflict: "id" });
    if (error) throw error;
  }

  const stored = await fetchLeadsFromDB();
  return { stored, added, updated, rejected };
}

export async function deleteLeadsFromDB(ids: string[]): Promise<Lead[]> {
  const { error } = await supabase.from("leads").delete().in("id", ids);
  if (error) throw error;
  return fetchLeadsFromDB();
}

export async function batchUpdateLeadStatus(ids: string[], status: Lead["status"]): Promise<Lead[]> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leads")
    .update({ status, last_touched: now, updated_at: now })
    .in("id", ids);
  if (error) throw error;
  return fetchLeadsFromDB();
}

export async function computeStatsFromLeads(leads: Lead[]): Promise<Stats> {
  const withEmail = leads.filter(l => l.emailStatus === "verified").length;
  const avgScore = leads.length
    ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length)
    : 0;
  const industryCounts: Record<string, number> = {};
  for (const l of leads) {
    if (l.industry) industryCounts[l.industry] = (industryCounts[l.industry] || 0) + 1;
  }
  const topIndustry = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return { total: leads.length, withEmail, avgScore, topIndustry };
}

// ─── Messages ───────────────────────────────────────────────────────────────────

export async function getMessages(leadId?: string): Promise<Message[]> {
  let q = supabase.from("messages").select("*").order("created_at", { ascending: false });
  if (leadId) q = q.eq("lead_id", leadId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(messageFromDB);
}

export async function addMessage(msg: Omit<Message, "id" | "createdAt">): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      lead_id: msg.leadId,
      subject: msg.subject,
      body: msg.body,
      tone: msg.tone,
      message_type: msg.messageType,
    })
    .select()
    .single();
  if (error) throw error;
  return messageFromDB(data as unknown as Record<string, unknown>);
}

// ─── Sequences ──────────────────────────────────────────────────────────────────

export async function getSequences(): Promise<Sequence[]> {
  const { data, error } = await supabase
    .from("sequences")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(sequenceFromDB);
}

export async function saveSequence(seq: Omit<Sequence, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Sequence> {
  const row = {
    ...(seq.id ? { id: seq.id } : {}),
    name: seq.name,
    steps: seq.steps,
    assigned_lead_ids: seq.assignedLeadIds,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("sequences")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return sequenceFromDB(data as unknown as Record<string, unknown>);
}

export async function deleteSequence(id: string): Promise<void> {
  const { error } = await supabase.from("sequences").delete().eq("id", id);
  if (error) throw error;
}

// ─── Campaigns ──────────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(campaignFromDB);
}

export async function saveCampaign(c: Omit<Campaign, "id" | "createdAt"> & { id?: string }): Promise<Campaign> {
  const row = {
    ...(c.id ? { id: c.id } : {}),
    name: c.name,
    target_industry: c.targetIndustry,
    status: c.status,
    lead_ids: c.leadIds,
  };
  const { data, error } = await supabase
    .from("campaigns")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return campaignFromDB(data as unknown as Record<string, unknown>);
}

// ─── Clients ────────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(clientFromDB);
}

export async function saveClient(c: Omit<Client, "id" | "createdAt"> & { id?: string }): Promise<Client> {
  const row: Record<string, unknown> = {
    ...(c.id ? { id: c.id } : {}),
    name: c.name,
    company: c.company,
    industry: c.industry,
    monthly_retainer: c.monthlyRetainer,
    status: c.status,
  };
  if (c.email !== undefined) row.email = c.email;
  if (c.portalUsername !== undefined) row.portal_username = c.portalUsername;
  if (c.portalPassword !== undefined) row.portal_password = c.portalPassword;
  if (c.plan !== undefined) row.plan = c.plan;
  const { data, error } = await supabase
    .from("clients")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return clientFromDB(data as unknown as Record<string, unknown>);
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.company !== undefined) row.company = updates.company;
  if (updates.industry !== undefined) row.industry = updates.industry;
  if (updates.monthlyRetainer !== undefined) row.monthly_retainer = updates.monthlyRetainer;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.portalUsername !== undefined) row.portal_username = updates.portalUsername;
  if (updates.portalPassword !== undefined) row.portal_password = updates.portalPassword;
  if (updates.plan !== undefined) row.plan = updates.plan;
  const { data, error } = await supabase
    .from("clients")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return clientFromDB(data as unknown as Record<string, unknown>);
}

// ─── Activity Log ───────────────────────────────────────────────────────────────

export async function getActivityLog(limit = 20): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(activityFromDB);
}

export async function logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">): Promise<void> {
  const { error } = await supabase
    .from("activity_log")
    .insert({
      type: entry.type,
      text: entry.text,
      lead_id: entry.leadId || null,
    });
  if (error) throw error;
}

// ─── Sequence Executions ──────────────────────────────────────────────────────

export async function getSequenceExecutions(sequenceId?: string): Promise<SequenceExecution[]> {
  let q = supabase.from("sequence_executions").select("*").order("created_at", { ascending: false });
  if (sequenceId) q = q.eq("sequence_id", sequenceId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(sequenceExecutionFromDB);
}

export async function getDueExecutions(): Promise<SequenceExecution[]> {
  const { data, error } = await supabase
    .from("sequence_executions")
    .select("*")
    .eq("status", "active")
    .order("last_action_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(sequenceExecutionFromDB);
}

export async function createSequenceExecutions(
  rows: Array<{
    sequence_id: string;
    lead_id: string;
    status: string;
    user_id?: string;
  }>
): Promise<SequenceExecution[]> {
  const { data, error } = await supabase
    .from("sequence_executions")
    .insert(rows)
    .select();
  if (error) throw error;
  return (data || []).map(sequenceExecutionFromDB);
}

export async function updateSequenceExecution(
  id: string,
  updates: { current_step?: number; status?: string; last_action_at?: string }
): Promise<SequenceExecution> {
  const { data, error } = await supabase
    .from("sequence_executions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return sequenceExecutionFromDB(data as unknown as Record<string, unknown>);
}

// ─── Sequence Messages ────────────────────────────────────────────────────────

export async function getSequenceMessages(executionId?: string): Promise<SequenceMessage[]> {
  let q = supabase.from("sequence_messages").select("*").order("created_at", { ascending: false });
  if (executionId) q = q.eq("execution_id", executionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(sequenceMessageFromDB);
}

export async function insertSequenceMessage(
  msg: Omit<SequenceMessage, "id" | "createdAt">
): Promise<SequenceMessage> {
  const { data, error } = await supabase
    .from("sequence_messages")
    .insert({
      execution_id: msg.executionId,
      lead_id: msg.leadId,
      step_index: msg.stepIndex,
      channel: msg.channel,
      subject: msg.subject,
      body: msg.body,
      status: msg.status,
      resend_id: msg.resendId,
      variant: msg.variant,
    })
    .select()
    .single();
  if (error) throw error;
  return sequenceMessageFromDB(data as unknown as Record<string, unknown>);
}

export async function hasRecentMessages(minutesAgo: number = 4): Promise<boolean> {
  const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("sequence_messages")
    .select("*", { count: "exact", head: true })
    .gt("created_at", cutoff);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function batchUpdateLeadKanban(leadIds: string[], column: string, status: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leads")
    .update({ kanban_column: column, status: status, last_touched: now, updated_at: now })
    .in("id", leadIds);
  if (error) throw error;
}

export async function findLeadByEmail(email: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error || !data) return null;
  return leadFromDB(data);
}

export async function findSequenceMessageByResendId(resendId: string): Promise<SequenceMessage | null> {
  const { data, error } = await supabase
    .from("sequence_messages")
    .select("*")
    .eq("resend_id", resendId)
    .maybeSingle();
  if (error || !data) return null;
  return sequenceMessageFromDB(data as unknown as Record<string, unknown>);
}

export async function updateSequenceMessageStatus(
  id: string,
  status: SequenceMessage["status"]
): Promise<void> {
  const { error } = await supabase
    .from("sequence_messages")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export interface VariantStat {
  variant: string;
  sent: number;
  replied: number;
  replyRate: number;
}

export async function getVariantStats(sequenceId: string): Promise<VariantStat[]> {
  const { data, error } = await supabase
    .from("sequence_messages")
    .select("variant, status")
    .not("variant", "is", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const groups: Record<string, { sent: number; replied: number }> = {};
  for (const row of data as Array<{ variant: string; status: string }>) {
    const v = row.variant || "unknown";
    if (!groups[v]) groups[v] = { sent: 0, replied: 0 };
    groups[v].sent++;
    if (row.status === "replied") groups[v].replied++;
  }

  return Object.entries(groups).map(([variant, counts]) => ({
    variant,
    sent: counts.sent,
    replied: counts.replied,
    replyRate: counts.sent > 0 ? Math.round((counts.replied / counts.sent) * 100) : 0,
  }));
}
