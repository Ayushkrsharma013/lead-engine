import type { Lead, Source } from "./types";

const DB_KEY = "leadgen_db_v2";
const LEGACY_KEY = "leadgen_db_v1";

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

// ─── Internal storage helpers ─────────────────────────────────────────────────
function readRaw(): Lead[] {
  if (typeof window === "undefined") return [];
  try {
    const current = localStorage.getItem(DB_KEY);
    const legacy = !current ? localStorage.getItem(LEGACY_KEY) : null;
    const raw = current || legacy;

    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    const valid: Lead[] = [];
    const repaired: Lead[] = [];
    let anyRepaired = false;

    for (const item of data) {
      if (validateLead(item)) {
        valid.push(item as Lead);
      } else if (item && typeof item === "object") {
        repaired.push(sanitizeLead(item as Record<string, unknown>));
        anyRepaired = true;
      }
    }

    const result = [...valid, ...repaired];

    // If we migrated from legacy or repaired data, save to new key
    if (legacy || anyRepaired) {
      if (legacy) localStorage.removeItem(LEGACY_KEY);
      writeRaw(result);
    }

    return result;
  } catch {
    return [];
  }
}

function writeRaw(leads: Lead[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(leads));
  } catch {
    // Storage quota exceeded — trim oldest 20% and retry
    const trimmed = leads.slice(Math.floor(leads.length * 0.2));
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(trimmed));
    } catch {
      // Nothing we can do
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function getStoredLeads(): Lead[] {
  return readRaw();
}

export function getStoredLeadsBySource(source: Source): Lead[] {
  return readRaw().filter(l => l.source === source);
}

export interface MergeResult {
  stored: Lead[];
  added: number;
  updated: number;
  rejected: number;
}

export function mergeLeads(incoming: Lead[]): MergeResult {
  const existing = readRaw();
  const result = [...existing];
  let added = 0, updated = 0, rejected = 0;
  const now = new Date().toISOString();

  for (const rawLead of incoming) {
    if (!rawLead || typeof rawLead !== "object") { rejected++; continue; }
    const lead = sanitizeLead(rawLead as unknown as Record<string, unknown>);
    const withTs: Lead = { ...lead, fetchedAt: now, savedAt: lead.savedAt || now };

    // Deduplicate by id, email (non-empty), or linkedin URL (non-empty)
    const dupIdx = result.findIndex(e => {
      if (e.id === withTs.id) return true;
      if (withTs.email && e.email && e.email === withTs.email) return true;
      if (withTs.linkedin && e.linkedin && e.linkedin === withTs.linkedin) return true;
      return false;
    });

    if (dupIdx >= 0) {
      // Keep original savedAt; update everything else
      result[dupIdx] = {
        ...result[dupIdx],
        ...withTs,
        id: result[dupIdx].id,
        savedAt: result[dupIdx].savedAt,
      };
      updated++;
    } else {
      result.push(withTs);
      added++;
    }
  }

  writeRaw(result);
  return { stored: result, added, updated, rejected };
}

export function deleteLeads(ids: string[]): Lead[] {
  const idSet = new Set(ids);
  const remaining = readRaw().filter(l => !idSet.has(l.id));
  writeRaw(remaining);
  return remaining;
}

export function clearAllLeads(): void {
  writeRaw([]);
}

export function getStorageStats() {
  const leads = readRaw();
  const withEmail = leads.filter(l => l.emailStatus === "verified").length;
  const avgScore = leads.length
    ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length)
    : 0;
  const industryCounts: Record<string, number> = {};
  for (const l of leads) {
    if (l.industry) industryCounts[l.industry] = (industryCounts[l.industry] || 0) + 1;
  }
  const topIndustry =
    Object.entries(industryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return { total: leads.length, withEmail, avgScore, topIndustry };
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
