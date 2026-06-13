import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { personSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "About | Prospecting OS — Built by operators, for operators",
  description:
    "Prospecting OS is built by Ayush Kumar Sharma at Flow-Forges. Learn the story behind the AI lead generation system, why it exists, and how to get in touch.",
  alternates: { canonical: "https://app.flow-forges.com/prospecting-os/about" },
  openGraph: {
    title: "About Prospecting OS — Built by operators, for operators",
    description:
      "The story behind Prospecting OS — an AI lead generation system built to replace manual prospecting with a 5-step pipeline that delivers scored, enriched leads every morning.",
    url: "https://app.flow-forges.com/prospecting-os/about",
    type: "profile",
  },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <div className="landing-page" role="main" aria-label="About Prospecting OS and the founder">
      <JsonLd id="schema-about-person" data={personSchema()} />
      <JsonLd
        id="schema-about-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: "https://app.flow-forges.com/prospecting-os" },
          { name: "About", url: "https://app.flow-forges.com/prospecting-os/about" },
        ])}
      />

      <section
        style={{
          padding: "120px 24px 60px",
          textAlign: "center",
          position: "relative",
          background:
            "radial-gradient(ellipse 800px 400px at 50% 0%, rgba(232,66,10,0.08) 0%, transparent 70%)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 900,
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              marginBottom: 16,
            }}
          >
            Built by operators, for operators.
          </h1>
          <p
            style={{
              fontSize: "1.05rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              maxWidth: 580,
              margin: "0 auto",
            }}
          >
            Prospecting OS exists because manual B2B prospecting is broken — and
            generic lead lists, in 2026, are not the answer either. The only
            thing that scales is intelligence applied early in the pipeline.
          </p>
        </div>
      </section>

      <section style={{ padding: "60px 24px", maxWidth: 760, margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: "1.6rem",
            color: "var(--text-primary)",
            marginBottom: 20,
            letterSpacing: "-0.01em",
          }}
        >
          Why I built Prospecting OS
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            color: "var(--text-secondary)",
            fontSize: "1rem",
            lineHeight: 1.7,
          }}
        >
          <p>
            I&apos;m an Electrical &amp; Electronics Engineer who transitioned into AI Automation &amp; Systems Engineering. Before Prospecting OS, I built WA-GENIE — a WhatsApp-based AI automation system for industrial reporting. Field teams submitted reports via WhatsApp, AI processed the inputs, and management received structured summaries and downloadable reports. It cut manual reporting effort significantly and proved that AI could replace repetitive operational workflows.
          </p>
          <p>
            That experience shaped how I think about Prospecting OS. The same pattern — automated data ingestion, AI-powered processing, structured delivery — applies to B2B lead generation. Every founder I spoke to was burning hours on manual prospecting that a well-built pipeline could replace. The tools existed (Apify, Claude AI, Supabase), but nobody had wired them together into a productized system.
          </p>
          <p>
            Prospecting OS is that system: a 5-step AI pipeline that sources, filters, scores, enriches, and delivers qualified B2B leads — running daily so founders wake up to pipeline, not to-do lists.
          </p>
        </div>
      </section>

      <section
        style={{
          padding: "40px 24px",
          maxWidth: 760,
          margin: "0 auto",
          borderTop: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: "1.6rem",
            color: "var(--text-primary)",
            marginBottom: 20,
            letterSpacing: "-0.01em",
          }}
        >
          Who I am
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            color: "var(--text-secondary)",
            fontSize: "1rem",
            lineHeight: 1.7,
          }}
        >
          <p>
            <strong style={{ color: "var(--text-primary)" }}>
              Ayush Kumar Sharma
            </strong>{" "}
            is an Electrical &amp; Electronics Engineer turned AI Automation &amp; Systems Engineer. He is the Founder and Proprietor of{" "}
            <strong style={{ color: "var(--text-primary)" }}>AKS Forge Lab</strong>, an India-registered sole proprietorship operating through the Flow-Forges brand. He builds AI automation, SaaS-ready systems, API integrations, backend workflows, and cloud/serverless systems for global clients.
          </p>
          <p>
            He previously built WA-GENIE, a WhatsApp-based AI automation system for industrial reporting that reduced manual reporting effort for field teams. Prospecting OS is the next productized system from Flow-Forges: an AI-powered B2B prospecting workspace for sourcing, scoring, enriching, organizing, and messaging leads.
          </p>
          <p>
            Every line of the Prospecting OS pipeline runs in production for live clients today — it isn&apos;t a deck.
          </p>
        </div>
      </section>

      <section
        style={{
          padding: "40px 24px",
          maxWidth: 760,
          margin: "0 auto",
          borderTop: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: "1.6rem",
            color: "var(--text-primary)",
            marginBottom: 20,
            letterSpacing: "-0.01em",
          }}
        >
          What we do
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            lineHeight: 1.7,
            marginBottom: 16,
          }}
        >
          A 5-step pipeline — Source, Filter, Score, Enrich, Deliver — runs
          every morning and lands 100-500 ICP-verified leads in your Slack,
          Telegram, or CRM. Scored against your ICP, enriched with company
          context, and paired with a personalized icebreaker.
        </p>
        <Link
          href="/#how-it-works"
          style={{
            color: "var(--accent)",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "0.95rem",
          }}
        >
          See the full pipeline →
        </Link>
      </section>

      <section
        style={{
          padding: "40px 24px 80px",
          maxWidth: 760,
          margin: "0 auto",
          borderTop: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: "1.6rem",
            color: "var(--text-primary)",
            marginBottom: 20,
            letterSpacing: "-0.01em",
          }}
        >
          Get in touch
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          The fastest way to evaluate Prospecting OS is to book a call. I run
          all early-pilot calls myself — bring your ICP and we&apos;ll do a
          live walkthrough on real data.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/book"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 9999,
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.92rem",
              textDecoration: "none",
              boxShadow: "0 0 24px var(--accent-glow)",
            }}
          >
            Book a Free Strategy Call →
          </Link>
          <a
            href="mailto:hello@flow-forges.com"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 9999,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "0.92rem",
              textDecoration: "none",
            }}
          >
            hello@flow-forges.com
          </a>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
