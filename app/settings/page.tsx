"use client";

import { useState, useEffect } from "react";
import {
  Linkedin, Map, ShoppingBag, Cpu, Zap, DollarSign,
  Star, Info, Check, AlertTriangle, Globe, Key, Eye, EyeOff, Sparkles,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import type { EnabledSources } from "@/lib/AppContext";
import type { Source } from "@/lib/types";

// ─── Providers ────────────────────────────────────────────────────────────────
const AI_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    icon: Cpu,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
    description: "Powers Message Lab and Lead Scorer. Claude Sonnet 4 for complex reasoning, Haiku for fast generation.",
    storageKey: "proos_anthropic_key",
    docsUrl: "https://console.anthropic.com/keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    icon: Zap,
    color: "var(--info)",
    bg: "var(--info-soft)",
    description: "Gemini Flash for cost-effective scoring and data extraction. 20x cheaper than Claude for structured tasks.",
    storageKey: "proos_gemini_key",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai",
    label: "OpenAI (GPT-4o)",
    icon: Sparkles,
    color: "var(--positive)",
    bg: "var(--positive-soft)",
    description: "GPT-4o mini for message generation at $0.15/M tokens. Natural, conversion-optimised copy.",
    storageKey: "proos_openai_key",
    docsUrl: "https://platform.openai.com/api-keys",
  },
] as const;

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
    key: "linkedin", label: "LinkedIn", icon: Linkedin,
    color: "var(--accent)", bg: "var(--accent-soft)",
    description: "Scrape decision-makers from LinkedIn via Apollo/ZoomInfo data. Best for B2B outreach.",
    status: "Fully operational",
  },
  {
    key: "gmaps", label: "Google Maps", icon: Map,
    color: "var(--positive)", bg: "var(--positive-soft)",
    description: "Find local business owners from Google Maps listings. Great for agency and SMB targeting.",
    status: "Coming soon", comingSoon: true,
  },
  {
    key: "amazon", label: "Amazon", icon: ShoppingBag,
    color: "var(--negative)", bg: "var(--negative-soft)",
    description: "Identify Amazon Seller Central operators by category. E-commerce tools and supplier outreach.",
    status: "Coming soon", comingSoon: true,
  },
];

const TABS = [
  { id: "sources", label: "Data Sources", icon: Globe },
  { id: "keys",    label: "API Keys",     icon: Key },
  { id: "about",   label: "About",        icon: Info },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── Source Card ───────────────────────────────────────────────────────────────
function SourceCard({ cfg, enabled, onToggle }: {
  cfg: typeof SOURCES_CONFIG[number];
  enabled: boolean;
  onToggle: () => void;
}) {
  const Icon = cfg.icon;
  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: enabled ? cfg.bg : "var(--surface-2)",
        border: `1px solid ${enabled ? cfg.color + "40" : "var(--line)"}`,
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
              <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{cfg.label}</span>
              {cfg.comingSoon && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "var(--negative-soft)", color: "var(--negative)", border: "1px solid var(--negative)/25" }}>
                  Soon
                </span>
              )}
              {!cfg.comingSoon && enabled && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1" style={{ background: "var(--positive-soft)", color: "var(--positive)", border: "1px solid var(--positive)/25" }}>
                  <Check size={8} /> Active
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>{cfg.status}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={cfg.comingSoon}
          className="relative w-10 h-5 rounded-full transition-all duration-200 focus:outline-none shrink-0 disabled:opacity-40 disabled:cursor-not-allowed mt-0.5"
          style={{ background: enabled ? cfg.color : "var(--line)" }}
          aria-checked={enabled}
          role="switch"
        >
          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }} />
        </button>
      </div>
      <p className="text-[12px] mt-3 leading-relaxed" style={{ color: "var(--ink-3)" }}>{cfg.description}</p>
      {cfg.comingSoon && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: "var(--negative-soft)", color: "var(--negative)", border: "1px solid var(--negative)/25" }}>
          <AlertTriangle size={11} />
          Integration in development -- toggle will unlock automatically on release.
        </div>
      )}
    </div>
  );
}

