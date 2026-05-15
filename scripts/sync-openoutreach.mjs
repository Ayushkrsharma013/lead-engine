/**
 * OpenOutreach → Supabase sync script
 *
 * Reads leads + deals from OpenOutreach's local SQLite database and
 * upserts CONNECTED/PENDING/QUALIFIED profiles into your Supabase leads table.
 *
 * Requirements:
 *   npm install sql.js --save-dev   (run once)
 *   npm install dotenv               (run once)
 *
 * Usage:
 *   node scripts/sync-openoutreach.mjs
 *   node scripts/sync-openoutreach.mjs --path "C:/custom/path/db.sqlite3" --state CONNECTED
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

// Load .env.local
loadEnv({ path: join(process.cwd(), ".env.local") });

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i += 2) {
  argMap[args[i]] = args[i + 1];
}

const SQLITE_PATH =
  argMap["--path"] ??
  process.env.OPENOUTREACH_DATA_PATH ??
  join(homedir(), ".openoutreach", "data", "db.sqlite3");

// Which deal states to import (default: all non-disqualified)
const IMPORT_STATES = (argMap["--state"] ?? "QUALIFIED,READY_TO_CONNECT,PENDING,CONNECTED,COMPLETED")
  .split(",")
  .map(s => s.trim().toUpperCase());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Validate env ─────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!existsSync(SQLITE_PATH)) {
  console.error(`SQLite file not found: ${SQLITE_PATH}`);
  console.error("Make sure OpenOutreach Docker container is running and has processed some leads.");
  console.error("Or set OPENOUTREACH_DATA_PATH in .env.local");
  process.exit(1);
}

// ─── Read SQLite ──────────────────────────────────────────────────────────────

console.log(`Reading SQLite: ${SQLITE_PATH}`);

const { default: initSqlJs } = await import("sql.js");
const SQL = await initSqlJs();
const fileBuffer = readFileSync(SQLITE_PATH);
const db = new SQL.Database(fileBuffer);

// Fetch leads (linkedin_lead table — name from OO architecture)
const leadsResult = db.exec(
  "SELECT id, name, company, headline, profile_url, email, location, disqualified, created_at FROM linkedin_lead WHERE disqualified = 0"
);

// Fetch deals
const dealsResult = db.exec(
  `SELECT id, lead_id, campaign_id, state, outcome, qualification_reason, connection_attempts, created_at, updated_at
   FROM linkedin_deal
   WHERE state IN (${IMPORT_STATES.map(s => `'${s}'`).join(",")})`
);

// Fetch campaigns
const campaignsResult = db.exec(
  "SELECT id, name, product_docs, campaign_objective, booking_link FROM linkedin_campaign"
);

db.close();

// ─── Parse rows ───────────────────────────────────────────────────────────────

function rowsToObjects(result) {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

const leads = rowsToObjects(leadsResult);
const deals = rowsToObjects(dealsResult);
const campaigns = rowsToObjects(campaignsResult);

console.log(`Found: ${leads.length} leads, ${deals.length} deals, ${campaigns.length} campaigns`);

if (leads.length === 0) {
  console.log("No leads to sync. Run OpenOutreach longer to discover profiles.");
  process.exit(0);
}

// ─── Map to Supabase schema ───────────────────────────────────────────────────

const dealByLeadId = new Map(deals.map(d => [d.lead_id, d]));

function mapState(state) {
  switch (state) {
    case "PENDING":          return "contacted";
    case "CONNECTED":        return "replied";
    case "COMPLETED":        return "hot";
    case "FAILED":           return "lost";
    default:                 return "new";
  }
}

function mapKanban(state) {
  switch (state) {
    case "QUALIFIED":        return "New";
    case "READY_TO_CONNECT": return "New";
    case "PENDING":          return "Contacted";
    case "CONNECTED":        return "Replied";
    case "COMPLETED":        return "Hot Lead";
    case "FAILED":           return "Lost";
    default:                 return "New";
  }
}

const mappedLeads = leads.map(lead => {
  const deal = dealByLeadId.get(lead.id);
  return {
    id:           `oo_${lead.id}`,
    name:         lead.name ?? "",
    title:        lead.headline ?? "",
    company:      lead.company ?? "",
    industry:     "",
    location:     lead.location ?? "",
    email:        lead.email ?? "",
    email_status: lead.email ? "risky" : "not_found",
    linkedin:     lead.profile_url ?? "",
    website:      "",
    company_size: "",
    score:        deal?.state === "CONNECTED" || deal?.state === "COMPLETED" ? 80 : 70,
    source:       "linkedin",
    status:       mapState(deal?.state),
    kanban_column: mapKanban(deal?.state),
    saved_at:     lead.created_at,
    fetched_at:   new Date().toISOString(),
    tags:         ["openoutreach"],
    notes:        deal?.qualification_reason ?? null,
  };
});

// ─── Upsert to Supabase ───────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

console.log(`Upserting ${mappedLeads.length} leads into Supabase...`);

const BATCH = 100;
let totalUpserted = 0;

for (let i = 0; i < mappedLeads.length; i += BATCH) {
  const batch = mappedLeads.slice(i, i + BATCH);
  const { error, count } = await supabase
    .from("leads")
    .upsert(batch, { onConflict: "id", count: "exact" });

  if (error) {
    console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
    process.exit(1);
  }
  totalUpserted += count ?? batch.length;
  process.stdout.write(`\r  Progress: ${totalUpserted}/${mappedLeads.length}`);
}

console.log(`\nDone. Synced ${totalUpserted} leads.`);

// Log activity
await supabase.from("activity_log").insert({
  type: "lead_added",
  text: `OpenOutreach sync: ${totalUpserted} leads imported from LinkedIn automation`,
});

console.log("Activity log updated. Check /leads?tag=openoutreach in Prospecting OS.");
