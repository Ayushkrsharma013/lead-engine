/* ═══════════════════════════════════════════════════════════════════════════
   lib/analytics.ts — Cross-platform tracking helpers
   ───────────────────────────────────────────────────────────────────────────
   Fires events to all configured platforms (GA4, Meta Pixel, LinkedIn, PostHog,
   Clarity). Each platform is checked at call-time via window globals so missing
   tags silently no-op.

   PII rule: NEVER pass raw email/name into tracking events. Always hash via
   SHA-256 with Web Crypto first. Tracking calls are fire-and-forget.
   ═══════════════════════════════════════════════════════════════════════════ */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
    lintrk?: (action: string, payload?: Record<string, unknown>) => void;
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify: (id: string, properties?: Record<string, unknown>) => void;
      reset?: () => void;
    };
    clarity?: (action: string, ...args: unknown[]) => void;
  }
}

/* ─── Environment check ───────────────────────────────────────────────────── */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/* ─── SHA-256 email hashing (Web Crypto, browser-only) ────────────────────── */

export async function hashEmail(email: string): Promise<string> {
  if (!isBrowser() || !window.crypto?.subtle) return "";
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "";
  try {
    const buf = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

/* ─── Page view ───────────────────────────────────────────────────────────── */

export function trackPageView(path: string): void {
  if (!isBrowser()) return;

  // GA4
  if (window.gtag) {
    window.gtag("event", "page_view", { page_path: path });
  }

  // Meta Pixel — PageView is auto-tracked but firing again is safe on SPA nav
  if (window.fbq) {
    window.fbq("track", "PageView");
  }

  // LinkedIn — auto-tracks but trigger on route change
  if (window.lintrk) {
    window.lintrk("track");
  }

  // PostHog — captures $pageview automatically; capture explicit event for SPA
  if (window.posthog) {
    window.posthog.capture("$pageview", { path });
  }
}

/* ─── Generic event ───────────────────────────────────────────────────────── */

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!isBrowser()) return;
  const safeParams = params || {};

  if (window.gtag) {
    window.gtag("event", name, safeParams);
  }
  if (window.fbq) {
    window.fbq("trackCustom", name, safeParams);
  }
  if (window.posthog) {
    window.posthog.capture(name, safeParams);
  }
  if (window.clarity) {
    window.clarity("event", name);
  }
}

/* ─── Booking conversion (calendar booked) ────────────────────────────────── */

export async function trackBooking(data: {
  plan?: string;
  type: string;
  email: string;
}): Promise<void> {
  if (!isBrowser()) return;

  const emailHash = await hashEmail(data.email);
  const props: Record<string, unknown> = {
    meeting_type: data.type,
    plan: data.plan || "unknown",
  };
  if (emailHash) props.user_id = emailHash;

  if (window.gtag) {
    window.gtag("event", "booking_completed", props);
  }
  if (window.fbq) {
    // Meta standard event for scheduled appointments
    window.fbq("track", "Schedule", {
      content_name: data.type,
      content_category: data.plan || "demo",
      ...(emailHash ? { eventID: emailHash.slice(0, 16) } : {}),
    });
    // Lead is a stronger signal — fire both
    window.fbq("track", "Lead", { content_name: data.type });
  }
  if (window.lintrk) {
    window.lintrk("track");
  }
  if (window.posthog) {
    if (emailHash) window.posthog.identify(emailHash, { plan: data.plan });
    window.posthog.capture("booking_completed", props);
  }
  if (window.clarity) {
    window.clarity("event", "booking_completed");
    if (emailHash) window.clarity("identify", emailHash);
  }
}

/* ─── Payment conversion (revenue!) ───────────────────────────────────────── */

export function trackPayment(data: {
  plan: string;
  amount: number;
  txnid: string;
}): void {
  if (!isBrowser()) return;

  const props = {
    plan: data.plan,
    value: data.amount,
    currency: "USD",
    transaction_id: data.txnid,
  };

  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: data.txnid,
      value: data.amount,
      currency: "USD",
      items: [{ item_id: data.plan, item_name: data.plan, price: data.amount, quantity: 1 }],
    });
  }
  if (window.fbq) {
    window.fbq("track", "Purchase", {
      value: data.amount,
      currency: "USD",
      content_name: data.plan,
      content_ids: [data.plan],
    });
  }
  if (window.lintrk) {
    window.lintrk("track");
  }
  if (window.posthog) {
    window.posthog.capture("purchase_completed", props);
  }
  if (window.clarity) {
    window.clarity("event", "purchase_completed");
    window.clarity("set", "plan", data.plan);
  }
}

/* ─── Signup conversion ───────────────────────────────────────────────────── */

export async function trackSignup(data: {
  email: string;
  plan?: string;
}): Promise<void> {
  if (!isBrowser()) return;

  const emailHash = await hashEmail(data.email);
  const props: Record<string, unknown> = { plan: data.plan || "free" };
  if (emailHash) props.user_id = emailHash;

  if (window.gtag) {
    window.gtag("event", "sign_up", { method: "email", ...props });
  }
  if (window.fbq) {
    window.fbq("track", "CompleteRegistration", {
      content_name: data.plan || "free",
      ...(emailHash ? { eventID: emailHash.slice(0, 16) } : {}),
    });
  }
  if (window.lintrk) {
    window.lintrk("track");
  }
  if (window.posthog) {
    if (emailHash) window.posthog.identify(emailHash, { plan: data.plan });
    window.posthog.capture("signup_completed", props);
  }
  if (window.clarity) {
    window.clarity("event", "signup_completed");
    if (emailHash) window.clarity("identify", emailHash);
  }
}
