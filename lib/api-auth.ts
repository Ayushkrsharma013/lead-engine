import { NextRequest, NextResponse } from "next/server";

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
