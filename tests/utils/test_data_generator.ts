/**
 * Test Data Generator
 *
 * Creates random but realistic test data for E2E and security tests.
 * All data is ephemeral — intended for test scenarios only.
 */

import crypto from "node:crypto";

const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery",
  "Blake", "Cameron", "Dakota", "Emerson", "Finley", "Harper", "Jesse",
];

const LAST_NAMES = [
  "Anderson", "Bennett", "Chen", "Davis", "Edwards", "Foster", "Garcia",
  "Hughes", "Ibrahim", "Jackson", "Kim", "Liu", "Martinez", "Nguyen",
];

const COMPANIES = [
  "TechFlow Solutions", "PeakDigital Media", "GreenPath Analytics",
  "CloudBase Systems", "NovaStack Inc", "BrightBridge Consulting",
  "QuantumLeap Ventures", "Streamline Operations", "CoreVault Security",
  "ElevateCX Platform",
];

const INDUSTRIES = [
  "SaaS", "FinTech", "Healthcare", "E-Commerce", "Logistics",
  "Real Estate", "Marketing & Advertising", "Education Technology",
  "Cybersecurity", "Renewable Energy",
];

const SENIORITY_LEVELS = [
  "C-Suite (CEO, CTO, CFO)",
  "VP / Director",
  "Head of Department",
  "Senior Manager",
  "Manager",
  "Founder / Co-Founder",
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia",
  "Germany", "Singapore", "India", "Netherlands",
];

/**
 * Generate a unique test ID (12-char alphanumeric).
 */
function uid(): string {
  return crypto.randomBytes(6).toString("hex");
}

/**
 * Pick a random element from an array.
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Public generators ────────────────────────────────────────────────────────

export interface Prospect {
  email: string;
  name: string;
}

/**
 * Generate a random prospect with a unique test email.
 */
export function generateProspect(): Prospect {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const id = uid();
  return {
    email: `test-${id}@flow-forges-test.com`,
    name: `${first} ${last}`,
  };
}

export interface ICPConfig {
  industries: string[];
  companySizes: string[];
  seniority: string[];
  countries: string[];
}

/**
 * Generate a realistic ICP config.
 */
export function generateICP(): ICPConfig {
  // Pick 2-3 random values per category
  const pickN = <T>(arr: T[], n: number): T[] => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };

  return {
    industries: pickN(INDUSTRIES, 3),
    companySizes: pickN(COMPANY_SIZES, 2),
    seniority: pickN(SENIORITY_LEVELS, 2),
    countries: pickN(COUNTRIES, 2),
  };
}

export interface AppointmentData {
  prospect: Prospect;
  date: string;
  time: string;
  meetingLink: string;
  plan?: string;
}

/**
 * Generate a test appointment (future date, business hours).
 */
export function generateAppointment(plan: string = "micro"): AppointmentData {
  const prospect = generateProspect();

  // Find next business day
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Skip weekends
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }

  const dateStr = tomorrow.toISOString().slice(0, 10);
  const hour = 9 + Math.floor(Math.random() * 7); // 9am-4pm

  return {
    prospect,
    date: dateStr,
    time: `${String(hour).padStart(2, "0")}:00`,
    meetingLink: `https://meet.google.com/test-${uid()}`,
    plan,
  };
}

/**
 * Generate a unique test workspace ID (UUID format).
 */
export function generateWorkspaceId(): string {
  return crypto.randomUUID();
}

/**
 * Generate test payment data matching Dodo webhook format.
 */
export function generateDodoPayment(overrides: {
  email?: string;
  amount?: number;
  productId?: string;
  paymentId?: string;
} = {}) {
  const id = uid();
  return {
    event: "payment.succeeded",
    data: {
      payment: {
        id: overrides.paymentId || `pay_test_${id}`,
        email: overrides.email || `test-client-${id}@flow-forges-test.com`,
        amount: overrides.amount ?? 9700, // $97.00 micro plan default
        product_id: overrides.productId || "prod_micro",
        status: "succeeded",
        currency: "USD",
        created_at: new Date().toISOString(),
      },
    },
  };
}
