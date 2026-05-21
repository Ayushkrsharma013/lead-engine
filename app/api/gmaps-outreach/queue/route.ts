// app/api/gmaps-outreach/queue/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromHeaders } from "@/lib/auth";
import {
  parseRatingFromNotes,
  parsePhoneFromNotes,
  parseCityFromLocation,
  generateContactFormMessage,
} from "@/lib/agents/gmaps-message";

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => undefined);
}

export async function POST(req: Request) {
  const user = await getUserFromHeaders();
  if (!user || !["super_admin", "qa_agent"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { leadIds?: string[] };
  const { leadIds } = body;
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds array required" }, { status: 400 });
  }

  let queued = 0;
  let skipped = 0;
  const skipReasons: string[] = [];

  for (const leadId of leadIds) {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, company, industry, location, website, notes")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) {
      skipped++;
      skipReasons.push(`${leadId}: not found in DB`);
      continue;
    }

    const { data: existing } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("id")
      .eq("lead_id", leadId)
      .eq("step_number", 1)
      .maybeSingle();

    if (existing) {
      skipped++;
      skipReasons.push(`${leadId}: already_queued`);
      continue;
    }

    const notes = (lead.notes as string) ?? "";
    const phone = parsePhoneFromNotes(notes);
    const website = (lead.website as string) ?? "";
    if (!website && !phone) {
      skipped++;
      skipReasons.push(`${leadId}: no_contact_method`);
      continue;
    }

    const { rating, reviewCount } = parseRatingFromNotes(notes);
    const city = parseCityFromLocation((lead.location as string) ?? "");
    const businessName = ((lead.company || lead.name) as string);

    const message = generateContactFormMessage({
      businessName,
      city,
      industry: (lead.industry as string) ?? "business",
      rating,
      reviewCount,
      leadId: lead.id as string,
    });

    const { error } = await supabaseAdmin.from("gmaps_outreach_queue").insert({
      lead_id: leadId,
      action_type: "contact_form_fill",
      website_url: website || null,
      phone: phone || null,
      message,
      status: "pending",
      step_number: 1,
      scheduled_for: new Date().toISOString(),
    });

    if (error && error.code !== "23505") {
      skipped++;
      skipReasons.push(`${leadId}: db_error — ${error.message}`);
      continue;
    }
    queued++;
  }

  if (queued > 0) {
    await sendTelegram(
      `[GMap Outreach] ${queued} businesses added to outreach queue via /gmaps-search — pending runner execution`
    );
  }

  return NextResponse.json({ queued, skipped, skipReasons });
}
