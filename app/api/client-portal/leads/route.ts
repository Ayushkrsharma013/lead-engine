import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/client-portal/leads
 * Returns workspace-scoped leads from client_leads table.
 * Email is NEVER returned in the response.
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lookup workspace for this user
  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, plan")
    .eq("client_user_id", userId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ leads: [], count: 0, page: 1, limit: 50 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const scoreMin = searchParams.get("score_min") ? parseInt(searchParams.get("score_min")!) : null;
  const sort = searchParams.get("sort") ?? "score";

  // Query client_leads — explicitly exclude email from select
  let query = supabaseAdmin
    .from("client_leads")
    .select("id, name, title, company, linkedin_url, score, icp_match_reason, created_at", { count: "exact" })
    .eq("workspace_id", workspace.id)
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
    workspaceId: workspace.id,
  });
}
