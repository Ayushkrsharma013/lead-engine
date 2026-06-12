import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { checkLeadScrapeLimit, setRateLimitHeaders } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";
import { fireWebhook } from "@/lib/webhook";
import { APIFY_ACTOR_ID, APIFY_BASE, apifyHeaders, SENIORITY_MAP, FUNCTION_MAP } from "@/lib/apify-config";

export const maxDuration = 300;

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
  const session = await requireApiSession(req);
  if (!("userId" in session)) return session;
  const userId = session.userId;

  const rateLimit = await checkLeadScrapeLimit(userId);
  const headers = new Headers();
  setRateLimitHeaders(headers, rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Daily scrape limit reached (${rateLimit.used}/${rateLimit.limit}). Resets at ${rateLimit.resetAt}.` },
      { status: 429, headers }
    );
  }

  if (!process.env.APIFY_API_KEY) {
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
      const countries   = Array.isArray(f.countries)    ? f.countries    as string[] : [];
      const regions     = Array.isArray(f.regions)      ? f.regions      as string[] : [];
      const industries  = Array.isArray(f.industries)   ? f.industries   as string[] : [];
      const seniority   = Array.isArray(f.seniority)    ? f.seniority    as string[] : [];
      const jobFunction = Array.isArray(f.jobFunction)  ? f.jobFunction  as string[] : [];
      const sizes       = Array.isArray(f.companySizes) ? f.companySizes as string[] : [];
      const salary      = Array.isArray(f.salary)       ? f.salary       as string[] : [];
      const emailStatus = Array.isArray(f.emailStatus)  ? f.emailStatus  as string[] : [];
      const companyDomains = typeof f.companyDomains === "string" ? f.companyDomains : "";
      const titles      = typeof f.keyword === "string" && f.keyword ? f.keyword : "";
      const maxResults  = parseInt(fields?.limit || String(f.leadLimit || "100"));

      // Over-fetch 3× target so dedup against existing DB still yields new leads
      input = {
        max_results: Math.min(maxResults * 3, 500),
        include_emails: true,
        include_phones: false,
      };

      // Countries
      if (countries.length > 0) input.person_location_country = countries;

      // Regions (US states, EU cities)
      if (regions.length > 0) input.person_location_region = regions;

      // Industries → search_terms
      if (industries.length > 0) input.search_terms = industries.join(" OR ");

      // Keyword → job_titles
      if (titles) {
        const titleArr = titles.split(",").map((t: string) => t.trim()).filter(Boolean);
        if (titleArr.length > 0) input.job_titles = titleArr;
      }

      // Company sizes
      if (sizes.length > 0) input.employee_size = sizes;

      // Seniority
      const mappedSeniority = seniority.map(s => SENIORITY_MAP[s]).filter(Boolean);
      input.job_title_seniority = mappedSeniority.length > 0
        ? mappedSeniority
        : ["owner", "cxo", "vp", "director", "manager"];

      // Job function / departments
      const mappedDepts = jobFunction.map(fn => FUNCTION_MAP[fn]).filter(Boolean);
      input.job_departments = mappedDepts.length > 0
        ? mappedDepts
        : ["sales", "marketing", "engineering", "product", "business_development"];

      // Salary
      if (salary.length > 0) input.inferred_salary = salary;

      // Company domains → company_website
      if (companyDomains.trim()) {
        const domainArr = companyDomains.split(",").map(d => d.trim()).filter(Boolean);
        if (domainArr.length > 0) input.company_website = domainArr;
      }

      // Email status mapping
      const emailStatusActor = emailStatus.includes("verified")
        ? "verified"
        : emailStatus.includes("risky")
        ? "likely"
        : "all";
      input.email_status = emailStatusActor;

      // Store filters that Apify doesn't support for server-side post-filtering
      const unsupportedFilters = {
        minScore: typeof f.minScore === "number" ? f.minScore : 0,
        emailStatus,
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
      `${APIFY_BASE}/acts/${APIFY_ACTOR_ID}/runs?waitForFinish=0`,
      { method: "POST", headers: apifyHeaders(), body: JSON.stringify(input) }
    );
    const startText = await startRes.text();
    let startData: any = {};
    try { startData = JSON.parse(startText); } catch (err) { console.error("[leads] Apify start response parse failed:", err);
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
  const session = await requireApiSession(req);
  if (!("userId" in session)) return session;

  if (!process.env.APIFY_API_KEY) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "Missing runId parameter" }, { status: 400 });
  }

  try {
    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}`,
      { headers: apifyHeaders() }
    );
    const statusText = await statusRes.text();
    let statusData: any = {};
    try { statusData = JSON.parse(statusText); } catch (err) { console.error("[leads] Apify status response parse failed:", err);
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
        `${APIFY_BASE}/datasets/${datasetId}/items?limit=500`,
        { headers: apifyHeaders() }
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
      // Determine source from filters — default to "linkedin" for this actor
      const leadSource = (wantedSources.length === 1 ? wantedSources[0] : "linkedin") as string;

      const matchedLeads = rawLeads.map((item: any) => {
        // Normalize the Apify item into a lead-like object with proper fields
        const email = (item.email || item.emails?.[0]?.address || "").toString().toLowerCase().trim();
        const linkedin = (item.linkedin_url || "").toString().trim();
        const name = (item.full_name || item.name || "").toString().trim();
        const company = (item.job_company_name || item.company || "").toString().trim();

        // Skip leads with no name or company — likely junk
        if (!name || !company) return null;

        // Skip leads without email or linkedin — can't use them
        if (!email && !linkedin) return null;

        // Compute score based on data completeness
        const hasEmail = !!email;
        const hasLinkedin = !!linkedin;
        let score = 70;
        if (hasEmail) score += 15;
        if (hasLinkedin) score += 10;

        // Apply user's minScore filter
        if (score < minScore) return null;

        // Determine email status
        const emailStatus = hasEmail ? "verified" : "not_found";

        // Return normalized lead with proper source, score, and emailStatus
        return {
          ...item,
          source: leadSource,
          score,
          emailStatus,
          email: email,
          _preScore: score,
          _email: email,
        };
      }).filter(Boolean);

      const matched = matchedLeads.length;
      if (matched > 0) {
        console.log(`[leads] First imported lead: source=${matchedLeads[0].source} score=${matchedLeads[0].score} emailStatus=${matchedLeads[0].emailStatus}`);
      }

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

      // Notify n8n lead delivery alert (non-blocking, with retry)
      if (matched > 0) {
        void fireWebhook("https://automate.flow-forges.com/webhook/lead-delivery", {
          client_id: "scrape",
          client_name: "Manual Scrape",
          lead_count: matched,
          hot_count: matchedLeads.filter((l: any) => (l.score || l._score || 0) >= 80).length,
          avg_score: matchedLeads.reduce((s: number, l: any) => s + (l.score || l._score || 0), 0) / Math.max(matched, 1),
        }, { label: "lead-delivery" });
      }

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
