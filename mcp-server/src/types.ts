export type Source = "linkedin" | "gmaps" | "amazon";

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
  kanbanColumn?: string;
  status?: "new" | "contacted" | "replied" | "hot" | "meeting" | "won" | "lost";
  notes?: string;
  lastTouched?: string;
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

export type SortField = "name" | "company" | "score" | "savedAt" | "location" | "emailStatus";
export type SortDir = "asc" | "desc";

export interface SortState {
  field: SortField;
  dir: SortDir;
}

export interface MergeResult {
  stored: Lead[];
  added: number;
  updated: number;
  rejected: number;
}
