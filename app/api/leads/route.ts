import { NextRequest, NextResponse } from "next/server";

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "x_guru~Leads-Scraper-apollo-zoominfo";

async function pollRun(runId: string): Promise<string> {
  const base = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetch(base);
    const data = await res.json();
    const status = data?.data?.status;
    if (status === "SUCCEEDED") return data.data.defaultDatasetId;
    if (status === "FAILED" || status === "ABORTED") throw new Error(`Actor run ${status}`);
  }
  throw new Error("Timed out waiting for actor");
}

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
      return NextResponse.json({ leads: [], message: "Google Maps live mode coming soon" });
    } else {
      return NextResponse.json({ leads: [], message: "Amazon live mode coming soon" });
    }

    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${APIFY_TOKEN}&async=1`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );
    const startData = await startRes.json();
    const runId = startData?.data?.id;
    if (!runId) throw new Error("Failed to start actor run");

    const datasetId = await pollRun(runId);

    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=200`
    );
    const leads = await dataRes.json();

    return NextResponse.json({ leads: Array.isArray(leads) ? leads : [], runId, datasetId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
