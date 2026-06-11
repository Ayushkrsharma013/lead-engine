import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";

/**
 * GET /api/client-portal/leads
 * Returns workspace-scoped leads from client_leads. Email is never returned.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req, "leads");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const scoreMin = searchParams.get("score_min") ? parseFloat(searchParams.get("score_min")!) : null;
  const sort = searchParams.get("sort") ?? "score";

  let query = supabaseAdmin
    .from("client_leads")
    .select("id, name, title, company, linkedin, score, icp_match_reason, created_at", { count: "exact" })
    .eq("workspace_id", auth.workspaceId)
    .order(sort === "score" ? "score" : "created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (scoreMin !== null) query = query.gte("score", scoreMin);

  const { data: leads, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    leads: leads || [],
    count: count || 0,
    page,
    limit,
    workspaceId: auth.workspaceId,
  });
}
