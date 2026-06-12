// app/api/gmaps-outreach/auto-queue/route.ts
// Scans all gmaps leads not yet queued and auto-routes high-quality ones to the outreach pipeline.
// No manual selection needed — score >= 75, rating >= 4.0, has website/phone, operational.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assessLeadQuality,
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
  // SSR cookie auth — resilient to middleware header issues
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();

    const role = profile?.role ?? "";
    if (role !== "super_admin" && role !== "qa_agent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    console.error("[gmaps-outreach/auto-queue] Auth check failed:", err);
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({})) as { leadIds?: string[]; dryRun?: boolean };
  const dryRun = body.dryRun === true;
  const specificLeadIds = body.leadIds;

  // Fetch all unqueued gmaps leads (or specific ones if provided)
  let query = supabaseAdmin
    .from("leads")
    .select("id, name, company, industry, location, website, notes, score, status")
    .eq("source", "gmaps")
    .not("status", "in", '("meeting","won","lost")')
    .order("score", { ascending: false });

  if (specificLeadIds?.length) {
    query = query.in("id", specificLeadIds);
  }

  const { data: leads } = await query;
  if (!leads?.length) {
    return NextResponse.json({ queued: 0, skipped: 0, assessed: 0, details: [] });
  }

  // Get already-queued lead IDs to skip
  const { data: queuedRows } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("lead_id")
    .eq("step_number", 1);
  const alreadyQueued = new Set((queuedRows ?? []).map((r: { lead_id: string }) => r.lead_id));

  const details: Array<{
    leadId: string;
    name: string;
    score: number;
    qualifies: boolean;
    reasons: string[];
    action: "queued" | "skipped";
  }> = [];

  let queued = 0;
  let skipped = 0;

  for (const lead of leads) {
    const leadId = lead.id as string;

    if (alreadyQueued.has(leadId)) {
      skipped++;
      details.push({
        leadId,
        name: (lead.company || lead.name) as string,
        score: (lead.score as number) ?? 0,
        qualifies: false,
        reasons: ["already_queued"],
        action: "skipped",
      });
      continue;
    }

    const quality = assessLeadQuality(lead as any);

    if (!quality.qualifies) {
      skipped++;
      details.push({
        leadId,
        name: (lead.company || lead.name) as string,
        score: quality.score,
        qualifies: false,
        reasons: quality.reasons,
        action: "skipped",
      });
      continue;
    }

    details.push({
      leadId,
      name: (lead.company || lead.name) as string,
      score: quality.score,
      qualifies: true,
      reasons: [],
      action: dryRun ? "skipped" : "queued",
    });

    if (dryRun) {
      skipped++;
      continue;
    }

    const notes = (lead.notes as string) ?? "";
    const phone = parsePhoneFromNotes(notes);
    const city = parseCityFromLocation((lead.location as string) ?? "");
    const businessName = ((lead.company || lead.name) as string);

    const message = generateContactFormMessage({
      businessName,
      city,
      industry: (lead.industry as string) ?? "business",
      rating: quality.rating,
      reviewCount: quality.reviewCount,
      leadId,
    });

    const { error } = await supabaseAdmin.from("gmaps_outreach_queue").insert({
      lead_id: leadId,
      action_type: "contact_form_fill",
      website_url: (lead.website as string) || null,
      phone: phone || null,
      message,
      status: "pending",
      step_number: 1,
      scheduled_for: new Date().toISOString(),
    });

    if (error && error.code !== "23505") {
      details[details.length - 1].action = "skipped";
      details[details.length - 1].reasons.push(`db_error: ${error.message}`);
      skipped++;
    } else {
      queued++;
    }
  }

  const qualifyingCount = details.filter(d => d.qualifies).length;

  if (queued > 0) {
    await sendTelegram(
      `[GMap Auto-Queue] ${queued} high-quality businesses auto-routed to outreach pipeline (${qualifyingCount} qualified, ${skipped} skipped)`
    );
  }

  return NextResponse.json({
    queued,
    skipped,
    assessed: leads.length,
    qualifyingCount,
    dryRun,
    details,
  });
}
