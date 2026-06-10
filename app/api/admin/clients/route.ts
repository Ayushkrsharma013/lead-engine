import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userRole = req.headers.get("x-user-role");
  if (userRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);
  const search = searchParams.get("search")?.trim() || "";
  const planFilter = searchParams.get("plan") || "";
  const statusFilter = searchParams.get("status") || "";

  // Build query for profiles with role=client
  let query = supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, plan, subscription_status, created_at, is_active", { count: "exact" })
    .eq("role", "client")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }
  if (planFilter) {
    query = query.eq("plan", planFilter);
  }
  if (statusFilter) {
    query = query.eq("subscription_status", statusFilter);
  }

  const { data: profiles, count, error } = await query.range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ clients: [], count: 0, page, limit });
  }

  // Fetch workspace data for each client
  const userIds = profiles.map(p => p.id);
  const { data: workspaces } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, client_user_id, leads_count, leads_generation_status, icp_locked")
    .in("client_user_id", userIds);

  const wsByUser = new Map<string, Record<string, unknown>>();
  for (const w of (workspaces || []) as Record<string, unknown>[]) {
    wsByUser.set(w.client_user_id as string, w);
  }

  const clients = profiles.map(p => {
    const ws = wsByUser.get(p.id) as Record<string, unknown> | undefined;
    return {
      id: p.id,
      email: p.email,
      name: p.full_name || p.email?.split("@")[0] || "Client",
      plan: p.plan || "pilot",
      subscription_status: p.subscription_status || "inactive",
      is_active: p.is_active ?? true,
      created_at: p.created_at,
      workspace_id: ws?.id || null,
      leads_count: ws?.leads_count || 0,
      leads_generation_status: ws?.leads_generation_status || "pending",
      icp_locked: ws?.icp_locked || false,
    };
  });

  return NextResponse.json({ clients, count: count || 0, page, limit });
}

// PATCH to update client status (suspend/activate)
export async function PATCH(req: NextRequest) {
  const userRole = req.headers.get("x-user-role");
  if (userRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; action?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  if (body.action === "suspend") {
    await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "suspended", is_active: false, updated_at: new Date().toISOString() })
      .eq("id", body.id);
    return NextResponse.json({ ok: true, status: "suspended" });
  }

  if (body.action === "activate") {
    await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "active", is_active: true, updated_at: new Date().toISOString() })
      .eq("id", body.id);
    return NextResponse.json({ ok: true, status: "active" });
  }

  return NextResponse.json({ error: "Invalid action. Use suspend or activate." }, { status: 400 });
}

// DELETE a client
export async function DELETE(req: NextRequest) {
  const userRole = req.headers.get("x-user-role");
  if (userRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Soft delete: set deleted_at and deactivate
  await supabaseAdmin
    .from("profiles")
    .update({ is_active: false, subscription_status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true, deleted: true });
}
