import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { logActivity } from "@/lib/db";
import { captureApiError } from "@/lib/error-tracking";

export const runtime = "nodejs";
export const maxDuration = 120;

const HIGH_VALUE_INDUSTRIES = new Set([
  "technology", "finance", "healthcare", "software", "fintech",
  "health", "tech", "banking", "insurance", "medical", "it",
  "information technology", "financial services", "biotech",
  "pharmaceuticals", "saas", "cybersecurity",
]);

function computeScore(lead: {
  email_status?: string;
  linkedin?: string;
  website?: string;
  company_size?: string;
  industry?: string;
  title?: string;
}): number {
  let score = 0;
  if (lead.email_status === "verified") score += 20;
  if (lead.linkedin?.trim()) score += 15;
  if (lead.website?.trim()) score += 10;
  if (lead.company_size?.trim()) score += 10;
  if (lead.industry && HIGH_VALUE_INDUSTRIES.has(lead.industry.toLowerCase().trim())) score += 20;
  if (lead.title?.trim()) score += 10;
  // Additional: email exists and looks valid
  return Math.min(100, score);
}

export async function POST(req: NextRequest) {
  const authCheck = await requireRoleApi(req, "super_admin");
  if (authCheck) return authCheck;

  try {
    const { data: unscoredLeads, error } = await supabaseAdmin
      .from("leads")
      .select("id, email_status, linkedin, website, company_size, industry, title")
      .or("score.eq.0,score.is.null")
      .limit(500);

    if (error) throw error;
    if (!unscoredLeads?.length) return NextResponse.json({ scored: 0 });

    const now = new Date().toISOString();
    const updates = unscoredLeads.map(lead => ({
      id: lead.id as string,
      score: computeScore(lead as {
        email_status?: string;
        linkedin?: string;
        website?: string;
        company_size?: string;
        industry?: string;
        title?: string;
      }),
    })).filter(u => u.score > 0);

    await Promise.all(
      updates.map(u =>
        supabaseAdmin
          .from("leads")
          .update({ score: u.score, updated_at: now, last_touched: now })
          .eq("id", u.id)
      )
    );

    await logActivity({
      type: "lead_added",
      text: `Auto-scored ${updates.length} imported leads`,
    });

    // Phase 4: Queue hot lead auto-enrollment for approval
    let hotLeadsQueued = 0;
    const hotLeads = updates.filter(u => u.score >= 80);
    if (hotLeads.length > 0) {
      try {
        const hotLeadIds = hotLeads.map(u => u.id);
        const { data: seqs } = await supabaseAdmin
          .from("sequences")
          .select("id, name")
          .order("created_at", { ascending: false })
          .limit(1);
        const seq = seqs?.[0] as { id: string; name: string } | undefined;
        const batchId = `score-engine-${Date.now()}`;
        const { data: inserted } = await supabaseAdmin
          .from("agent_actions")
          .insert({
            agent_name: "score-engine",
            batch_run_id: batchId,
            action_type: "auto_enroll_hot_leads",
            description: `Auto-enroll ${hotLeads.length} hot lead${hotLeads.length !== 1 ? "s" : ""} (score ≥80)${seq ? ` into "${seq.name}"` : ""}`,
            payload: { lead_ids: hotLeadIds, sequence_id: seq?.id ?? null },
            risk_level: "medium",
            status: "pending",
            notified_via: [],
          })
          .select("id")
          .single();
        if (inserted) {
          const tgToken = process.env.TELEGRAM_BOT_TOKEN;
          const tgChat  = process.env.TELEGRAM_CHAT_ID;
          if (tgToken && tgChat) {
            const msg = `[Score Engine] — Needs Approval\n\n${hotLeads.length} hot lead${hotLeads.length !== 1 ? "s" : ""} scored ≥80 after sync.\nApprove auto-enroll into${seq ? ` "${seq.name}"` : " first sequence"}?\n\nRisk: medium`;
            const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: tgChat,
                text: msg,
                reply_markup: {
                  inline_keyboard: [[
                    { text: "Approve", callback_data: `approve_agent:${(inserted as { id: string }).id}` },
                    { text: "Reject",  callback_data: `reject_agent:${(inserted as { id: string }).id}` },
                  ]],
                },
              }),
            });
            const tgData = await tgRes.json() as { ok: boolean; result?: { message_id: number } };
            if (tgData.ok && tgData.result) {
              await supabaseAdmin
                .from("agent_actions")
                .update({ telegram_msg_id: String(tgData.result.message_id), notified_via: ["telegram"] })
                .eq("id", (inserted as { id: string }).id);
            }
          }
          hotLeadsQueued = hotLeads.length;
        }
      } catch (queueErr) {
        console.warn("[score] Hot lead queue failed:", queueErr);
      }
    }

    return NextResponse.json({ scored: updates.length, hot_leads_queued: hotLeadsQueued });
  } catch (err) {
    captureApiError(err, "api/leads/apify-sync/score");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
