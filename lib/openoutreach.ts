import type { Lead } from "./types";

// ─── OpenOutreach data model types ───────────────────────────────────────────

export type OOProfileState =
  | "QUALIFIED"
  | "READY_TO_CONNECT"
  | "PENDING"
  | "CONNECTED"
  | "COMPLETED"
  | "FAILED";

export interface OOLead {
  id: number;
  name: string;
  company: string;
  headline: string;
  profile_url: string;
  email: string | null;
  location: string | null;
  disqualified: boolean;
  created_at: string;
}

export interface OODeal {
  id: number;
  lead_id: number;
  campaign_id: number;
  state: OOProfileState;
  outcome: string | null;
  qualification_reason: string | null;
  connection_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface OOCampaign {
  id: number;
  name: string;
  product_docs: string;
  campaign_objective: string;
  booking_link: string;
}

export interface OOStatus {
  running: boolean;
  url: string;
}

export interface OOSyncPayload {
  leads: OOLead[];
  deals: OODeal[];
  campaigns: OOCampaign[];
}

// ─── State machine helpers ────────────────────────────────────────────────────

export function mapOOStateToLeadStatus(state?: OOProfileState): Lead["status"] {
  switch (state) {
    case "READY_TO_CONNECT":
    case "PENDING": return "contacted";
    case "CONNECTED": return "replied";
    case "COMPLETED": return "hot";
    case "FAILED": return "lost";
    default: return "new";
  }
}

export function mapOOStateToKanbanColumn(state?: OOProfileState): string {
  switch (state) {
    case "QUALIFIED": return "New";
    case "READY_TO_CONNECT": return "Contacted";
    case "PENDING": return "Contacted";
    case "CONNECTED": return "Replied";
    case "COMPLETED": return "Hot Lead";
    case "FAILED": return "Lost";
    default: return "New";
  }
}

// ─── Lead mapper ──────────────────────────────────────────────────────────────

export function mapOOLeadToLead(lead: OOLead, deal?: OODeal): Omit<Lead, "id"> & { id: string } {
  return {
    id: `oo_${lead.id}`,
    name: lead.name,
    title: lead.headline || "",
    company: lead.company || "",
    industry: "",
    location: lead.location || "",
    email: lead.email || "",
    emailStatus: lead.email ? "risky" : "not_found",
    linkedin: lead.profile_url,
    website: "",
    companySize: "",
    // OO-qualified leads get elevated base score
    score: deal?.state === "CONNECTED" || deal?.state === "COMPLETED" ? 80 : 70,
    source: "linkedin",
    status: mapOOStateToLeadStatus(deal?.state),
    kanbanColumn: mapOOStateToKanbanColumn(deal?.state),
    savedAt: lead.created_at,
    fetchedAt: new Date().toISOString(),
    tags: ["openoutreach"],
    notes: deal?.qualification_reason ?? undefined,
  };
}

// ─── Pipeline stats helper ────────────────────────────────────────────────────

export interface OOPipelineStats {
  qualified: number;
  readyToConnect: number;
  pending: number;
  connected: number;
  completed: number;
  failed: number;
  total: number;
}

export function computeOOStats(deals: OODeal[]): OOPipelineStats {
  const counts = { QUALIFIED: 0, READY_TO_CONNECT: 0, PENDING: 0, CONNECTED: 0, COMPLETED: 0, FAILED: 0 };
  for (const d of deals) {
    if (d.state in counts) counts[d.state as keyof typeof counts]++;
  }
  return {
    qualified: counts.QUALIFIED,
    readyToConnect: counts.READY_TO_CONNECT,
    pending: counts.PENDING,
    connected: counts.CONNECTED,
    completed: counts.COMPLETED,
    failed: counts.FAILED,
    total: deals.length,
  };
}
