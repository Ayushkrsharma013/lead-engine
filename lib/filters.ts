import type { Lead, FilterState, SortState } from "./types";

// ─── Seniority matching ───────────────────────────────────────────────────────
function matchesSeniority(title: string, level: string): boolean {
  const t = title.toLowerCase();
  switch (level) {
    case "Owner / Founder": return /founder|owner|co-founder|cofounder/.test(t);
    case "C-Suite":         return /\bceo\b|\bcto\b|\bcmo\b|\bcoo\b|\bcso\b|\bcpo\b|chief/.test(t);
    case "VP":              return /\bvp\b|vice\s+president/.test(t);
    case "Director":        return /\bdirector\b/.test(t);
    case "Manager":         return /\bmanager\b/.test(t);
    case "Senior / Head":   return /\bsenior\b|head\s+of|\blead\b|\bprincipal\b/.test(t);
    default:                return false;
  }
}

// ─── Function matching ────────────────────────────────────────────────────────
function matchesFunction(title: string, fn: string): boolean {
  const t = title.toLowerCase();
  switch (fn) {
    case "Sales":        return /\bsales\b|account\s+executive|\bae\b|\bbdr\b|\bsdr\b/.test(t);
    case "Marketing":    return /\bmarketing\b|\bgrowth\b|\bdemand\b|\bbrand\b|\bcontent\b/.test(t);
    case "Engineering":  return /\bengineer\b|\bdeveloper\b|\barchitect\b|tech\s+lead|\bsoftware\b/.test(t);
    case "Product":      return /\bproduct\b|\bpm\b|\bprogram\s+manager\b/.test(t);
    case "Operations":   return /\boperations\b|\bops\b|\bstrategy\b/.test(t);
    case "Finance":      return /\bfinance\b|\bcfo\b|\bcontroller\b|\baccounting\b/.test(t);
    case "HR / People":  return /\bhr\b|\bpeople\b|\btalent\b|\brecruiting\b|human\s+resources/.test(t);
    case "Business Dev": return /business\s+dev|\bbd\b|\bpartnerships\b|\balliances\b/.test(t);
    default:             return false;
  }
}

// ─── Geography matching ───────────────────────────────────────────────────────
const US_KEYWORDS = [
  "usa", "united states", "u.s.", "u.s.a",
  "remote, us", "remote - us", "new york", "san francisco", "los angeles",
  "chicago", "austin", "seattle", "boston", "denver", "miami",
  ", ny", ", ca", ", tx", ", wa", ", il", ", ma", ", fl", ", co", ", ga",
];

function matchesCountry(location: string, country: string): boolean {
  const loc = location.toLowerCase();
  if (country === "United States") return US_KEYWORDS.some(kw => loc.includes(kw));
  if (country === "Remote")        return loc.includes("remote");
  return loc.includes(country.toLowerCase());
}

