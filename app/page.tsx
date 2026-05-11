"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap, Sparkles, Target, Users, BarChart3, MessageSquare,
  ArrowRight, Check, ChevronRight, Linkedin, Mail, Globe,
  Shield, Building2, TrendingUp, Send, Bot,
} from "lucide-react";

/* ─── Constants ──────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: Users, title: "Lead Discovery", desc: "AI-powered scraping from LinkedIn, Google Maps, and Amazon. Find decision-makers with verified emails at scale.", color: "#C9A87C" },
  { icon: Sparkles, title: "AI Message Lab", desc: "Generate personalised outreach with Gemini. LinkedIn connections, DMs, and cold emails that convert.", color: "#A8C99A" },
  { icon: Target, title: "ICP Scoring", desc: "Score every lead against your ideal customer profile. Prioritise hot leads with AI reasoning.", color: "#D49484" },
  { icon: BarChart3, title: "Pipeline Analytics", desc: "Track conversion rates, source performance, and campaign ROI with live dashboard charts.", color: "#9AB3C8" },
  { icon: MessageSquare, title: "Sequences", desc: "Build multi-step outreach cadences. Drag-and-drop timeline, variable templates, automated follow-ups.", color: "#C9A87C" },
  { icon: Bot, title: "24/7 AI Agent", desc: "A live AI agent inside the platform — answer questions, run tasks, and even chat via Telegram.", color: "#A8C99A" },
];

const PRICING = [
  { name: "Starter", price: 499, desc: "For solo founders and small agencies", features: ["Up to 500 leads/mo", "LinkedIn scraping", "AI Message Lab", "Basic ICP scoring", "Email support"], cta: "Start Free Trial", popular: false },
  { name: "Pro", price: 1499, desc: "For growing B2B sales teams", features: ["Up to 5,000 leads/mo", "All 3 sources (LinkedIn, Maps, Amazon)", "Advanced AI scoring", "Sequence builder", "Kanban pipeline", "Google Drive export", "Priority support"], cta: "Start Free Trial", popular: true },
  { name: "Enterprise", price: null, desc: "For agencies and large teams", features: ["Unlimited leads", "Custom AI model training", "White-label client portal", "Telegram agent integration", "API access", "Dedicated account manager", "SLA guarantee"], cta: "Talk to Sales", popular: false },
];

const STEPS = [
  { step: "01", title: "Connect Sources", desc: "Plug in LinkedIn, Google Maps, or Amazon. Our AI scrapes verified contacts in real-time." },
  { step: "02", title: "Score & Prioritise", desc: "Every lead gets an ICP score. AI reasoning tells you exactly why they're a fit." },
  { step: "03", title: "Outreach at Scale", desc: "Generate personalised messages, build sequences, and track pipeline — all from one dashboard." },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="bg-bg text-ink font-geist">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: "rgba(8,8,10,0.85)", backdropFilter: "blur(16px)", borderColor: "var(--sidebar-border)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,124,0.12)", border: "1px solid rgba(201,168,124,0.22)" }}>
              <Zap size={13} style={{ color: "var(--accent)" }} />
            </div>
            <span className="font-bold text-[13px] tracking-tight">LinkedIn<span style={{ color: "var(--accent)" }}>ProOS</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/portal/login" className="text-[12px] font-medium transition-colors duration-200" style={{ color: "var(--ink-3)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}>
              Client Portal
            </Link>
            <Link href="/dashboard"
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold transition-all duration-200"
              style={{ background: "linear-gradient(90deg, rgba(201,168,124,0.14), rgba(201,168,124,0.08))", color: "var(--accent-ink)", border: "1px solid rgba(201,168,124,0.22)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(201,168,124,0.15)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "none"}>
              Launch App <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(201,168,124,0.06) 0%, transparent 70%)" }} />

        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-6"
            style={{ background: "rgba(201,168,124,0.08)", color: "var(--accent)", border: "1px solid rgba(201,168,124,0.18)" }}>
            <Zap size={11} /> AI-Powered B2B Prospecting Platform
          </div>
          <h1 className="text-[48px] font-bold leading-[1.1] tracking-tight mb-5">
            Find, Score, and Close
            <br />
            <span style={{ color: "var(--accent)" }}>B2B Leads</span> on Autopilot
          </h1>
          <p className="text-[16px] leading-relaxed max-w-2xl mx-auto mb-8" style={{ color: "var(--ink-3)" }}>
            LinkedIn ProOS scrapes verified contacts from LinkedIn, Google Maps, and Amazon.
            AI scores every lead, generates personalised outreach, and tracks your pipeline — all in one platform.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard"
              className="flex items-center gap-2 h-11 px-6 rounded-xl text-[14px] font-semibold transition-all duration-200"
              style={{ background: "linear-gradient(90deg, rgba(201,168,124,0.20), rgba(201,168,124,0.12))", color: "var(--accent-ink)", border: "1px solid rgba(201,168,124,0.30)", boxShadow: "0 0 20px rgba(201,168,124,0.12)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 32px rgba(201,168,124,0.22)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(201,168,124,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
              Get Started Free <ArrowRight size={15} />
            </Link>
            <Link href="#features"
              className="flex items-center gap-2 h-11 px-6 rounded-xl text-[13px] font-medium transition-all duration-200"
              style={{ background: "transparent", color: "var(--ink-2)", border: "1px solid var(--line)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(237,234,226,0.15)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; }}>
              See How It Works
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-10 text-[12px]" style={{ color: "var(--ink-4)" }}>
            <span className="flex items-center gap-1.5"><Check size={12} style={{ color: "var(--positive)" }} /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check size={12} style={{ color: "var(--positive)" }} /> 14-day free trial</span>
            <span className="flex items-center gap-1.5"><Check size={12} style={{ color: "var(--positive)" }} /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Features</span>
          <h2 className="text-[28px] font-bold mt-2 mb-3">Everything You Need to Prospect</h2>
          <p className="text-[14px] max-w-xl mx-auto" style={{ color: "var(--ink-3)" }}>From discovery to deal — a complete B2B prospecting engine powered by AI.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title}
              className="rounded-xl p-5 transition-all duration-200 group"
              style={{ background: "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))", border: "1px solid rgba(201,168,124,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.18)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${f.color}14`, border: `1px solid ${f.color}25` }}>
                <f.icon size={16} style={{ color: f.color }} />
              </div>
              <h3 className="text-[14px] font-semibold mb-1.5">{f.title}</h3>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20" style={{ background: "var(--sidebar-bg)", borderTop: "1px solid var(--sidebar-border)", borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>How It Works</span>
            <h2 className="text-[28px] font-bold mt-2 mb-3">Three Steps to Your Pipeline</h2>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.step} className="text-center relative">
                <div className="text-[48px] font-bold mb-3" style={{ color: "var(--accent)", opacity: 0.15 }}>{s.step}</div>
                <h3 className="text-[16px] font-semibold mb-2">{s.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>{s.desc}</p>
                {i < 2 && (
                  <div className="hidden lg:block absolute top-8 -right-4" style={{ color: "var(--ink-4)" }}>
                    <ChevronRight size={20} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Pricing</span>
          <h2 className="text-[28px] font-bold mt-2 mb-3">Simple, Transparent Pricing</h2>
          <p className="text-[14px] max-w-xl mx-auto" style={{ color: "var(--ink-3)" }}>Start with a 14-day free trial. No credit card required. Upgrade anytime.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {PRICING.map(p => (
            <div key={p.name}
              className="rounded-xl p-6 transition-all duration-200 relative"
              style={{
                background: p.popular ? "linear-gradient(180deg, rgba(201,168,124,0.06), rgba(12,13,11,0.6))" : "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))",
                border: p.popular ? "1px solid rgba(201,168,124,0.18)" : "1px solid rgba(201,168,124,0.07)",
                boxShadow: p.popular ? "0 0 24px rgba(201,168,124,0.08)" : "0 1px 3px rgba(0,0,0,0.25)",
              }}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.10em]"
                  style={{ background: "var(--accent)", color: "var(--bg)" }}>Most Popular</div>
              )}
              <h3 className="text-[16px] font-semibold mb-1">{p.name}</h3>
              <p className="text-[11px] mb-4" style={{ color: "var(--ink-3)" }}>{p.desc}</p>
              <div className="mb-5">
                {p.price ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>$</span>
                    <span className="text-[36px] font-bold">{p.price.toLocaleString()}</span>
                    <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>/month</span>
                  </div>
                ) : (
                  <span className="text-[28px] font-bold">Custom</span>
                )}
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                    <Check size={12} className="shrink-0 mt-0.5" style={{ color: "var(--positive)" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/dashboard"
                className="block text-center h-10 rounded-xl text-[13px] font-semibold transition-all duration-200 flex items-center justify-center"
                style={p.popular
                  ? { background: "linear-gradient(90deg, rgba(201,168,124,0.18), rgba(201,168,124,0.10))", color: "var(--accent-ink)", border: "1px solid rgba(201,168,124,0.25)" }
                  : { background: "transparent", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust / Stats ── */}
      <section className="py-16" style={{ background: "var(--sidebar-bg)", borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: "10,000+", label: "Leads Generated" },
              { value: "92%", label: "Email Verification Rate" },
              { value: "3.2x", label: "Average Pipeline Growth" },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[32px] font-bold mb-1" style={{ color: "var(--accent)" }}>{s.value}</div>
                <div className="text-[12px]" style={{ color: "var(--ink-4)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-[28px] font-bold mb-3">Ready to Fill Your Pipeline?</h2>
        <p className="text-[14px] mb-8" style={{ color: "var(--ink-3)" }}>Start your 14-day free trial. No credit card, no setup fees, no commitment.</p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 h-12 px-8 rounded-xl text-[14px] font-semibold transition-all duration-200"
          style={{ background: "linear-gradient(90deg, rgba(201,168,124,0.22), rgba(201,168,124,0.14))", color: "var(--accent-ink)", border: "1px solid rgba(201,168,124,0.30)", boxShadow: "0 0 24px rgba(201,168,124,0.14)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(201,168,124,0.25)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(201,168,124,0.14)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
          Launch ProOS <ArrowRight size={15} />
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--sidebar-border)", background: "var(--sidebar-bg)" }}>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(201,168,124,0.10)", border: "1px solid rgba(201,168,124,0.18)" }}>
                  <Zap size={11} style={{ color: "var(--accent)" }} />
                </div>
                <span className="font-bold text-[12px]">ProOS</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink-4)" }}>AI-powered B2B prospecting platform. Find, score, and close leads on autopilot.</p>
            </div>
            {[
              { label: "Product", links: ["Features", "Pricing", "Client Portal", "API"] },
              { label: "Company", links: ["About", "Blog", "Contact", "Privacy"] },
              { label: "Connect", links: ["LinkedIn", "Twitter", "Email", "Telegram"] },
            ].map(col => (
              <div key={col.label}>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "var(--ink-4)" }}>{col.label}</h4>
                <ul className="space-y-1.5">
                  {col.links.map(l => (
                    <li key={l}><span className="text-[11px] cursor-pointer transition-colors duration-150" style={{ color: "var(--ink-3)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}>{l}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-6 flex items-center justify-between text-[10px]" style={{ borderTop: "1px solid var(--sidebar-border)", color: "var(--ink-4)" }}>
            <span>© 2026 LinkedIn ProOS. All rights reserved.</span>
            <span>Built by Ayush Kumar Sharma</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
