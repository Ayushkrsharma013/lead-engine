export type Source = "linkedin" | "gmaps" | "amazon";
export type SortDir = "asc" | "desc";
export type SortField = "name" | "company" | "score" | "savedAt" | "location" | "emailStatus";

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  email: string;
  emailStatus: "verified" | "risky" | "not_found";
  linkedin: string;
  website: string;
  companySize: string;
  score: number;
  source: Source;
  savedAt?: string;
  fetchedAt?: string;
  tags?: string[];
}

export interface LogEntry {
  id: number;
  ts: string;
  text: string;
  type: "info" | "success" | "warn";
}

export interface Stats {
  total: number;
  withEmail: number;
  avgScore: number;
  topIndustry: string;
}

export interface FilterState {
  keyword: string;
  seniority: string[];
  jobFunction: string[];
  industries: string[];
  companySizes: string[];
  countries: string[];
  emailStatus: string[];
  minScore: number;
  sources: string[];
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_FILTERS: FilterState = {
  keyword: "",
  seniority: [],
  jobFunction: [],
  industries: [],
  companySizes: [],
  countries: [],
  emailStatus: [],
  minScore: 0,
  sources: [],
  dateFrom: "",
  dateTo: "",
};

export interface PaginationState {
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: 25,
};

export interface SortState {
  field: SortField;
  dir: SortDir;
}

export const DEFAULT_SORT: SortState = {
  field: "savedAt",
  dir: "desc",
};

// ─── New types for ProOS ────────────────────────────────────────────────────────

export interface Message {
  id: string;
  leadId: string;
  subject: string;
  body: string;
  tone: string;
  messageType: "linkedin_connection" | "linkedin_dm" | "cold_email" | "followup_email" | "breakup_email";
  charCount?: number;
  createdAt?: string;
}

export interface SequenceStep {
  day: number;
  channel: "linkedin" | "email";
  type: string;
  template: string;
  active: boolean;
}

export interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  assignedLeadIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  targetIndustry: string;
  status: "active" | "paused" | "complete";
  leadIds: string[];
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  industry: string;
  monthlyRetainer: number;
  status: "active" | "inactive";
  createdAt?: string;
}

export interface ActivityLogEntry {
  id: string;
  type: "lead_added" | "message_sent" | "scored_hot" | "meeting_booked" | "lead_moved" | "notification";
  text: string;
  leadId?: string;
  createdAt?: string;
}

export interface Notification {
  id: string;
  type: string;
  text: string;
  read: boolean;
  createdAt: string;
}

export type ModuleName = "dashboard" | "leads" | "message-lab" | "scorer"
  | "sequences" | "kanban" | "analytics" | "clients";

export interface MergeResult {
  stored: Lead[];
  added: number;
  updated: number;
  rejected: number;
}
