import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Validate that the request comes from an authenticated Supabase session.
 * Returns the user ID if valid, or a 401 Response if not.
 */
export async function requireApiSession(
  req: NextRequest
): Promise<{ userId: string } | NextResponse> {
  try {
    const cookieStore = req.cookies;
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return { userId: user.id };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// ─── Legacy — kept for backward compatibility during migration ───────────
// @deprecated Use requireApiSession(req) instead.
// The old validateApiAuth used NEXT_PUBLIC_SUPABASE_ANON_KEY (a public value)
// as a Bearer token — that was security theater. All routes have been
// migrated to proper SSR cookie-session auth.

const LEGACY_SECRET = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function validateApiAuth(req: NextRequest): NextResponse | null {
  if (!LEGACY_SECRET) return null;

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token !== LEGACY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
