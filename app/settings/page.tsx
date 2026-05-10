"use client";

import { useState } from "react";
import {
  Linkedin, Map, ShoppingBag, Cpu, Zap, DollarSign,
  Star, Info, Check, AlertTriangle, Globe,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import type { EnabledSources } from "@/lib/AppContext";
import type { Source } from "@/lib/types";

// ─── AI Models data ───────────────────────────────────────────────────────────
const AI_MODELS = [
  {
    useCase: "Message Generation",
    desc: "Cold emails, LinkedIn DMs, connection requests",
    recommended: { name: "GPT-4o mini", provider: "OpenAI", cost: "~$0.15 / 1M tokens", quality: 4, speed: 5 },
    alternative: { name: "Claude Haiku 3.5", provider: "Anthropic", cost: "~$0.80 / 1M tokens", quality: 5, speed: 5 },
    budget: { name: "Llama 3.3 70B", provider: "Groq (free tier)", cost: "Free / very cheap", quality: 4, speed: 5 },
    note: "GPT-4o mini writes natural, conversion-optimised copy at 10× cheaper than Sonnet.",
  },
  {
    useCase: "Lead Scoring / ICP",
    desc: "Analyse profiles, score fit, extract signals",
    recommended: { name: "GPT-4o mini", provider: "OpenAI", cost: "~$0.15 / 1M tokens", quality: 4, speed: 5 },
    alternative: { name: "Gemini 1.5 Flash", provider: "Google", cost: "~$0.075 / 1M tokens", quality: 4, speed: 5 },
    budget: { name: "Mistral Small", provider: "Mistral AI", cost: "~$0.20 / 1M tokens", quality: 3, speed: 5 },
    note: "Gemini Flash is the cheapest option with solid reasoning for structured scoring.",
  },
  {
    useCase: "Complex Reasoning / Strategy",
    desc: "Campaign strategy, reply handling, tone analysis",
    recommended: { name: "Claude Sonnet 4", provider: "Anthropic", cost: "~$3 / 1M tokens", quality: 5, speed: 4 },
    alternative: { name: "GPT-4o", provider: "OpenAI", cost: "~$5 / 1M tokens", quality: 5, speed: 4 },
    budget: { name: "DeepSeek V3", provider: "DeepSeek", cost: "~$0.27 / 1M tokens", quality: 5, speed: 3 },
    note: "DeepSeek V3 matches GPT-4o quality at 20× lower cost — best hidden gem for heavy reasoning.",
  },
  {
    useCase: "Data Extraction / Parsing",
    desc: "Parse scraped profiles, clean company data",
    recommended: { name: "Gemini 1.5 Flash", provider: "Google", cost: "~$0.075 / 1M tokens", quality: 4, speed: 5 },
    alternative: { name: "GPT-4o mini", provider: "OpenAI", cost: "~$0.15 / 1M tokens", quality: 4, speed: 5 },
    budget: { name: "Llama 3.1 8B", provider: "Groq", cost: "Free", quality: 3, speed: 5 },
    note: "Structured output (JSON mode) works best with Gemini Flash and GPT-4o mini.",
  },
];

const SOURCES_CONFIG: {
  key: Source;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  description: string;
  status: string;
  comingSoon?: boolean;
}[] = [
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
    description: "Scrape decision-makers from LinkedIn via Apollo/ZoomInfo data. Best for B2B outreach — verified job titles, company data, and email enrichment.",
    status: "Fully operational",
  },
  {
    key: "gmaps",
    label: "Google Maps",
    icon: Map,
    color: "var(--positive)",
    bg: "rgba(0,255,136,0.08)",
    description: "Find local business owners from Google Maps listings. Great for agency outreach, local services, and SMB targeting.",
    status: "Coming soon",
    comingSoon: true,
  },
  {
    key: "amazon",
    label: "Amazon",
    icon: ShoppingBag,
    color: "var(--negative)",
    bg: "rgba(255,107,53,0.08)",
    description: "Identify Amazon Seller Central operators by category and revenue signals. Useful for e-commerce tools and supplier outreach.",
    status: "Coming soon",
    comingSoon: true,
  },
];

