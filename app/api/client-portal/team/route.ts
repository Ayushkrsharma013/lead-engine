import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id") || null;
}

async function getWorkspace(userId: string) {
  const { data } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("client_user_id", userId)
    .maybeSingle();
  return data as { id: string } | null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace(userId);
  if (!workspace) return NextResponse.json({ members: [] });

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, role, invited_at, accepted_at")
    .eq("workspace_id", workspace.id)
    .order("invited_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch emails for team members from auth.users
  const members = [];
  for (const m of data || []) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
    members.push({
      id: m.id,
      user_id: m.user_id,
      email: authUser?.user?.email || m.user_id,
      role: m.role,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
    });
  }

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Find user by email
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("email", body.email.toLowerCase().trim())
    .limit(1);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: "No user found with that email. They must have a Prospecting OS account first." }, { status: 404 });
  }

  const memberId = profiles[0].id;

  // Check not already a member
  const { data: existing } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", memberId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "User is already a team member" }, { status: 409 });
  }

  const { data: member, error } = await supabaseAdmin
    .from("team_members")
    .insert({
      workspace_id: workspace.id,
      user_id: memberId,
      role: body.role || "member",
      invited_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ member });
}

export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = req.nextUrl.searchParams.get("id");
  if (!memberId) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  const workspace = await getWorkspace(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
