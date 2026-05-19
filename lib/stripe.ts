// PLANS — product definitions
// Payments handled by Xflow Pay; Stripe is not used.
// All amounts in INR (base currency). Multi-currency conversion via lib/currency.ts.

import { convertINR, type CurrencyCode, ALL_CURRENCIES } from "./currency";

export const PLANS = {
  diy: {
    name: "DIY Setup",
    amount: 1500,
    interval: "one_time" as const,
    features: [
      "Prospecting OS platform configured for you",
      "Sales Navigator integration configured",
      "Gemini AI scoring (7+ filter)",
      "Google Sheets dashboard",
      "Telegram alerts configured",
      "1-week email support post-handover",
    ],
  },
  growth: {
    name: "Managed Growth",
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

export function getPlanPrice(plan: PlanKey | string, currency?: CurrencyCode): number {
  const p = PLANS[plan as PlanKey] || PLANS.diy;
  if (!currency || currency === "INR") return p.amount;
  return convertINR(p.amount, currency);
}

export function getPlanPrices(plan: PlanKey | string): Record<CurrencyCode, number> {
  const p = PLANS[plan as PlanKey] || PLANS.diy;
  return Object.fromEntries(ALL_CURRENCIES.map(c => [c, c === "INR" ? p.amount : convertINR(p.amount, c)])) as Record<CurrencyCode, number>;
}