const TABS = [
  { id: "sources", label: "Data Sources", icon: Globe },
  { id: "ai",      label: "AI Models",    icon: Cpu },
  { id: "about",   label: "About",        icon: Info },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── Stars component ──────────────────────────────────────────────────────────
function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={10}
          style={{
            color: i <= count ? "#fbbf24" : "var(--line-strong)",
            fill: i <= count ? "#fbbf24" : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Source card ──────────────────────────────────────────────────────────────
function SourceCard({
  cfg, enabled, onToggle,
}: {
  cfg: typeof SOURCES_CONFIG[number];
  enabled: boolean;
  onToggle: () => void;
}) {
  const Icon = cfg.icon;
  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: enabled ? cfg.bg : "rgba(255,255,255,0.02)",
        border: `1px solid ${enabled ? cfg.color + "30" : "var(--line)"}`,
        boxShadow: enabled ? `0 0 20px ${cfg.color}08` : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: enabled ? cfg.bg : "var(--surface-2)", border: `1px solid ${enabled ? cfg.color + "30" : "var(--line)"}` }}
          >
            <Icon size={16} style={{ color: enabled ? cfg.color : "var(--ink-3)" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                {cfg.label}
              </span>
              {cfg.comingSoon && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ background: "var(--negative-soft)", color: "var(--negative)", border: "1px solid rgba(255,107,53,0.2)" }}
                >
                  Soon
                </span>
              )}
              {!cfg.comingSoon && enabled && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1"
                  style={{ background: "rgba(0,255,136,0.1)", color: "var(--positive)", border: "1px solid rgba(0,255,136,0.2)" }}
                >
                  <Check size={8} /> Active
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>{cfg.status}</p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          disabled={cfg.comingSoon}
          className="relative w-10 h-5 rounded-full transition-all duration-200 focus:outline-none shrink-0 disabled:opacity-40 disabled:cursor-not-allowed mt-0.5"
          style={{ background: enabled ? cfg.color + "80" : "rgba(255,255,255,0.1)" }}
          aria-checked={enabled}
          role="switch"
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
          />
        </button>
      </div>

      <p className="text-[12px] mt-3 leading-relaxed" style={{ color: "var(--ink-3)" }}>
        {cfg.description}
      </p>

      {cfg.comingSoon && (
        <div
          className="mt-3 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg"
          style={{ background: "rgba(255,107,53,0.08)", color: "var(--negative)", border: "1px solid rgba(255,107,53,0.15)" }}
        >
          <AlertTriangle size={11} />
          Integration in development — toggle will unlock automatically on release.
        </div>
      )}
    </div>
  );
}

