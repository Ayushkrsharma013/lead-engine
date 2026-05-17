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
  kanbanColumn?: string;
  status?: "new" | "contacted" | "replied" | "hot" | "meeting" | "won" | "lost";
  notes?: string;
  lastTouched?: string;
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
  variants?: string[];
}

export interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  assignedLeadIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SequenceExecution {
  id: string;
  sequenceId: string;
  leadId: string;
  currentStep: number;
  status: "active" | "paused" | "completed" | "cancelled";
  variant: string;
  startedAt: string;
  lastActionAt: string;
  createdAt?: string;
}

export interface SequenceMessage {
  id: string;
  executionId: string;
  leadId: string;
  stepIndex: number;
  channel: "email" | "linkedin";
  subject: string;
  body: string;
  status: "sent" | "failed" | "bounced" | "skipped" | "replied";
  resendId?: string;
  variant?: string;
  createdAt?: string;
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
  | "sequences" | "kanban" | "analytics" | "clients" | "outreach" | "agent" | "settings";

export interface MergeResult {
  stored: Lead[];
  added: number;
  updated: number;
  rejected: number;
}

// ─── Appointments ──────────────────────────────────────────────────────────

export type MeetingType = "discovery" | "demo" | "technical" | "strategy";
export type AppointmentStatus = "confirmed" | "cancelled" | "rescheduled" | "completed";

export const MEETING_TYPES: Record<MeetingType, { label: string; duration: number; description: string }> = {
  discovery: { label: "Discovery Call", duration: 15, description: "Quick intro to see if we're a fit" },
  demo: { label: "Product Demo", duration: 30, description: "Full platform walkthrough with your use case" },
  technical: { label: "Technical Deep-Dive", duration: 45, description: "Architecture, integrations, and security" },
  strategy: { label: "Strategy Session", duration: 60, description: "Custom ICP + pipeline design workshop" },
};

export interface Appointment {
  id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  type: MeetingType;
  duration: number;
  status: AppointmentStatus;
  timezone: string;
  calendarLink?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppointmentInput {
  date: string;
  time: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  type: MeetingType;
  timezone: string;
}

export const APPOINTMENT_BUFFER_MINUTES = 15;
export const MAX_BOOKINGS_PER_DAY = 8;
export const BUSINESS_HOURS_START = 9;
export const BUSINESS_HOURS_END = 17;
export const WEEKEND_DAYS = [0, 6];

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  ts: string;
}

// ─── RBAC types ───────────────────────────────────────────────

export type UserRole = 'super_admin' | 'client' | 'user' | 'qa_agent'

export type PlanKey = 'diy' | 'growth' | 'scale'

export const PLAN_MODULES: Record<PlanKey, string[]> = {
  diy: [
    'overview',
    'leads-view',
    'billing',
  ],
  growth: [
    'overview',
    'leads-view',
    'leads-full',
    'icebreakers',
    'analytics',
    'slack-digest',
    'billing',
    'settings',
  ],
  scale: [
    'overview',
    'leads-view',
    'leads-full',
    'icebreakers',
    'analytics',
    'analytics-ab',
    'slack-digest',
    'crm-sync',
    'sequences',
    'weekly-report',
    'billing',
    'settings',
  ],
}

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  plan: PlanKey | null
  subscription_status: 'pending_payment' | 'active' | 'cancelled' | null
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
  last_login_at: string | null
  notes: string | null
  subscription_activated_at: string | null
  payment_ref: string | null
  onboarding_complete: boolean
}

export interface ClientWorkspace {
  id: string
  client_user_id: string
  plan: PlanKey
  icp_config: Record<string, unknown>
  leads_count: number
  last_sync_at: string | null
  slack_webhook: string | null
  settings: Record<string, unknown>
  created_at: string
}

export interface QASession {
  id: string
  surface: 'super_admin' | 'client_portal'
  test_suite: string
  status: 'running' | 'passed' | 'failed'
  results: Record<string, unknown>
  started_at: string
  ended_at: string | null
}
