import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Lead } from "@/lib/types";

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function inferIndustry(types: string[]): string {
  if (types.some(x => ["dentist", "dental_clinic"].includes(x))) return "Healthcare";
  if (types.some(x => ["real_estate_agency"].includes(x))) return "Real Estate";
  if (types.some(x => ["lawyer", "attorney"].includes(x))) return "Legal";
  if (types.some(x => ["physiotherapist", "doctor", "medical_clinic", "hospital", "health"].includes(x))) return "Healthcare";
  if (types.some(x => ["gym", "fitness_center"].includes(x))) return "Fitness";
  if (types.some(x => ["spa", "beauty_salon", "hair_care"].includes(x))) return "Beauty & Wellness";
  if (types.some(x => ["plumber", "electrician", "general_contractor", "roofing_contractor"].includes(x))) return "Home Services";
  if (types.some(x => ["accounting"].includes(x))) return "Finance";
  if (types.some(x => ["insurance_agency"].includes(x))) return "Insurance";
  if (types.some(x => ["car_dealer", "car_repair"].includes(x))) return "Automotive";
  if (types.some(x => ["veterinary_care"].includes(x))) return "Veterinary";
  if (types.some(x => ["lodging", "hotel"].includes(x))) return "Hospitality";
  if (types.some(x => ["restaurant", "food", "cafe", "bakery"].includes(x))) return "Food & Beverage";
  if (types.some(x => ["school", "university"].includes(x))) return "Education";
  if (types.some(x => ["moving_company", "storage"].includes(x))) return "Moving & Storage";
  if (types.some(x => ["locksmith", "security"].includes(x))) return "Security Services";
  if (types.some(x => ["pest_control"].includes(x))) return "Pest Control";
  if (types.some(x => ["landscaping", "lawn_care"].includes(x))) return "Landscaping";
  if (types.some(x => ["cleaning"].includes(x))) return "Cleaning Services";
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

export interface GMapsBusiness {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  category: string;
  industry: string;
  businessStatus: string;
  types: string[];
  score: number;
  lat?: number;
  lng?: number;
}

async function fetchDetails(placeId: string): Promise<{ phone: string; website: string }> {
  try {
    const res = await fetch(
      `${PLACES_BASE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_phone_number,website&key=${MAPS_KEY}`,
      { next: { revalidate: 0 } },
    );
    const data = await res.json();
    return {
      phone: data.result?.formatted_phone_number || "",
      website: data.result?.website || "",
    };
  } catch {
    return { phone: "", website: "" };
  }
}

// ─── GET — search Google Places ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!MAPS_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured. Add it to your Vercel environment variables." },
      { status: 500 },
    );
  }

  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q") || "";
  const location = searchParams.get("location") || "";
  const minRating = parseFloat(searchParams.get("minRating") || "0");
  const pageToken = searchParams.get("pageToken") || "";

  if (!query || !location) {
    return NextResponse.json({ error: "q and location are required" }, { status: 400 });
  }

  const searchQuery = encodeURIComponent(`${query} in ${location}`);
  let url = `${PLACES_BASE}/textsearch/json?query=${searchQuery}&key=${MAPS_KEY}`;
  if (pageToken) url += `&pagetoken=${encodeURIComponent(pageToken)}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json(
      { error: `Google Places API: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}` },
      { status: 400 },
    );
  }

  const rawResults: any[] = data.results || [];

  const filtered = minRating > 0
    ? rawResults.filter((r: any) => (r.rating || 0) >= minRating)
    : rawResults;

  // Fetch phone + website for all results in parallel
  const detailsArr = await Promise.all(filtered.map((r: any) => fetchDetails(r.place_id)));

  const results: GMapsBusiness[] = filtered.map((r: any, i: number) => {
    const details = detailsArr[i];
    const rating = r.rating || 0;
    const reviewCount = r.user_ratings_total || 0;
    const types: string[] = r.types || [];
    const rawCategory = types.find(t => !["point_of_interest", "establishment", "business"].includes(t));
    const category = rawCategory
      ? rawCategory.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "Business";
    const isOperational = (r.business_status || "OPERATIONAL") === "OPERATIONAL";

    return {
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address || "",
      phone: details.phone,
      website: details.website,
      rating,
      reviewCount,
      category,
      industry: inferIndustry(types),
      businessStatus: r.business_status || "OPERATIONAL",
      types,
      score: computeScore(rating, reviewCount, !!details.phone, !!details.website, isOperational),
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    };
  });

  return NextResponse.json({
    results,
    nextPageToken: data.next_page_token || null,
    total: results.length,
  });
}

// ─── POST — import selected businesses as leads ────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as { places: GMapsBusiness[] };
  const { places } = body;

  if (!Array.isArray(places) || places.length === 0) {
    return NextResponse.json({ error: "places array is required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const leads: Lead[] = places.map((p) => ({
    id: `gmaps_${p.placeId}`,
    name: p.name,
    title: "Owner",
    company: p.name,
    industry: p.industry,
    location: p.address,
    email: "",
    emailStatus: "not_found" as const,
    linkedin: "",
    website: p.website || "",
    companySize: "1-10",
    score: p.score,
    source: "gmaps" as const,
    status: "new" as const,
    tags: [p.category, p.industry].filter(Boolean),
    notes: [
      p.phone ? `Phone: ${p.phone}` : null,
      p.rating ? `Rating: ${p.rating}/5 (${p.reviewCount} reviews)` : null,
      p.businessStatus !== "OPERATIONAL" ? `Status: ${p.businessStatus}` : null,
    ].filter(Boolean).join("  |  "),
    savedAt: now,
    fetchedAt: now,
  }));

  const { mergeLeadsInDB } = await import("@/lib/db");
  const result = await mergeLeadsInDB(leads);

  // Log activity for each new lead
  if (result.added > 0) {
    try {
      await supabaseAdmin.from("activity_log").insert(
        leads.slice(0, result.added).map(l => ({
          type: "lead_added",
          text: `${l.name} added from Google Maps`,
          lead_id: l.id,
        }))
      );
    } catch { /* non-critical */ }
  }

  return NextResponse.json({
    imported: result.added,
    duplicates: result.updated,
    total: leads.length,
  });
}
