import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id") || null;
}

async function getWorkspace(userId: string) {
  const { data } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, plan")
    .eq("client_user_id", userId)
    .maybeSingle();
  return data as { id: string; plan: string } | null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace(userId);
  if (!workspace) return NextResponse.json({ sequences: [] });

  const { data, error } = await supabaseAdmin
    .from("client_sequences")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sequences: data || [] });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let body: { name?: string; steps?: unknown[]; schedule?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("client_sequences")
    .insert({
      workspace_id: workspace.id,
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
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  const workspace = await getWorkspace(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

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
    .eq("workspace_id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  const workspace = await getWorkspace(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("client_sequences")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
