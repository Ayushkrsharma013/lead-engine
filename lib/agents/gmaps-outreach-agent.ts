// lib/agents/gmaps-outreach-agent.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { AgentModule, AgentResult, AgentAction } from "./types";
import { readKnowledgeNumber, writeKnowledge } from "./knowledge";
import {
  parseRatingFromNotes,
  parsePhoneFromNotes,
  parseCityFromLocation,
  generateContactFormMessage,
  generateSmsMessage,
} from "./gmaps-message";

export class GmapsOutreachAgent implements AgentModule {
  name = "gmaps-outreach-agent";
  displayName = "GMap Outreach Agent";
  description = "Queues contact form fills and SMS follow-ups for Google Maps businesses to sell Missed Call Recovery";

  async run(config: Record<string, unknown>): Promise<AgentResult> {
    const log: string[] = [];
    const actionsToQueue: AgentAction[] = [];

    const dailyCap = Number(config.daily_cap ?? (await readKnowledgeNumber("gmaps_outreach.daily_cap", 30)));
    const smsCap = Number(config.sms_cap ?? 20);

    // ── Step 1: Find new prospects ─────────────────────────────────────────────
    const { data: queuedRows } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("lead_id");
    const alreadyQueued = new Set(
      (queuedRows ?? []).map((r: { lead_id: string }) => r.lead_id)
    );

    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from("leads")
      .select("id, name, company, industry, location, website, notes, score")
      .eq("source", "gmaps")
      .not("status", "in", '("meeting","won")')
      .or("website.neq.,notes.ilike.%Phone:%")
      .order("score", { ascending: false })
      .limit(dailyCap * 2);

    if (leadsErr) {
      return {
        outcome: "failed",
        log: `DB error fetching leads: ${leadsErr.message}`,
        safeActionsExecuted: 0,
        actionsToQueue: [],
      };
    }

    const newProspects = (leads ?? [])
      .filter((l: { id: string }) => !alreadyQueued.has(l.id))
      .slice(0, dailyCap);

    log.push(
      `Step 1: ${newProspects.length} new prospects found (${alreadyQueued.size} already queued, cap: ${dailyCap})`
    );

    // ── Steps 2+3: Generate messages + queue contact form fills ────────────────
    for (const lead of newProspects) {
      const notes = (lead.notes as string) ?? "";
      const { rating, reviewCount } = parseRatingFromNotes(notes);
      const phone = parsePhoneFromNotes(notes);
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

      actionsToQueue.push({
        type: "gmaps_contact_form_fill",
        description: `Send contact form to ${businessName} (${city}) — Tier ${
          rating >= 4.5 && reviewCount >= 100 ? "A" : rating >= 4.0 || reviewCount >= 20 ? "B" : "C"
        }`,
        riskLevel: "medium",
        payload: {
          leadId: lead.id,
          websiteUrl: (lead.website as string) ?? "",
          phone,
          message,
          stepNumber: 1,
        },
      });
    }

    if (newProspects.length > 0) {
      log.push(`Step 3: Queued ${newProspects.length} contact form fills — pending Telegram approval`);
    }

    // ── Step 4: Check day-3 follow-up eligibility ──────────────────────────────
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

    const { data: doneStep1 } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("lead_id, phone, executed_at")
      .eq("step_number", 1)
      .eq("status", "done")
      .lt("executed_at", threeDaysAgo)
      .limit(smsCap);

    let smsQueued = 0;
    for (const row of (doneStep1 ?? [])) {
      const leadId = row.lead_id as string;

      // Skip if already booked
      const { data: booked } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .ilike("notes", `%lid=${leadId}%`)
        .maybeSingle();
      if (booked) continue;

      // Skip if step 2 already exists
      const { data: existingStep2 } = await supabaseAdmin
        .from("gmaps_outreach_queue")
        .select("id")
        .eq("lead_id", leadId)
        .eq("step_number", 2)
        .maybeSingle();
      if (existingStep2) continue;

      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, company, name")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead) continue;

      const businessName = ((lead.company || lead.name) as string);
      const smsMessage = generateSmsMessage({ businessName, leadId });

      actionsToQueue.push({
        type: "gmaps_sms_follow_up",
        description: `Day-3 SMS follow-up for ${businessName}`,
        riskLevel: "medium",
        payload: {
          leadId,
          phone: (row.phone as string) ?? "",
          message: smsMessage,
          stepNumber: 2,
        },
      });
      smsQueued++;
    }

    if (smsQueued > 0) {
      log.push(`Step 4: Queued ${smsQueued} SMS follow-ups — pending Telegram approval`);
    }

    // ── Step 4b: Detect new bookings + update lead status ─────────────────────
    const { data: sentItems } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("lead_id, executed_at")
      .eq("status", "done");

    let bookingsDetected = 0;
    for (const item of (sentItems ?? [])) {
      const leadId = item.lead_id as string;

      const { data: appointment } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .ilike("notes", `%lid=${leadId}%`)
        .gt("created_at", (item.executed_at as string) ?? "2000-01-01")
        .maybeSingle();

      if (!appointment) continue;

      const { data: currentLead } = await supabaseAdmin
        .from("leads")
        .select("status, name, company, location")
        .eq("id", leadId)
        .maybeSingle();
      if (!currentLead || currentLead.status === "meeting" || currentLead.status === "won") continue;

      await supabaseAdmin.from("leads").update({
        status: "meeting",
        kanban_column: "Meeting",
        last_touched: new Date().toISOString(),
      }).eq("id", leadId);

      const businessName = ((currentLead.company || currentLead.name) as string);
      const city = parseCityFromLocation((currentLead.location as string) ?? "");
      await supabaseAdmin.from("activity_log").insert({
        type: "meeting_booked",
        text: `Discovery call booked via GMap outreach — ${businessName}, ${city}`,
        lead_id: leadId,
      });
      bookingsDetected++;
    }

    if (bookingsDetected > 0) {
      log.push(`Step 4b: Detected ${bookingsDetected} new booking(s) — leads moved to Meeting`);
    }

    // ── Step 5: Write knowledge store ─────────────────────────────────────────
    const { count: pipelineSize } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("*", { count: "exact", head: true });

    const today = new Date().toISOString().split("T")[0];
    const { count: formsSentToday } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "done")
      .eq("step_number", 1)
      .gte("executed_at", `${today}T00:00:00Z`);

