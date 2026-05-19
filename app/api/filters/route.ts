import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("saved_filters")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ filters: data });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, config } = await req.json();
    if (!name || !config) return NextResponse.json({ error: "name and config required" }, { status: 400 });

    // Upsert: if filter with same name exists, update it
    const { data: existing } = await supabaseAdmin
      .from("saved_filters")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("saved_filters")
        .update({ filter_config: config, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ filter: data });
    }

    const { data, error } = await supabaseAdmin
      .from("saved_filters")
      .insert({ user_id: userId, name, filter_config: config })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ filter: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
