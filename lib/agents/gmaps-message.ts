// lib/agents/gmaps-message.ts

const BOOKING_BASE =
  "https://app.flow-forges.com/prospecting-os/book?type=discovery&ref=gmaps&lid=";

export function buildBookingUrl(leadId: string): string {
  return `${BOOKING_BASE}${encodeURIComponent(leadId)}`;
}

export function parseRatingFromNotes(notes: string): { rating: number; reviewCount: number } {
  const match = notes.match(/Rating:\s*([\d.]+)\/5\s*\((\d+)\s*reviews?\)/i);
  if (!match) return { rating: 0, reviewCount: 0 };
  return { rating: parseFloat(match[1]), reviewCount: parseInt(match[2], 10) };
}

export function parsePhoneFromNotes(notes: string): string {
  const match = notes.match(/Phone:\s*([+\d\s\-().]+?)(?:\s*\|{2}|\s*$)/);
  if (!match) return "";
  return match[1].trim();
}

export function parseCityFromLocation(location: string): string {
  // "123 Main St, Austin, TX 78701, USA" → "Austin"
  const parts = location.split(",").map(s => s.trim());
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length >= 2) return parts[0];
  return location.trim();
}

type Tier = "A" | "B" | "C";

export function determineTier(rating: number, reviewCount: number): Tier {
  if (rating >= 4.5 && reviewCount >= 100) return "A";
  if (rating >= 4.0 || reviewCount >= 20) return "B";
  return "C";
}

export function generateContactFormMessage(params: {
  businessName: string;
  city: string;
  industry: string;
  rating: number;
  reviewCount: number;
  leadId: string;
}): string {
  const { businessName, city, industry, rating, reviewCount, leadId } = params;
  const tier = determineTier(rating, reviewCount);
  const bookingUrl = buildBookingUrl(leadId);
  const industryLower = industry.toLowerCase();

  if (tier === "A") {
    return (
      `Hi ${businessName}, I came across ${businessName} while researching top ` +
      `${industryLower}s in ${city} — clearly you're doing great work with ${reviewCount} reviews.\n\n` +
      `Quick question: what happens when a patient calls after hours and no one picks up? ` +
      `We built an AI agent that texts back within 60 seconds, qualifies the lead, and books the ` +
      `appointment automatically. Takes 48 hours to set up, no new software for your team.\n\n` +
      `Worth a 15-min call? ${bookingUrl}\n\n` +
      `— Ayush Kumar, Flow Forges`
    );
  }

  if (tier === "B") {
    return (
      `Hi ${businessName}, spotted ${businessName} while looking at ${city} ${industryLower}s. ` +
      `You've built solid reviews — missed calls are one of the fastest ways to stall that momentum.\n\n` +
      `Our AI agent responds to every missed call in under 60 seconds and books the appointment ` +
      `automatically. No extra staff needed.\n\n` +
      `Happy to show you how it works in 15 minutes: ${bookingUrl}\n\n` +
      `— Ayush Kumar, Flow Forges`
    );
  }

  // Tier C
  return (
    `Hi ${businessName}, in ${industryLower}, the first business to call back wins the ` +
    `client — every time.\n\n` +
    `Our AI missed-call agent responds in under 60 seconds and books appointments automatically, ` +
    `even at midnight. Local ${city} businesses using it are converting 40% more missed calls ` +
    `into paying clients.\n\n` +
    `15-minute demo: ${bookingUrl}\n\n` +
    `— Ayush Kumar, Flow Forges`
  );
}

export function generateSmsMessage(params: {
  businessName: string;
  leadId: string;
}): string {
  const { businessName, leadId } = params;
  const url = buildBookingUrl(leadId);
  const msg = `Hi, I emailed ${businessName} about recovering missed calls with AI. Worth a quick 15-min call? ${url} — Ayush, Flow Forges`;
  return msg.slice(0, 160);
}

// ─── Auto-queue: quality gate ──────────────────────────────────────────────────

const AUTO_QUEUE_MIN_SCORE = 75;
const AUTO_QUEUE_MIN_RATING = 4.0;

export interface QualityCheck {
  qualifies: boolean;
  reasons: string[];
  score: number;
  rating: number;
  reviewCount: number;
  hasWebsite: boolean;
  hasPhone: boolean;
  isOperational: boolean;
}

export function assessLeadQuality(lead: {
  score?: number | null;
  notes?: string | null;
  website?: string | null;
  status?: string | null;
}): QualityCheck {
  const score = lead.score ?? 0;
  const notes = lead.notes ?? "";
  const website = lead.website ?? "";
  const status = lead.status ?? "new";
  const { rating, reviewCount } = parseRatingFromNotes(notes);
  const phone = parsePhoneFromNotes(notes);
  const hasWebsite = website.length > 0;
  const hasPhone = phone.length > 0;
  const isOperational = !notes.includes("CLOSED") && !notes.includes("SUSPENDED");

  const reasons: string[] = [];

  if (score < AUTO_QUEUE_MIN_SCORE) reasons.push(`score ${score} < ${AUTO_QUEUE_MIN_SCORE}`);
  if (rating < AUTO_QUEUE_MIN_RATING) reasons.push(`rating ${rating.toFixed(1)} < ${AUTO_QUEUE_MIN_RATING.toFixed(1)}`);
  if (!hasWebsite && !hasPhone) reasons.push("no website or phone");
  if (!isOperational) reasons.push("not operational");
  if (status === "meeting" || status === "won" || status === "lost") reasons.push(`status is ${status}`);

  return {
    qualifies: reasons.length === 0,
    reasons,
    score,
    rating,
    reviewCount,
    hasWebsite,
    hasPhone,
    isOperational,
  };
}
