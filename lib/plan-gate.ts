// Client-safe plan/module gating — no server imports
import type { PlanKey, UserRole } from "./types";
import { PLAN_MODULES } from "./types";

export function canAccessModule(plan: PlanKey | null, module: string): boolean {
  if (!plan) return false;
  return PLAN_MODULES[plan]?.includes(module) ?? false;
}

export function isRoleSafe(role: string | null | undefined, ...roles: UserRole[]): boolean {
  return role !== null && role !== undefined && roles.includes(role as UserRole);
}
