import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkMinuteLimit } from "@/lib/rate-limit";
import type { PlanKey } from "@/lib/types";
import { APIFY_BASE, PLAN_LEAD_LIMITS } from "@/lib/apify-config";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 120s for lead generation

// Map ICP seniority selections to LinkedIn/Apify seniority filters
const ICP_SENIORITY_MAP: Record<string, string[]> = {
  "C-Suite (CEO, CTO, CFO)": ["ceo", "cto", "cfo", "chief", "president", "managing director"],
  "VP / Director": ["vp", "vice president", "director", "head of"],
  "Head of Department": ["head of", "lead", "principal"],
  "Senior Manager": ["senior manager", "sr manager", "senior"],
  "Manager": ["manager", "team lead"],
  "Founder / Co-Founder": ["founder", "co-founder", "owner", "partner"],
};

// Map ICP company size selections to Apify employee count ranges
const COMPANY_SIZE_MAP: Record<string, { min: number; max: number }> = {
  "1-10": { min: 1, max: 10 },
  "11-50": { min: 11, max: 50 },
  "51-200": { min: 51, max: 200 },
  "201-500": { min: 201, max: 500 },
  "501-1000": { min: 501, max: 1000 },
  "1000+": { min: 1001, max: 500000 },
};

// Build ICP-aware search keywords combining industries + seniority titles
function buildSearchKeywords(icp: Record<string, string[]>): string[] {
  const keywords: string[] = [];

  // Combine industry terms with seniority titles for targeted keywords
  const industries = icp.industries || [];
  const seniority = icp.seniority || [];

  for (const industry of industries) {
    const shortIndustry = industry.split("&")[0].trim().split(",")[0].trim();
    // Industry-alone keyword
    keywords.push(shortIndustry);
    // Industry + C-suite/founder combo for high-value targets
    if (seniority.length > 0) {
      const titles = seniority.flatMap(s => ICP_SENIORITY_MAP[s] || [s.toLowerCase()]);
      for (const title of titles.slice(0, 3)) {
        keywords.push(`${shortIndustry} ${title}`);
      }
    }
  }

  // If no industry selected, use seniority as fallback
  if (keywords.length === 0 && seniority.length > 0) {
    keywords.push(...seniority.flatMap(s => ICP_SENIORITY_MAP[s] || [s]));
  }

  return keywords.length > 0 ? keywords.slice(0, 30) : ["saas founder", "technology ceo"];
}

// Build Apify search parameters from ICP config
function buildApifyInput(
  icp: Record<string, string[]>,
  maxResults: number
): Record<string, unknown> {
  const keywords = buildSearchKeywords(icp);
  const countries = icp.countries || [];
  const companySizes = icp.companySizes || [];
  const seniority = icp.seniority || [];

  const input: Record<string, unknown> = {
    searchUrl: "",
    maxResults,
  };

  // Use first keyword as primary search term
  if (keywords.length > 0) {
    input.searchTerms = keywords;
  }

  // Location filter
  if (countries.length > 0) {
    input.location = countries.join(", ");
  }

  // Seniority filter — use first 3 mapped values
  if (seniority.length > 0) {
    const filters = seniority.flatMap(s => ICP_SENIORITY_MAP[s] || [s.toLowerCase()]);
    input.seniority = [...new Set(filters)].slice(0, 10);
  }

  // Company size — use broadest range from selected sizes
  if (companySizes.length > 0) {
    const ranges = companySizes.map(s => COMPANY_SIZE_MAP[s]).filter(Boolean);
    if (ranges.length > 0) {
      input.minEmployees = Math.min(...ranges.map(r => r.min));
      input.maxEmployees = Math.max(...ranges.map(r => r.max));
    }
  }

  return input;
}

