"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function BlogNavbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("prospectingos-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("prospectingos-theme", next);
  }, [theme]);

  return (
    <div className="landing-page">
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, padding: "0 8px" }}>
        <div
          style={{
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 32,
            transition: "all 500ms ease-out",
            position: "relative",
            ...(scrolled
              ? {
                  marginTop: 8,
                  maxWidth: 1100,
                  height: 56,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(14,13,10,0.85)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 1px 40px rgba(0,0,0,0.4)",
                  padding: "0 24px",
                }
              : {
                  marginTop: 0,
                  maxWidth: "100%",
                  height: 72,
                  borderRadius: 0,
                  borderColor: "transparent",
                  background: "transparent",
                  backdropFilter: "none",
                  WebkitBackdropFilter: "none",
                  padding: "0 24px",
                }),
          }}
        >
          {/* Top glow line — visible only when scrolled */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: "linear-gradient(to right, transparent, rgba(232,66,10,0.15), transparent)",
              opacity: scrolled ? 1 : 0,
              transition: "opacity 500ms ease-out",
            }}
          />

          {/* Logo */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
              textDecoration: "none",
            }}
          >
            <img
              src="/prospecting-os/assets/Logo_Icon.png"
              alt="Prospecting OS"
              width={28}
              height={28}
              style={{ borderRadius: 8 }}
            />
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 900,
                fontSize: "1.25rem",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
              }}
            >
              Prospecting <span style={{ color: "var(--accent)" }}>OS</span>
            </span>
          </Link>

          {/* Desktop nav links — centered */}
          <nav
            className="desktop-only"
            style={{
              display: "flex",
              gap: 28,
              alignItems: "center",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <Link href="/#how-it-works" className="nav-link-item">How It Works</Link>
            <Link href="/#pricing" className="nav-link-item">Pricing</Link>
            <Link href="/#roi" className="nav-link-item">ROI Calculator</Link>
            <Link href="/#faq" className="nav-link-item">FAQ</Link>
            <Link
              href="/blog"
              style={{
                fontWeight: 600,
                fontSize: "0.9rem",
                color: "var(--accent)",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              Blog
            </Link>
          </nav>

          {/* Right side: theme toggle + CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", flexShrink: 0 }}>
            {/* Theme toggle — hides on scroll */}
            <div
              className="theme-toggle-wrapper"
              style={{
                opacity: scrolled ? 0 : 1,
                transform: scrolled ? "scale(0.8)" : "scale(1)",
                pointerEvents: scrolled ? "none" : "auto",
                transition: "all 400ms ease-out",
              }}
            >
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle light/dark theme">
                <span className="toggle-icon moon">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                </span>
                <span className="toggle-icon sun">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </span>
                <span className="toggle-thumb" />
              </button>
            </div>

            {/* Book CTA */}
            <Link
              href="/book"
              className="desktop-only"
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                padding: "9px 18px",
                background: "var(--accent)",
                color: "#fff",
                borderRadius: "var(--radius-full)",
                textDecoration: "none",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all var(--transition-fast)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Book a Free Strategy Call
            </Link>

            {/* Hamburger */}
            <button
              className="nav-hamburger"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation"
              style={{ display: "none" }}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
        <Link href="/#how-it-works" onClick={() => setMobileOpen(false)}>
          How It Works
        </Link>
        <Link href="/#pricing" onClick={() => setMobileOpen(false)}>
          Pricing
        </Link>
        <Link href="/#roi" onClick={() => setMobileOpen(false)}>
          ROI Calculator
        </Link>
        <Link href="/#faq" onClick={() => setMobileOpen(false)}>
          FAQ
        </Link>
        <Link href="/blog" onClick={() => setMobileOpen(false)} style={{ color: "var(--accent)", fontWeight: 600 }}>
          Blog
        </Link>
        <Link
          href="/book"
          className="nav-cta"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onClick={() => setMobileOpen(false)}
        >
          Book a Free Strategy Call
        </Link>
      </div>
    </div>
  );
}
