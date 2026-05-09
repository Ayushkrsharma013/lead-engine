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
