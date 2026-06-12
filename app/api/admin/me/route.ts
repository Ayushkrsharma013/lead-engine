import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { checkMinuteLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const rateLimitId = (await headers()).get("x-forwarded-for") || "anonymous";
  const rl = checkMinuteLimit("admin-me", rateLimitId, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }
  try {
    const cookieStore = await cookies();
    const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
    const ssr = createServerClient(rawUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
    });

    const { data: { user } } = await ssr.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Use supabaseAdmin to bypass RLS and get full profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json(profile || { email: user.email, role: user.user_metadata?.role || "user" });
  } catch (err) {
    console.error("[admin/me] Profile fetch failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
