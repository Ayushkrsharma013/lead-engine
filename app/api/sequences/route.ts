import { NextResponse } from "next/server";
import { getSequences } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sequences = await getSequences();
  return NextResponse.json({
    sequences: sequences.map(s => ({ id: s.id, name: s.name })),
  });
}
