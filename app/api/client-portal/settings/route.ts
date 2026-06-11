import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, icp_config, icp_locked")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  return NextResponse.json({
    icp_config: (workspace as any)?.icp_config || {},
    icp_locked: (workspace as any)?.icp_locked || false,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePortalAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Verify ICP is not locked before allowing changes
  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, icp_locked")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if ((workspace as any).icp_locked) {
    return NextResponse.json({ error: "ICP is locked. Contact support to make changes." }, { status: 403 });
  }

  let body: { industries?: string[]; locations?: string; minScore?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from("client_workspaces")
    .select("icp_config")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  const existing = ((current as any)?.icp_config || {}) as Record<string, unknown>;
  const updated = { ...existing };
  if (body.industries !== undefined) updated.industries = body.industries;
  if (body.locations !== undefined) updated.locations = body.locations;
  if (body.minScore !== undefined) updated.minScore = body.minScore;

  const { error } = await supabaseAdmin
    .from("client_workspaces")
    .update({ icp_config: updated, updated_at: new Date().toISOString() })
    .eq("id", auth.workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, icp_config: updated });
}
