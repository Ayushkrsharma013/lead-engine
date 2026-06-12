import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requirePortalAuth } from "@/app/api/client-portal/_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePortalAuth(req, "connector-marketplace");
  if (auth instanceof NextResponse) return auth;

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, plan, connector_config")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const connectorConfig = (workspace as any).connector_config || null;
  return NextResponse.json({ connectorConfig, workspaceId: workspace.id });
}

export async function POST(req: NextRequest) {
  const auth = await requirePortalAuth(req, "connector-marketplace");
  if (auth instanceof NextResponse) return auth;

  let body: { type?: string; config?: Record<string, string> };
  try { body = await req.json(); } catch (err) { console.error("[client-portal/connectors] JSON parse failed:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, config } = body;
  if (!type || !config) return NextResponse.json({ error: "Missing type or config" }, { status: 400 });

  const validTypes = ["slack", "telegram", "discord", "webhook"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `Invalid type. Must be: ${validTypes.join(", ")}` }, { status: 400 });
  }

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, plan, connector_config")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const plan = (workspace as any).plan || "pilot";
  const existingConfig = ((workspace as any).connector_config || {}) as Record<string, unknown>;

  // Growth plan: only 1 connector allowed
  if (plan === "growth" && !existingConfig[type]) {
    const existingKeys = Object.keys(existingConfig).filter(k => k !== type);
    if (existingKeys.length >= 1) {
      return NextResponse.json({ error: "Growth plan allows only 1 connector. Upgrade to Scale for multiple." }, { status: 400 });
    }
  }

  // Upsert connector config
  const updatedConfig = { ...existingConfig, [type]: config };

  const { error } = await supabaseAdmin
    .from("client_workspaces")
    .update({ connector_config: updatedConfig, updated_at: new Date().toISOString() })
    .eq("id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, connectorConfig: updatedConfig });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePortalAuth(req, "connector-marketplace");
  if (auth instanceof NextResponse) return auth;

  const type = req.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ error: "Missing type param" }, { status: 400 });

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id, connector_config")
    .eq("id", auth.workspaceId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const existingConfig = ((workspace as any).connector_config || {}) as Record<string, unknown>;
  delete existingConfig[type];

  await supabaseAdmin
    .from("client_workspaces")
    .update({ connector_config: existingConfig, updated_at: new Date().toISOString() })
    .eq("id", workspace.id);

  return NextResponse.json({ ok: true, connectorConfig: existingConfig });
}