// ─── Main filter function ─────────────────────────────────────────────────────
export function applyFilters(leads: Lead[], f: FilterState): Lead[] {
  return leads.filter(lead => {
    // Keyword — searches across all key fields including email
    if (f.keyword && f.keyword.trim()) {
      const kw = f.keyword.trim().toLowerCase();
      const haystack = [
        lead.name, lead.title, lead.company, lead.industry,
        lead.location, lead.email, lead.website,
      ].join(" ").toLowerCase();
      if (!haystack.includes(kw)) return false;
    }

    // Seniority
    if (f.seniority.length && !f.seniority.some(s => matchesSeniority(lead.title, s))) return false;

    // Job function
    if (f.jobFunction.length && !f.jobFunction.some(fn => matchesFunction(lead.title, fn))) return false;

    // Industry
    if (f.industries.length) {
      const ind = lead.industry.toLowerCase();
      const match = f.industries.some(i => {
        const parts = i.toLowerCase().split(/\s*\/\s*/);
        return parts.some(p => ind.includes(p.trim()));
      });
      if (!match) return false;
    }

    // Company size
    if (f.companySizes.length && !f.companySizes.includes(lead.companySize)) return false;

    // Geography
    if (f.countries.length && !f.countries.some(c => matchesCountry(lead.location, c))) return false;

    // Email status
    if (f.emailStatus.length && !f.emailStatus.includes(lead.emailStatus)) return false;

    // Min score
    if (f.minScore > 0 && lead.score < f.minScore) return false;

    // Source
    if (f.sources.length && !f.sources.includes(lead.source)) return false;

    // Date range (based on savedAt)
    if (f.dateFrom && lead.savedAt) {
      if (new Date(lead.savedAt) < new Date(f.dateFrom)) return false;
    }
    if (f.dateTo && lead.savedAt) {
      // Include the full end day
      const endOfDay = new Date(f.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (new Date(lead.savedAt) > endOfDay) return false;
    }

    return true;
  });
}

// ─── Sorting ──────────────────────────────────────────────────────────────────
export function sortLeads(leads: Lead[], sort: SortState): Lead[] {
  return [...leads].sort((a, b) => {
    let cmp = 0;
    switch (sort.field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "company":
        cmp = a.company.localeCompare(b.company);
        break;
      case "score":
        cmp = a.score - b.score;
        break;
      case "location":
        cmp = a.location.localeCompare(b.location);
        break;
      case "emailStatus": {
        const order: Record<string, number> = { verified: 0, risky: 1, not_found: 2 };
        cmp = (order[a.emailStatus] ?? 3) - (order[b.emailStatus] ?? 3);
        break;
      }
      case "savedAt":
      default: {
        const ta = a.savedAt ? new Date(a.savedAt).getTime() : 0;
        const tb = b.savedAt ? new Date(b.savedAt).getTime() : 0;
        cmp = ta - tb;
        break;
      }
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

// ─── Active filter count ──────────────────────────────────────────────────────
export function countActiveFilters(f: FilterState): number {
  return [
    f.keyword ? 1 : 0,
    f.seniority.length,
    f.jobFunction.length,
    f.industries.length,
    f.companySizes.length,
    f.countries.length,
    f.emailStatus.length,
    f.minScore > 0 ? 1 : 0,
    f.sources.length,
    f.dateFrom ? 1 : 0,
    f.dateTo ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

// ─── Filter chip helpers ──────────────────────────────────────────────────────
export function getActiveFilterChips(
  f: FilterState
): Array<{ label: string; group: keyof FilterState; value: string }> {
  const chips: Array<{ label: string; group: keyof FilterState; value: string }> = [];
  if (f.keyword)   chips.push({ label: `"${f.keyword}"`, group: "keyword", value: f.keyword });
  f.seniority.forEach(v    => chips.push({ label: v, group: "seniority", value: v }));
  f.jobFunction.forEach(v  => chips.push({ label: v, group: "jobFunction", value: v }));
  f.industries.forEach(v   => chips.push({ label: v, group: "industries", value: v }));
  f.companySizes.forEach(v => chips.push({ label: v, group: "companySizes", value: v }));
  f.countries.forEach(v    => chips.push({ label: v, group: "countries", value: v }));
  f.emailStatus.forEach(v  => chips.push({
    label: v === "verified" ? "✓ Verified" : v === "risky" ? "⚠ Risky" : "✗ Not Found",
    group: "emailStatus", value: v,
  }));
  if (f.minScore > 0) chips.push({ label: `Score ≥ ${f.minScore}`, group: "minScore", value: String(f.minScore) });
  f.sources.forEach(v => chips.push({
    label: v === "linkedin" ? "LinkedIn" : v === "gmaps" ? "Google Maps" : "Amazon",
    group: "sources", value: v,
  }));
  if (f.dateFrom) chips.push({ label: `From ${f.dateFrom}`, group: "dateFrom", value: f.dateFrom });
  if (f.dateTo)   chips.push({ label: `To ${f.dateTo}`,   group: "dateTo",   value: f.dateTo });
  return chips;
}
