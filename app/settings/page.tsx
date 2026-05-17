"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Linkedin, Map, ShoppingBag, Cpu, Zap, Bot,
  Check, Eye, EyeOff, Sparkles, Send, Globe,
  Key, Bell, User, Shield, CreditCard, LogOut,
  RefreshCw, AlertTriangle, Info, Copy, Settings2,
  Moon, Sun, Mail, MessageSquare, Trash2,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import LogoutButton from "@/components/auth/LogoutButton";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import type { EnabledSources } from "@/lib/AppContext";
import type { Source } from "@/lib/types";

const TABS = [
  { id: "profile",  label: "Profile",   icon: User },
  { id: "sources",  label: "Sources",   icon: Globe },
  { id: "keys",     label: "API Keys",  icon: Key },
  { id: "agent",    label: "Agent",     icon: Bot },
  { id: "about",    label: "About",     icon: Info },
] as const;
type TabId = typeof TABS[number]["id"];

// ═══════════════════════════════════════════════════════════════════════════

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={enabled} onClick={onChange}
      disabled={disabled}
      className="relative w-10 h-5 rounded-full transition-all duration-200 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ background: enabled ? "var(--accent)" : "var(--line)" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ left: 2, transform: enabled ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

function SectionCard({ icon: Icon, title, sub, children }: {
  icon: React.ElementType; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(232,168,64,0.06)", border: "1px solid rgba(232,168,64,0.12)" }}>
          <Icon size={18} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
          {sub && <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile Tab
// ═══════════════════════════════════════════════════════════════════════════

function ProfileTab() {
  const [profile, setProfile] = useState<Record<string, string | null> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        // Fetch profile via API (uses supabaseAdmin, bypasses RLS)
        const res = await fetch("/prospecting-os/api/admin/me");
        if (res.ok) {
          const d = await res.json();
          setProfile(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v ?? "")])));
        } else {
          // Fallback: query directly
          const { data } = await client.from("profiles").select("role, email, full_name, plan, subscription_status, created_at").eq("id", user.id).single();
          if (data) {
            setProfile(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")])));
          } else {
            setProfile({ email: user.email || "", role: user.user_metadata?.role || "user" });
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    super_admin: "#E8A840", client: "#3b82f6", qa_agent: "#a78bfa", user: "#6b7280",
  };

  return (
    <div className="space-y-3">
      {/* Avatar + identity */}
      <div className="rounded-xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-[22px] font-bold"
          style={{ background: "linear-gradient(135deg, rgba(232,168,64,0.15), rgba(232,168,64,0.05))", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}>
          {String(profile?.full_name || profile?.email || "?")[0]?.toUpperCase()}
        </div>
        <p className="text-[16px] font-bold mt-3" style={{ color: "var(--ink)" }}>
          {String(profile?.full_name || profile?.display_name || profile?.email || "Unknown")}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{String(profile?.email || "")}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Badge label={String(profile?.role || "user").replace("_", " ")} color={roleColors[String(profile?.role)] || "#6b7280"} />
          {!!profile?.plan && <Badge label={String(profile.plan).toUpperCase()} color="#6BCB77" />}
          {!!profile?.subscription_status && (
            <Badge
              label={String(profile.subscription_status)}
              color={String(profile.subscription_status) === "active" ? "#6BCB77" : "#E8A840"}
            />
          )}
        </div>
        <p className="text-[10px] mt-3" style={{ color: "var(--ink-4)" }}>
          Member since {profile?.created_at ? new Date(String(profile.created_at)).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "—"}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Role", value: String(profile?.role || "user").replace("_", " ") },
          { label: "Plan", value: (String(profile?.plan || "none")).toUpperCase() },
          { label: "Status", value: String(profile?.subscription_status || "inactive") },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ink-4)" }}>{s.label}</p>
            <p className="text-[14px] font-semibold mt-0.5 capitalize" style={{ color: "var(--ink)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl" style={{ background: "rgba(232,168,64,0.06)", border: "1px solid rgba(232,168,64,0.15)" }}>
        <Shield size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
          Your account is secured with Supabase Auth. Passwords are hashed with bcrypt. Enable 2FA in your Supabase account settings.
        </p>
      </div>

      {/* Logout */}
      <LogoutButton />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sources Tab
// ═══════════════════════════════════════════════════════════════════════════

const SOURCES_CONFIG = [
  {
    key: "linkedin" as Source, label: "LinkedIn (Apollo/ZoomInfo)",
    icon: Linkedin, color: "var(--accent)",
    description: "B2B decision-makers via Apollo & ZoomInfo data. Best for tech, finance, healthcare.",
    status: "Active — 222 leads scraped",
    comingSoon: false,
  },
  {
    key: "gmaps" as Source, label: "Google Maps",
    icon: Map, color: "var(--positive)",
    description: "Local business owners from Google Maps. Great for agency and SMB targeting.",
    status: "Integration pending",
    comingSoon: true,
  },
  {
    key: "amazon" as Source, label: "Amazon Sellers",
    icon: ShoppingBag, color: "var(--negative)",
    description: "Amazon Seller Central operators by category. E-commerce and supplier outreach.",
    status: "Integration pending",
    comingSoon: true,
  },
];

function SourcesTab({ enabledSources, onToggle }: {
  enabledSources: EnabledSources;
  onToggle: (key: Source) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        Enable or disable lead data sources. At least one source must remain active. Disabled sources are hidden from the Leads toolbar.
      </p>
      {SOURCES_CONFIG.map(cfg => {
        const Icon = cfg.icon;
        const enabled = enabledSources[cfg.key];
        return (
          <div key={cfg.key} className="rounded-xl p-4 transition-all"
            style={{ background: enabled ? "var(--surface)" : "var(--surface-2)", border: `1px solid ${enabled ? cfg.color + "30" : "var(--line)"}`, opacity: cfg.comingSoon ? 0.55 : 1 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: enabled ? `${cfg.color}15` : "var(--surface-2)", border: `1px solid ${enabled ? cfg.color + "25" : "var(--line)"}` }}>
                  <Icon size={18} style={{ color: enabled ? cfg.color : "var(--ink-4)" }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{cfg.label}</span>
                    {cfg.comingSoon && <Badge label="Soon" color="#E8A840" />}
                    {!cfg.comingSoon && enabled && <Badge label="Active" color="#6BCB77" />}
                    {!cfg.comingSoon && !enabled && <Badge label="Paused" color="#6b7280" />}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>{cfg.status}</p>
                </div>
              </div>
              <Toggle enabled={enabled} onChange={() => onToggle(cfg.key)} disabled={cfg.comingSoon} />
            </div>
            <p className="text-[12px] mt-3 leading-relaxed" style={{ color: "var(--ink-3)" }}>{cfg.description}</p>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// API Keys Tab
// ═══════════════════════════════════════════════════════════════════════════

const AI_PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)", icon: Cpu, color: "var(--accent)", storageKey: "proos_anthropic_key", docsUrl: "https://console.anthropic.com/keys", desc: "Claude Sonnet 4 for complex reasoning. Powers Message Lab and Lead Scorer." },
  { id: "gemini", label: "Google Gemini", icon: Zap, color: "#3b82f6", storageKey: "proos_gemini_key", docsUrl: "https://aistudio.google.com/apikey", desc: "Gemini 2.5 Flash — 20x cheaper than Claude for structured tasks like scoring." },
  { id: "openai", label: "OpenAI (GPT-4o)", icon: Sparkles, color: "#6BCB77", storageKey: "proos_openai_key", docsUrl: "https://platform.openai.com/api-keys", desc: "GPT-4o mini at $0.15/M tokens. Natural, conversion-optimized copy generation." },
];

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

  const masked = key ? `${key.slice(0, 6)}${"•".repeat(Math.min(20, key.length - 6))}` : "";

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${provider.color}10`, border: `1px solid ${provider.color}20` }}>
          <Icon size={18} style={{ color: provider.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{provider.label}</span>
            {key && <Badge label="Configured" color="#6BCB77" />}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>{provider.desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? "text" : "password"}
            value={show ? key : (key ? masked : "")}
            onChange={e => { setKey(e.target.value); setSaved(false); }}
            placeholder={`Paste your ${provider.label} key…`}
            className="w-full h-9 rounded-lg px-3 pr-8 text-[12px] font-mono outline-none transition-colors"
            style={{ background: "var(--surface-2)", border: `1px solid ${key ? provider.color + "30" : "var(--line)"}`, color: key ? provider.color : "var(--ink-3)" }}
            onFocus={e => (e.currentTarget.style.borderColor = provider.color)}
            onBlur={e => (e.currentTarget.style.borderColor = key ? provider.color + "30" : "var(--line)")}
          />
          {key && (
            <button onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
              style={{ color: "var(--ink-3)" }}>
              {show ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          )}
        </div>
        {key && !saved && (
          <button onClick={handleSave} className="h-9 px-4 rounded-lg text-[12px] font-semibold transition-all"
            style={{ background: provider.color, color: "#000" }}>Save</button>
        )}
        {key && saved && (
          <button onClick={() => { localStorage.removeItem(provider.storageKey); setKey(""); setSaved(false); }}
            className="h-9 px-3 rounded-lg text-[12px] transition-all" style={{ color: "var(--ink-3)", border: "1px solid var(--line)" }}>
            Clear
          </button>
        )}
        {!key && (
          <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer"
            className="h-9 px-3 rounded-lg text-[11px] font-medium inline-flex items-center transition-all"
            style={{ color: "var(--ink-3)", border: "1px solid var(--line)" }}>
            Get key ↗
          </a>
        )}
      </div>
    </div>
  );
}

function ApiKeysTab() {
  return (
    <div className="space-y-3">
      <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        Add API keys for AI providers. Keys are stored in your browser only — never sent to our servers or database.
      </p>
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[11px]"
        style={{ background: "rgba(232,168,64,0.06)", border: "1px solid rgba(232,168,64,0.15)", color: "var(--ink-3)" }}>
        <Shield size={13} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <span><span className="font-semibold" style={{ color: "var(--accent)" }}>Local storage only.</span> Keys live in localStorage and are used directly from your browser. No one else can access them.</span>
      </div>
      {AI_PROVIDERS.map(p => <ApiKeyCard key={p.id} provider={p} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Agent Tab
// ═══════════════════════════════════════════════════════════════════════════

function AgentTab() {
  const [telegramToken, setTelegramToken] = useState("");
  const [agentName, setAgentName] = useState("ProOS Agent");
  const [autoReply, setAutoReply] = useState(true);
  const [saved, setSaved] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState("");

  useEffect(() => {
    setTelegramToken(localStorage.getItem("proos_telegram_bot_token") || "");
    setAgentName(localStorage.getItem("proos_agent_name") || "ProOS Agent");
    setAutoReply(localStorage.getItem("proos_agent_auto_reply") !== "false");
  }, []);

  const handleSave = () => {
    localStorage.setItem("proos_telegram_bot_token", telegramToken.trim());
    localStorage.setItem("proos_agent_name", agentName.trim() || "ProOS Agent");
    localStorage.setItem("proos_agent_auto_reply", String(autoReply));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setupWebhook = async () => {
    setWebhookStatus("Registering webhook…");
    try {
      const res = await fetch("/prospecting-os/api/agent/telegram?action=set");
      const d = await res.json() as Record<string, unknown>;
      const r = d.result as Record<string, unknown> | undefined;
      setWebhookStatus(r?.ok ? "Webhook active ✓" : `Failed: ${r?.description || "Unknown"}`);
    } catch { setWebhookStatus("Network error"); }
  };

  const webhookUrl = typeof window !== "undefined" ? `https://app.flow-forges.com/prospecting-os/api/agent/telegram` : "";

  return (
    <div className="space-y-3">
      <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        Configure your ProOS Agent — the 24/7 AI workforce that lives inside the platform. Connect Telegram to interact with your agent from anywhere.
      </p>

      <SectionCard icon={Settings2} title="Agent Identity" sub="How your agent appears to users">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.10em] block mb-1.5" style={{ color: "var(--ink-4)" }}>Name</label>
          <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)}
            className="w-full h-9 rounded-lg px-3 text-[13px] outline-none transition-all"
            style={{ color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={e => (e.currentTarget.style.borderColor = "var(--line)")} />
        </div>
      </SectionCard>

      <SectionCard icon={Send} title="Telegram Integration" sub="Chat with your agent via Telegram bot">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.10em] block mb-1.5" style={{ color: "var(--ink-4)" }}>Bot Token</label>
            <input type="password" value={telegramToken} onChange={e => setTelegramToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full h-9 rounded-lg px-3 text-[12px] font-mono outline-none transition-all"
              style={{ color: telegramToken ? "#3b82f6" : "var(--ink-3)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
              onFocus={e => (e.currentTarget.style.borderColor = "#3b82f6")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--line)")} />
            <p className="text-[10px] mt-1" style={{ color: "var(--ink-4)" }}>
              Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>@BotFather</a> on Telegram
            </p>
          </div>
          {telegramToken && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.10em] block mb-1.5" style={{ color: "var(--ink-4)" }}>Webhook URL</label>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={webhookUrl}
                    className="flex-1 h-9 rounded-lg px-3 text-[11px] font-mono outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-3)" }} />
                  <button onClick={() => { navigator.clipboard.writeText(webhookUrl); }}
                    className="h-9 w-9 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-3)" }}>
                    <Copy size={13} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={setupWebhook}
                  className="h-9 px-4 rounded-lg text-[12px] font-medium transition-all"
                  style={{ background: "rgba(59,130,246,0.10)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.20)" }}>
                  Auto-setup Webhook
                </button>
                {webhookStatus && (
                  <span className="text-[11px]" style={{ color: webhookStatus.includes("Failed") || webhookStatus.includes("error") ? "var(--negative)" : "var(--positive)" }}>
                    {webhookStatus}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={Bot} title="Behaviour" sub="Control how your agent operates">
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>Auto-reply on Telegram</span>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>Agent responds automatically to Telegram messages</p>
            </div>
            <Toggle enabled={autoReply} onChange={() => setAutoReply(!autoReply)} />
          </label>
        </div>
      </SectionCard>

      <button onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-semibold transition-all"
        style={{
          background: saved ? "rgba(107,203,119,0.10)" : "linear-gradient(90deg, rgba(232,168,64,0.14), rgba(232,168,64,0.06))",
          color: saved ? "#6BCB77" : "var(--accent)",
          border: saved ? "1px solid rgba(107,203,119,0.20)" : "1px solid rgba(232,168,64,0.20)",
        }}>
        {saved ? <><Check size={15} /> Configuration Saved</> : "Save Agent Configuration"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// About Tab
// ═══════════════════════════════════════════════════════════════════════════

function AboutTab() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
          style={{ background: "linear-gradient(135deg, rgba(232,168,64,0.15), rgba(232,168,64,0.04))", border: "1px solid rgba(232,168,64,0.20)" }}>
          <Zap size={22} style={{ color: "var(--accent)" }} />
        </div>
        <p className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>Prospecting OS</p>
        <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>v1.0.0 — AI-Powered B2B Lead Generation</p>
        <p className="text-[10px] mt-3" style={{ color: "var(--ink-4)" }}>
          Built with Next.js 14 · Supabase · Anthropic Claude · Gemini 2.5 Flash · Vercel
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        {[
          { l: "Framework", v: "Next.js 14.2 (App Router)" },
          { l: "Language", v: "TypeScript 5 — strict mode" },
          { l: "Database", v: "Supabase Postgres + Realtime" },
          { l: "AI Engine", v: "Claude Sonnet 4 + Gemini 2.5 Flash + GPT-4o" },
          { l: "Agents", v: "8 autonomous agents (Phase 4)" },
          { l: "Payments", v: "Xflow Pay — manual activation" },
          { l: "Email", v: "Resend — transactional + inbound webhooks" },
          { l: "Deployment", v: "Vercel — auto-deploy from main branch" },
          { l: "Code", v: "github.com/Ayushkrsharma013/lead-engine" },
        ].map((row, i) => (
          <div key={row.l} className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: i < 8 ? "1px solid var(--line)" : "none" }}>
            <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>{row.l}</span>
            <span className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>{row.v}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[11px]"
        style={{ background: "rgba(232,168,64,0.06)", border: "1px solid rgba(232,168,64,0.15)", color: "var(--ink-3)" }}>
        <Info size={13} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <span>API keys are stored in your browser's localStorage only — never written to our database or servers. Your session is managed by Supabase Auth with SSR cookies.</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

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
      <TopBar title="Settings" subtitle="Manage your workspace, keys, and preferences" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-5 py-6 space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-0.5">
            {TABS.map(tab => {
              const TabIcon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all"
                  style={active ? { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }
                    : { color: "var(--ink-3)", border: "1px solid transparent" }}
                  onMouseEnter={e => { if (!active) (e.currentTarget.style.color = "var(--ink)") }}
                  onMouseLeave={e => { if (!active) (e.currentTarget.style.color = "var(--ink-3)") }}>
                  <TabIcon size={12} />{tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "sources" && <SourcesTab enabledSources={state.enabledSources} onToggle={toggleSource} />}
          {activeTab === "keys" && <ApiKeysTab />}
          {activeTab === "agent" && <AgentTab />}
          {activeTab === "about" && <AboutTab />}

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
