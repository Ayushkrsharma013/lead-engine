import {
  getDueExecutions,
  hasRecentMessages,
  updateSequenceExecution,
  insertSequenceMessage,
  getSequences,
  batchUpdateLeadKanban,
  findLeadByEmail,
  findSequenceMessageByResendId,
  updateSequenceMessageStatus,
  logActivity,
  leadFromDB as leadFromRow,
} from "./db";
import { enqueueLinkedInAction, isAlreadyQueued } from "./linkedin-queue";
import { sendEmail, buildProspectingEmailHtml } from "./resend";
import { supabaseAdmin } from "./supabase";
import type { Sequence, SequenceExecution, Lead } from "./types";

const supabase = supabaseAdmin;

// ─── Batch Icebreaker Generator (server-side, no rate limit) ─────────────────

interface CronResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  locked: boolean;
}

// ─── Template Resolution ─────────────────────────────────────────────────────

export function resolveTemplate(template: string, lead: Lead): string {
  const vars: Record<string, string> = {
    "{{first_name}}": lead.name?.split(" ")[0] || "there",
    "{{company}}": lead.company || "",
    "{{industry}}": lead.industry || "",
    "{{title}}": lead.title || "",
  };

  let resolved = template;
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replaceAll(key, value);
  }
  resolved = resolved.replace(/\{\{[^}]+\}\}/g, "");
  return resolved.trim();
}

// ─── Launch ──────────────────────────────────────────────────────────────────

export async function launchSequence(sequenceId: string, userId?: string): Promise<{
  sequence: Sequence;
  executions: SequenceExecution[];
  alreadyRunning: number;
}> {
  const sequences = await getSequences();
  const sequence = sequences.find(s => s.id === sequenceId);
  if (!sequence) throw new Error("Sequence not found");

  const { data: existing } = await supabase
    .from("sequence_executions")
    .select("lead_id, status")
    .eq("sequence_id", sequenceId)
    .in("status", ["active", "paused"]);

  const existingLeadIds = new Set((existing || []).map((e: Record<string, unknown>) => String(e.lead_id)));
  const alreadyRunning = existingLeadIds.size;

  const { data: leads } = await supabase
    .from("leads")
    .select("id")
    .in("id", sequence.assignedLeadIds);

  const leadIds = (leads || []).map((l: Record<string, unknown>) => String(l.id));
  const newLeadIds = leadIds.filter(id => !existingLeadIds.has(id));

  if (newLeadIds.length === 0) {
    return { sequence, executions: [], alreadyRunning };
  }

  // Round-robin variant assignment: A, B, C... based on step's variants array
  const firstStep = sequence.steps[0];
  const variantLabels = firstStep?.variants && firstStep.variants.length > 0
    ? firstStep.variants.map((_, i) => String.fromCharCode(65 + i)) // A, B, C...
    : ["A"];

  const rows = newLeadIds.map((leadId, idx) => ({
    sequence_id: sequenceId,
    lead_id: leadId,
    status: "active",
    variant: variantLabels[idx % variantLabels.length],
    user_id: userId || null,
  }));

  const { data: created } = await supabase
    .from("sequence_executions")
    .insert(rows)
    .select();

  const executions: SequenceExecution[] = (created || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    sequenceId: String(r.sequence_id),
    leadId: String(r.lead_id),
    currentStep: Number(r.current_step ?? 0),
    status: String(r.status) as SequenceExecution["status"],
    variant: String(r.variant || "A"),
    startedAt: String(r.started_at || new Date().toISOString()),
    lastActionAt: String(r.last_action_at || new Date().toISOString()),
    createdAt: String(r.created_at || ""),
  }));

  await logActivity({
    type: "notification",
    text: `Sequence "${sequence.name}" launched for ${newLeadIds.length} leads`,
  });

  return { sequence, executions, alreadyRunning };
}

// ─── Cron Handler ────────────────────────────────────────────────────────────

