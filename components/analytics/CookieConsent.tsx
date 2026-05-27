"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   CookieConsent — GDPR-aware bottom-of-screen banner
   ───────────────────────────────────────────────────────────────────────────
   - Detects EU/UK via Intl timezone (Europe/* prefix)
   - Non-EU users → silently set ff_consent="accepted" (no banner)
   - EU users → show slim bar; pixels gated on ff_consent === "accepted"
   - Stores in localStorage; emits "ff-consent-change" CustomEvent on change
   - SSR-safe: all window/localStorage/Intl access guarded inside useEffect
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "ff_consent";

export type ConsentValue = "accepted" | "declined";

function isEUTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    // Covers EU member states + UK + EEA. Atlantic/* (Iceland, Faroe) and
    // Africa/Ceuta are explicitly EEA-adjacent — keep narrow to Europe/* per spec.
    return tz.startsWith("Europe/");
  } catch {
    return false;
  }
}

export function getStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

function setStoredConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("ff-consent-change", { detail: value }));
  } catch {
    /* ignore */
  }
}

export default function CookieConsent() {
  // Always start hidden on SSR + first client render — prevents hydration mismatch.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredConsent();
    if (existing) {
      // Already decided — stay hidden, broadcast value so analytics can read it.
      window.dispatchEvent(new CustomEvent("ff-consent-change", { detail: existing }));
      return;
    }

    if (!isEUTimezone()) {
      // Outside EU/UK — silently accept (already industry standard for US/APAC)
      setStoredConsent("accepted");
      return;
    }

    // EU user, no decision yet → show banner
    setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    setStoredConsent("accepted");
    setVisible(false);
  };
  const decline = () => {
    setStoredConsent("declined");
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9000,
        background: "var(--surface-2, #0E0E0E)",
        borderTop: "1px solid rgba(232, 66, 10, 0.25)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.45)",
        color: "#f5f4f1",
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "12px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 14,
        }}
      >
        <p style={{ flex: "1 1 320px", margin: 0, fontSize: 13, lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600 }}>We use cookies</span>
          <span style={{ opacity: 0.78 }}>
            {" "}for analytics and to improve your experience. You can decline non-essential cookies.
          </span>
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={decline}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 999,
              background: "transparent",
              color: "rgba(245,244,241,0.85)",
              border: "1px solid rgba(255,255,255,0.14)",
              cursor: "pointer",
            }}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 16px",
              borderRadius: 999,
              background: "#e8420a",
              color: "#fff",
              border: "1px solid #e8420a",
              cursor: "pointer",
            }}
          >
            Accept
          </button>
          <Link
            href="/legal/privacy"
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(245,244,241,0.65)",
              textDecoration: "none",
              padding: "8px 6px",
            }}
          >
            Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
