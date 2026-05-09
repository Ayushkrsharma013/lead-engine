import type { Lead } from "./types";

const DB_KEY = "leadgen_db_v1";

export function getStoredLeads(): Lead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export interface MergeResult {
  stored: Lead[];
  added: number;
  updated: number;
}

export function mergeLeads(incoming: Lead[]): MergeResult {
  const existing = getStoredLeads();
  const result = [...existing];
  let added = 0, updated = 0;

  for (const lead of incoming) {
    const dupIdx = result.findIndex(e =>
      (lead.email && e.email && e.email === lead.email) ||
      (lead.linkedin && e.linkedin && e.linkedin === lead.linkedin)
    );
    const withTs: Lead = { ...lead, savedAt: lead.savedAt || new Date().toISOString() };
    if (dupIdx >= 0) {
      result[dupIdx] = { ...result[dupIdx], ...withTs, id: result[dupIdx].id };
      updated++;
    } else {
      result.push(withTs);
      added++;
    }
  }

  localStorage.setItem(DB_KEY, JSON.stringify(result));
  return { stored: result, added, updated };
}

export function deleteLeads(ids: string[]): Lead[] {
  const idSet = new Set(ids);
  const remaining = getStoredLeads().filter(l => !idSet.has(l.id));
  localStorage.setItem(DB_KEY, JSON.stringify(remaining));
  return remaining;
}

export function clearAllLeads(): void {
  localStorage.setItem(DB_KEY, "[]");
}
