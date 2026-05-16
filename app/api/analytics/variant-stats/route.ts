import { NextRequest, NextResponse } from "next/server";
import { getVariantStats } from "@/lib/db";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sequenceId = searchParams.get("sequenceId");
  if (!sequenceId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });

  try {
    const stats = await getVariantStats(sequenceId);
    return NextResponse.json({ stats });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
