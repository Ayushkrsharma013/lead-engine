import Link from "next/link";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Privacy Policy — Prospecting OS",
  description: "How we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--ink)", fontFamily: "'Geist', sans-serif" }}>
      {/* Top nav */}
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
        {/* Draft banner */}
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
          Privacy Policy
        </h1>
        <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 24 }}>
          This Privacy Policy describes how Flow-Forges ("we", "us", "our") collects, uses, and protects information you provide when using Prospecting OS. By using the service you agree to the practices described below.
        </p>

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>1. Data we collect</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            We collect the following categories of data when you sign up for, configure, or use the service:
          </p>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}>Account information — your name, email address, company name, and password (hashed).</li>
            <li style={{ marginBottom: 6 }}>ICP preferences — target industries, regions, company sizes, seniorities, and other filter configurations you supply.</li>
            <li style={{ marginBottom: 6 }}>Lead data — names, work emails, LinkedIn URLs, company information, and enrichment fields produced by your active pipelines. This data belongs to you; we process it on your behalf.</li>
            <li style={{ marginBottom: 6 }}>Usage data — pages viewed, actions taken, API calls made, error logs, and timestamps, used to operate and improve the service.</li>
            <li style={{ marginBottom: 6 }}>Billing metadata — payment reference numbers, plan tier, and activation timestamps. We do not store full card or bank account numbers; payment processing is handled by external gateways (Easebuzz / XflowPay).</li>
          </ul>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>2. How we store data</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            All data is stored in Supabase Postgres on managed infrastructure with row-level security (RLS) enforced at the database layer. Data is encrypted at rest and in transit (TLS 1.2+). Backups are retained for 30 days. We do not sell, rent, or share your data with third parties for marketing purposes.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>3. How we process data</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            To deliver the service we share necessary data with the following sub-processors:
          </p>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Supabase</strong> — primary database and authentication.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Anthropic (Claude API)</strong> — message generation, ICP scoring, icebreaker drafting. Lead and prompt data is sent to Anthropic for inference; Anthropic does not train on our API traffic.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Apify</strong> — lead discovery and enrichment via the actors we operate on your behalf.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Resend</strong> — transactional and outreach email delivery.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Vercel</strong> — application hosting and edge runtime.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Easebuzz / XflowPay</strong> — payment processing.</li>
          </ul>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>4. Data retention</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Account and lead data is retained for the duration of your active subscription plus 90 days after cancellation, after which it is permanently deleted unless you have requested earlier deletion or longer retention is required by law. Logs and aggregated analytics may be retained for up to 12 months in a non-identifiable form for service improvement.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>5. Your rights</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            Depending on where you live, you have the following rights with respect to your personal data:
          </p>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}>Right of access — receive a copy of the personal data we hold about you.</li>
            <li style={{ marginBottom: 6 }}>Right of rectification — correct inaccurate personal data.</li>
            <li style={{ marginBottom: 6 }}>Right of deletion — request that we erase your personal data.</li>
            <li style={{ marginBottom: 6 }}>Right of portability — receive your data in a structured, machine-readable format.</li>
            <li style={{ marginBottom: 6 }}>Right to object — object to processing for direct marketing or based on legitimate interests.</li>
            <li style={{ marginBottom: 6 }}>Right to withdraw consent — at any time, where processing is based on consent.</li>
          </ul>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 12 }}>
            To exercise any of these rights, email <a href="mailto:privacy@flow-forges.com" style={{ color: "var(--accent)" }}>privacy@flow-forges.com</a>. We respond within 30 days.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>6. GDPR (European users)</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            For users in the European Economic Area, United Kingdom, and Switzerland, we act as a data processor for the lead data your pipelines produce and as a data controller for your account information. Our legal bases for processing are contract performance and legitimate interests in operating and improving the service. EU/UK users have the right to lodge a complaint with their local supervisory authority.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>7. CCPA (California users)</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            California residents have the right to know what personal information is collected, to request deletion, and to opt out of sale of personal information. We do not sell personal information. To exercise these rights email <a href="mailto:privacy@flow-forges.com" style={{ color: "var(--accent)" }}>privacy@flow-forges.com</a>.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>8. Security</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            We follow industry-standard practices including TLS encryption, hashed passwords (bcrypt), service-role isolation for privileged operations, row-level security in the database, and least-privilege access for all team members. No system is perfectly secure; if you believe your account has been compromised email <a href="mailto:privacy@flow-forges.com" style={{ color: "var(--accent)" }}>privacy@flow-forges.com</a> immediately.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>9. Changes to this policy</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            We may update this Privacy Policy from time to time. Material changes will be notified via email to the address on file at least 14 days before they take effect. The "Last updated" date at the top of this page reflects the most recent revision.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>10. Contact for data requests</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            For privacy questions or data subject requests:
            <br />
            <a href="mailto:privacy@flow-forges.com" style={{ color: "var(--accent)" }}>privacy@flow-forges.com</a>
          </p>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
