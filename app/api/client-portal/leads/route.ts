import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";

/**
 * GET /api/client-portal/leads
 * Returns workspace-scoped leads from client_leads with icebreakers. Email is never returned.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req, "leads");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const scoreMin = searchParams.get("score_min") ? parseFloat(searchParams.get("score_min")!) : null;
  const sort = searchParams.get("sort") ?? "score";
  const search = searchParams.get("search")?.trim() || null;

  let query = supabaseAdmin
    .from("client_leads")
    .select("id, name, title, company, linkedin_url, score, icp_match_reason, created_at", { count: "exact" })
    .eq("workspace_id", auth.workspaceId)
    .order(sort === "score" ? "score" : "created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (scoreMin !== null) query = query.gte("score", scoreMin);
  if (search) query = query.or(`name.ilike.%${search}%,title.ilike.%${search}%,company.ilike.%${search}%`);

  const { data: leads, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch icebreakers for returned leads
  const leadIds = (leads || []).map(l => l.id);
  let ibByLead: Record<string, string> = {};

  if (leadIds.length > 0) {
    const { data: icebreakers } = await supabaseAdmin
      .from("client_icebreakers")
      .select("lead_id, text")
      .in("lead_id", leadIds)
      .limit(1, { foreignTable: "lead_id" }); // one icebreaker per lead

    // Take the first icebreaker for each lead
    for (const ib of (icebreakers || [])) {
      if (!ibByLead[ib.lead_id]) {
        ibByLead[ib.lead_id] = ib.text;
      }
    }
  }

  const enriched = (leads || []).map(lead => ({
    id: lead.id,
    name: lead.name,
    title: lead.title,
    company: lead.company,
    linkedin_url: lead.linkedin_url,
    score: lead.score,
    icebreaker: ibByLead[lead.id] || null,
  }));

  return NextResponse.json({
    leads: enriched,
    count: count || 0,
    page,
    limit,
    workspaceId: auth.workspaceId,
  });
}
