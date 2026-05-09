import type { Lead, FilterState } from "./types";

function matchesSeniority(title: string, level: string): boolean {
  const t = title.toLowerCase();
  switch (level) {
    case "Owner / Founder": return /founder|owner|co-founder/.test(t);
    case "C-Suite": return /\bceo\b|\bcto\b|\bcmo\b|\bcoo\b|\bcso\b|\bcpo\b|chief/.test(t);
    case "VP": return /\bvp\b|vice president/.test(t);
    case "Director": return /director/.test(t);
    case "Manager": return /manager/.test(t);
    case "Senior / Head": return /senior|head of|\blead\b|principal/.test(t);
    default: return false;
  }
}

function matchesFunction(title: string, fn: string): boolean {
  const t = title.toLowerCase();
  switch (fn) {
    case "Sales": return /sales|account executive|ae\b|bdr|sdr/.test(t);
    case "Marketing": return /marketing|growth|demand|brand|content/.test(t);
    case "Engineering": return /engineer|developer|architect|tech lead|software/.test(t);
    case "Product": return /product|pm\b|program manager/.test(t);
    case "Operations": return /operations|ops|strategy/.test(t);
    case "Finance": return /finance|cfo|controller|accounting/.test(t);
    case "HR / People": return /hr\b|people|talent|recruiting|human resources/.test(t);
    case "Business Dev": return /business dev|bd\b|partnerships|alliances/.test(t);
    default: return false;
  }
}

export function applyFilters(leads: Lead[], f: FilterState): Lead[] {
  return leads.filter(lead => {
    if (f.keyword) {
      const kw = f.keyword.toLowerCase();
      const haystack = [lead.name, lead.title, lead.company, lead.industry, lead.location]
        .join(" ").toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    if (f.seniority.length && !f.seniority.some(s => matchesSeniority(lead.title, s))) return false;
    if (f.jobFunction.length && !f.jobFunction.some(fn => matchesFunction(lead.title, fn))) return false;
    if (f.industries.length) {
      const ind = lead.industry.toLowerCase();
      const match = f.industries.some(i => {
        const normalized = i.toLowerCase().split(" / ")[0].trim();
        return ind.includes(normalized) || ind.includes(i.toLowerCase());
      });
      if (!match) return false;
    }
    if (f.companySizes.length && !f.companySizes.includes(lead.companySize)) return false;
    if (f.countries.length) {
      const loc = (lead.location || "").toLowerCase();
      const usKeywords = ["usa", "san francisco", "new york", "austin", "seattle", "chicago", "boston", ", ca", ", ny", ", tx", ", wa", ", il", ", ma", "united states", "remote, us"];
      const match = f.countries.some(c => {
        if (c === "United States") return usKeywords.some(kw => loc.includes(kw));
        if (c === "Remote") return loc.includes("remote");
        return loc.includes(c.toLowerCase());
      });
      if (!match) return false;
    }
    if (f.emailStatus.length && !f.emailStatus.includes(lead.emailStatus)) return false;
    if (f.minScore > 0 && lead.score < f.minScore) return false;
    if (f.sources.length && !f.sources.includes(lead.source)) return false;
    return true;
  });
}

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
  ].reduce((a, b) => a + b, 0);
}

export function getActiveFilterChips(f: FilterState): Array<{ label: string; group: keyof FilterState; value: string }> {
  const chips: Array<{ label: string; group: keyof FilterState; value: string }> = [];
  if (f.keyword) chips.push({ label: `"${f.keyword}"`, group: "keyword", value: f.keyword });
  f.seniority.forEach(v => chips.push({ label: v, group: "seniority", value: v }));
  f.jobFunction.forEach(v => chips.push({ label: v, group: "jobFunction", value: v }));
  f.industries.forEach(v => chips.push({ label: v, group: "industries", value: v }));
  f.companySizes.forEach(v => chips.push({ label: v, group: "companySizes", value: v }));
  f.countries.forEach(v => chips.push({ label: v, group: "countries", value: v }));
  f.emailStatus.forEach(v => chips.push({ label: v === "verified" ? "✓ Verified" : v === "risky" ? "⚠ Risky" : "✗ Not Found", group: "emailStatus", value: v }));
  if (f.minScore > 0) chips.push({ label: `Score ≥ ${f.minScore}`, group: "minScore", value: String(f.minScore) });
  f.sources.forEach(v => chips.push({ label: v.charAt(0).toUpperCase() + v.slice(1), group: "sources", value: v }));
  return chips;
}
