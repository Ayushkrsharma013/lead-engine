import Link from "next/link";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Mail, Calendar, Clock, MapPin } from "lucide-react";

export const metadata = {
  title: "Contact — Prospecting OS",
  description: "Get in touch with the Prospecting OS team.",
};

export default function ContactPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--ink)", fontFamily: "'Geist', sans-serif" }}>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--ink)" }}>
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" width={26} height={26} style={{ borderRadius: 6 }} />
            <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>Prospecting OS</span>
          </Link>
          <Link href="/" style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "none" }}>
            Back to home
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: 32, lineHeight: 1.15, marginBottom: 12, color: "var(--ink)" }}>
          Contact
        </h1>
        <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 32 }}>
          Whether you have a question about plans, want to talk through your ICP before buying, or need support with a live pipeline, we&apos;re here. Use the channel below that fits your need.
        </p>

        {/* Contact options grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {/* General */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Mail size={16} style={{ color: "var(--accent)" }} />
              <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--ink)", margin: 0 }}>General questions</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 8 }}>Sales, partnerships, press, anything else.</p>
            <a href="mailto:hello@flow-forges.com" style={{ fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>
              hello@flow-forges.com
            </a>
          </div>

          {/* Billing */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Mail size={16} style={{ color: "var(--accent)" }} />
              <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--ink)", margin: 0 }}>Billing & refunds</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 8 }}>Plan changes, invoices, refund requests.</p>
            <a href="mailto:billing@flow-forges.com" style={{ fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>
              billing@flow-forges.com
            </a>
          </div>

          {/* Privacy */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Mail size={16} style={{ color: "var(--accent)" }} />
              <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--ink)", margin: 0 }}>Privacy & data requests</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 8 }}>Access, deletion, GDPR, CCPA inquiries.</p>
            <a href="mailto:privacy@flow-forges.com" style={{ fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>
              privacy@flow-forges.com
            </a>
          </div>

          {/* Booking */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Calendar size={16} style={{ color: "var(--accent)" }} />
              <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--ink)", margin: 0 }}>Strategy call</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 8 }}>Free 30-minute call to scope your ICP fit.</p>
            <Link href="/book" style={{ fontSize: 14, color: "var(--accent)", fontWeight: 500 }}>
              Book a call
            </Link>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>Response time</h2>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Clock size={16} style={{ color: "var(--accent)", marginTop: 3, flexShrink: 0 }} />
            <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", margin: 0 }}>
              We respond to all email within <strong style={{ color: "var(--ink)" }}>24 hours on business days</strong> (Mon–Fri). Real-time support is available via Telegram for active customers during support hours: <strong style={{ color: "var(--ink)" }}>Monday to Friday, 9 AM – 6 PM IST</strong>. Outside those hours we still monitor for urgent issues but reply on the next business day.
            </p>
          </div>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>Imprint / business information</h2>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <MapPin size={16} style={{ color: "var(--accent)", marginTop: 3, flexShrink: 0 }} />
            <div className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
              <p style={{ margin: 0, marginBottom: 8 }}>
                <strong style={{ color: "var(--ink)" }}>Founder:</strong> Ayush Kumar Sharma
              </p>
              <p style={{ margin: 0, marginBottom: 8 }}>
                <strong style={{ color: "var(--ink)" }}>Business:</strong> Flow-Forges (sole proprietorship — India)
              </p>
              <p style={{ margin: 0, marginBottom: 8 }}>
                <strong style={{ color: "var(--ink)" }}>Registered in:</strong> India
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>
                Formal entity registration is in progress. Updated business name, registration number, and registered address will be published here once finalized.
              </p>
            </div>
          </div>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>Legal documents</h2>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}>
              <Link href="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</Link>
            </li>
            <li style={{ marginBottom: 6 }}>
              <Link href="/terms" style={{ color: "var(--accent)" }}>Terms of Service</Link>
            </li>
            <li style={{ marginBottom: 6 }}>
              <Link href="/refund-policy" style={{ color: "var(--accent)" }}>Refund Policy</Link>
            </li>
          </ul>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