export async function processDueSteps(): Promise<CronResult> {
  // Prevent overlapping cron runs
  const locked = await hasRecentMessages(4);
  if (locked) {
    console.log("[sequence-engine] Skipping — another cron run in progress");
    return { processed: 0, sent: 0, skipped: 0, failed: 0, locked: true };
  }

  const executions = await getDueExecutions();
  if (executions.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, locked: false };
  }

  const sequences = await getSequences();
  const sequenceMap = new Map(sequences.map(s => [s.id, s]));

  // Get all leads for active executions in one query
  const leadIds = Array.from(new Set(executions.map(e => e.leadId)));
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .in("id", leadIds);
  const leadMap = new Map((leads || []).map((l: Record<string, unknown>) => [String(l.id), l]));

  let sent = 0, skipped = 0, failed = 0;
  const contactedLeadIds: string[] = [];

  for (const exec of executions) {
    const sequence = sequenceMap.get(exec.sequenceId);
    if (!sequence) { skipped++; continue; }

    const step = sequence.steps[exec.currentStep];
    if (!step || !step.active) {
      const nextStep = exec.currentStep + 1;
      if (nextStep >= sequence.steps.length) {
        await updateSequenceExecution(exec.id, { status: "completed" });
      } else {
        await updateSequenceExecution(exec.id, { current_step: nextStep });
      }
      skipped++;
      continue;
    }

    // Check if step is due based on day offset
    const startedAt = new Date(exec.startedAt).getTime();
    const dueAt = startedAt + step.day * 86400000;
    if (Date.now() < dueAt) { skipped++; continue; }

    // Duplicate prevention
    const { data: existingMsg } = await supabase
      .from("sequence_messages")
      .select("id")
      .eq("execution_id", exec.id)
      .eq("step_index", exec.currentStep)
      .maybeSingle();
    if (existingMsg) { skipped++; continue; }

    // Queue LinkedIn steps in linkedin_queue for local runner execution
    if (step.channel === "linkedin") {
      const leadRow = leadMap.get(exec.leadId);
      const profileUrl = leadRow ? String(leadRow.linkedin || "") : "";

      // Only enqueue if lead has a LinkedIn URL and isn't already queued
      if (profileUrl) {
        const alreadyQueued = await isAlreadyQueued(
          exec.leadId,
          step.type === "connection_request" ? "connection_request" : "dm"
        );
        if (!alreadyQueued) {
          const resolvedMessage = leadRow
            ? resolveTemplate(step.template, leadFromRow(leadRow))
            : step.template;
          const scheduledFor = new Date(
            new Date(exec.startedAt).getTime() + step.day * 86400000
          );
          await enqueueLinkedInAction({
            leadId: exec.leadId,
            linkedinProfileUrl: profileUrl,
            actionType: step.type === "connection_request" ? "connection_request" : "dm",
            message: resolvedMessage,
            scheduledFor,
            sequenceExecutionId: exec.id,
          });
        }
      }

      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "linkedin",
        subject: step.type,
        body: step.template,
        status: "queued",
        variant: exec.variant,
      });
      const nextStep = exec.currentStep + 1;
      if (nextStep >= sequence.steps.length) {
        await updateSequenceExecution(exec.id, { status: "completed" });
      } else {
        await updateSequenceExecution(exec.id, { current_step: nextStep });
      }
      skipped++;
      continue;
    }

    // Resolve template and send email
    const leadRow = leadMap.get(exec.leadId);
    if (!leadRow) { skipped++; continue; }
    const lead = leadFromRow(leadRow);

    // Pick template based on variant assignment
    const variantIdx = exec.variant ? exec.variant.charCodeAt(0) - 65 : 0;
    const variantTemplate = step.variants && step.variants.length > variantIdx
      ? step.variants[variantIdx]
      : null;
    const template = variantTemplate || step.template;

    let subject = step.type;
    let body = resolveTemplate(template, lead);

    // Cold email has Subject: prefix in template
    if (template.startsWith("Subject:")) {
      const newlineIdx = template.indexOf("\n");
      subject = resolveTemplate(template.slice(0, newlineIdx).replace("Subject:", "").trim(), lead);
      body = resolveTemplate(template.slice(newlineIdx + 1), lead);
    }

    const html = buildProspectingEmailHtml({ leadName: lead.name, subject, body });

    // Retry up to 3 times
    let result: { ok: boolean; resendId?: string } = { ok: false };
    for (let attempt = 0; attempt < 3; attempt++) {
      result = await sendEmail({ to: lead.email, subject, html });
      if (result.ok) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }

    if (result.ok) {
      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "email",
        subject,
        body,
        status: "sent",
        resendId: result.resendId,
        variant: exec.variant,
      });
      sent++;
      contactedLeadIds.push(exec.leadId);
    } else {
      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "email",
        subject,
        body,
        status: "failed",
        variant: exec.variant,
      });
      failed++;
    }

    // Advance to next step
    const nextStep = exec.currentStep + 1;
    const now = new Date().toISOString();
    if (nextStep >= sequence.steps.length) {
      await updateSequenceExecution(exec.id, { status: "completed", last_action_at: now });
    } else {
      await updateSequenceExecution(exec.id, { current_step: nextStep, last_action_at: now });
    }
  }

  // Auto-move contacted leads to "Contacted" in kanban
  if (contactedLeadIds.length > 0) {
    try {
      await batchUpdateLeadKanban(contactedLeadIds, "Contacted", "contacted");
    } catch (err) {
      console.warn("[sequence-engine] Kanban update failed:", err);
    }
  }

  const processed = executions.length;
  console.log(`[sequence-engine] Processed ${processed} — sent=${sent} skipped=${skipped} failed=${failed}`);
  return { processed, sent, skipped, failed, locked: false };
}

