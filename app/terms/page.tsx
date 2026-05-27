import Link from "next/link";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Terms of Service — Prospecting OS",
  description: "The terms governing your use of Prospecting OS.",
};

export default function TermsPage() {
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
        <div
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 32,
            fontSize: 13,
            color: "var(--accent)",
            fontWeight: 500,
          }}
        >
          Last updated: 2026-05-27 — DRAFT FOR LEGAL REVIEW
        </div>

        <h1 className="font-bold tracking-tight" style={{ fontSize: 32, lineHeight: 1.15, marginBottom: 12, color: "var(--ink)" }}>
          Terms of Service
        </h1>
        <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 24 }}>
          These Terms of Service ("Terms") govern your access to and use of Prospecting OS ("Service"), operated by Flow-Forges ("we", "us"). By creating an account, completing payment, or otherwise using the Service, you agree to be bound by these Terms.
        </p>

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>1. Service description</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Prospecting OS is a B2B lead-generation platform that scrapes, enriches, scores, and delivers business leads matching the Ideal Customer Profile (ICP) you configure. The Service uses third-party data providers (Apify), AI models (Anthropic Claude), email infrastructure (Resend), and database hosting (Supabase). Specific capabilities depend on your plan.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>2. Account requirements</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            To use the Service you must:
          </p>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}>Be at least 18 years old and legally capable of entering into a contract.</li>
            <li style={{ marginBottom: 6 }}>Provide accurate, complete account information and keep it current.</li>
            <li style={{ marginBottom: 6 }}>Be using the Service for legitimate B2B sales or marketing purposes.</li>
            <li style={{ marginBottom: 6 }}>Keep your login credentials confidential — you are responsible for all activity under your account.</li>
            <li style={{ marginBottom: 6 }}>Notify us immediately of any unauthorized use.</li>
          </ul>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>3. Payment terms</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            Plans and pricing:
          </p>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Micro-Offer</strong> — $997 USD one-time payment for a single delivery batch.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Founder&apos;s Pilot</strong> — monthly subscription, billed in advance.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Growth</strong> — monthly subscription, billed in advance.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Scale</strong> — monthly subscription, billed in advance, with custom contract terms available.</li>
          </ul>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 12 }}>
            All prices are exclusive of applicable taxes. Subscriptions renew automatically each billing cycle until cancelled. You may cancel any time from your billing page; cancellation takes effect at the end of the current paid period. Late or failed payments may result in suspension of the Service after 5 business days&apos; notice.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>4. Refund policy</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Refunds are governed by our <Link href="/refund-policy" style={{ color: "var(--accent)" }}>Refund Policy</Link>, which is incorporated into these Terms by reference.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>5. Acceptable use</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            You agree not to use the Service to:
          </p>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}>Send spam, unsolicited bulk email, or messages that violate the CAN-SPAM Act, GDPR, or any other applicable communications law.</li>
            <li style={{ marginBottom: 6 }}>Scrape, target, or contact individuals in jurisdictions where doing so is unlawful.</li>
            <li style={{ marginBottom: 6 }}>Resell, sublicense, or republish lead data as a public dataset or commercial product.</li>
            <li style={{ marginBottom: 6 }}>Reverse-engineer, decompile, or attempt to extract source code from the Service.</li>
            <li style={{ marginBottom: 6 }}>Probe, scan, or test the vulnerability of the Service or breach security/authentication measures.</li>
            <li style={{ marginBottom: 6 }}>Use the Service for any unlawful, fraudulent, harassing, or harmful purpose.</li>
          </ul>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 12 }}>
            We reserve the right to suspend or terminate accounts that violate these rules, with or without notice.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>6. Intellectual property</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Flow-Forges retains all rights, title, and interest in the Service, including the source code, AI prompt templates, scoring algorithms, UI designs, and brand assets. You receive a non-exclusive, non-transferable license to use the Service for the duration of your subscription. You retain all rights, title, and interest in the lead data your pipelines produce — that data is yours; we process it on your behalf.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>7. Termination</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            You may terminate your account at any time by cancelling from your billing page or emailing <a href="mailto:billing@flow-forges.com" style={{ color: "var(--accent)" }}>billing@flow-forges.com</a>. We may terminate or suspend your account immediately, without notice, for material breach of these Terms, non-payment, or activity that exposes us or other users to legal or security risk. Upon termination your access ends; your data retention is governed by our Privacy Policy.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>8. Disclaimer of warranties</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            The Service is provided "as is" and "as available". We do not warrant that the Service will be uninterrupted, error-free, or that lead data will be 100% accurate, deliverable, or convertible. All warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement, are disclaimed to the fullest extent permitted by law.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>9. Limitation of liability</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            To the maximum extent permitted by law, our total liability for any claim arising out of or relating to the Service is limited to the total amount you have paid to us in the 12 months preceding the event giving rise to the claim. We are not liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost revenue, lost data, or business interruption, even if advised of the possibility.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>10. Governing law and jurisdiction</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            These Terms are governed by the laws of India, without regard to conflict-of-laws principles. The courts of New Delhi, India have exclusive jurisdiction over any dispute, except that for international users we may, at our discretion, agree to arbitration in a neutral venue. Nothing in this clause limits any non-waivable consumer rights you may have under your local jurisdiction.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>11. Dispute resolution</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Before initiating formal proceedings, both parties agree to attempt good-faith resolution by emailing <a href="mailto:hello@flow-forges.com" style={{ color: "var(--accent)" }}>hello@flow-forges.com</a> with a clear description of the dispute. If unresolved within 30 days, either party may proceed under the governing law clause above.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>12. Changes to these Terms</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            We may revise these Terms from time to time. Material changes will be notified by email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>13. Contact</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Questions about these Terms? Email <a href="mailto:hello@flow-forges.com" style={{ color: "var(--accent)" }}>hello@flow-forges.com</a>.
          </p>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
