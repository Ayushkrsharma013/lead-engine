import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");

  if (!clientId) {
    return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
  }

  try {
    // Total lead count
    const { count: totalCount, error: totalError } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    if (totalError) throw new Error(totalError.message);

    // Hot leads (score > 80)
    const { count: hotCount, error: hotError } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gt("score", 80);

    if (hotError) throw new Error(hotError.message);

    // Contacted leads (status != 'new')
    const { count: contactedCount, error: contactedError } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("status", "new");

    if (contactedError) throw new Error(contactedError.message);

    // Meeting/won leads (status in meeting or won)
    const { count: meetingCount, error: meetingError } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("status", ["meeting", "won"]);

    if (meetingError) throw new Error(meetingError.message);

    // Average score
    const { data: scoreData, error: scoreError } = await supabaseAdmin
      .from("leads")
      .select("score")
      .eq("client_id", clientId)
      .not("score", "is", null);

    if (scoreError) throw new Error(scoreError.message);

    const avgScore =
      scoreData && scoreData.length > 0
        ? Math.round(
            scoreData.reduce((sum: number, l: { score: number }) => sum + l.score, 0) /
              scoreData.length
          )
        : 0;

    return NextResponse.json({
      total: totalCount ?? 0,
      hot: hotCount ?? 0,
      contacted: contactedCount ?? 0,
      meetings: meetingCount ?? 0,
      avgScore,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
