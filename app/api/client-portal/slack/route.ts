import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id") || null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, slack_webhook")
    .eq("client_user_id", userId)
    .maybeSingle();

  return NextResponse.json({ slack_webhook: workspace?.slack_webhook || "" });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { slack_webhook?: string };
  try { body = await req.json(); } catch (err) { console.error("[client-portal/slack] JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body.slack_webhook || "").trim();
  if (!url) return NextResponse.json({ error: "slack_webhook is required" }, { status: 400 });
  if (!url.startsWith("https://hooks.slack.com/services/")) {
    return NextResponse.json({ error: "URL must start with https://hooks.slack.com/services/" }, { status: 400 });
  }

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("client_user_id", userId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("client_workspaces")
    .update({ slack_webhook: url, updated_at: new Date().toISOString() })
    .eq("id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("client_user_id", userId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("client_workspaces")
    .update({ slack_webhook: null, updated_at: new Date().toISOString() })
    .eq("id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
