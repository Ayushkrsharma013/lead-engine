import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil" as any,
});

export const PLANS = {
  diy: {
    name: "DIY Setup",
    priceId: process.env.STRIPE_PRICE_DIY || "",
    amount: 1500,
    interval: "one_time" as const,
    features: [
      "Full n8n workflow built for you",
      "Sales Navigator integration configured",
      "Gemini AI scoring (7+ filter)",
      "Google Sheets dashboard",
      "Telegram alerts configured",
      "1-week email support post-handover",
    ],
  },
  growth: {
    name: "Managed Growth",
    priceId: process.env.STRIPE_PRICE_GROWTH || "",
    amount: 3500,
    interval: "month" as const,
    features: [
      "Everything in DIY Setup",
      "AI icebreaker per lead",
      "Company & LinkedIn enrichment",
      "Daily Slack digest with hot leads",
      "Duplicate suppression",
      "Monthly ICP refinement call",
      "Dedicated Slack channel",
    ],
  },
  scale: {
    name: "Managed Scale",
    priceId: process.env.STRIPE_PRICE_SCALE || "",
    amount: 12500,
    interval: "month" as const,
    features: [
      "Everything in Managed Growth",
      "Automated cold email sending",
      "3-touch follow-up sequences",
      "AI reply detection & routing",
      "HubSpot / Salesforce CRM sync",
      "A/B message testing",
      "Weekly performance report",
      "Dedicated AI strategist",
    ],
  },
};

export type PlanKey = keyof typeof PLANS;
