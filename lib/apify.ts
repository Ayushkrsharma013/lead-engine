import type { Lead } from "./types";
import { stableLeadId } from "./storage";

export interface ApifyRun {
  id: string;
  status: string;
  finishedAt: string | null;
  defaultDatasetId: string;
  startedAt: string;
}

export interface ApifyItem {
  id?: string;
  fullName?: string;
  full_name?: string;
  name?: string;
  email?: string;
  emails?: unknown;
  work_email?: string;
  personal_emails?: unknown;
  email_status?: string;
  linkedInUrl?: string;
  linkedin_url?: string;
  linkedin?: string;
  company?: string;
  organization?: string;
  job_company_name?: string;
  title?: string;
  jobTitle?: string;
  job_title?: string;
  industry?: string;
  job_company_industry?: string;
  location?: string;
  city?: string;
  location_name?: string;
  companySize?: string;
  employees?: string;
  job_company_size?: string;
  website?: string;
  companyWebsite?: string;
  job_company_website?: string;
  [key: string]: unknown;
}

const APIFY_BASE = "https://api.apify.com/v2";

export async function getActorRuns(actorId: string, apiKey: string): Promise<ApifyRun[]> {
  const res = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${apiKey}&limit=100&desc=true`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Apify runs fetch failed: ${res.status}`);
  const data = await res.json() as { data?: { items?: ApifyRun[] } };
  return data?.data?.items || [];
}

export async function getDatasetItems(datasetId: string, apiKey: string): Promise<ApifyItem[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${apiKey}&format=json&clean=true&limit=1000`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`);
  const data = await res.json() as ApifyItem[];
  return Array.isArray(data) ? data : [];
}

export function mapApifyItemToLead(item: ApifyItem, runId: string, datasetId: string, finishedAt: string | null): Partial<Lead> & { apify_run_id: string; apify_dataset_id: string } {
  const extractEmail = (): string => {
    if (Array.isArray(item.emails) && item.emails.length > 0) {
      const first = item.emails[0];
      if (typeof first === "object" && first !== null)
        return String((first as Record<string, unknown>).address || first || "");
      return String(first || "");
    }
    if (typeof item.emails === "string" && item.emails.trim()) return item.emails.trim();
    if (typeof item.work_email === "string" && item.work_email.trim()) return item.work_email.trim();
    if (typeof item.email === "string" && item.email.trim()) return item.email.trim();
    if (typeof item.personal_emails === "string") {
      const first = item.personal_emails.split(/\s+/)[0];
      if (first) return first;
    }
    if (Array.isArray(item.personal_emails) && item.personal_emails.length > 0)
      return String(item.personal_emails[0]);
    return "";
  };

  const email = extractEmail().toLowerCase().trim();
  const linkedin = String(item.linkedInUrl || item.linkedin_url || item.linkedin || "").trim();
  const name = String(item.fullName || item.full_name || item.name || "").trim();
  const company = String(item.job_company_name || item.company || item.organization || "").trim();

  const rawEmailStatus = String(item.email_status || "not_found");
  const emailStatus = (["verified", "risky", "not_found"].includes(rawEmailStatus)
    ? rawEmailStatus : "not_found") as Lead["emailStatus"];

  return {
    id: stableLeadId(email, linkedin, name, company),
    name,
    title: String(item.job_title || item.title || item.jobTitle || ""),
    company,
    industry: String(item.job_company_industry || item.industry || ""),
    location: String(item.location_name || item.location || item.city || ""),
    email,
    emailStatus,
    linkedin,
    website: String(item.job_company_website || item.website || item.companyWebsite || ""),
    companySize: String(item.job_company_size || item.companySize || item.employees || ""),
    score: 0,
    source: "linkedin" as Lead["source"],
    savedAt: new Date().toISOString(),
    fetchedAt: finishedAt || new Date().toISOString(),
    apify_run_id: runId,
    apify_dataset_id: datasetId,
  };
}
