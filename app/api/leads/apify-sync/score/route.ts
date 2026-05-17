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

    return NextResponse.json({ scored: updates.length });
  } catch (err) {
    captureApiError(err, "api/leads/apify-sync/score");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
