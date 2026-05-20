import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Keywords extracted from a lead's title + industry
function extractKeywords(title: string, industry: string): string[] {
  const text = `${title} ${industry}`.toLowerCase();
  const words = text
    .split(/[\s,\/\-&]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ""))
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, 8);
}

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "from", "into", "that", "this", "are",
  "not", "but", "have", "has", "had", "can", "will", "was", "its",
  "via", "inc", "ltd", "llc", "corp", "co", "pvt",
]);

// POST — record thumbs up (feedback=true) or thumbs down (feedback=false)
export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    leadId: string;
    feedback: boolean;
    title?: string;
    industry?: string;
  };

  const { leadId, feedback, title = "", industry = "" } = body;
  if (!leadId || typeof feedback !== "boolean") {
    return NextResponse.json({ error: "leadId and feedback are required" }, { status: 400 });
  }

  const keywords = extractKeywords(title, industry);
  if (keywords.length === 0) {
    return NextResponse.json({ ok: true, keywordsRecorded: 0 });
  }

  const weight = feedback ? 1 : -1;
  const rows = keywords.map(keyword => ({
    user_id: userId,
    lead_id: leadId,
    keyword,
    feedback,
    weight,
  }));

  // Upsert — on conflict (user_id, lead_id, keyword) add to weight
  const { error } = await supabaseAdmin
    .from("lead_feedback")
    .upsert(rows, { onConflict: "user_id,lead_id,keyword" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, keywordsRecorded: keywords.length });
}

// GET — list all feedback for the current user (for debugging/inspection)
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("lead_feedback")
    .select("keyword, weight, feedback, lead_id, created_at")
    .eq("user_id", userId)
    .order("weight", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ feedback: data || [] });
}
