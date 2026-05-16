export type OnboardingStep = "welcome" | "icp" | "apikey" | "plan";

export const ONBOARDING_STEPS: { key: OnboardingStep; label: string; num: number }[] = [
  { key: "welcome", label: "Welcome", num: 1 },
  { key: "icp", label: "ICP Setup", num: 2 },
  { key: "apikey", label: "API Keys", num: 3 },
  { key: "plan", label: "Plan & Pay", num: 4 },
];

export const INDUSTRY_OPTIONS = [
  "SaaS & Technology", "Financial Services", "Healthcare", "E-Commerce & Retail",
  "Manufacturing", "Real Estate", "Marketing & Advertising", "Consulting",
  "Education", "Legal Services", "Construction", "Logistics & Supply Chain",
];

export const COMPANY_SIZE_OPTIONS = [
  "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+",
];

export const SENIORITY_OPTIONS = [
  "C-Suite (CEO, CTO, CFO)", "VP / Director", "Head of Department",
  "Senior Manager", "Manager", "Founder / Co-Founder",
];

export const COUNTRY_OPTIONS = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "India", "Singapore", "Netherlands", "UAE", "Brazil",
];

export interface IcpPreferences {
  industries: string[];
  companySizes: string[];
  seniority: string[];
  countries: string[];
}
