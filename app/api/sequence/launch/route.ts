import { NextRequest, NextResponse } from "next/server";
import { launchSequence } from "@/lib/sequence-engine";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { sequenceId?: string };
  try {
    body = await req.json();
  } catch (err) { console.error("[sequence/launch] JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sequenceId } = body;
  if (!sequenceId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });

  try {
    const result = await launchSequence(sequenceId, user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
