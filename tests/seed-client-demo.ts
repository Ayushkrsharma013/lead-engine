// Quick seed: creates a test client + dummy data for client-portal demo
// Run: npx tsx tests/seed-client-demo.ts

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const TEST_EMAIL = "demo@flowforges.com";
const TEST_PASSWORD = "Demo@2026!";

async function main() {
  console.log("Seeding demo client...\n");

  // 1. Create or get auth user
  let userId: string;
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u: any) => u.email === TEST_EMAIL);

  if (found) {
    userId = found.id;
    console.log("Using auth user:", userId);
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Ayush Demo" },
    });
    if (error) throw error;
    userId = created.user!.id;
    console.log("Created auth user:", userId);
  }

  // 2. Upsert profile
  const { error: profileErr } = await supabase.from("profiles").upsert({
    id: userId,
    email: TEST_EMAIL,
    full_name: "Ayush Demo",
    display_name: "Ayush Demo",
    role: "client",
    plan: "pilot",
    subscription_status: "active",
    payment_ref: "DEMO-2026-XYZ",
    onboarding_complete: true,
    is_active: true,
  }, { onConflict: "id" });
  if (profileErr) console.error("Profile error:", profileErr.message);
  else console.log("✓ Profile");

  // 3. Create workspace in client_workspaces
  const { data: ws } = await supabase.from("client_workspaces")
    .select("id").eq("client_user_id", userId).single();

  let workspaceId: string;
  if (ws) {
    workspaceId = ws.id;
    console.log("Using workspace:", workspaceId);
  } else {
    const { data: newWs, error: wsErr } = await supabase.from("client_workspaces").insert({
      client_user_id: userId,
      plan: "pilot",
      icp_config: { industries: ["Technology", "Healthcare", "Finance"], minScore: 50 },
      leads_count: 0,
    }).select("id").single();
    if (wsErr) { console.error("Workspace error:", wsErr.message); return; }
    workspaceId = newWs!.id;
    console.log("Created workspace:", workspaceId);
  }

  // 4. Delete existing demo leads for this workspace
  await supabase.from("client_leads").delete().eq("workspace_id", workspaceId);
  await supabase.from("client_icebreakers").delete().eq("workspace_id", workspaceId);

  // 5. Insert dummy leads
  const names = ["Sarah Chen", "Marcus Johnson", "Emily Davis", "James Wilson", "Lisa Park", "David Kim", "Rachel Torres", "Michael Brown", "Jessica Lee", "Daniel Garcia"];
  const titles = ["VP Marketing", "CTO", "Head of Sales", "Director of Engineering", "VP Product", "CEO", "CMO", "COO", "CFO", "VP Engineering"];
  const companies = ["TechCorp", "DataFlow Inc", "CloudBase", "NexGen Systems", "Apex Solutions", "Quantum Labs", "Fusion IO", "CoreStack", "Prime Analytics", "Vertex AI"];

  const leads = Array.from({ length: 30 }, (_, i) => ({
    workspace_id: workspaceId,
    name: names[i % 10],
    title: titles[i % 10],
    company: companies[i % 10],
    linkedin: `https://linkedin.com/in/demo-${i}`,
    score: 40 + Math.floor(Math.random() * 55), // 40-95 range
    icp_match_reason: "Matches ICP: industry + seniority + location",
    source: "linkedin",
    status: ["new", "contacted", "hot", "meeting"][i % 4],
    location: "United States",
  }));

  const { data: insertedLeads, error: leadsErr } = await supabase.from("client_leads").insert(leads).select("id");
  if (leadsErr) { console.error("Leads error:", leadsErr.message); return; }
  console.log(`✓ ${insertedLeads!.length} leads`);

  // 6. Insert icebreakers for first 10 leads
  const subjects = ["Quick question", "Loved your post", "Team growth", "SaaS approach", "Your expansion"];
  const bodies = [
    "Hi! I saw you're leading marketing at a growing company. At Flow Forges, we help B2B teams generate qualified pipeline using AI-powered prospecting. Would you be open to a 15-min chat this week?",
    "Hey! Your recent LinkedIn post about outbound strategies really resonated. We've been helping similar companies 3x their qualified meetings. Quick call to share what's working?",
    "I noticed your team has been expanding rapidly. We specialize in helping scaling companies build predictable lead engines. Would love to share some ideas if you're open to it.",
    "As a fellow SaaS enthusiast, I wanted to reach out. Our AI prospecting platform has been generating 50+ qualified leads/month for companies your size. Worth a quick chat?",
    "Congratulations on the recent growth! We help companies at your stage automate their top-of-funnel prospecting. Would you be interested in seeing how it works?",
  ];

  const leadIds = insertedLeads!.slice(0, 10);
  const icebreakers = leadIds.map((l, i) => ({
    workspace_id: workspaceId,
    lead_id: l.id,
    subject: subjects[i % 5],
    body: bodies[i % 5],
    message_type: "icebreaker",
    char_count: bodies[i % 5].length,
  }));

  const { error: ibErr } = await supabase.from("client_icebreakers").insert(icebreakers);
  if (ibErr) { console.error("Icebreakers error:", ibErr.message); return; }
  console.log(`✓ ${icebreakers.length} icebreakers`);

  // 7. Update leads_count
  await supabase.from("client_workspaces").update({ leads_count: leads.length }).eq("id", workspaceId);

  console.log("\n---");
  console.log("✅ All seeded! Login:");
  console.log(`   ${TEST_EMAIL} / ${TEST_PASSWORD}`);
  console.log(`   http://localhost:3001/prospecting-os/client-portal/login`);
}

main().catch(console.error);
