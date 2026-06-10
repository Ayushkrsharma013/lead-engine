// Plan-specific module definitions for client portal
// Each plan tier unlocks a subset of modules.

export type ModuleKey =
  | "overview"
  | "leads"
  | "icebreakers"
  | "analytics"
  | "sequences"
  | "crm-sync"
  | "integrations"
  | "connector-marketplace"
  | "team-access"
  | "billing"
  | "settings";

export type PlanTier = "micro" | "pilot" | "growth" | "scale";

// Modules available per plan tier
export const PLAN_MODULES: Record<PlanTier, ModuleKey[]> = {
  micro: ["overview", "leads", "icebreakers", "billing", "settings"],
  pilot: ["overview", "leads", "icebreakers", "billing", "settings", "sequences", "integrations"],
  growth: [
    "overview",
    "leads",
    "icebreakers",
    "billing",
    "settings",
    "sequences",
    "integrations",
    "analytics",
    "crm-sync",
    "connector-marketplace",
  ],
  scale: [
    "overview",
    "leads",
    "icebreakers",
    "billing",
    "settings",
    "sequences",
    "integrations",
    "analytics",
    "crm-sync",
    "connector-marketplace",
    "team-access",
  ],
};

// Human-readable labels
export const MODULE_LABELS: Record<ModuleKey, string> = {
  overview: "Overview",
  leads: "My Leads",
  icebreakers: "Icebreakers",
  analytics: "Analytics",
  sequences: "Sequences",
  "crm-sync": "CRM Sync",
  integrations: "Integrations",
  "connector-marketplace": "Connector Marketplace",
  "team-access": "Team Access",
  billing: "Billing",
  settings: "Settings",
};

// Route paths for each module
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  overview: "/client-portal",
  leads: "/client-portal/leads",
  icebreakers: "/client-portal/icebreakers",
  analytics: "/client-portal/analytics",
  sequences: "/client-portal/sequences",
  "crm-sync": "/client-portal/crm",
  integrations: "/client-portal/integrations",
  "connector-marketplace": "/client-portal/connectors",
  "team-access": "/client-portal/team",
  billing: "/client-portal/billing",
  settings: "/client-portal/settings",
};

// Icons for each module (lucide icon names)
export const MODULE_ICONS: Record<ModuleKey, string> = {
  overview: "LayoutDashboard",
  leads: "Users",
  icebreakers: "MessageSquare",
  analytics: "BarChart2",
  sequences: "GitBranch",
  "crm-sync": "RefreshCw",
  integrations: "Plug",
  "connector-marketplace": "ShoppingBag",
  "team-access": "UserPlus",
  billing: "CreditCard",
  settings: "Settings",
};

// Check if a module is available for a given plan tier
export function isModuleAvailable(plan: PlanTier | null, module: ModuleKey): boolean {
  if (!plan) return false;
  return PLAN_MODULES[plan]?.includes(module) ?? false;
}

// Plan tier hierarchy for "requiredPlan" gating
const PLAN_TIER_RANK: Record<PlanTier, number> = {
  micro: 0,
  pilot: 1,
  growth: 2,
  scale: 3,
};

export function canAccessPlan(userPlan: PlanTier | null, requiredPlan: PlanTier): boolean {
  if (!userPlan) return false;
  return (PLAN_TIER_RANK[userPlan] ?? 0) >= (PLAN_TIER_RANK[requiredPlan] ?? 0);
}
