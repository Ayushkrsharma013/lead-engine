// Client-safe plan/module gating — no server imports
import { PLAN_MODULES, type PlanTier, type ModuleKey } from "./plan-modules";

export function canAccessModule(plan: PlanTier | null, module: string): boolean {
  if (!plan) return false;
  return PLAN_MODULES[plan]?.includes(module as ModuleKey) ?? false;
}
