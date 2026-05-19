import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/api-auth";
import { checkLeadScrapeLimit, setRateLimitHeaders } from "@/lib/rate-limit";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";
const APIFY_HEADERS = { Authorization: `Bearer ${APIFY_TOKEN}`, "Content-Type": "application/json" };

function apifyError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.error && typeof d.error === "object") {
    const e = d.error as Record<string, unknown>;
    return String(e.message || e.type || "Unknown Apify error");
  }
  if (typeof d.error === "string") return d.error;
  return null;
}

// ─── Input validation ──────────────────────────────────────────────────────────

const VALID_COUNTRIES = new Set([
  "United States", "Canada", "United Kingdom", "Australia", "Germany",
  "France", "India", "Brazil", "Netherlands", "Singapore", "Ireland",
  "Spain", "Italy", "Sweden", "Denmark", "Norway", "Finland",
  "Switzerland", "Belgium", "Austria", "New Zealand", "Israel",
  "United Arab Emirates", "Japan", "South Korea", "Mexico",
]);

const VALID_SIZES = new Set([
  "1-10", "11-50", "51-200", "201-500", "501-1000",
  "1001-5000", "5001-10000", "10001+",
]);

const VALID_SOURCES = new Set(["linkedin", "gmaps", "amazon"]);

function validateFields(body: Record<string, unknown>): string | null {
  const { source, fields } = body as { source?: string; fields?: Record<string, unknown> };

  if (source && !VALID_SOURCES.has(source)) return `Invalid source: ${source}`;

  if (fields) {
    if (fields.limit !== undefined) {
      const n = Number(fields.limit);
      if (!Number.isFinite(n) || n < 1 || n > 500) return "fields.limit must be 1–500";
    }
    if (fields.country && typeof fields.country === "string" && fields.country !== "Any") {
      if (!VALID_COUNTRIES.has(fields.country)) return `Invalid country: ${fields.country}`;
    }
    if (fields.size && typeof fields.size === "string" && fields.size !== "Any") {
      if (!VALID_SIZES.has(fields.size)) return `Invalid size: ${fields.size}`;
    }
    if (fields.titles && typeof fields.titles === "string") {
      if (fields.titles.length > 500) return "fields.titles too long (max 500 chars)";
    }
  }

  return null;
}

// ─── POST — start actor and return runId immediately ───────────────────────────

