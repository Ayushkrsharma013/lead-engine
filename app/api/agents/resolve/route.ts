import { NextRequest, NextResponse } from "next/server";
import { resolveAgentAction } from "@/lib/agents/resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const role = req.headers.get("x-user-role");
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { actionId?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { actionId, decision } = body;
  if (!actionId || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json(
      { error: "Required: actionId (string), decision ('approve' | 'reject')" },
      { status: 400 }
    );
  }

  const result = await resolveAgentAction(actionId, decision === "approve", "super_admin");

  if (!result.success && result.message.startsWith("Already resolved")) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result);
}
