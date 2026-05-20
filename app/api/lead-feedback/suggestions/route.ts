import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — return top positive/negative keywords the user hasn't already filtered on
// ?currentKeyword=<comma-separated-currently-applied-keywords>
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentKeyword = req.nextUrl.searchParams.get("currentKeyword") || "";
  const appliedTerms = new Set(
    currentKeyword
      .toLowerCase()
      .split(",")
      .map(t => t.trim())
      .filter(Boolean)
  );

  // Aggregate weight per keyword across all leads
  const { data, error } = await supabaseAdmin
    .from("lead_feedback")
    .select("keyword, weight")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals: Record<string, number> = {};
  for (const row of data || []) {
    totals[row.keyword] = (totals[row.keyword] || 0) + (row.weight as number);
  }

  // Top 5 positive keywords not already applied
  const addSuggestions = Object.entries(totals)
    .filter(([k, w]) => w > 0 && !appliedTerms.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword, weight]) => ({ keyword, weight, action: "add" as const }));

  // Top 3 negative keywords not already excluded
  const removeSuggestions = Object.entries(totals)
    .filter(([k, w]) => w < 0 && !appliedTerms.has(k))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([keyword, weight]) => ({ keyword, weight, action: "exclude" as const }));

  return NextResponse.json({
    suggestions: [...addSuggestions, ...removeSuggestions],
    totalFeedbackRecords: (data || []).length,
  });
}