// ─── AI model row ─────────────────────────────────────────────────────────────
function ModelCard({ data }: { data: typeof AI_MODELS[number] }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}
    >
      <div className="mb-3">
        <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{data.useCase}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>{data.desc}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { tier: "Best", ...data.recommended, accent: "var(--accent)" },
          { tier: "Alt", ...data.alternative, accent: "var(--info)" },
          { tier: "Budget", ...data.budget, accent: "var(--positive)" },
        ].map(m => (
          <div
            key={m.tier}
            className="rounded-lg p-2.5"
            style={{ background: `${m.accent}06`, border: `1px solid ${m.accent}15` }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: m.accent }}>{m.tier}</span>
              <Stars count={m.quality} />
            </div>
            <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{m.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-3)" }}>{m.provider}</p>
            <div className="flex items-center gap-1 mt-2">
              <DollarSign size={9} style={{ color: m.accent }} />
              <span className="text-[10px] font-medium" style={{ color: m.accent }}>{m.cost}</span>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-2.5 flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg"
        style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)" }}
      >
        <Zap size={11} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <span style={{ color: "var(--ink-3)" }}>{data.note}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>("sources");

  const toggleSource = (key: Source) => {
    const next: EnabledSources = { ...state.enabledSources, [key]: !state.enabledSources[key] };
    if (!Object.values(next).some(Boolean)) return;
    dispatch({ type: "SET_ENABLED_SOURCES", payload: next });
    if (key === state.source && !next[key]) {
      const fallback = (Object.keys(next) as Source[]).find(k => next[k]);
      if (fallback) dispatch({ type: "SET_SOURCE", payload: fallback });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg">
      <TopBar title="Settings" subtitle="Configure your ProOS workspace" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-5 py-6 space-y-4">

          {/* Tabs */}
          <div className="flex items-center gap-0.5">
            {TABS.map(tab => {
              const TabIcon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all"
                  style={active ? {
                    background: "rgba(0,212,255,0.1)",
                    color: "var(--accent)",
                    border: "1px solid rgba(0,212,255,0.2)",
                  } : {
                    color: "var(--ink-3)",
                    border: "1px solid transparent",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; }}
                >
                  <TabIcon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Sources tab ── */}
          {activeTab === "sources" && (
            <>
              <div className="mb-1">
                <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                  Enable or disable data sources. Disabled sources are hidden from the Lead Intelligence toolbar.
                  At least one source must remain active.
                </p>
              </div>
              {SOURCES_CONFIG.map(cfg => (
                <SourceCard
                  key={cfg.key}
                  cfg={cfg}
                  enabled={state.enabledSources[cfg.key]}
                  onToggle={() => toggleSource(cfg.key)}
                />
              ))}
            </>
          )}

          {/* ── AI Models tab ── */}
          {activeTab === "ai" && (
            <>
              <div className="mb-1">
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                  Claude (Anthropic) is the current AI engine powering Message Lab and Lead Scorer.
                  Below is a cost-vs-quality guide for swapping to cheaper models on each task type.
                  All pricing is approximate output token cost.
                </p>
              </div>

              {/* Cost summary banner */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(0,255,136,0.1)" }}>
                  <DollarSign size={15} style={{ color: "var(--positive)" }} />
                </div>
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--positive)" }}>Quick cost comparison</p>
                  <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                    Claude Sonnet 4 = $3/M tokens · GPT-4o mini = $0.15/M · Gemini Flash = $0.075/M · Groq Llama = Free
                  </p>
                </div>
              </div>

              {AI_MODELS.map(m => <ModelCard key={m.useCase} data={m} />)}

              <div
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[11px]"
                style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", color: "var(--ink-3)" }}
              >
                <Zap size={12} className="shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
                <span>
                  <span className="font-semibold" style={{ color: "var(--info)" }}>Recommended stack:</span>{" "}
                  Use <strong style={{ color: "var(--ink)" }}>GPT-4o mini</strong> for message generation and scoring (80% of your usage),
                  and <strong style={{ color: "var(--ink)" }}>DeepSeek V3</strong> for any complex reasoning tasks.
                  This cuts AI cost by ~90% vs Claude Sonnet with minimal quality drop.
                </span>
              </div>
            </>
          )}

          {/* ── About tab ── */}
          {activeTab === "about" && (
            <div className="space-y-3">
              <div
                className="rounded-xl p-5 text-center"
                style={{ background: "rgba(0,212,255,0.04)", border: "1px solid var(--accent-soft)" }}
              >
                <div
                  className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3"
                  style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.15))", border: "1px solid rgba(0,212,255,0.3)", boxShadow: "0 0 20px rgba(0,212,255,0.1)" }}
                >
                  <Zap size={20} style={{ color: "var(--accent)" }} />
                </div>
                <p className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>LinkedIn ProOS</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>Version 1.0.0 · AI-powered B2B prospecting</p>
              </div>

              {[
                { label: "Framework", value: "Next.js 14 (App Router)" },
                { label: "Database", value: "Supabase (Postgres + Realtime)" },
                { label: "Current AI", value: "Anthropic Claude (Sonnet)" },
                { label: "Lead scraping", value: "Apify — Apollo/ZoomInfo" },
                { label: "Deployment", value: "Vercel (auto-deploy from main)" },
                { label: "Repository", value: "github.com/Ayushkrsharma013/lead-engine" },
              ].map(row => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}
                >
                  <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>{row.label}</span>
                  <span className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>{row.value}</span>
                </div>
              ))}

              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px]"
                style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)", color: "var(--ink-3)" }}
              >
                <Info size={11} style={{ color: "var(--accent)" }} />
                Your Anthropic API key is stored in React memory only — never written to disk or database.
              </div>
            </div>
          )}

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
