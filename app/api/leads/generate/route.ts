import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { PlanKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 120s for lead generation

const APIFY_BASE = "https://api.apify.com/v2";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Plan-based lead limits
const PLAN_LEAD_LIMITS: Record<string, number> = {
  micro: 50,
  pilot: 100,
  growth: 200,
  scale: 500,
};

// Simple ICP-based scoring (no Claude API call — deterministic for speed)
function scoreLead(lead: {
  title?: string;
  company?: string;
  linkedin_url?: string;
  email?: string;
}, icp: Record<string, string[]>): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Check seniority match
  const seniorityKeywords = (icp.seniority || []).join(" ").toLowerCase();
  const title = (lead.title || "").toLowerCase();
  if (seniorityKeywords && title) {
    const matched = (icp.seniority || []).some(s =>
      title.includes(s.toLowerCase()) ||
      seniorityKeywords.includes(title)
    );
    if (matched) { score += 25; reasons.push("Seniority match"); }
  }

  // Has LinkedIn = data quality
  if (lead.linkedin_url && lead.linkedin_url.trim().length > 0) {
    score += 20;
    reasons.push("Has LinkedIn profile");
  }

  // Has email = data quality
  if (lead.email && lead.email.trim().length > 0) {
    score += 15;
    reasons.push("Has verified email");
  }

  // Industry bonus (any industry in ICP gets bonus)
  const industryKeywords = (icp.industries || []).join(" ").toLowerCase();
  if (industryKeywords && lead.company) {
    score += 10;
    reasons.push("Industry in ICP range");
  }

  // Title presence
  if (title && title.length > 0) {
    score += 10;
  }

  // Company presence
  if (lead.company && lead.company.length > 0) {
    score += 10;
  }

  return {
    score: Math.min(100, score),
    reason: reasons.join("; ") || "Basic ICP match",
  };
}