    const { count: meetingsBooked } = await supabaseAdmin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .ilike("notes", "%ref=gmaps%");

    const { count: totalFormsSent } = await supabaseAdmin
      .from("gmaps_outreach_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "done")
      .eq("step_number", 1);

    const convRate =
      totalFormsSent && meetingsBooked
        ? `${Math.round(((meetingsBooked ?? 0) / totalFormsSent) * 100)}%`
        : "0%";

    await writeKnowledge("gmaps_outreach.pipeline_size", pipelineSize ?? 0, "gmaps-outreach-agent");
    await writeKnowledge("gmaps_outreach.forms_sent_today", formsSentToday ?? 0, "gmaps-outreach-agent");
    await writeKnowledge("gmaps_outreach.meetings_booked", meetingsBooked ?? 0, "gmaps-outreach-agent");
    await writeKnowledge("gmaps_outreach.conversion_rate", convRate, "gmaps-outreach-agent");

    log.push(
      `Step 5: pipeline=${pipelineSize ?? 0}, sent_today=${formsSentToday ?? 0}, meetings=${meetingsBooked ?? 0}, conv=${convRate}`
    );

    return {
      outcome: "success",
      log: log.join("\n"),
      safeActionsExecuted: bookingsDetected,
      actionsToQueue,
    };
  }
}

export const gmapsOutreachAgent = new GmapsOutreachAgent();
