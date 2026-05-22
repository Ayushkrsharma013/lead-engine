// app/api/gmaps-outreach/queue/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

// GET — called by local runner to fetch pending queue items
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const runnerSecret = process.env.GMAPS_RUNNER_SECRET || process.env.CRON_SECRET || "gmaps-runner-v1";
  if (secret !== runnerSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("step_number", { ascending: true })
    .order("scheduled_for", { ascending: true })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get daily counts for cap enforcement
  const today = new Date().toISOString().split("T")[0];
  const { count: formsFilled } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "contact_form_fill")
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);
  const { count: smsSent } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "sms_follow_up")
    .eq("status", "done")
    .gte("executed_at", `${today}T00:00:00Z`);

  return NextResponse.json({
    items: data ?? [],
    dailyCounts: { formsFilled: formsFilled ?? 0, smsSent: smsSent ?? 0 },
  });
}

// PATCH — called by local runner to report execution results
export async function PATCH(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const runnerSecret = process.env.GMAPS_RUNNER_SECRET || process.env.CRON_SECRET || "gmaps-runner-v1";
  if (secret !== runnerSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    id: string;
    status: "executing" | "done" | "failed" | "skipped";
    error?: string;
  };

  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const update: Record<string, any> = { status: body.status };
  if (body.status === "done" || body.status === "failed" || body.status === "skipped") {
    update.executed_at = new Date().toISOString();
  }
  if (body.error) update.error = body.error;

  const { error } = await supabaseAdmin
    .from("gmaps_outreach_queue")
    .update(update)
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
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
  } catch {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
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
