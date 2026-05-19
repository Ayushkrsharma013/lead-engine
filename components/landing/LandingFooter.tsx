import Link from "next/link";

export function LandingFooter() {
  return (
    <footer
      className="footer"
      role="contentinfo"
      aria-label="Prospecting OS footer"
    >
      <div className="container">
        <p>
          (c) 2026{" "}
          <a
            href="https://flow-forges.com"
            aria-label="Flow-Forges AI automation agency"
            style={{ color: "var(--accent)" }}
          >
            Flow-Forges
          </a>
          . Prospecting OS — AI-Powered B2B Lead Generation System
        </p>
        <nav
          aria-label="Footer navigation"
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            justifyContent: "center",
            margin: "12px 0",
            fontSize: "0.85rem",
          }}
        >
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/book" aria-label="Book a free B2B prospecting strategy call">
            Book a Call
          </Link>
          <Link href="/tools/free-audit">Free Pipeline Audit</Link>
          <Link href="/tools/icebreaker-generator">AI Icebreaker</Link>
          <a
            href="https://flow-forges.com"
            aria-label="Flow-Forges — AI automation agency for B2B businesses"
          >
            Flow-Forges.com
          </a>
        </nav>
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--text-tertiary)",
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          Prospecting OS is a productized AI system built on Apify, Gemini AI,
          and LinkedIn Sales Navigator. Results vary based on ICP configuration
          and industry. Pro plan includes a 50-lead/month performance guarantee.
        </p>
      </div>
    </footer>
  );
}
