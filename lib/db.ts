import { supabase } from "./supabase";
import { sanitizeLead } from "./storage";
import type {
  Lead, Message, Sequence, Campaign, Client,
  ActivityLogEntry, MergeResult, Stats,
} from "./types";

// ─── Transform helpers (snake_case ↔ camelCase) ────────────────────────────────

type LeadRow = Record<string, unknown>;

function leadFromDB(row: LeadRow): Lead {
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
    name: String(row.name || ""),
    company: String(row.company || ""),
    industry: String(row.industry || ""),
    monthlyRetainer: Number(row.monthly_retainer ?? 0),
    status: String(row.status || "active") as Client["status"],
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
  const row = {
    ...(c.id ? { id: c.id } : {}),
    name: c.name,
    company: c.company,
    industry: c.industry,
    monthly_retainer: c.monthlyRetainer,
    status: c.status,
  };
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
