import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Lead } from "@/lib/types";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_API_KEY || "";
const ACTOR = "compass~crawler-google-places";
const APIFY_HEADERS = {
  Authorization: `Bearer ${APIFY_TOKEN}`,
  "Content-Type": "application/json",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function inferIndustry(categories: string[]): string {
  const cats = categories.map(c => c.toLowerCase());
  if (cats.some(c => c.includes("dentist") || c.includes("dental"))) return "Healthcare";
  if (cats.some(c => c.includes("real estate"))) return "Real Estate";
  if (cats.some(c => c.includes("law") || c.includes("attorney") || c.includes("legal"))) return "Legal";
  if (cats.some(c => c.includes("doctor") || c.includes("clinic") || c.includes("medical") || c.includes("physician"))) return "Healthcare";
  if (cats.some(c => c.includes("gym") || c.includes("fitness") || c.includes("yoga"))) return "Fitness";
  if (cats.some(c => c.includes("spa") || c.includes("beauty") || c.includes("salon") || c.includes("hair"))) return "Beauty & Wellness";
  if (cats.some(c => c.includes("plumb") || c.includes("electric") || c.includes("hvac") || c.includes("roofing") || c.includes("contractor"))) return "Home Services";
  if (cats.some(c => c.includes("account") || c.includes("bookkeep"))) return "Finance";
  if (cats.some(c => c.includes("insurance"))) return "Insurance";
  if (cats.some(c => c.includes("auto") || c.includes("car repair") || c.includes("mechanic"))) return "Automotive";
  if (cats.some(c => c.includes("vet") || c.includes("animal"))) return "Veterinary";
  if (cats.some(c => c.includes("hotel") || c.includes("motel") || c.includes("inn"))) return "Hospitality";
  if (cats.some(c => c.includes("restaurant") || c.includes("cafe") || c.includes("pizza") || c.includes("food"))) return "Food & Beverage";
  if (cats.some(c => c.includes("school") || c.includes("tutor") || c.includes("education"))) return "Education";
  if (cats.some(c => c.includes("pest"))) return "Pest Control";
  if (cats.some(c => c.includes("landscap") || c.includes("lawn"))) return "Landscaping";
  if (cats.some(c => c.includes("clean"))) return "Cleaning Services";
  if (cats.some(c => c.includes("moving") || c.includes("storage"))) return "Moving & Storage";
  if (cats.some(c => c.includes("chiropractic") || c.includes("chiropractor"))) return "Healthcare";
  return "Local Business";
}

function computeScore(
  rating: number,
  reviewCount: number,
  hasPhone: boolean,
  hasWebsite: boolean,
  isOperational: boolean,
): number {
  let score = 60;
  if (rating >= 4.5) score += 20;
  else if (rating >= 4.0) score += 13;
  else if (rating >= 3.5) score += 6;
  if (reviewCount >= 200) score += 10;
  else if (reviewCount >= 50) score += 6;
  else if (reviewCount >= 10) score += 3;
  if (hasPhone) score += 5;
  if (hasWebsite) score += 5;
  if (!isOperational) score -= 15;
  return Math.max(0, Math.min(score, 100));
}

function mapItemToLead(item: any, now: string): Lead | null {
  const name = (item.title || "").trim();
  if (!name) return null;

  const phone = (item.phoneUnformatted || item.phone || "").trim();
  const website = (item.website || "").trim();
  const address = (item.address || item.street || "").trim();
  const rating = typeof item.totalScore === "number" ? item.totalScore : (typeof item.rating === "number" ? item.rating : 0);
  const reviewCount = typeof item.reviewsCount === "number" ? item.reviewsCount : 0;
  const categories: string[] = item.categories || (item.categoryName ? [item.categoryName] : []);
  const placeId = item.placeId || item.id || `${name}_${address}`.replace(/\s+/g, "_");
  const isOperational = (item.businessStatus || "OPERATIONAL") !== "CLOSED_PERMANENTLY";

  const locationParts = [item.city, item.state, item.countryCode].filter(Boolean);
  const location = address || locationParts.join(", ");
  if (!location) return null;

  return {
    id: `gmaps_${placeId}`,
    name,
    title: "Owner",
    company: name,
    industry: inferIndustry(categories),
    location,
    email: "",
    emailStatus: "not_found",
    linkedin: "",
    website,
    companySize: "1-10",
    score: computeScore(rating, reviewCount, !!phone, !!website, isOperational),
    source: "gmaps",
    status: "new",
    tags: categories.slice(0, 3),
    notes: [
      phone ? `Phone: ${phone}` : null,
      rating ? `Rating: ${rating}/5 (${reviewCount} reviews)` : null,
      !isOperational ? `Status: ${item.businessStatus}` : null,
    ].filter(Boolean).join("  |  "),
    savedAt: now,
    fetchedAt: now,
  };
}

// ─── Helpers: rating → Apify format ─────────────────────────────────────────────

function ratingToApify(min: number): string | undefined {
  if (min >= 4.5) return "fourAndHalf";
  if (min >= 4) return "four";
  if (min >= 3.5) return "threeAndHalf";
  if (min >= 3) return "three";
  if (min >= 2) return "two";
  return undefined;
}

// ─── POST — start Apify actor run ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json() as {
    query: string;
    location: string;
    maxResults?: number;
    minRating?: number;
    websiteRequired?: boolean;
  };

  const { query, location, maxResults = 50, minRating = 0, websiteRequired = false } = body;

  if (!query?.trim() || !location?.trim()) {
    return NextResponse.json({ error: "query and location are required" }, { status: 400 });
  }

  const searchTerm = query.trim();
  const searchString = `${searchTerm} in ${location.trim()}`;

  const input: Record<string, unknown> = {
    searchStringsArray: [searchTerm],
    locationQuery: location.trim(),
    maxCrawledPlacesPerSearch: Math.min(maxResults, 200),
    language: "en",
    categoryFilterWords: [searchTerm.toLowerCase()],
    skipClosedPlaces: true,
    maxImages: 0,
    maxReviews: 0,
  };

  const stars = ratingToApify(minRating);
  if (stars) input.placeMinimumStars = stars;
  if (websiteRequired) input.website = "withWebsite";

  try {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs?waitForFinish=0`,
      { method: "POST", headers: APIFY_HEADERS, body: JSON.stringify(input) },
    );
    const startData = await startRes.json();

    if (!startRes.ok) {
      const msg = startData?.error?.message || startData?.error || `Apify HTTP ${startRes.status}`;
      return NextResponse.json({ error: String(msg) }, { status: 500 });
    }

    const runId = startData?.data?.id;
    if (!runId) {
      return NextResponse.json({ error: "Failed to start actor — no runId returned" }, { status: 500 });
    }

    return NextResponse.json({ runId, searchString });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — poll run + return results when done ─────────────────────────────────

export async function GET(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_KEY not configured" }, { status: 500 });
  }

  const runId = req.nextUrl.searchParams.get("runId");
  const minRating = parseFloat(req.nextUrl.searchParams.get("minRating") || "0");
  const importNow = req.nextUrl.searchParams.get("import") === "1";

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: APIFY_HEADERS },
    );
    const statusData = await statusRes.json();

    if (!statusRes.ok) {
      return NextResponse.json({ error: `Apify HTTP ${statusRes.status}` }, { status: 500 });
    }

    const status: string = statusData?.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data.defaultDatasetId;
      if (!datasetId) {
        return NextResponse.json({ status: "SUCCEEDED", results: [], total: 0, runId });
      }

      const dataRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?limit=500`,
        { headers: APIFY_HEADERS },
      );
      const rawItems: any[] = await dataRes.json().then(d => (Array.isArray(d) ? d : [])).catch(() => []);

      const now = new Date().toISOString();

      // Map to our GMapsBusiness shape for the UI
      const results = rawItems
        .filter((item: any) => {
          const rating = item.totalScore || item.rating || 0;
          return minRating === 0 || rating >= minRating;
        })
        .map((item: any) => {
          const phone = (item.phoneUnformatted || item.phone || "").trim();
          const website = (item.website || "").trim();
          const rating = typeof item.totalScore === "number" ? item.totalScore : (typeof item.rating === "number" ? item.rating : 0);
          const reviewCount = typeof item.reviewsCount === "number" ? item.reviewsCount : 0;
          const categories: string[] = item.categories || (item.categoryName ? [item.categoryName] : []);
          const isOperational = (item.businessStatus || "OPERATIONAL") !== "CLOSED_PERMANENTLY";
          const rawCategory = categories[0] || "Business";

          return {
            placeId: item.placeId || item.id || `${item.title}_${item.address}`.replace(/\s+/g, "_"),
            name: item.title || "",
            address: item.address || [item.city, item.state, item.countryCode].filter(Boolean).join(", "),
            phone,
            website,
            rating,
            reviewCount,
            category: rawCategory,
            industry: inferIndustry(categories),
            businessStatus: item.businessStatus || "OPERATIONAL",
            types: categories,
            score: computeScore(rating, reviewCount, !!phone, !!website, isOperational),
            lat: item.location?.lat,
            lng: item.location?.lng,
          };
        })
        .filter((r: any) => r.name);

      // Auto-import if requested
      let importResult: { imported: number; duplicates: number } | null = null;
      if (importNow && results.length > 0) {
        const leads: Lead[] = results
          .map((r: any) => mapItemToLead({
            title: r.name, address: r.address, phoneUnformatted: r.phone,
            website: r.website, totalScore: r.rating, reviewsCount: r.reviewCount,
            categories: r.types, placeId: r.placeId, businessStatus: r.businessStatus,
          }, now))
          .filter(Boolean) as Lead[];

        if (leads.length > 0) {
          const { mergeLeadsInDB } = await import("@/lib/db");
          const merged = await mergeLeadsInDB(leads);
          importResult = { imported: merged.added, duplicates: merged.updated };

          if (merged.added > 0) {
            void supabaseAdmin.from("activity_log").insert(
              leads.slice(0, merged.added).map(l => ({
                type: "lead_added",
                text: `${l.name} added from Google Maps (Apify)`,
                lead_id: l.id,
              }))
            );
          }
        }
      }

      return NextResponse.json({
        status: "SUCCEEDED",
        results,
        total: results.length,
        runId,
        ...(importResult ? { importResult } : {}),
      });
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      return NextResponse.json({
        status,
        runId,
        error: statusData?.data?.statusMessage || `Actor run ${status}`,
      });
    }

    // Still running — return progress estimate
    const stats = statusData?.data?.stats || {};
    return NextResponse.json({
      status: status || "RUNNING",
      runId,
      crawled: stats.pagesWithResults || 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH — import a specific result set by runId ────────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { places: any[] };
  const { places } = body;

  if (!Array.isArray(places) || places.length === 0) {
    return NextResponse.json({ error: "places array required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const leads: Lead[] = places
    .map((p: any) => mapItemToLead({
      title: p.name, address: p.address, phoneUnformatted: p.phone,
      website: p.website, totalScore: p.rating, reviewsCount: p.reviewCount,
      categories: p.types, placeId: p.placeId, businessStatus: p.businessStatus,
    }, now))
    .filter(Boolean) as Lead[];

  if (leads.length === 0) {
    return NextResponse.json({ imported: 0, duplicates: 0, total: 0 });
  }

  const { mergeLeadsInDB } = await import("@/lib/db");
  const result = await mergeLeadsInDB(leads);

  if (result.added > 0) {
    void supabaseAdmin.from("activity_log").insert(
      leads.slice(0, result.added).map(l => ({
        type: "lead_added",
        text: `${l.name} added from Google Maps (Apify)`,
        lead_id: l.id,
      }))
    );
  }

  return NextResponse.json({
    imported: result.added,
    duplicates: result.updated,
    total: leads.length,
  });
}
