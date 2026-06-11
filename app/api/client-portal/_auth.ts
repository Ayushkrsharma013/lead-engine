import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PLAN_MODULES } from "@/lib/plan-modules";
import type { ModuleKey } from "@/lib/plan-modules";

export type PortalUser = { userId: string; role: string; plan: string; workspaceId: string };

/**
 * Validates that the caller is an authenticated portal user (client / qa_agent / super_admin)
 * and optionally that their plan includes a given module.
 *
 * Returns either a `PortalUser` or a `NextResponse` error — callers must check:
 *   const auth = await requirePortalAuth(req); if (auth instanceof NextResponse) return auth;
 */
export async function requirePortalAuth(
  req: NextRequest,
  requiredModule?: ModuleKey,
): Promise<PortalUser | NextResponse> {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, plan")
    .eq("id", userId)
    .maybeSingle();

  const role = profile?.role ?? "user";
  const plan = profile?.plan ?? "pilot";

  const allowedRoles = ["client", "qa_agent", "super_admin"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (requiredModule && role === "client") {
    const allowed = PLAN_MODULES[plan as keyof typeof PLAN_MODULES] ?? [];
    if (!allowed.includes(requiredModule)) {
      return NextResponse.json(
        { error: `Your plan does not include access to this feature` },
        { status: 403 },
      );
    }
  }

  const { data: workspace } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("client_user_id", userId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return { userId, role, plan, workspaceId: workspace.id };
}
