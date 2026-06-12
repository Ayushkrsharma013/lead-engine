/**
 * Single source of truth for Apify actor configuration.
 * Previously duplicated across 5+ route files.
 */

export const APIFY_ACTOR_ID =
  process.env.APIFY_ACTOR_ID ?? "x_guru~Leads-Scraper-apollo-zoominfo";

export const APIFY_BASE = "https://api.apify.com/v2";

export function apifyHeaders(): Record<string, string> {
  const token = process.env.APIFY_API_KEY || "";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ─── Seniority mapping ────────────────────────────────────────────────
export const SENIORITY_MAP: Record<string, string> = {
  "Owner / Founder": "owner",
  "C-Suite": "cxo",
  VP: "vp",
  Director: "director",
  Manager: "manager",
  "Senior / Head": "senior",
};

// ─── Job function mapping ─────────────────────────────────────────────
export const FUNCTION_MAP: Record<string, string> = {
  Sales: "sales",
  Marketing: "marketing",
  Engineering: "engineering",
  Product: "product",
  Operations: "operations",
  Finance: "finance",
  "HR / People": "human_resources",
  "Business Dev": "business_development",
};

// ─── Default options ──────────────────────────────────────────────────
export const APIFY_DEFAULTS = {
  maxResults: 100,
  pollIntervalMs: 5000,
  maxPollAttempts: 60,
  overFetchMultiplier: 3, // fetch 3x target to compensate for dedup
  maxOverFetch: 500,
} as const;

// ─── Lead plan limits ─────────────────────────────────────────────────
export const PLAN_LEAD_LIMITS: Record<string, number> = {
  micro: 50,
  pilot: 100,
  growth: 200,
  scale: 500,
};
