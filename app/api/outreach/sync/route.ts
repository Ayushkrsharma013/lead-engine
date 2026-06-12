import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mapOOLeadToLead } from "@/lib/openoutreach";
import type { OOSyncPayload } from "@/lib/openoutreach";

export async function POST(req: NextRequest) {
  let body: OOSyncPayload;
  try {
    body = await req.json() as OOSyncPayload;
  } catch (err) { console.error("[outreach/sync] JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { leads = [], deals = [], campaigns = [] } = body;

  if (!Array.isArray(leads)) {
    return NextResponse.json({ error: "leads must be an array" }, { status: 400 });
  }

  // Build a quick deal lookup by lead_id
  const dealByLeadId = new Map(deals.map(d => [d.lead_id, d]));

  // Map OO leads → our Lead shape
  const mapped = leads
    .filter(l => !l.disqualified)
    .map(l => mapOOLeadToLead(l, dealByLeadId.get(l.id)));

  if (mapped.length === 0) {
    return NextResponse.json({ synced: 0, campaigns: campaigns.length });
  }

  // Upsert into Supabase leads table — conflict on id (snake_case column)
  const { error, count } = await supabaseAdmin
    .from("leads")
    .upsert(
      mapped.map(l => ({
        id: l.id,
        name: l.name,
        title: l.title,
        company: l.company,
        industry: l.industry,
        location: l.location,
        email: l.email,
        email_status: l.emailStatus,
        linkedin: l.linkedin,
        website: l.website,
        company_size: l.companySize,
        score: l.score,
        source: l.source,
        status: l.status,
        kanban_column: l.kanbanColumn,
        saved_at: l.savedAt,
        fetched_at: l.fetchedAt,
        tags: l.tags,
        notes: l.notes,
      })),
      { onConflict: "id", count: "exact" }
    );

  if (error) {
    console.error("[outreach/sync] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the sync activity
  await supabaseAdmin.from("activity_log").insert({
    type: "lead_added",
    text: `OpenOutreach sync: ${count ?? mapped.length} leads imported from LinkedIn automation`,
  }).then(() => {/* fire-and-forget */});

  return NextResponse.json({
    synced: count ?? mapped.length,
    campaigns: campaigns.length,
  });
}
