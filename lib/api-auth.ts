import { NextRequest, NextResponse } from "next/server";

// NOTE: This API auth uses NEXT_PUBLIC_SUPABASE_ANON_KEY as a Bearer token.
// That value is the Supabase anonymous (anon) key — it is designed to be
// public / safe to expose in client-side code and is NOT a secret.  Any
// caller who inspects the frontend source can discover it.
//
// Compensating control: endpoints gated by this check are also protected
// by IP-based rate limiting via the `tool_rate_limits` table, which
// prevents abuse from a single origin.
//
// A proper auth migration (e.g. a dedicated API key or Supabase RLS-based
// authentication) is tracked as a future task.  For now, this layer exists
// as a light obfuscation / non-publicity barrier only.

const API_SECRET = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function validateApiAuth(req: NextRequest): NextResponse | null {
  if (!API_SECRET) return null; // misconfigured — let route decide

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token !== API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // auth ok
}
