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
