import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/api-auth";
import { checkLeadScrapeLimit, setRateLimitHeaders } from "@/lib/rate-limit";
import { createServerClient } from "@supabase/ssr";

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

    const { source, fields } = body as { source: string; fields?: Record<string, string> };

    let input: Record<string, unknown> = {};

    if (source === "linkedin") {
      input = {
        max_results: parseInt(fields?.limit || "100"),
        person_location_country: [fields?.country || "United States"],
        business_model: ["saas", "b2b"],
        job_title_seniority: ["owner", "cxo", "vp", "director", "manager"],
        job_departments: ["sales", "marketing", "engineering", "product", "business_development"],
        employee_size: (fields?.size && fields.size !== "Any") ? [fields.size] : ["11-50", "51-200", "201-500"],
        email_status: "verified",
        include_emails: true,
        include_phones: false,
      };
      if (fields?.titles) input.job_titles = fields.titles.split(",").map((t: string) => t.trim());
    } else if (source === "gmaps") {
      return NextResponse.json({ error: "Google Maps live mode coming soon" }, { status: 400 });
    } else if (source === "amazon") {
      return NextResponse.json({ error: "Amazon live mode coming soon" }, { status: 400 });
    }

    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?waitForFinish=0`,
      { method: "POST", headers: APIFY_HEADERS, body: JSON.stringify(input) }
    );
    const startData = await startRes.json();

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
    const statusData = await statusRes.json();

    if (!statusRes.ok) {
      const ae = apifyError(statusData);
      throw new Error(ae || `Apify HTTP ${statusRes.status}`);
    }

    const status = statusData?.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data.defaultDatasetId;
      if (!datasetId) {
        return NextResponse.json({ status: "SUCCEEDED", leads: [], runId });
      }

      const dataRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?limit=200`,
        { headers: APIFY_HEADERS }
      );
      const leads = await dataRes.json();

      return NextResponse.json({
        status: "SUCCEEDED",
        leads: Array.isArray(leads) ? leads : [],
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
