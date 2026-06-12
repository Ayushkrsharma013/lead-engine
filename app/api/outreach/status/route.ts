import { NextResponse } from "next/server";

const OO_URL = process.env.OPENOUTREACH_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${OO_URL}/admin/login/`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    // Django admin login page returns 200; redirect means server is up
    const running = res.ok || res.status === 302 || res.status === 301;
    return NextResponse.json({ running, url: OO_URL });
  } catch (err) { console.error("[outreach/status] Health check failed:", err);
    return NextResponse.json({ running: false, url: OO_URL });
  }
}
