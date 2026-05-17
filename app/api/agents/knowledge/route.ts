import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (key) {
    const { data } = await supabaseAdmin
      .from("knowledge_store")
      .select("key, value, agent, updated_at")
      .eq("key", key)
      .maybeSingle();
    return NextResponse.json({ key, value: data?.value ?? null, agent: data?.agent ?? null, updated_at: data?.updated_at ?? null });
  }

  const { data } = await supabaseAdmin
    .from("knowledge_store")
    .select("key, value, agent, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ knowledge: data || [] });
}
