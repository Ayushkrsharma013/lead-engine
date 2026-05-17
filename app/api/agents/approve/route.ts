// app/api/agents/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyApproveToken } from "@/lib/agents/tokens";
import { resolveAgentAction } from "@/lib/agents/resolver";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id       = searchParams.get("id") ?? "";
  const token    = searchParams.get("token") ?? "";
  const decision = searchParams.get("decision") ?? "approve";

  if (!id || !token) {
    return new NextResponse("Missing id or token", { status: 400 });
  }

  if (!verifyApproveToken(id, token)) {
    return new NextResponse("Invalid or expired token", { status: 401 });
  }

  const approved = decision === "approve";

  try {
    await resolveAgentAction(id, approved, "email-link");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>Error</h2><p>${msg}</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  const label = approved ? "Approved" : "Rejected";
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#000;color:#eee">
      <h2 style="color:${approved ? "#6BCB77" : "#E06060"}">${label}</h2>
      <p style="color:#888">Action has been ${approved ? "executed" : "rejected"}.</p>
      <a href="/prospecting-os/admin/agents" style="color:#E8A840">View Command Center →</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