// ─── Inbound Reply Processing ─────────────────────────────────────────────────

export interface InboundReplyResult {
  matched: boolean;
  leadId?: string;
  leadName?: string;
  messageMatched: boolean;
  action: string;
}

export async function processInboundReply(params: {
  fromEmail: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
}): Promise<InboundReplyResult> {
  const { fromEmail, subject, bodyText, inReplyTo } = params;

  // 1. Match lead by email
  const lead = await findLeadByEmail(fromEmail);
  if (!lead) {
    console.log(`[inbound] No lead found for email: ${fromEmail}`);
    return { matched: false, messageMatched: false, action: "no_lead_match" };
  }

  // 2. Try to match the sequence message by Resend ID in In-Reply-To header
  let messageMatched = false;
  if (inReplyTo) {
    const msg = await findSequenceMessageByResendId(inReplyTo);
    if (msg) {
      await updateSequenceMessageStatus(msg.id, "replied");
      messageMatched = true;
    }
  }

  // 3. Update lead kanban status
  try {
    await batchUpdateLeadKanban([lead.id], "Replied", "replied");
  } catch (err) {
    console.warn("[inbound] Kanban update failed:", err);
  }

  // 3b. Boost lead score on reply (+15, capped at 100)
  try {
    const currentScore = typeof lead.score === "number" ? lead.score : 0;
    const newScore = Math.min(100, currentScore + 15);
    if (newScore > currentScore) {
      await supabase
        .from("leads")
        .update({ score: newScore, last_touched: new Date().toISOString() })
        .eq("id", lead.id);
    }
  } catch (err) {
    console.warn("[inbound] Score boost failed:", err);
  }

  // 4. Log activity
  const preview = bodyText.length > 200 ? bodyText.slice(0, 200) + "..." : bodyText;
  try {
    await logActivity({
      type: "message_sent",
      text: `${lead.name} replied: "${preview}"`,
      leadId: lead.id,
    });
  } catch (err) {
    console.warn("[inbound] Activity log failed:", err);
  }

  return {
    matched: true,
    leadId: lead.id,
    leadName: lead.name,
    messageMatched,
    action: messageMatched ? "lead_matched_message_updated" : "lead_matched_no_message",
  };
}

// ─── Batch Icebreaker Generator (server-side, bypasses 3/day rate limit) ─────

export interface IcebreakerResult {
  leadId: string;
  leadName: string;
  company: string;
  icebreakers: string[];
}

/**
 * Generate 5 icebreakers per lead for the top N leads.
 * Uses Gemini directly — no rate limit. For founder's own outreach use.
 */
