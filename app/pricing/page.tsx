"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, HelpCircle, Shield, Zap } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Pricing Page — Standalone pricing module for Prospecting OS
   ═══════════════════════════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function PlanCard({
  planKey, name, amount, interval, monthlyAmount, features, popular, cta, href,
}: {
  planKey: string; name: string; amount: number; interval: string; monthlyAmount?: number;
  features: string[]; popular?: boolean; cta: string; href: string;
}) {
  return (
    <motion.div
      variants={itemVariant}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={!popular ? { y: -6 } : undefined}
      className="relative flex flex-col rounded-2xl p-8"
      style={{
        background: popular ? "linear-gradient(180deg, #1f1c18 0%, #1a1917 100%)" : "var(--bg-card, #1a1917)",
        border: popular ? "2px solid var(--accent, #e8420a)" : "1px solid var(--border-card, rgba(255,255,255,0.06))",
        boxShadow: popular ? "0 0 40px rgba(232,66,10,0.15)" : "0 4px 16px rgba(0,0,0,0.4)",
        transform: popular ? "scale(1.03)" : undefined,
        zIndex: popular ? 2 : 1,
        overflow: "visible",
      }}
    >
      {popular && (
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
          style={{ background: "var(--accent, #e8420a)", fontFamily: "monospace" }}
        >
          Most Popular
        </motion.span>
      )}

      <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] mb-3 opacity-50"
        style={{ color: "var(--text-tertiary, #7a7875)" }}>
        {interval === "one_time" ? "ONE-TIME" : interval === "setup_plus_monthly" ? "SETUP + MONTHLY" : "MONTHLY"}
      </span>

      <h3 className="text-2xl font-extrabold mb-1 tracking-tight" style={{ color: "var(--text-primary, #f5f4f1)", fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}>
        {name}
      </h3>

      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-black tracking-tight" style={{ color: "var(--text-primary, #f5f4f1)", fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          ${amount.toLocaleString()}
        </span>
        <span className="text-sm" style={{ color: "var(--text-tertiary, #7a7875)" }}>
          {interval === "one_time" ? "one-time" : interval === "setup_plus_monthly" ? "setup" : "/mo"}
        </span>
      </div>
      {monthlyAmount && monthlyAmount > 0 ? (
        <div className="text-sm mb-6" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
          + ${monthlyAmount.toLocaleString()}/month
        </div>
      ) : <div className="mb-6" />}

      <ul className="flex-1 space-y-3 mb-8">
        {features.map((f, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.04 }}
            className="flex items-start gap-2.5 text-sm"
            style={{ color: "var(--text-secondary, #b0aeaa)" }}
          >
            <Check size={15} className="shrink-0 mt-0.5" style={{ color: popular ? "var(--accent, #e8420a)" : "var(--success, #22c55e)" }} />
            {f}
          </motion.li>
        ))}
      </ul>

      <Link
        href={href}
        className="w-full text-center py-3.5 rounded-full font-semibold text-sm transition-all inline-flex items-center justify-center gap-2 no-underline"
        style={{
          background: popular ? "var(--accent, #e8420a)" : "transparent",
          color: popular ? "#fff" : "var(--text-primary, #f5f4f1)",
          border: popular ? "none" : "1px solid var(--border, rgba(255,255,255,0.08))",
          boxShadow: popular ? "0 0 24px var(--accent-glow, rgba(232,66,10,0.3))" : "none",
          fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
        }}
      >
        {cta} <ArrowRight size={14} />
      </Link>
    </motion.div>
  );
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const planEntries = Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][];

  const faqs = [
    {
      q: "Can I switch plans later?",
      a: "Yes. Upgrades are instant — you only pay the difference from the upgrade date. Downgrades take effect at the end of your billing period. No migration or rebuild required."
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept bank transfers (ACH) and manual invoicing via Xflow Pay. Credit card processing is coming soon. Invoices are due net-15 for monthly plans."
    },
    {
      q: "Is there a contract or minimum commitment?",
      a: "No long-term contracts. Monthly plans can be cancelled anytime with 14 days notice. Setup fees are non-refundable since the work begins immediately."
    },
    {
      q: "Do you offer refunds?",
      a: "Setup fees are non-refundable. For monthly plans, you can cancel anytime. If the Managed Growth plan doesn't deliver at least 50 qualified leads in month 1, month 2 is free."
    },
    {
      q: "Can I start with DIY and add managed services later?",
      a: "Absolutely. Many clients start with DIY Setup to validate their ICP, then upgrade to Managed Growth or Scale once they see the pipeline quality. The Prospecting OS setup is the same — we just take over operations."
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--bg-primary, #0e0d0a)",
        color: "var(--text-primary, #f5f4f1)",
        fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{
          background: "rgba(14,13,10,0.85)", backdropFilter: "blur(16px)",
          borderColor: "var(--border, rgba(255,255,255,0.08))",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" className="w-7 h-7 rounded-lg" />
            <span className="font-extrabold text-[15px] tracking-tight" style={{ color: "var(--text-primary, #f5f4f1)" }}>
              Prospecting<span style={{ color: "var(--accent, #e8420a)" }}>OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium no-underline" style={{ color: "var(--text-secondary, #b0aeaa)" }}>Home</Link>
            <Link href="/book" className="text-sm font-semibold px-4 py-2 rounded-full no-underline" style={{ background: "var(--accent, #e8420a)", color: "#fff" }}>
              Book a Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        variants={containerVariants} initial="hidden" animate="visible"
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="pt-24 pb-16 text-center px-6"
      >
        <motion.div variants={itemVariant} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
          style={{ background: "rgba(232,66,10,0.08)", border: "1px solid rgba(232,66,10,0.15)" }}>
          <Zap size={12} style={{ color: "var(--accent, #e8420a)" }} />
          <span className="text-xs font-mono font-semibold tracking-wide uppercase" style={{ color: "var(--accent, #e8420a)" }}>Plans & Pricing</span>
        </motion.div>

        <motion.h1 variants={itemVariant} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="text-4xl md:text-5xl font-black tracking-tight mb-4"
          style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}>
          Your AI SDR.{' '}
          <span style={{ background: "linear-gradient(135deg, #E8A840, #F5D078, #FFB347, #E8A840)", backgroundSize: "200% 200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "hero-gradient-shift 3s ease-in-out infinite" }}>
            A fraction of the cost.
          </span>
        </motion.h1>
        <motion.p variants={itemVariant} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
          An in-house SDR costs $4,000–6,000/month and delivers 50 leads. We deliver 500+ scored leads — already enriched and ready to send.
        </motion.p>
      </motion.section>

      {/* Guarantee banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto px-6 mb-16"
      >
        <div className="flex items-center justify-center gap-3 px-6 py-3.5 rounded-full text-sm font-medium mx-auto"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "var(--success, #22c55e)" }}>
          <Shield size={15} />
          Zero-risk guarantee — less than 50 qualified leads in month 1? Month 2 is on us.
        </div>
      </motion.div>

      {/* Plan cards */}
      <motion.section
        variants={containerVariants} initial="hidden" whileInView="visible"
        viewport={{ once: true }}
        className="max-w-5xl mx-auto px-6 pb-24"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <PlanCard
            planKey="pilot" name="Founder's Pilot" amount={1499} interval="setup_plus_monthly" monthlyAmount={499}
            features={["100 ICP-verified leads/month", "3 personalized outreach sequences", "Kanban pipeline configured", "Monthly strategy call", "Founder-managed delivery", "Apify lead scraping", "Anthropic Claude AI scoring", "Supabase-powered dashboard"]}
            cta="Get Started" href="/book"
          />
          <PlanCard
            planKey="growth" name="Growth" amount={2499} interval="setup_plus_monthly" monthlyAmount={999} popular
            features={["Everything in Pilot, plus:", "200+ leads/month", "Email + LinkedIn sequences", "A/B testing of 2 variants", "Bi-weekly strategy calls", "Dedicated Slack channel", "Reply monitoring & warm handoff"]}
            cta="Book a Demo" href="/book"
          />
        </div>
      </motion.section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 pb-24" style={{ borderTop: "1px solid var(--divider, rgba(255,255,255,0.06))" }}>
        <div className="text-center pt-24 mb-12">
          <span className="text-xs font-mono font-bold uppercase tracking-[0.12em] opacity-50" style={{ color: "var(--text-tertiary, #7a7875)" }}>FAQ</span>
          <h2 className="text-3xl font-extrabold mt-2 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}>Common questions</h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl overflow-hidden"
                style={{ background: "var(--bg-card, #1a1917)", border: `1px solid ${isOpen ? "rgba(232,66,10,0.3)" : "var(--border-card, rgba(255,255,255,0.06))"}` }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}
                >
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary, #f5f4f1)" }}>
                    {faq.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 text-lg opacity-50"
                    style={{ color: "var(--text-tertiary, #7a7875)" }}
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center pb-28 px-6"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(232,66,10,0.10) 0%, transparent 70%)",
        }}
      >
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4"
          style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}>
          Not sure which plan fits?
        </h2>
        <p className="text-base max-w-md mx-auto mb-8" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
          Book a free 15-minute strategy call. We'll review your ICP, estimate your pipeline volume, and recommend the right setup — zero pressure.
        </p>
        <Link
          href="/book"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold no-underline transition-all"
          style={{
            background: "var(--accent, #e8420a)",
            color: "#fff",
            boxShadow: "0 0 40px var(--accent-glow, rgba(232,66,10,0.3))",
            fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
          }}
        >
          Book a Free Strategy Call <ArrowRight size={16} />
        </Link>
      </motion.section>
    </div>
  );
}
