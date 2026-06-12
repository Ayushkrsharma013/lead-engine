import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req, "team-access");
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, role, invited_at, accepted_at")
    .eq("workspace_id", auth.workspaceId)
    .order("invited_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const memberIds = (data || []).map(m => m.user_id);

  // Batch-fetch emails from profiles instead of N+1 auth.admin calls
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, display_name")
    .in("id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const members = (data || []).map(m => {
    const p = profileMap.get(m.user_id);
    return {
      id: m.id,
      user_id: m.user_id,
      email: p?.email || m.user_id,
      display_name: p?.display_name || null,
      role: m.role,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
    };
  });

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const auth = await requirePortalAuth(req, "team-access");
  if (auth instanceof NextResponse) return auth;

  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch (err) { console.error("[client-portal/team] JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("email", body.email.toLowerCase().trim())
    .limit(1);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: "No user found with that email. They must have a Prospecting OS account first." }, { status: 404 });
  }

  const memberId = profiles[0].id;

  const { data: existing } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("workspace_id", auth.workspaceId)
    .eq("user_id", memberId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "User is already a team member" }, { status: 409 });
  }

  const { data: member, error } = await supabaseAdmin
    .from("team_members")
    .insert({
      workspace_id: auth.workspaceId,
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
  const auth = await requirePortalAuth(req, "team-access");
  if (auth instanceof NextResponse) return auth;

  const memberId = req.nextUrl.searchParams.get("id");
  if (!memberId) return NextResponse.json({ error: "Missing id param" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", auth.workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
