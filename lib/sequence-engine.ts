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
} from "./db";
import { sendEmail, buildProspectingEmailHtml } from "./resend";
import { supabaseAdmin } from "./supabase";
import type { Sequence, SequenceExecution, Lead } from "./types";

const supabase = supabaseAdmin;

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

  const rows = newLeadIds.map(leadId => ({
    sequence_id: sequenceId,
    lead_id: leadId,
    status: "active",
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

// ─── Lead row to Lead ───────────────────────────────────────────────────────

function leadFromRow(row: Record<string, unknown>): Lead {
  const s = String(row.source || "linkedin");
  const validSources = new Set(["linkedin", "gmaps", "amazon"]);
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    title: String(row.title || ""),
    company: String(row.company || ""),
    industry: String(row.industry || ""),
    location: String(row.location || ""),
    email: String(row.email || ""),
    emailStatus: (["verified", "risky", "not_found"].includes(String(row.email_status)) ? String(row.email_status) : "not_found") as Lead["emailStatus"],
    linkedin: String(row.linkedin || ""),
    website: String(row.website || ""),
    companySize: String(row.company_size || ""),
    score: Number(row.score ?? 0),
    source: validSources.has(s) ? s as Lead["source"] : "linkedin",
  };
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

    // Skip LinkedIn steps (handled by OpenOutreach)
    if (step.channel === "linkedin") {
      await insertSequenceMessage({
        executionId: exec.id,
        leadId: exec.leadId,
        stepIndex: exec.currentStep,
        channel: "linkedin",
        subject: step.type,
        body: step.template,
        status: "skipped",
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

    let subject = step.type;
    let body = resolveTemplate(step.template, lead);

    // Cold email has Subject: prefix in template
    if (step.template.startsWith("Subject:")) {
      const newlineIdx = step.template.indexOf("\n");
      subject = resolveTemplate(step.template.slice(0, newlineIdx).replace("Subject:", "").trim(), lead);
      body = resolveTemplate(step.template.slice(newlineIdx + 1), lead);
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
