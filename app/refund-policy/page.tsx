import Link from "next/link";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata = {
  title: "Refund Policy — Prospecting OS",
  description: "When refunds are available and how to request one.",
};

export default function RefundPolicyPage() {
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
          Refund Policy
        </h1>
        <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 24 }}>
          We want every customer to feel confident buying from Prospecting OS. This policy explains when refunds are available, how they work, and how to request one. By purchasing the Service you agree to the terms below.
        </p>

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>1. Monthly subscription plans (Pilot, Growth, Scale)</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            All monthly subscriptions come with a <strong style={{ color: "var(--ink)" }}>7-day refund window</strong> from the date of first payment. If you are not satisfied within the first 7 calendar days of activation, email <a href="mailto:billing@flow-forges.com" style={{ color: "var(--accent)" }}>billing@flow-forges.com</a> to request a full refund. We process approved refunds within 7 business days back to the original payment method.
          </p>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            After the 7-day window, monthly subscriptions are non-refundable for the current billing cycle. You may still cancel at any time to prevent the next renewal — cancellation takes effect at the end of the current paid period and you keep access until then.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>2. Micro-Offer ($997 one-time)</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 12 }}>
            The $997 Micro-Offer is a single-batch lead delivery and is treated as a deliverable, not a recurring subscription. The refund rule is:
          </p>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Refundable</strong> only if leads are not delivered within 5 business days of payment confirmation.</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: "var(--ink)" }}>Non-refundable</strong> once the lead batch has been delivered to your dashboard, regardless of conversion outcome.</li>
          </ul>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 12 }}>
            Because lead data is irrevocable once delivered, we cannot refund after delivery. We strongly recommend booking a free strategy call before purchasing the Micro-Offer if you are unsure your ICP is a fit.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>3. Growth plan performance guarantee</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            The Growth plan includes a written performance guarantee: if you do not receive at least 50 qualified, AI-scored leads in your first calendar month, your second month is provided <strong style={{ color: "var(--ink)" }}>free of charge</strong> and the team performs a complete ICP refinement session at no additional cost. This is offered in lieu of a cash refund. To invoke the guarantee email <a href="mailto:billing@flow-forges.com" style={{ color: "var(--accent)" }}>billing@flow-forges.com</a> within 7 days of the end of your first billing cycle.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>4. What is not refundable</h2>
          <ul className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "disc" }}>
            <li style={{ marginBottom: 6 }}>Subscription periods after the 7-day window has passed.</li>
            <li style={{ marginBottom: 6 }}>Lead batches that have already been delivered.</li>
            <li style={{ marginBottom: 6 }}>Third-party costs you incurred separately (Apify subscription fees, domain purchases, email infrastructure providers).</li>
            <li style={{ marginBottom: 6 }}>Setup or onboarding fees once setup work has begun.</li>
            <li style={{ marginBottom: 6 }}>Accounts terminated for breach of the <Link href="/terms" style={{ color: "var(--accent)" }}>Terms of Service</Link> (spam, abuse, fraud, illegal use).</li>
          </ul>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>5. How to request a refund</h2>
          <ol className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)", paddingLeft: 22, listStyle: "decimal" }}>
            <li style={{ marginBottom: 6 }}>Email <a href="mailto:billing@flow-forges.com" style={{ color: "var(--accent)" }}>billing@flow-forges.com</a> from the address on your account.</li>
            <li style={{ marginBottom: 6 }}>Include your account email, payment reference number, plan, and the reason for the request.</li>
            <li style={{ marginBottom: 6 }}>We acknowledge within 1 business day and respond with a decision within 5 business days.</li>
            <li style={{ marginBottom: 6 }}>Approved refunds are returned to the original payment method within 7 business days. Bank reversal time varies — most see funds in 3 to 10 business days.</li>
          </ol>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>6. Chargebacks</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Please contact us before filing a chargeback. We respond to all good-faith refund requests quickly and fairly. Chargebacks filed without first contacting us may result in immediate account termination and forfeiture of any pending lead deliveries.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--line)", margin: "32px 0" }} />

        <section>
          <h2 className="font-semibold" style={{ fontSize: 20, marginTop: 40, marginBottom: 12, color: "var(--ink)" }}>7. Contact</h2>
          <p className="leading-relaxed" style={{ fontSize: 15, color: "var(--ink-2)" }}>
            Refund and billing questions: <a href="mailto:billing@flow-forges.com" style={{ color: "var(--accent)" }}>billing@flow-forges.com</a>
          </p>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
