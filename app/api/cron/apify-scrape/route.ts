import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkMinuteLimit } from "@/lib/rate-limit";
import { readKnowledge, writeKnowledge } from "@/lib/agents/knowledge";
import { mergeLeadsInDB, logActivity } from "@/lib/db";
import { sanitizeLead } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ApifyLead {
  name?: string; firstName?: string; lastName?: string;
  title?: string; jobTitle?: string;
  company?: string; companyName?: string;
  industry?: string;
  location?: string; city?: string; country?: string;
  email?: string; emailAddress?: string;
  linkedInUrl?: string; linkedin?: string;
  website?: string; companyWebsite?: string;
  companySize?: string;
}

export async function GET(req: NextRequest) {
  // Rate limit: 3/min by IP (cron endpoint)
  const ip = req.headers.get("x-forwarded-for") || "cron";
  const rl = checkMinuteLimit("cron-apify-scrape", ip, 3);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read scheduler config from knowledge store
  const enabled = await readKnowledge("scheduler.enabled");
  if (!enabled) {
    return NextResponse.json({ skipped: true, reason: "Scheduler disabled" });
  }

  const titles = await readKnowledge("scheduler.titles") as string | null;
  const country = (await readKnowledge("scheduler.country") as string | null) ?? "United States";
  const size = (await readKnowledge("scheduler.size") as string | null) ?? "Any";
  const limit = Number((await readKnowledge("scheduler.limit") as string | number | null) ?? 100);

  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    return NextResponse.json({ error: "APIFY_API_KEY not set" }, { status: 500 });
  }

  // Build actor input
  const actorInput: Record<string, string | number | boolean> = {
    outputType: "leads", getEmailAddresses: true, count: limit,
  };
  if (titles) actorInput.titles = titles;
  if (country && country !== "Any") actorInput.location = country;
  if (size && size !== "Any") actorInput.companySize = size;

  // Start actor run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/x_guru~Leads-Scraper-apollo-zoominfo/runs?token=${apifyKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(actorInput) }
  );
  if (!startRes.ok) {
    return NextResponse.json({ error: `Apify start failed: ${startRes.status}` }, { status: 500 });
  }
  const { data: runData } = await startRes.json() as { data: { id: string } };
  const runId = runData.id;

  // Poll until finished (max 4 minutes)
  let status = "RUNNING";
  for (let i = 0; i < 48 && status === "RUNNING"; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(
      `https://api.apify.com/v2/acts/x_guru~Leads-Scraper-apollo-zoominfo/runs/${runId}?token=${apifyKey}`
    );
    const pollData = await pollRes.json() as { data: { status: string } };
    status = pollData.data.status;
  }

  if (status !== "SUCCEEDED") {
    return NextResponse.json({ error: `Run ended with status: ${status}` }, { status: 500 });
  }

  // Fetch results
  const itemsRes = await fetch(
    `https://api.apify.com/v2/acts/x_guru~Leads-Scraper-apollo-zoominfo/runs/${runId}/dataset/items?token=${apifyKey}&clean=true`
  );
  if (!itemsRes.ok) {
    return NextResponse.json({ error: "Failed to fetch run items" }, { status: 500 });
  }
  const items = await itemsRes.json() as ApifyLead[];

  // Map to Lead shape
  const mapped = items
    .filter(r => r.email || r.emailAddress)
    .map(r => sanitizeLead({
      id: crypto.randomUUID(),
      name: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim(),
      title: r.title || r.jobTitle || "",
      company: r.company || r.companyName || "",
      industry: r.industry || "",
      location: r.location || r.city || r.country || "",
      email: (r.email || r.emailAddress || "").toLowerCase().trim(),
      emailStatus: "not_found" as const,
      linkedin: r.linkedInUrl || r.linkedin || "",
      website: r.website || r.companyWebsite || "",
      companySize: r.companySize || "",
      score: 0,
      source: "linkedin" as const,
    }));

  const result = await mergeLeadsInDB(mapped);
  const imported = result.added;

  await writeKnowledge("scheduler.last_run", new Date().toISOString(), "apify-cron");
  await writeKnowledge("scheduler.last_run_imported", imported, "apify-cron");

  await logActivity({ type: "lead_added", text: `Scheduled scrape: ${imported} new leads imported (${items.length} found)` });

  return NextResponse.json({ ok: true, found: items.length, imported, runId });
}
