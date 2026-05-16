// Xflow Pay — manual payment reference generator
// Payments handled manually (not via Stripe). Reference format: XFLW-{timestamp}-{shortId}

import type { PlanKey } from "./types";
import { PLANS } from "./stripe";

export function generatePaymentRef(userId: string, plan: PlanKey): string {
  const ts = Date.now().toString(36).toUpperCase();
  const shortId = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `XFLW-${ts}-${shortId}`;
}

export function getPlanAmount(plan: PlanKey): number {
  return PLANS[plan]?.amount ?? 0;
}

export function getPlanInterval(plan: PlanKey): string {
  return PLANS[plan]?.interval ?? "one_time";
}
