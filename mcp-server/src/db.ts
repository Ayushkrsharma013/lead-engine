import { supabase } from "./supabase.js";
import type { Lead, Message, Sequence, Campaign, Client, ActivityLogEntry, Stats, MergeResult, FilterState } from "./types.js";
import { applyFilters } from "./filters.js";

// ─── camelCase ↔ snake_case transforms ─────────────────────────────────────────

function leadFromDB(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    industry: String(row.industry ?? ""),
    location: String(row.location ?? ""),
    email: String(row.email ?? ""),
    emailStatus: String(row.email_status ?? "not_found") as Lead["emailStatus"],
    linkedin: String(row.linkedin ?? ""),
    website: String(row.website ?? ""),
    companySize: String(row.company_size ?? ""),
    score: Number(row.score) || 0,
    source: String(row.source ?? "linkedin") as Lead["source"],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    kanbanColumn: String(row.kanban_column ?? "New"),
    status: (row.status as Lead["status"]) ?? undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    lastTouched: typeof row.last_touched === "string" ? row.last_touched : undefined,
    savedAt: typeof row.saved_at === "string" ? row.saved_at : undefined,
    fetchedAt: typeof row.fetched_at === "string" ? row.fetched_at : undefined,
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
    id: String(row.id ?? ""),
    leadId: String(row.lead_id ?? ""),
    subject: String(row.subject ?? ""),
    body: String(row.body ?? ""),
    tone: String(row.tone ?? ""),
    messageType: String(row.message_type ?? "cold_email") as Message["messageType"],
    charCount: typeof row.char_count === "number" ? row.char_count : undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function messageToDB(msg: Omit<Message, "id" | "createdAt">): Record<string, unknown> {
  return {
    lead_id: msg.leadId,
    subject: msg.subject,
    body: msg.body,
    tone: msg.tone,
    message_type: msg.messageType,
    char_count: msg.charCount,
  };
}

function sequenceFromDB(row: Record<string, unknown>): Sequence {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    steps: Array.isArray(row.steps) ? row.steps as Sequence["steps"] : [],
    assignedLeadIds: Array.isArray(row.assigned_lead_ids) ? row.assigned_lead_ids.map(String) : [],
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function campaignFromDB(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    targetIndustry: String(row.target_industry ?? ""),
    status: String(row.status ?? "active") as Campaign["status"],
    leadIds: Array.isArray(row.lead_ids) ? row.lead_ids.map(String) : [],
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function clientFromDB(row: Record<string, unknown>): Client {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    company: String(row.company ?? ""),
    industry: String(row.industry ?? ""),
    monthlyRetainer: Number(row.monthly_retainer) || 0,
    status: String(row.status ?? "active") as Client["status"],
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function activityFromDB(row: Record<string, unknown>): ActivityLogEntry {
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? "notification") as ActivityLogEntry["type"],
    text: String(row.text ?? ""),
    leadId: typeof row.lead_id === "string" ? row.lead_id : undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

// ─── inlined sanitizeLead (no localStorage/window deps) ────────────────────────

const EMAIL_STATUS_VALUES = new Set(["verified", "risky", "not_found"]);
const SOURCE_VALUES = new Set(["linkedin", "gmaps", "amazon"]);

function sanitizeLead(raw: Record<string, unknown>): Lead {
  const now = new Date().toISOString();
  return {
    id: String(raw.id || `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    name: String(raw.name || "").trim().slice(0, 200),
    title: String(raw.title || "").trim().slice(0, 200),
    company: String(raw.company || "").trim().slice(0, 200),
    industry: String(raw.industry || "").trim().slice(0, 100),
    location: String(raw.location || "").trim().slice(0, 200),
    email: String(raw.email || "").trim().toLowerCase().slice(0, 254),
    emailStatus: EMAIL_STATUS_VALUES.has(String(raw.emailStatus))
      ? (raw.emailStatus as Lead["emailStatus"])
      : "not_found",
    linkedin: String(raw.linkedin || "").trim().slice(0, 500),
    website: String(raw.website || "").trim().slice(0, 500),
    companySize: String(raw.companySize || "").trim().slice(0, 50),
    score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))),
    source: SOURCE_VALUES.has(String(raw.source)) ? (raw.source as Lead["source"]) : "linkedin",
    savedAt: typeof raw.savedAt === "string" && raw.savedAt ? raw.savedAt : now,
    fetchedAt: typeof raw.fetchedAt === "string" && raw.fetchedAt ? raw.fetchedAt : now,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 20) : [],
  };
}

// ─── Leads ─────────────────────────────────────────────────────────────────────

export async function fetchLeadsFromDB(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(leadFromDB);
}

export async function searchLeadsInDB(filters: FilterState): Promise<Lead[]> {
  const all = await fetchLeadsFromDB();
  return applyFilters(all, filters);
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

// ─── Messages ──────────────────────────────────────────────────────────────────

export async function getMessages(leadId?: string): Promise<Message[]> {
  let q = supabase.from("messages").select("*").order("created_at", { ascending: false });
  if (leadId) q = q.eq("lead_id", leadId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(messageFromDB);
}

export async function addMessage(msg: Omit<Message, "id" | "createdAt">): Promise<Message> {
  const row = { ...messageToDB(msg), id: crypto.randomUUID() };
  const { data, error } = await supabase.from("messages").insert(row).select().single();
  if (error) throw error;
  return messageFromDB(data as unknown as Record<string, unknown>);
}

// ─── Sequences ─────────────────────────────────────────────────────────────────

export async function getSequences(): Promise<Sequence[]> {
  const { data, error } = await supabase.from("sequences").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(sequenceFromDB);
}

export async function saveSequence(seq: Omit<Sequence, "id" | "createdAt" | "updatedAt"> & { id?: string; updatedAt?: string }): Promise<Sequence> {
  const row = {
    id: seq.id || crypto.randomUUID(),
    name: seq.name,
    steps: seq.steps,
    assigned_lead_ids: seq.assignedLeadIds,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("sequences").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return sequenceFromDB(data as unknown as Record<string, unknown>);
}

export async function deleteSequence(id: string): Promise<void> {
  const { error } = await supabase.from("sequences").delete().eq("id", id);
  if (error) throw error;
}

// ─── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(campaignFromDB);
}

export async function saveCampaign(c: Omit<Campaign, "id" | "createdAt"> & { id?: string }): Promise<Campaign> {
  const row = {
    id: c.id || crypto.randomUUID(),
    name: c.name,
    target_industry: c.targetIndustry,
    status: c.status,
    lead_ids: c.leadIds,
  };
  const { data, error } = await supabase.from("campaigns").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return campaignFromDB(data as unknown as Record<string, unknown>);
}

// ─── Clients ───────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(clientFromDB);
}

export async function saveClient(c: Omit<Client, "id" | "createdAt"> & { id?: string }): Promise<Client> {
  const row = {
    id: c.id || crypto.randomUUID(),
    name: c.name,
    company: c.company,
    industry: c.industry,
    monthly_retainer: c.monthlyRetainer,
    status: c.status,
  };
  const { data, error } = await supabase.from("clients").upsert(row, { onConflict: "id" }).select().single();
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
  const { data, error } = await supabase.from("clients").update(row).eq("id", id).select().single();
  if (error) throw error;
  return clientFromDB(data as unknown as Record<string, unknown>);
}

// ─── Activity Log ──────────────────────────────────────────────────────────────

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
  const row = {
    id: crypto.randomUUID(),
    type: entry.type,
    text: entry.text,
    lead_id: entry.leadId || null,
  };
  const { error } = await supabase.from("activity_log").insert(row);
  if (error) throw error;
}
