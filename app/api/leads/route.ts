import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";

// POST — start actor and return runId immediately
export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { source, fields } = await req.json();

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
      `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );
    const startData = await startRes.json();
    const runId = startData?.data?.id;
    if (!runId) throw new Error("Failed to start actor run");

    return NextResponse.json({ runId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — poll actor run status and return results when complete
export async function GET(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "Missing runId parameter" }, { status: 400 });
  }

  try {
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    const statusData = await statusRes.json();
    const status = statusData?.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data.defaultDatasetId;
      const dataRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=200`
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
      return NextResponse.json({ status, runId });
    }

    return NextResponse.json({ status: status || "RUNNING", runId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
