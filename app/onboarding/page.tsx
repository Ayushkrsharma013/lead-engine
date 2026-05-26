"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap, ArrowRight, ArrowLeft, CheckCircle2, Search, Monitor, Code, Compass,
  Building2, Users, MapPin, Key, Sparkles, Loader2, CreditCard, Briefcase,
} from "lucide-react";
import {
  type OnboardingStep, ONBOARDING_STEPS,
  INDUSTRY_OPTIONS, COMPANY_SIZE_OPTIONS, SENIORITY_OPTIONS, COUNTRY_OPTIONS,
  type IcpPreferences,
} from "@/lib/onboarding";

const PLANS_DATA: Record<string, { name: string; price: string; interval: string; features: string[]; popular?: boolean }> = {
  pilot: {
    name: "Founder's Pilot", price: "$1,499", interval: "setup + $499/mo",
    features: ["100 ICP-verified leads/month", "3 outreach sequences", "Kanban pipeline", "Monthly strategy call", "Apify + Claude AI scoring", "Supabase dashboard", "Founder-managed delivery"],
  },
  growth: {
    name: "Growth", price: "$2,499", interval: "setup + $999/mo", popular: true,
    features: ["Everything in Pilot", "200+ leads/month", "Email + LinkedIn sequences", "A/B testing", "Bi-weekly calls", "Dedicated Slack channel", "Reply monitoring & handoff"],
  },
  micro: {
    name: "Micro-Offer", price: "$997", interval: "one-time",
    features: ["50 ICP-verified leads", "5 outreach sequences", "CSV delivery", "30-min ICP call", "Delivery in 5 business days"],
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [name, setName] = useState("");
  const [icp, setIcp] = useState<IcpPreferences>({ industries: [], companySizes: [], seniority: [], countries: [] });
  const [selectedPlan, setSelectedPlan] = useState("pilot");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentIndex = ONBOARDING_STEPS.findIndex(s => s.key === step);
  const progress = ((currentIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const toggleIcp = (field: keyof IcpPreferences, value: string) => {
    setIcp(prev => {
      const list = prev[field];
      const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
      return { ...prev, [field]: next };
    });
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      // Save onboarding data + set subscription to pending_payment
      // Finance Agent picks this up via cron and alerts Telegram
      const res = await fetch("/prospecting-os/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          icp,
          plan: selectedPlan,
          subscriptionStatus: "pending_payment",
          onboardingComplete: true,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        router.push("/checkout");
      } else {
        setError(data.error || "Failed to save. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleSkip = () => {
    fetch("/prospecting-os/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icp, onboardingComplete: true }),
    }).catch(() => {});
    router.push("/dashboard");
  };

  const styles = {
    bg: "#0e0d0a",
    card: "#1a1917",
    input: "#1a1a1a",
    text: "#f5f4f1",
    textSecondary: "#b0aeaa",
    textTertiary: "#7a7875",
    accent: "#e8420a",
    border: "rgba(255,255,255,0.08)",
    borderCard: "rgba(255,255,255,0.06)",
    success: "#22c55e",
    badgeBg: "rgba(232,66,10,0.12)",
    badgeText: "#ff8a5c",
  };

  const inputStyle = {
    width: "100%", height: 44, padding: "0 16px", borderRadius: 12,
    border: `1px solid ${styles.border}`, background: styles.input,
    color: styles.text, fontSize: "0.875rem", fontFamily: "inherit", outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100vh", background: styles.bg, color: styles.text, fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}>
      <nav style={{ background: "rgba(14,13,10,0.85)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${styles.border}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: styles.text, fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" style={{ width: 20, height: 20, borderRadius: 4 }} />
            Prospecting<span style={{ color: styles.accent }}>OS</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {ONBOARDING_STEPS.map((s, i) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: 700,
                  background: i <= currentIndex ? styles.accent : styles.input,
                  color: i <= currentIndex ? "#fff" : styles.textTertiary,
                }}>{s.num}</span>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: i <= currentIndex ? styles.text : styles.textTertiary, display: i === currentIndex ? "inline" : "none" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ height: "100%", background: styles.accent, width: `${progress}%`, transition: "width 0.3s ease" }} />
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}>
        {/* Step 1: Welcome */}
        {step === "welcome" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: styles.badgeBg, color: styles.badgeText, fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                <Sparkles size={12} /> Setup Wizard
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px" }}>Let&apos;s Build Your Prospecting Engine</h1>
              <p style={{ color: styles.textSecondary, fontSize: "1rem", margin: 0 }}>3 minutes to set up — start finding qualified leads today.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
              {[
                { icon: Search, title: "AI-Powered Scoring", desc: "Claude scores every lead by ICP fit" },
                { icon: Users, title: "500+ Leads/Month", desc: "Consistent pipeline from day one" },
                { icon: Monitor, title: "Multi-Channel", desc: "LinkedIn + Email + cold outreach" },
              ].map(c => (
                <div key={c.title} style={{ padding: 20, borderRadius: 12, background: styles.card, border: `1px solid ${styles.borderCard}`, textAlign: "center" }}>
                  <c.icon size={24} style={{ color: styles.accent, marginBottom: 10 }} />
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 700, margin: "0 0 4px" }}>{c.title}</h3>
                  <p style={{ fontSize: "0.75rem", color: styles.textSecondary, margin: 0 }}>{c.desc}</p>
                </div>
              ))}
            </div>

            <div style={{ background: styles.card, border: `1px solid ${styles.borderCard}`, borderRadius: 16, padding: 24 }}>
              <label style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: styles.textTertiary, display: "block", marginBottom: 8 }}>
                Your Name
              </label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = styles.accent; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = styles.border; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <button onClick={handleSkip} style={{ background: "none", border: "none", color: styles.textTertiary, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                Skip for now
              </button>
              <button onClick={() => setStep("icp")} style={{ height: 44, padding: "0 24px", borderRadius: 999, border: "none", background: styles.accent, color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                Continue <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: ICP Setup */}
        {step === "icp" && (
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Who are your ideal customers?</h1>
            <p style={{ color: styles.textSecondary, margin: "0 0 32px" }}>This pre-configures your lead filters so you get relevant prospects from day one.</p>

            {[
              { field: "industries" as const, label: "Industries", icon: Building2, options: INDUSTRY_OPTIONS },
              { field: "companySizes" as const, label: "Company Size", icon: Briefcase, options: COMPANY_SIZE_OPTIONS },
              { field: "seniority" as const, label: "Seniority Level", icon: Users, options: SENIORITY_OPTIONS },
              { field: "countries" as const, label: "Target Countries", icon: MapPin, options: COUNTRY_OPTIONS },
            ].map(section => (
              <div key={section.field} style={{ marginBottom: 24 }}>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", fontWeight: 700, marginBottom: 12 }}>
                  <section.icon size={14} style={{ color: styles.accent }} />
                  {section.label}
                  {icp[section.field].length > 0 && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: styles.badgeBg, color: styles.badgeText }}>
                      {icp[section.field].length} selected
                    </span>
                  )}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {section.options.map(opt => {
                    const sel = icp[section.field].includes(opt);
                    return (
                      <button key={opt} onClick={() => toggleIcp(section.field, opt)} style={{
                        padding: "7px 14px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                        background: sel ? styles.accent : "transparent",
                        color: sel ? "#fff" : styles.textSecondary,
                        border: sel ? `1px solid ${styles.accent}` : `1px solid ${styles.border}`,
                        transition: "all 0.15s",
                      }}>{opt}</button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 }}>
              <button onClick={() => setStep("welcome")} style={{ background: "none", border: "none", color: styles.textSecondary, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Back
              </button>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={handleSkip} style={{ background: "none", border: "none", color: styles.textTertiary, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Skip for now
                </button>
                <button onClick={() => setStep("plan")} style={{ height: 44, padding: "0 24px", borderRadius: 999, border: "none", background: styles.accent, color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Plan & Pay */}
        {step === "plan" && (
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Choose Your Plan</h1>
            <p style={{ color: styles.textSecondary, margin: "0 0 32px" }}>Payment via Xflow Pay. Our team will send an invoice and activate your plan within 24 hours.</p>

            <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              {Object.entries(PLANS_DATA).map(([key, plan]) => {
                const sel = selectedPlan === key;
                return (
                  <button key={key} onClick={() => setSelectedPlan(key)} style={{
                    display: "block", width: "100%", textAlign: "left", padding: 24, borderRadius: 16,
                    background: sel ? "rgba(232,66,10,0.04)" : styles.card,
                    border: sel ? `2px solid ${styles.accent}` : `1px solid ${styles.borderCard}`,
                    cursor: "pointer", fontFamily: "inherit", color: styles.text,
                    position: "relative", transition: "all 0.15s",
                  }}>
                    {plan.popular && (
                      <span style={{ position: "absolute", top: -10, right: 20, padding: "3px 12px", borderRadius: 999, background: styles.accent, color: "#fff", fontSize: "0.65rem", fontWeight: 700 }}>
                        MOST POPULAR
                      </span>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                      <div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 2px" }}>{plan.name}</h3>
                        <span style={{ fontSize: "0.75rem", color: styles.textTertiary }}>{plan.interval}</span>
                      </div>
                      <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>{plan.price}<span style={{ fontSize: "0.8rem", color: styles.textTertiary, fontWeight: 400 }}>{plan.interval !== "one-time" ? plan.interval : ""}</span></span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                      {plan.features.map(f => (
                        <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: styles.textSecondary }}>
                          <CheckCircle2 size={12} style={{ color: styles.success, flexShrink: 0 }} /> {f}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: 12 }}>{error}</p>}

            <button onClick={handleCheckout} disabled={loading} style={{
              width: "100%", height: 48, borderRadius: 999, border: "none", background: styles.accent,
              color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: loading ? 0.7 : 1, marginBottom: 16,
            }}>
              {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={16} />}
              {loading ? "Saving..." : "Request Manual Payment"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setStep("icp")} style={{ background: "none", border: "none", color: styles.textSecondary, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleSkip} style={{ background: "none", border: "none", color: styles.textTertiary, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
                Skip for now — start free trial
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
