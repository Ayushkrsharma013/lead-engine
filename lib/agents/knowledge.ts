// lib/agents/knowledge.ts
// Shared knowledge store — agents read findings from peers, write their own discoveries.
// Uses supabaseAdmin (service role) — only called from cron paths.

import { supabaseAdmin } from "@/lib/supabase";

export async function readKnowledge(key: string): Promise<unknown | null> {
  const { data, error } = await supabaseAdmin
    .from("knowledge_store")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { value: unknown }).value;
}

export async function readKnowledgeNumber(key: string, fallback: number): Promise<number> {
  const v = await readKnowledge(key);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

export async function readKnowledgeList(key: string): Promise<string[]> {
  const v = await readKnowledge(key);
  if (Array.isArray(v)) return v.map(String);
  return [];
}

export async function readKnowledgeRecord(key: string): Promise<Record<string, unknown>> {
  const v = await readKnowledge(key);
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

export async function writeKnowledge(
  key: string,
  value: unknown,
  agent: string
): Promise<void> {
  await supabaseAdmin.from("knowledge_store").upsert(
    { key, value, agent, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}
