// app/api/admin/migrate/route.ts
// One-shot migration runner for production Supabase.
// Uses the server-side supabaseAdmin (production keys).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const secret = req.headers.get("x-migrate-secret") || "";
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: string[] = [];

  // Create knowledge_store table if missing
  try {
    await supabaseAdmin.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.knowledge_store (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL,
          value JSONB NOT NULL DEFAULT '{}',
          agent TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE (key, agent)
        );
        ALTER TABLE public.knowledge_store ENABLE ROW LEVEL SECURITY;
      `
    });
    results.push("knowledge_store: created (or already exists)");
  } catch (e: any) {
    // exec_sql might not be available — try raw query approach
    try {
      const { error } = await supabaseAdmin.from("knowledge_store").select("key").limit(1);
      if (error && error.message.includes("PGRST205")) {
        results.push("knowledge_store: table missing, RPC not available. Run SQL manually in Supabase dashboard.");
      } else {
        results.push("knowledge_store: exists");
      }
    } catch {
      results.push("knowledge_store: could not verify");
    }
  }

  return NextResponse.json({ ok: true, results });
}
