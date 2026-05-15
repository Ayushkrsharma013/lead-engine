const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const envRaw = fs.readFileSync(".env.local", "utf-8");
const env = {};
envRaw.split("\n").forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.+)/);
  if (m) env[m[1]] = m[2].trim();
});

const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function main() {
  const sql = [
    "CREATE TABLE IF NOT EXISTS appointments (",
    "  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,",
    "  date TEXT NOT NULL,",
    "  time TEXT NOT NULL,",
    "  name TEXT NOT NULL,",
    "  email TEXT NOT NULL,",
    "  company TEXT DEFAULT '',",
    "  notes TEXT DEFAULT '',",
    "  created_at TIMESTAMPTZ DEFAULT now()",
    ");",
  ].join("\n");

  // Try exec_sql
  const { data, error } = await supabase.rpc("exec_sql", { sql });
  console.log("exec_sql:", error ? "FAIL: " + error.message : "OK");

  if (error) {
    // Try query RPC
    const { error: e2 } = await supabase.rpc("query", { sql });
    console.log("query:", e2 ? "FAIL: " + e2.message : "OK");
  }

  // Try creating email_captures too
  const sql2 = [
    "CREATE TABLE IF NOT EXISTS email_captures (",
    "  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,",
    "  email TEXT UNIQUE NOT NULL,",
    "  source TEXT DEFAULT 'landing_page',",
    "  created_at TIMESTAMPTZ DEFAULT now()",
    ");",
  ].join("\n");
  await supabase.rpc("exec_sql", { sql: sql2 });

  // Verify
  const { error: checkErr } = await supabase.from("appointments").select("id").limit(1);
  console.log("appointments table:", checkErr ? "NOT FOUND: " + checkErr.message : "EXISTS!");

  const { error: checkErr2 } = await supabase.from("email_captures").select("id").limit(1);
  console.log("email_captures table:", checkErr2 ? "NOT FOUND: " + checkErr2.message : "EXISTS!");
}

main();
