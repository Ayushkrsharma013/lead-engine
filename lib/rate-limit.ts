import { supabaseAdmin } from "./supabase";

const supabase = supabaseAdmin;

// ─── In-memory per-minute rate limiter ──────────────────────────────────
// Sliding-window tracking for API routes. Resets on server restart (cold start).
// For production, replace with Redis or a DB-backed counter.

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

function getWindowKey(scope: string, identifier: string): string {
  return `${scope}:${identifier}`;
}

/**
 * Check a per-minute rate limit using in-memory sliding window.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkMinuteLimit(
  scope: string,
  identifier: string,
  maxPerMinute: number
): { allowed: boolean; used: number; remaining: number } {
  const now = Date.now();
  const key = getWindowKey(scope, identifier);
  let entry = windows.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    windows.set(key, entry);
  }

  // Purge entries older than 60 seconds
  const cutoff = now - 60_000;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  const used = entry.timestamps.length;
  const allowed = used < maxPerMinute;

  if (allowed) {
    entry.timestamps.push(now);
  }

  return { allowed, used, remaining: Math.max(0, maxPerMinute - used - (allowed ? 1 : 0)) };
}

// Periodic cleanup of stale windows (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [key, entry] of windows) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) windows.delete(key);
    }
  }, 300_000);
}

// Default limits
const DEFAULT_DAILY_SCRAPE_LIMIT = 500;
const DEFAULT_DAILY_EMAIL_LIMIT = 200;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string; // ISO timestamp when the limit resets
}

function todayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

async function getDailyCount(
  table: string,
  userId: string,
  { start, end }: { start: string; end: string }
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start)
    .lt("created_at", end);
  if (error) return 0;
  return count ?? 0;
}

export async function checkLeadScrapeLimit(userId: string): Promise<RateLimitResult> {
  const { start, end } = todayRange();
  const used = await getDailyCount("leads", userId, { start, end });
  const limit = DEFAULT_DAILY_SCRAPE_LIMIT;

  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt: end,
  };
}

export async function checkEmailSendLimit(userId: string): Promise<RateLimitResult> {
  const { start, end } = todayRange();
  const used = await getDailyCount("sequence_messages", userId, { start, end });
  const limit = DEFAULT_DAILY_EMAIL_LIMIT;

  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt: end,
  };
}

export function setRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Used", String(result.used));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", result.resetAt);
}