// ─── API Key Card ──────────────────────────────────────────────────────────────
function ApiKeyCard({ provider }: { provider: typeof AI_PROVIDERS[number] }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const Icon = provider.icon;

  useEffect(() => {
    const stored = localStorage.getItem(provider.storageKey);
    if (stored) { setKey(stored); setSaved(true); }
  }, [provider.storageKey]);

  const handleSave = () => {
    if (!key.trim()) return;
    localStorage.setItem(provider.storageKey, key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    localStorage.removeItem(provider.storageKey);
    setKey("");
    setSaved(false);
  };

  const masked = key ? `${key.slice(0, 8)}${"*".repeat(Math.min(24, key.length - 8))}` : "";

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: provider.bg }}>
          <Icon size={16} style={{ color: provider.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{provider.label}</span>
            {key && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1" style={{ background: "var(--positive-soft)", color: "var(--positive)", border: "1px solid var(--positive)/25" }}>
                <Check size={8} /> Configured
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--ink-3)" }}>{provider.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? "text" : "password"}
            value={show ? key : (key ? masked : "")}
            onChange={e => { setKey(e.target.value); setSaved(false); }}
            placeholder={`Enter your ${provider.label} API key...`}
            className="w-full h-9 rounded-lg px-3 pr-8 text-[12px] font-mono outline-none transition-colors"
            style={{
              background: "var(--surface-2)",
              border: `1px solid ${key ? provider.color + "40" : "var(--line)"}`,
              color: key ? provider.color : "var(--ink-3)",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = provider.color)}
            onBlur={e => (e.currentTarget.style.borderColor = key ? provider.color + "40" : "var(--line)")}
          />
          <button
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--ink-3)" }}
          >
            {show ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
        {key && !saved && (
          <button
            onClick={handleSave}
            className="h-9 px-4 rounded-lg text-[12px] font-semibold transition-all active:translate-y-[0.5px]"
            style={{ background: provider.color, color: "var(--bg)" }}
          >
            Save
          </button>
        )}
        {key && (
          <button
            onClick={handleClear}
            className="h-9 px-3 rounded-lg text-[12px] font-medium transition-all border"
            style={{ color: "var(--ink-3)", borderColor: "var(--line)" }}
          >
            Clear
          </button>
        )}
        {!key && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 rounded-lg text-[11px] font-medium transition-all border inline-flex items-center"
            style={{ color: "var(--ink-3)", borderColor: "var(--line)" }}
          >
            Get key
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
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
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)/30",
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

          {/* Data Sources tab */}
          {activeTab === "sources" && (
            <>
              <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                Enable or disable data sources. Disabled sources are hidden from the Lead Intelligence toolbar. At least one source must remain active.
              </p>
              {SOURCES_CONFIG.map(cfg => (
                <SourceCard key={cfg.key} cfg={cfg} enabled={state.enabledSources[cfg.key]} onToggle={() => toggleSource(cfg.key)} />
              ))}
            </>
          )}

          {/* API Keys tab */}
          {activeTab === "keys" && (
            <>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                Add your API keys for the AI providers you want to use. Keys are stored in your browser's local storage and never sent to our servers.
              </p>

              {/* Security note */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[11px]" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)/20", color: "var(--ink-3)" }}>
                <Info size={12} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                <span>
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>Your keys stay local.</span>{" "}
                  API keys are stored in localStorage and used directly from your browser. They are never uploaded, logged, or accessible by anyone else.
                </span>
              </div>

              {AI_PROVIDERS.map(p => (
                <ApiKeyCard key={p.id} provider={p} />
              ))}

              {/* Model recommendations */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={14} style={{ color: "var(--positive)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Model recommendations by task</span>
                </div>
                {[
                  { task: "Message Generation", best: "GPT-4o mini", alt: "Claude Haiku 3.5", budget: "Llama 3.3 70B (Groq)" },
                  { task: "Lead Scoring / ICP", best: "Gemini 1.5 Flash", alt: "GPT-4o mini", budget: "Mistral Small" },
                  { task: "Complex Reasoning", best: "Claude Sonnet 4", alt: "GPT-4o", budget: "DeepSeek V3" },
                  { task: "Data Extraction", best: "Gemini 1.5 Flash", alt: "GPT-4o mini", budget: "Llama 3.1 8B (Groq)" },
                ].map(row => (
                  <div key={row.task} className="flex items-center gap-3 text-[11px] py-1.5 px-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                    <span className="font-medium w-[160px] shrink-0" style={{ color: "var(--ink)" }}>{row.task}</span>
                    <span className="flex-1" style={{ color: "var(--ink-3)" }}>
                      <span style={{ color: "var(--accent)" }}>Best:</span> {row.best}
                      {" · "}
                      <span style={{ color: "var(--info)" }}>Alt:</span> {row.alt}
                      {" · "}
                      <span style={{ color: "var(--positive)" }}>Budget:</span> {row.budget}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* About tab */}
          {activeTab === "about" && (
            <div className="space-y-3">
              <div className="rounded-xl p-5 text-center" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)/20" }}>
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)/40" }}>
                  <Zap size={20} style={{ color: "var(--accent)" }} />
                </div>
                <p className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>LinkedIn ProOS</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>Version 1.0.0 · AI-powered B2B prospecting</p>
              </div>
              {[
                { label: "Framework", value: "Next.js 14 (App Router)" },
                { label: "Database", value: "Supabase (Postgres + Realtime)" },
                { label: "AI Engine", value: "Anthropic Claude + Gemini + GPT-4o" },
                { label: "Lead scraping", value: "Apify — Apollo/ZoomInfo" },
                { label: "Deployment", value: "Vercel (auto-deploy from main)" },
                { label: "Repository", value: "github.com/Ayushkrsharma013/lead-engine" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>{row.label}</span>
                  <span className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>{row.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px]" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)/20", color: "var(--ink-3)" }}>
                <Info size={11} style={{ color: "var(--accent)" }} />
                API keys are stored in your browser's localStorage only — never written to our database or servers.
              </div>
            </div>
          )}

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