export async function generateBatchIcebreakers(
  leads: Array<{ id: string; name: string; title: string; company: string; industry: string }>,
  count: number = 5
): Promise<IcebreakerResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[batch-icebreaker] No GEMINI_API_KEY configured");
    return [];
  }

  const results: IcebreakerResult[] = [];

  for (const lead of leads) {
    const prompt = `You are an expert B2B outreach specialist. Write ${count} short, personalized icebreaker opening lines for a LinkedIn DM. Each line must be 1-2 sentences, reference something specific about the prospect, and avoid generic flattery.

PROSPECT:
- Name: ${lead.name}
- Title: ${lead.title}
- Company: ${lead.company}
- Industry: ${lead.industry || "Not specified"}

Return exactly ${count} icebreakers, one per line, numbered 1-${count}. No introductions, no explanations.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.9, topP: 0.95 },
          }),
        }
      );

      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Parse numbered lines
      const lines = text
        .split("\n")
        .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
        .filter((l) => l.length > 10);

      results.push({
        leadId: lead.id,
        leadName: lead.name,
        company: lead.company,
        icebreakers: lines.slice(0, count),
      });
    } catch (err) {
      console.warn(`[batch-icebreaker] Failed for ${lead.name}:`, err);
      results.push({
        leadId: lead.id,
        leadName: lead.name,
        company: lead.company,
        icebreakers: ["Could not generate icebreakers — please try manually."],
      });
    }
  }

  return results;
}

// ─── LinkedIn Outreach Sequence Templates ────────────────────────────────────

export const LINKEDIN_SEQUENCE_TEMPLATES = {
  /** Step 1: Connection request (300 char limit) */
  connection_request: (firstName: string, company: string, industry: string) =>
    `Hi ${firstName}, saw you're leading growth at ${company}. I've been helping ${industry} founders fill their pipeline with AI-scored leads — would love to connect and share what's working.`,

  /** Step 2: Follow-up DM (sent after connection accepted) */
  follow_up_dm: (firstName: string, company: string) =>
    `Thanks for connecting, ${firstName}! Quick question — how are you currently handling outbound lead gen at ${company}? We've built an AI pipeline that scores and delivers ICP-verified leads every morning. Happy to share a sample report if you're curious.`,

  /** Step 3: Value DM (1-2 days after follow-up) */
  value_dm: (firstName: string) =>
    `${firstName}, here's a quick look at what our system produces: 50 ICP-verified leads with AI icebreakers, scored 8+/10. No commitment — happy to run a sample batch for your ICP so you can see the quality yourself. Want me to send it over?`,

  /** Step 4: Breakup (3-4 days after value DM, if no reply) */
  breakup: (firstName: string) =>
    `No worries if this isn't the right time, ${firstName}. If you ever want to see what 50 AI-scored leads look like for your ICP, my inbox is open. Wishing you a strong Q2!`,

  /** Full sequence with UTM parameters */
  full_sequence: (firstName: string, company: string, industry: string) => ({
    step1_connection: {
      channel: "linkedin",
      delay: "Day 0",
      message: `Hi ${firstName}, saw you're leading growth at ${company}. I've been helping ${industry} founders fill their pipeline with AI-scored leads — would love to connect and share what's working.`,
    },
    step2_followup: {
      channel: "linkedin",
      delay: "Day 1 (after accept)",
      message: `Thanks for connecting, ${firstName}! Quick question — how are you currently handling outbound lead gen at ${company}? We've built an AI pipeline that scores and delivers ICP-verified leads every morning. Happy to share a sample report: https://app.flow-forges.com/prospecting-os/tools/free-audit?utm_source=linkedin&utm_medium=dm&utm_campaign=outreach_q2_2026`,
    },
    step3_value: {
      channel: "linkedin",
      delay: "Day 2-3",
      message: `${firstName}, here's what we deliver: 50 ICP-verified leads with AI icebreakers, scored 8+/10 by Claude. No commitment — I'll run a free sample batch for your ICP so you can see the quality. Book a 15-min call: https://app.flow-forges.com/prospecting-os/book?offer=micro&utm_source=linkedin&utm_medium=dm&utm_campaign=outreach_q2_2026`,
    },
    step4_breakup: {
      channel: "linkedin",
      delay: "Day 4-5",
      message: `No worries if the timing isn't right, ${firstName}. If you ever want to see what 50 AI-scored leads look like for your ICP, here's the micro-offer: https://app.flow-forges.com/prospecting-os/#pricing?utm_source=linkedin&utm_medium=dm&utm_campaign=outreach_q2_2026 — $997 one-time, delivered in 5 days. Wishing you a strong quarter!`,
    },
  }),
};