// Generate 1 icebreaker per lead via Gemini
async function generateIcebreaker(
  lead: { name: string; title: string; company: string; industry: string },
  apiKey: string
): Promise<string> {
  const prompt = `You are an expert B2B outreach specialist. Write ONE short, personalized icebreaker opening line for a LinkedIn DM (1-2 sentences max). Reference something specific about the prospect's role or company. No generic flattery.

PROSPECT:
- Name: ${lead.name}
- Title: ${lead.title || "Not specified"}
- Company: ${lead.company || "Not specified"}
- Industry: ${lead.industry || "Not specified"}

Return ONLY the icebreaker text. No numbering, no introduction, no explanation.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.9, topP: 0.95 },
      }),
    });

    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim() || `Hi ${lead.name.split(" ")[0]}, I came across your profile and would love to connect.`;
  } catch (err) {
    console.warn(`[generate] Icebreaker failed for ${lead.name}:`, err);
    return `Hi ${lead.name.split(" ")[0]}, I came across your profile and would love to connect.`;
  }
}

// Fetch Apify dataset items
async function fetchApifyResults(datasetId: string, apiKey: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${apiKey}&format=json&clean=true&limit=1000`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`);
  return (await res.json()) as Array<Record<string, unknown>>;
}

// POST /api/leads/generate — trigger lead generation
// Auth: x-user-id header (client portal), OR Authorization: Bearer <CRON_SECRET> + ?workspace_id= (webhook/cron)
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isInternal = cronSecret && authHeader === `Bearer ${cronSecret}`;

  let workspaceId: string | undefined;
  let userId: string | undefined;

  if (isInternal) {
    // Internal call from webhook/cron — use workspace_id query param
    workspaceId = req.nextUrl.searchParams.get("workspace_id") || undefined;
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
    }
  } else {
    // Client portal call — use x-user-id header
    userId = req.headers.get("x-user-id") || undefined;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apifyKey = process.env.APIFY_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!apifyKey || !geminiKey) {
    return NextResponse.json({ error: "Lead generation not configured" }, { status: 500 });
  }

  // Get workspace + ICP config
  let workspace: Record<string, unknown> | null = null;
  if (workspaceId) {
    const { data } = await supabaseAdmin
      .from("client_workspaces")
      .select("id, plan, icp_config, leads_generation_status, icp_locked, client_user_id")
      .eq("id", workspaceId)
      .maybeSingle();
    workspace = data as Record<string, unknown> | null;
  } else if (userId) {
    const { data } = await supabaseAdmin
      .from("client_workspaces")
      .select("id, plan, icp_config, leads_generation_status, icp_locked")
      .eq("client_user_id", userId)
      .maybeSingle();
    workspace = data as Record<string, unknown> | null;
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found — complete onboarding first" }, { status: 404 });
  }

  // Prevent re-generation for micro plan (ICP locked)
  if (workspace.icp_locked && workspace.plan === "micro") {
    return NextResponse.json({ error: "ICP is locked — leads already generated for this micro plan" }, { status: 400 });
  }

  // Set status to processing
  await supabaseAdmin
    .from("client_workspaces")
    .update({ leads_generation_status: "processing" })
    .eq("id", workspace.id);

  try {
    const icp = (workspace.icp_config || {}) as Record<string, string[]>;
    const plan = (workspace.plan || "pilot") as PlanKey;
    const leadLimit = PLAN_LEAD_LIMITS[plan] || 50;

    // Build Apify search query from ICP
    const industries = (icp.industries || []).join(", ");
    const countries = (icp.countries || []).join(", ");
    const companySizes = (icp.companySizes || []).join(", ");

    // Use Apify LinkedIn Search Actor
    const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || "curious_coder~linkedin-people-search-scraper";

    // Start Apify run
    const runRes = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${apifyKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchUrl: "", // Let actor build search from params
          searchTerms: industries || undefined,
          location: countries || undefined,
          maxResults: leadLimit + 20, // Get extras for filtering
        }),
      }
    );

    if (!runRes.ok) {
      const errText = await runRes.text();
      throw new Error(`Apify run start failed: ${runRes.status} — ${errText.slice(0, 200)}`);
    }

    const run = (await runRes.json()) as { data?: { id: string }; id?: string };
    const runId = run.data?.id || run.id;
    if (!runId) throw new Error("No run ID returned from Apify");

    // Poll for completion (up to 90 seconds)
    let datasetId = "";
    for (let i = 0; i < 18; i++) {
      await new Promise(r => setTimeout(r, 5000)); // 5s intervals

      const statusRes = await fetch(
        `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs/${runId}?token=${apifyKey}`,
        { headers: { Accept: "application/json" } }
      );

      if (!statusRes.ok) continue;
      const status = (await statusRes.json()) as { data?: { status: string; defaultDatasetId: string }; status?: string; defaultDatasetId?: string };

      const st = status.data?.status || status.status || "";
      datasetId = status.data?.defaultDatasetId || status.defaultDatasetId || "";

      if (st === "SUCCEEDED") break;
      if (st === "FAILED" || st === "ABORTED" || st === "TIMED-OUT") {
        throw new Error(`Apify run ${st.toLowerCase()}`);
      }
    }

    if (!datasetId) {
      throw new Error("Apify run did not complete in time — try again");
    }

    // Fetch results
    const items = await fetchApifyResults(datasetId, apifyKey);
    if (!items || items.length === 0) {
      throw new Error("No leads found — try broadening your ICP criteria");
    }

    // Map and filter leads
    const mappedLeads = items.slice(0, leadLimit).map(item => ({
      name: String(item.fullName || item.full_name || item.name || "").trim(),
      title: String(item.job_title || item.title || item.jobTitle || "").trim(),
      company: String(item.job_company_name || item.company || item.organization || "").trim(),
      linkedin_url: String(item.linkedInUrl || item.linkedin_url || item.linkedin || "").trim(),
      email: String(item.email || item.work_email || "").toLowerCase().trim(),
      industry: String(item.job_company_industry || item.industry || "").trim(),
    })).filter(l => l.name && l.name.length > 1);

    if (mappedLeads.length === 0) {
      throw new Error("No valid leads found in Apify results");
    }

    // Score each lead against ICP
    const scored = mappedLeads.map(lead => {
      const { score, reason } = scoreLead(lead, icp);
      return { ...lead, score, icp_match_reason: reason };
    });

    // Insert leads into client_leads
    const leadRows = scored.map(l => ({
      workspace_id: workspace.id,
      name: l.name,
      title: l.title || null,
      company: l.company || null,
      linkedin_url: l.linkedin_url || null,
      email: l.email || null,
      score: l.score,
      icp_match_reason: l.icp_match_reason,
      month_year: new Date().toISOString().slice(0, 7) + "-01",
    }));

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("client_leads")
      .insert(leadRows)
      .select("id, name, title, company");

    if (insertError) throw new Error(`Lead insert failed: ${insertError.message}`);
    if (!inserted || inserted.length === 0) throw new Error("No leads inserted");

    // Generate icebreakers (1 per lead) — process in batches to avoid rate limits
    const icebreakerRows: Array<{ lead_id: string; text: string }> = [];
    const batchSize = 5;

    for (let i = 0; i < inserted.length; i += batchSize) {
      const batch = inserted.slice(i, i + batchSize);
      const batchScored = scored.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map((lead, idx) =>
          generateIcebreaker(
            {
              name: lead.name,
              title: batchScored[idx]?.title || "",
              company: lead.company || "",
              industry: batchScored[idx]?.industry || "",
            },
            geminiKey
          ).then(text => ({ lead_id: lead.id, text }))
        )
      );

      icebreakerRows.push(...results);
    }

    // Insert icebreakers
    if (icebreakerRows.length > 0) {
      await supabaseAdmin.from("client_icebreakers").insert(icebreakerRows);
    }

    // Update workspace status
    const updates: Record<string, unknown> = {
      leads_generation_status: "ready",
      leads_generated_at: new Date().toISOString(),
      leads_count: inserted.length,
    };

    // Lock ICP for micro plan
    if (plan === "micro") {
      updates.icp_locked = true;
    }

    await supabaseAdmin
      .from("client_workspaces")
      .update(updates)
      .eq("id", workspace.id);

    return NextResponse.json({
      ok: true,
      leadsGenerated: inserted.length,
      status: "ready",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[leads/generate]", message);

    // Mark generation as failed
    await supabaseAdmin
      .from("client_workspaces")
      .update({ leads_generation_status: "failed" })
      .eq("id", workspace.id);

    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}

// GET /api/leads/generate — check generation status
// Auth: x-user-id header (client portal), OR Authorization: Bearer <CRON_SECRET> + ?workspace_id= (webhook/cron)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isInternal = cronSecret && authHeader === `Bearer ${cronSecret}`;

  let workspaceId: string | undefined;
  let userId: string | undefined;

  if (isInternal) {
    workspaceId = req.nextUrl.searchParams.get("workspace_id") || undefined;
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
    }
  } else {
    userId = req.headers.get("x-user-id") || undefined;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let workspace: Record<string, unknown> | null = null;
  if (workspaceId) {
    const { data } = await supabaseAdmin
      .from("client_workspaces")
      .select("leads_generation_status, leads_generated_at, leads_count, icp_locked")
      .eq("id", workspaceId)
      .maybeSingle();
    workspace = data as Record<string, unknown> | null;
  } else if (userId) {
    const { data } = await supabaseAdmin
      .from("client_workspaces")
      .select("leads_generation_status, leads_generated_at, leads_count, icp_locked")
      .eq("client_user_id", userId)
      .maybeSingle();
    workspace = data as Record<string, unknown> | null;
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: workspace.leads_generation_status || "pending",
    generatedAt: workspace.leads_generated_at || null,
    leadsCount: workspace.leads_count || 0,
    icpLocked: workspace.icp_locked || false,
  });
}