export async function POST(req: NextRequest) {
  const authError = validateApiAuth(req);
  if (authError) return authError;

  // Rate limit: get user from session
  let userId = "anonymous";
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  } catch { /* anonymous */ }

  const rateLimit = await checkLeadScrapeLimit(userId);
  const headers = new Headers();
  setRateLimitHeaders(headers, rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Daily scrape limit reached (${rateLimit.used}/${rateLimit.limit}). Resets at ${rateLimit.resetAt}.` },
      { status: 429, headers }
    );
  }

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();

    const validationError = validateFields(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { source, fields, filters } = body as {
      source: string; fields?: Record<string, string>; filters?: Record<string, unknown>;
    };

    let input: Record<string, unknown> = {};

    if (source === "linkedin") {
      // Map frontend filters to Apify actor input
      const f = (filters || {}) as Record<string, unknown>;
      const countries = Array.isArray(f.countries) ? f.countries as string[] : [];
      const industries = Array.isArray(f.industries) ? f.industries as string[] : [];
      const titles = typeof f.keyword === "string" && f.keyword ? f.keyword : "";
      const sizes = Array.isArray(f.companySizes) ? f.companySizes as string[] : [];
      const maxResults = parseInt(fields?.limit || (f.leadLimit as string) || "100");

      input = {
        max_results: Math.min(maxResults, 500),
        include_emails: true,
        include_phones: false,
      };

      // Map countries to Apify person_location_country
      if (countries.length > 0) {
        input.person_location_country = countries;
      }

      // Map industries to search terms (actor uses keyword-based industry search)
      if (industries.length > 0) {
        input.search_terms = industries.join(" OR ");
      }

      // Map title keywords to job_titles
      if (titles) {
        const titleArr = titles.split(",").map((t: string) => t.trim()).filter(Boolean);
        if (titleArr.length > 0) input.job_titles = titleArr;
      }

      // Map company sizes
      if (sizes.length > 0) {
        input.employee_size = sizes;
      }

      // Always target B2B-relevant seniority and departments
      input.job_title_seniority = ["owner", "cxo", "vp", "director", "manager"];
      input.job_departments = ["sales", "marketing", "engineering", "product", "business_development"];

      // Store filters that Apify doesn't support for server-side post-filtering
      const unsupportedFilters = {
        minScore: typeof f.minScore === "number" ? f.minScore : 0,
        emailStatus: Array.isArray(f.emailStatus) ? f.emailStatus as string[] : [],
        sources: Array.isArray(f.sources) ? f.sources as string[] : [],
      };

      // Attach to input for the poller to use later
      (input as any)._unsupportedFilters = unsupportedFilters;

      // Store filter metadata in scrape_logs for the GET poller
      const filterMeta = (input as any)._unsupportedFilters;
      if (filterMeta) {
        await supabaseAdmin.from("scrape_logs").insert({
          filters_used: { ...input, _unsupportedFilters: filterMeta },
          status: "started",
          estimated_leads: parseInt(fields?.limit || "100"),
        } as any);
      }
    } else if (source === "gmaps") {
      return NextResponse.json({ error: "Google Maps live mode coming soon" }, { status: 400 });
    } else if (source === "amazon") {
      return NextResponse.json({ error: "Amazon live mode coming soon" }, { status: 400 });
    }

    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?waitForFinish=0`,
      { method: "POST", headers: APIFY_HEADERS, body: JSON.stringify(input) }
    );
    const startText = await startRes.text();
    let startData: any = {};
    try { startData = JSON.parse(startText); } catch {
      throw new Error(`Apify returned non-JSON (HTTP ${startRes.status}): ${startText.slice(0, 120)}`);
    }

    if (!startRes.ok) {
      const ae = apifyError(startData);
      throw new Error(ae || `Apify HTTP ${startRes.status}`);
    }

    const runId = startData?.data?.id;
    if (!runId) {
      const ae = apifyError(startData);
      throw new Error(ae || "Failed to start actor — no runId returned");
    }

    return NextResponse.json({ runId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — poll actor run status and return results when complete ──────────────

export async function GET(req: NextRequest) {
  const authError = validateApiAuth(req);
  if (authError) return authError;

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "Missing runId parameter" }, { status: 400 });
  }

  try {
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: APIFY_HEADERS }
    );
    const statusText = await statusRes.text();
    let statusData: any = {};
    try { statusData = JSON.parse(statusText); } catch {
      throw new Error(`Apify returned non-JSON response (HTTP ${statusRes.status}): ${statusText.slice(0, 120)}`);
    }

    if (!statusRes.ok) {
      const ae = apifyError(statusData);
      throw new Error(ae || `Apify HTTP ${statusRes.status}`);
    }

    const status = statusData?.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data.defaultDatasetId;
      if (!datasetId) {
        return NextResponse.json({ status: "SUCCEEDED", leads: [], totalFetched: 0, matched: 0, runId });
      }

      const dataRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?limit=500`,
        { headers: APIFY_HEADERS }
      );
      const dataText = await dataRes.text();
      let rawLeads: any[] = [];
      try { const parsed = JSON.parse(dataText); rawLeads = Array.isArray(parsed) ? parsed : []; } catch { /* empty */ }

      const totalFetched = rawLeads.length;

      // Fetch filter metadata stored during POST to apply server-side filtering
      let postFilters: Record<string, unknown> = {};
      try {
        const { data: logEntry } = await supabaseAdmin
          .from("scrape_logs")
          .select("filters_used")
          .eq("status", "started")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (logEntry?.filters_used?._unsupportedFilters) {
          postFilters = logEntry.filters_used._unsupportedFilters as Record<string, unknown>;
        }
      } catch { /* filter without metadata */ }

      // Server-side filter: apply filters that Apify doesn't support
      const minScore = (postFilters.minScore as number) || 0;
      const wantedSources = (postFilters.sources as string[]) || [];
      const wantedEmailStatus = (postFilters.emailStatus as string[]) || [];

      const matchedLeads = rawLeads.filter((item: any) => {
        // Score filter: Apify items don't have score; we assign one here for filtering
        const email = (item.email || item.emails?.[0]?.address || "").toString().toLowerCase().trim();
        const linkedin = (item.linkedin_url || "").toString().trim();
        const name = (item.full_name || item.name || "").toString().trim();
        const company = (item.job_company_name || item.company || "").toString().trim();

        // Skip leads with no name or company — likely junk
        if (!name || !company) return false;

        // Skip leads without email or linkedin — can't use them
        if (!email && !linkedin) return false;

        return true;
      }).map((item: any) => {
        // Normalize the Apify item into a lead-like object with a preliminary score
        const email = (item.email || item.emails?.[0]?.address || "").toString().toLowerCase().trim();
        const hasEmail = !!email;
        const hasLinkedin = !!(item.linkedin_url || "").toString().trim();
        let preScore = 70;
        if (hasEmail) preScore += 15;
        if (hasLinkedin) preScore += 10;
        // Apply user's minScore filter
        if (preScore < minScore) return null;
        return { ...item, _preScore: preScore, _email: email };
      }).filter(Boolean);

      const matched = matchedLeads.length;

      // Update scrape_logs with results
      try {
        await supabaseAdmin
          .from("scrape_logs")
          .update({
            status: "completed",
            leads_fetched: totalFetched,
            leads_added: 0,
            duplicates_removed: 0,
            emails_found: matchedLeads.filter((l: any) => l._email).length,
            linkedin_matched: Math.round((matchedLeads.filter((l: any) => l.linkedin_url).length / Math.max(matched, 1)) * 100),
            credits_consumed: Math.ceil(totalFetched / 5),
            match_accuracy: totalFetched > 0 ? Math.round((matched / totalFetched) * 100) : 0,
          })
          .eq("status", "started");
      } catch { /* log failure non-critical */ }

      return NextResponse.json({
        status: "SUCCEEDED",
        leads: matchedLeads,
        totalFetched,
        matched,
        runId,
        datasetId,
      });
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      const exitCode = statusData?.data?.exitCode;
      const statusMsg = statusData?.data?.statusMessage || "";
      return NextResponse.json({
        status,
        runId,
        error: statusMsg ? `Actor ${status}: ${statusMsg}` : `Actor run ${status}`,
      });
    }

    return NextResponse.json({ status: status || "RUNNING", runId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
