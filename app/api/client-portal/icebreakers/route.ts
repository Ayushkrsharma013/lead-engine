import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/client-portal/icebreakers
 * Returns workspace-scoped leads with their icebreakers (one per lead).
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lookup workspace
  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("client_user_id", userId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ leads: [] });
  }

  // Get leads with score >= 50 for this workspace (exclude email)
  const { data: leads, error: leadsError } = await supabaseAdmin
    .from("client_leads")
    .select("id, name, title, company, linkedin_url, score")
    .eq("workspace_id", workspace.id)
    .gte("score", 50)
    .order("score", { ascending: false })
    .limit(100);

  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 });
  if (!leads || leads.length === 0) return NextResponse.json({ leads: [] });

  // Get icebreakers for these leads
  const leadIds = leads.map(l => l.id);
  const { data: icebreakers, error: ibError } = await supabaseAdmin
    .from("client_icebreakers")
    .select("id, lead_id, text")
    .in("lead_id", leadIds);

  if (ibError) return NextResponse.json({ error: ibError.message }, { status: 500 });

  // Group icebreakers by lead_id
  const ibByLead: Record<string, Array<{ id: string; text: string }>> = {};
  for (const ib of icebreakers || []) {
    if (!ibByLead[ib.lead_id]) ibByLead[ib.lead_id] = [];
    ibByLead[ib.lead_id].push({ id: ib.id, text: ib.text });
  }

  // Enrich leads with icebreakers
  const enriched = leads.map(lead => ({
    id: lead.id,
    name: lead.name,
    title: lead.title,
    company: lead.company,
    linkedin_url: lead.linkedin_url,
    score: lead.score,
    icebreakers: (ibByLead[lead.id] || []).map(ib => ({
      id: ib.id,
      body: ib.text,
      subject: "",
      tone: "friendly",
    })),
  }));

  return NextResponse.json({ leads: enriched });
}
