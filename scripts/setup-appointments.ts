/* One-time setup: create appointments table in Supabase */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  // Parse .env.local manually
  const envPath = resolve(process.cwd(), ".env.local");
  console.log("Looking for .env.local at:", envPath);
  const envRaw = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of envRaw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  console.log("Parsed keys:", Object.keys(env).filter(k => k.includes("SUPABASE")).join(", "));

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "");
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }

  // Use service role key for DDL if available, otherwise try anon
  const key = serviceKey || anonKey;
  const supabase = createClient(url, key);

  console.log(serviceKey ? "Using service_role key" : "Using anon key (may not have DDL privileges)");

  // Try to create the table using raw SQL via rpc
  const sql = `
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // First, check if table already exists
  const { error: checkError } = await supabase.from("appointments").select("id").limit(1);

  if (!checkError) {
    console.log("appointments table already exists");
    process.exit(0);
  }

  console.log("Table does not exist, creating...");

  // Try RPC method first
  const { error: rpcError } = await supabase.rpc("exec_sql", { sql });
  if (!rpcError) {
    console.log("Table created via RPC");
    process.exit(0);
  }

  // Try direct HTTP SQL endpoint
  const projectRef = url.match(/https:\/\/([^.]+)/)?.[1];
  if (projectRef && serviceKey) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) {
      console.log("Table created via Management API");
      process.exit(0);
    }
  }

  // Fall back to providing SQL
  console.log("\nCould not create table automatically.");
  console.log("The anon key lacks DDL privileges.");
  console.log("Add SUPABASE_SERVICE_ROLE_KEY to .env.local, or run this SQL in the Supabase SQL Editor:\n");
  console.log(sql);
  process.exit(1);
}

main();
