import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";

/**
 * GET /api/client-portal/icebreakers
 * Returns workspace-scoped leads with their icebreakers.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req, "icebreakers");
  if (auth instanceof NextResponse) return auth;

  // Scores stored on 0-10 scale; 6.0 = ICP-aligned, 8.0 = hot
  const { data: leads, error: leadsError } = await supabaseAdmin
    .from("client_leads")
    .select("id, name, title, company, linkedin_url, score")
    .eq("workspace_id", auth.workspaceId)
    .gte("score", 6.0)
    .order("score", { ascending: false })
    .limit(100);

  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 });
  if (!leads || leads.length === 0) return NextResponse.json({ leads: [] });

  const leadIds = leads.map(l => l.id);
  const { data: icebreakers, error: ibError } = await supabaseAdmin
    .from("client_icebreakers")
    .select("id, lead_id, text")
    .in("lead_id", leadIds);

  if (ibError) return NextResponse.json({ error: ibError.message }, { status: 500 });

  const ibByLead: Record<string, Array<{ id: string; text: string }>> = {};
  for (const ib of icebreakers || []) {
    if (!ibByLead[ib.lead_id]) ibByLead[ib.lead_id] = [];
    ibByLead[ib.lead_id].push({ id: ib.id, text: ib.text });
  }

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
