import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

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

  let body: { executionId?: string; sequenceId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { executionId, sequenceId, action } = body;
  if (!action || !["pause", "cancel"].includes(action)) {
    return NextResponse.json({ error: "action must be 'pause' or 'cancel'" }, { status: 400 });
  }

  try {
    const newStatus = action === "cancel" ? "cancelled" : "paused";
    if (executionId) {
      await supabaseAdmin
        .from("sequence_executions")
        .update({ status: newStatus })
        .eq("id", executionId);
    } else if (sequenceId) {
      await supabaseAdmin
        .from("sequence_executions")
        .update({ status: newStatus })
        .eq("sequence_id", sequenceId)
        .in("status", ["active"]);
    } else {
      return NextResponse.json({ error: "executionId or sequenceId required" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
