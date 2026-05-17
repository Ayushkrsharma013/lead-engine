import { NextRequest, NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { readKnowledge, writeKnowledge } from "@/lib/agents/knowledge";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const deny = await requireRoleApi(req, "super_admin");
  if (deny) return deny;

  const [enabled, titles, country, size, limit, lastRun, lastImported] = await Promise.all([
    readKnowledge("scheduler.enabled"),
    readKnowledge("scheduler.titles"),
    readKnowledge("scheduler.country"),
    readKnowledge("scheduler.size"),
    readKnowledge("scheduler.limit"),
    readKnowledge("scheduler.last_run"),
    readKnowledge("scheduler.last_run_imported"),
  ]);

  return NextResponse.json({
    enabled: !!enabled,
    titles: (titles as string | null) ?? "",
    country: (country as string | null) ?? "United States",
    size: (size as string | null) ?? "Any",
    limit: Number((limit as string | number | null) ?? 100),
    lastRun: (lastRun as string | null) ?? null,
    lastImported: Number((lastImported as string | number | null) ?? 0),
  });
}

export async function POST(req: NextRequest) {
  const deny = await requireRoleApi(req, "super_admin");
  if (deny) return deny;

  const body = await req.json() as {
    enabled?: boolean; titles?: string; country?: string; size?: string; limit?: number;
  };

  await Promise.all([
    writeKnowledge("scheduler.enabled", body.enabled ?? false, "settings"),
    writeKnowledge("scheduler.titles", body.titles ?? "", "settings"),
    writeKnowledge("scheduler.country", body.country ?? "United States", "settings"),
    writeKnowledge("scheduler.size", body.size ?? "Any", "settings"),
    writeKnowledge("scheduler.limit", body.limit ?? 100, "settings"),
  ]);

  return NextResponse.json({ ok: true });
}