// ICP scoring with proper field matching (0-10 scale for DB storage)
function scoreLead(lead: {
  title?: string;
  company?: string;
  linkedin_url?: string;
  email?: string;
  industry?: string;
}, icp: Record<string, string[]>): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Seniority match — compare title against mapped seniority keywords
  const senioritySelections = icp.seniority || [];
  const title = (lead.title || "").toLowerCase();
  if (senioritySelections.length > 0 && title) {
    const matchWords = senioritySelections.flatMap(s => ICP_SENIORITY_MAP[s] || [s.toLowerCase()]);
    const matched = matchWords.some(kw => title.includes(kw));
    if (matched) { score += 3.0; reasons.push("Seniority match"); }
  }

  // Has LinkedIn = data quality
  if (lead.linkedin_url && lead.linkedin_url.trim().length > 0) {
    score += 2.0;
    reasons.push("LinkedIn profile");
  }

  // Has email = high quality
  if (lead.email && lead.email.trim().length > 0) {
    score += 1.5;
    reasons.push("Verified email");
  }

  // Industry match
  const industrySelections = (icp.industries || []).map(i => i.toLowerCase());
  const leadIndustry = (lead.industry || "").toLowerCase();
  if (leadIndustry && industrySelections.some(ind => leadIndustry.includes(ind) || ind.includes(leadIndustry))) {
    score += 1.5;
    reasons.push("Industry match");
  }

  // Title presence
  if (title && title.length > 0) {
    score += 1.0;
  }

  // Company presence
  if (lead.company && lead.company.length > 0) {
    score += 1.0;
  }

  return {
    score: Math.min(10, Math.round(score * 10) / 10),
    reason: reasons.join("; ") || "Basic match",
  };
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
  // Rate limit: 10/min per user
  const rateLimitId = req.headers.get("x-user-id") || req.headers.get("x-forwarded-for") || "anonymous";
  const rl = checkMinuteLimit("leads-generate", rateLimitId, 10);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

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
  if (!apifyKey) {
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
    const fetchCount = leadLimit * 3; // Fetch 3x to have enough after scoring/filtering

    // Build ICP-aware Apify search parameters
    const apifyInput = buildApifyInput(icp, fetchCount);
    const keywords = (apifyInput.searchTerms as string[]) || [];

    console.log("[leads/generate] ICP config:", JSON.stringify(icp));
    console.log("[leads/generate] Plan:", plan, "| Target:", leadLimit, "| Fetch:", fetchCount);
    console.log("[leads/generate] Keywords:", keywords.join(", "));

    // Use Apify LinkedIn Search Actor
    const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || "curious_coder~linkedin-people-search-scraper";

    // Start Apify run with ICP-targeted parameters
    const runRes = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${apifyKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyInput),
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
    const allMapped = items.map(item => ({
      name: String(item.fullName || item.full_name || item.name || "").trim(),
      title: String(item.job_title || item.title || item.jobTitle || "").trim(),
      company: String(item.job_company_name || item.company || item.organization || "").trim(),
      linkedin_url: String(item.linkedInUrl || item.linkedin_url || item.linkedin || "").trim(),
      email: String(item.email || item.work_email || "").toLowerCase().trim(),
      industry: String(item.job_company_industry || item.industry || "").trim(),
    })).filter(l => l.name && l.name.length > 1);

    console.log(`[leads/generate] Apify returned: ${items.length} raw → ${allMapped.length} valid leads`);

    if (allMapped.length === 0) {
      throw new Error("No valid leads found in Apify results — try broadening your ICP criteria");
    }

    // Score each lead against ICP (0-10 scale)
    const scored = allMapped.map(lead => {
      const { score, reason } = scoreLead(lead, icp);
      return { ...lead, score, icp_match_reason: reason };
    });

    // Filter: score >= 8.0, then sort by score descending, take top N
    const qualified = scored
      .filter(l => l.score >= 8.0)
      .sort((a, b) => b.score - a.score)
      .slice(0, leadLimit);

    console.log(
      `[leads/generate] Scored: ${scored.length} total | ` +
      `${scored.filter(l => l.score >= 8.0).length} qualified (≥8.0) | ` +
      `${qualified.length} final (plan limit: ${leadLimit})`
    );

    // If not enough qualified leads, relax threshold to 7.0
    let finalLeads = qualified;
    if (finalLeads.length < Math.floor(leadLimit * 0.5)) {
      const relaxed = scored
        .filter(l => l.score >= 7.0)
        .sort((a, b) => b.score - a.score)
        .slice(0, leadLimit);
      finalLeads = relaxed;
      console.log(`[leads/generate] Relaxed threshold to 7.0: ${finalLeads.length} leads`);
    }

    if (finalLeads.length === 0) {
      throw new Error("No leads met the ICP quality threshold — try broader criteria");
    }

    // Insert leads into client_leads
    const leadRows = finalLeads.map(l => ({
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

    // Generate icebreakers (1 per lead) — uses multi-model fallback
    const { generateOneIcebreaker } = await import("@/lib/icebreaker-llm");
    const icebreakerRows: Array<{ lead_id: string; text: string }> = [];
    const batchSize = 5;

    for (let i = 0; i < inserted.length; i += batchSize) {
      const batch = inserted.slice(i, i + batchSize);
      const batchLeads = finalLeads.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map((lead, idx) =>
          generateOneIcebreaker({
            name: lead.name,
            title: batchLeads[idx]?.title || "",
            company: lead.company || "",
            industry: batchLeads[idx]?.industry || "",
          }).then(r => ({ lead_id: lead.id, text: r.text }))
        )
      );

      icebreakerRows.push(...results);
    }

    console.log(`[leads/generate] Generated ${icebreakerRows.length} icebreakers`);

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
  // Rate limit: 10/min per user
  const rateLimitId = req.headers.get("x-user-id") || req.headers.get("x-forwarded-for") || "anonymous";
  const rl = checkMinuteLimit("leads-generate", rateLimitId, 10);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

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
