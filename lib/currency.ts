// Multi-currency support for MRR tracking and plan pricing
// Detection priority: explicit param → Vercel geo header → Accept-Language → USD fallback
// Base currency: INR (all internal amounts stored in INR)

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "INR";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  rate: number; // 1 INR → this currency
  name: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", locale: "en-US", rate: 0.012, name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", rate: 0.011, name: "Euro" },
  GBP: { code: "GBP", symbol: "£", locale: "en-GB", rate: 0.0096, name: "British Pound" },
  CAD: { code: "CAD", symbol: "CA$", locale: "en-CA", rate: 0.017, name: "Canadian Dollar" },
  AUD: { code: "AUD", symbol: "A$", locale: "en-AU", rate: 0.018, name: "Australian Dollar" },
  INR: { code: "INR", symbol: "₹", locale: "en-IN", rate: 1, name: "Indian Rupee" },
};

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  US: "USD", CA: "CAD", GB: "GBP",
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR",
  FR: "EUR", DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR",
  LV: "EUR", LT: "EUR", LU: "EUR", MT: "EUR", NL: "EUR",
  PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR", HR: "EUR",
  AD: "EUR", MC: "EUR", SM: "EUR", VA: "EUR", AX: "EUR", ME: "EUR", XK: "EUR",
  AU: "AUD", NZ: "AUD",
  IN: "INR",
  CH: "EUR", NO: "EUR", SE: "EUR", DK: "EUR", PL: "EUR", CZ: "EUR", HU: "EUR", RO: "EUR", BG: "EUR",
  AE: "USD", SA: "USD", SG: "USD", HK: "USD", JP: "USD", KR: "USD", MX: "USD", BR: "USD",
};

export function getCurrencyFromCountry(country?: string | null): CurrencyCode {
  if (country && country in COUNTRY_TO_CURRENCY) return COUNTRY_TO_CURRENCY[country];
  return "USD";
}

export function detectCurrency(request?: Request): CurrencyCode {
  if (request) {
    const country = request.headers.get("x-vercel-ip-country");
    if (country) return getCurrencyFromCountry(country);
    const acceptLang = request.headers.get("accept-language") || "";
    const region = acceptLang.split(",")[0]?.split("-")[1]?.toUpperCase();
    if (region && region in COUNTRY_TO_CURRENCY) return COUNTRY_TO_CURRENCY[region];
  }
  return "USD";
}

export function convertINR(amountINR: number, to: CurrencyCode): number {
  const rate = CURRENCIES[to]?.rate ?? 0.012;
  return Math.round(amountINR * rate);
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const config = CURRENCIES[currency];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatINR(amount: number): string {
  return formatCurrency(amount, "INR");
}

export const ALL_CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "CAD", "AUD", "INR"];
