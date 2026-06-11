import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req, "sequences");
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin
    .from("client_sequences")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sequences: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePortalAuth(req, "sequences");
  if (auth instanceof NextResponse) return auth;

  let body: { name?: string; steps?: unknown[]; schedule?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("client_sequences")
    .insert({
      workspace_id: auth.workspaceId,
      name: body.name.trim(),
      steps: body.steps || [],
      schedule: body.schedule || null,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sequence: data });
}

export async function PUT(req: NextRequest) {
  const auth = await requirePortalAuth(req, "sequences");
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  let body: { name?: string; steps?: unknown[]; schedule?: Record<string, unknown>; status?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.steps !== undefined) updates.steps = body.steps;
  if (body.schedule !== undefined) updates.schedule = body.schedule;
  if (body.status !== undefined) updates.status = body.status;

  const { error } = await supabaseAdmin
    .from("client_sequences")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePortalAuth(req, "sequences");
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("client_sequences")
    .delete()
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
