// PLANS — product definitions for Prospecting OS
// All amounts in USD. Payments via XflowPay + Easebuzz (one-time) and XflowPay VBAN ACH (monthly).
// Base pricing: Pilot ($1,499 + $499/mo), Growth ($2,499 + $999/mo), Micro ($997 one-time).

export const PLANS = {
  pilot: {
    name: "Founder's Pilot",
    setupAmount: 1499,
    monthlyAmount: 499,
    displaySetup: "$1,499",
    displayMonthly: "$499/month",
    features: [
      "100 ICP-verified leads/month",
      "3 personalized outreach sequences (Email or LinkedIn)",
      "Kanban pipeline configured",
      "Monthly strategy call",
      "Founder-managed delivery",
      "Apify lead scraping configured",
      "Anthropic Claude AI scoring",
      "Supabase-powered dashboard",
    ],
  },
  growth: {
    name: "Growth",
    setupAmount: 2499,
    monthlyAmount: 999,
    displaySetup: "$2,499",
    displayMonthly: "$999/month",
    features: [
      "Everything in Pilot, plus:",
      "200+ leads/month",
      "Email + LinkedIn sequences",
      "A/B testing of 2 variants",
      "Bi-weekly strategy calls",
      "Dedicated Slack channel",
      "Reply monitoring & warm handoff within 24 hrs",
    ],
  },
  scale: {
    name: "Scale",
    setupAmount: 4999,
    monthlyAmount: 1999,
    displaySetup: "$4,999",
    displayMonthly: "$1,999/month",
    features: [
      "Everything in Growth, plus:",
      "500+ leads/month",
      "Email + LinkedIn + GMap multi-channel",
      "A/B testing of 5 variants",
      "Weekly strategy calls",
      "Dedicated Slack + Telegram",
      "CRM sync (HubSpot/Salesforce)",
      "Priority support within 4 hrs",
    ],
  },
  micro: {
    name: "Founder's Pilot Micro-Offer",
    setupAmount: 997,
    monthlyAmount: 0,
    displaySetup: "$997",
    displayMonthly: "one-time",
    features: [
      "50 ICP-verified leads (one-time)",
      "5 personalized outreach sequences",
      "CSV + sequence document delivery",
      "30-min ICP definition call",
      "Delivery within 5 business days",
    ],
  },
};

export type PlanKey = keyof typeof PLANS;

export function getPlanSetupAmount(plan: PlanKey | string): number {
  const p = PLANS[plan as PlanKey];
  return p?.setupAmount ?? PLANS.pilot.setupAmount;
}

export function getPlanMonthlyAmount(plan: PlanKey | string): number {
  const p = PLANS[plan as PlanKey];
  return p?.monthlyAmount ?? PLANS.pilot.monthlyAmount;
}

export function getPlanPrice(plan: PlanKey | string): number {
  return getPlanSetupAmount(plan);
}
