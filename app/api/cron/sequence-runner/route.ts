import { NextResponse } from "next/server";
import { processDueSteps } from "@/lib/sequence-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const isVercelCron = req.headers.get("x-vercel-cron") === "true";
    if (!isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processDueSteps();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/sequence-runner] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
