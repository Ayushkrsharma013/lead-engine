import type { Lead, Source } from "./types";

// ─── Validation ───────────────────────────────────────────────────────────────
const EMAIL_STATUS_VALUES = new Set(["verified", "risky", "not_found"]);
const SOURCE_VALUES = new Set(["linkedin", "gmaps", "amazon"]);

export function validateLead(lead: unknown): lead is Lead {
  if (!lead || typeof lead !== "object") return false;
  const l = lead as Record<string, unknown>;
  return (
    typeof l.id === "string" && l.id.length > 0 &&
    typeof l.name === "string" &&
    typeof l.title === "string" &&
    typeof l.company === "string" &&
    typeof l.email === "string" &&
    typeof l.score === "number" && l.score >= 0 && l.score <= 100 &&
    EMAIL_STATUS_VALUES.has(String(l.emailStatus)) &&
    SOURCE_VALUES.has(String(l.source))
  );
}

export function sanitizeLead(raw: Record<string, unknown>): Lead {
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
    source: SOURCE_VALUES.has(String(raw.source))
      ? (raw.source as Source)
      : "linkedin",
    savedAt: typeof raw.savedAt === "string" && raw.savedAt ? raw.savedAt : now,
    fetchedAt: typeof raw.fetchedAt === "string" && raw.fetchedAt ? raw.fetchedAt : now,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 20) : [],
  };
}

// ─── Stable lead ID ────────────────────────────────────────────────────────────

/** Generate a stable, deterministic ID from the lead's best unique keys.
 *  Same email/linkedin/name+company always produces the same ID,
 *  so re-importing never duplicates across agent runs or API imports. */
export function stableLeadId(email: string, linkedin: string, name: string, company: string): string {
  const key = email.toLowerCase().trim()
    || linkedin.toLowerCase().trim()
    || `${name.toLowerCase().trim()}|${company.toLowerCase().trim()}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h = h >>> 0;
  }
  return `apify-${h.toString(36)}`;
}

// ─── CSV generation ───────────────────────────────────────────────────────────
export function generateCSV(leads: Lead[]): string {
  const HEADERS = [
    "Name", "Title", "Company", "Industry", "Location",
    "Email", "Email Status", "LinkedIn", "Website",
    "Company Size", "Score", "Source", "Saved At", "Fetched At",
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    // Prevent CSV formula injection in Excel/Sheets
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe}"`;
  };
  const rows = leads.map(l =>
    [
      l.name, l.title, l.company, l.industry, l.location,
      l.email, l.emailStatus, l.linkedin, l.website,
      l.companySize, l.score, l.source,
      l.savedAt ? new Date(l.savedAt).toLocaleString() : "",
      l.fetchedAt ? new Date(l.fetchedAt).toLocaleString() : "",
    ].map(esc).join(",")
  );
  return [HEADERS.map(esc).join(","), ...rows].join("\n");
}
