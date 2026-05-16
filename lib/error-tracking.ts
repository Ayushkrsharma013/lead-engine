import { supabaseAdmin } from "./supabase";

const supabase = supabaseAdmin;

export interface ErrorContext {
  message: string;
  stack?: string;
  source: string; // "client" | "server" | "api"
  url?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function captureError(ctx: ErrorContext): Promise<void> {
  const sentryDsn = process.env.SENTRY_DSN;

  // Log to Supabase
  try {
    await supabase.from("error_logs").insert({
      message: ctx.message,
      stack: ctx.stack || null,
      source: ctx.source,
      url: ctx.url || null,
      user_id: ctx.userId || null,
      metadata: ctx.metadata || null,
    });
  } catch {
    console.warn("[error-tracking] Failed to log to Supabase");
  }

  // Forward to Sentry if configured
  if (sentryDsn) {
    try {
      await fetch("https://sentry.io/api/" + sentryDsn.split("@")[1]?.split("/")[0] + "/store/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exception: { values: [{ type: "Error", value: ctx.message, stacktrace: ctx.stack }] },
          tags: { source: ctx.source, url: ctx.url },
          user: ctx.userId ? { id: ctx.userId } : undefined,
        }),
      });
    } catch {
      console.warn("[error-tracking] Sentry forward failed");
    }
  }

  // Always console.error for server-side visibility
  console.error(`[${ctx.source}] ${ctx.message}`, ctx.metadata || "");
}

export function captureClientError(error: Error, userId?: string): void {
  captureError({
    message: error.message,
    stack: error.stack,
    source: "client",
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userId,
  }).catch(() => {});
}

export function captureApiError(error: unknown, endpoint: string): void {
  const message = error instanceof Error ? error.message : String(error);
  captureError({
    message,
    stack: error instanceof Error ? error.stack : undefined,
    source: "api",
    url: endpoint,
  }).catch(() => {});
}
