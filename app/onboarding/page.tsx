"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap, ArrowRight, ArrowLeft, CheckCircle2, Search, Monitor, Code, Compass,
  Building2, Users, MapPin, Key, Sparkles, Loader2, CreditCard, Briefcase, X,
} from "lucide-react";
import {
  type OnboardingStep, ONBOARDING_STEPS,
  INDUSTRY_OPTIONS, COMPANY_SIZE_OPTIONS, SENIORITY_OPTIONS, COUNTRY_OPTIONS,
  type IcpPreferences,
} from "@/lib/onboarding";

// Keep in sync with lib/stripe.ts PLANS
const PLANS_DATA: Record<string, { name: string; price: string; interval: string; features: string[]; popular?: boolean; enterprise?: boolean }> = {
  pilot: {
    name: "Founder's Pilot", price: "$1,499", interval: "setup + $499/mo",
    features: ["100 ICP-verified leads/month", "3 outreach sequences", "Kanban pipeline", "Monthly strategy call", "Apify + Claude AI scoring", "Supabase dashboard", "Founder-managed delivery"],
  },
  growth: {
    name: "Growth", price: "$2,499", interval: "setup + $999/mo", popular: true,
    features: ["Everything in Pilot", "200+ leads/month", "Email + LinkedIn sequences", "A/B testing", "Bi-weekly calls", "Dedicated Slack channel", "Reply monitoring & handoff"],
  },
  scale: {
    name: "Scale", price: "$4,999", interval: "setup + $1,999/mo", enterprise: true,
    features: ["Everything in Growth", "500+ leads/month", "Email + LinkedIn + GMap multi-channel", "A/B testing of 5 variants", "Weekly strategy calls", "Dedicated Slack + Telegram", "CRM sync (HubSpot/Salesforce)", "Priority support within 4 hrs"],
  },
  micro: {
    name: "Micro-Offer", price: "$997", interval: "one-time",
    features: ["50 ICP-verified leads", "5 outreach sequences", "CSV delivery", "30-min ICP call", "Delivery in 5 business days"],
  },
};

// Confetti overlay — CSS-based animation like booking confirmation
const CONFETTI_COLORS = ["#e8420a", "#ff6b35", "#ffd700", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316"];
const φ = 1.6180339887;
const CONFETTI_PIECES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: (i * φ * 100) % 100,
  delay: (i * 0.0416) % 2.5,
  duration: 2.5 + (i * 0.0333) % 2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  width: 6 + (i % 8),
  height: 8 + (i % 7),
}));

function ConfettiOverlay() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
      <style>{`
        @keyframes confetti-fall-onboarding {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {CONFETTI_PIECES.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: 2,
            animation: `confetti-fall-onboarding ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0e0d0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "#e8420a" }} />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [name, setName] = useState("");
  const [icp, setIcp] = useState<IcpPreferences>({ industries: [], companySizes: [], seniority: [], countries: [] });
  const [selectedPlan, setSelectedPlan] = useState("pilot");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Token-based access (no auth required)
  const token = searchParams.get("token");
  const [tokenData, setTokenData] = useState<{
    name: string; email: string; company: string; plan: string;
  } | null>(null);
  const [tokenLoading, setTokenLoading] = useState(!!token);
  const [countdown, setCountdown] = useState(3);

  // Fetch appointment data by token
  useEffect(() => {
    if (!token) return;
    setTokenLoading(true);
    fetch(`/prospecting-os/api/appointments?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          setTokenLoading(false);
          return;
        }
        setTokenData({
          name: data.name || "",
          email: data.email || "",
          company: data.company || "",
          plan: data.plan || "pilot",
        });
        setSelectedPlan(data.plan || "pilot");
        setName(data.name || "");
        setTokenLoading(false);
      })
      .catch(() => {
        setError("Failed to verify onboarding link. Please contact support.");
        setTokenLoading(false);
      });
  }, [token]);

  // Countdown + redirect after confirmation
  useEffect(() => {
    if (step !== "confirmation") return;
    setCountdown(3);
    const interval = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    const timeout = setTimeout(() => {
      router.push("/client-portal");
    }, 3000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [step, router]);

  // Detect plan from URL params (e.g., ?plan=micro or ?plan=pilot)
  useEffect(() => {
    if (token) return; // token takes precedence
    const planParam = searchParams.get("plan");
    if (planParam && PLANS_DATA[planParam]) {
      setSelectedPlan(planParam);
      // For micro: skip welcome step, go straight to ICP
      if (planParam === "micro") {
        setStep("icp");
      }
    }
  }, [searchParams, token]);

  // Fetch name automatically — token flow from appointment, auth flow from profile
  useEffect(() => {
    if (token) return; // name already fetched via tokenData in the token useEffect
    fetch("/prospecting-os/api/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.display_name) setName(data.display_name);
        else if (data?.email) setName(data.email.split("@")[0].replace(/[^a-zA-Z]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
        else if (data?.full_name) setName(data.full_name);
      })
      .catch(() => {});
  }, [token]);

  // Name is valid if non-empty (auto-populated in both flows)

  const currentIndex = ONBOARDING_STEPS.findIndex(s => s.key === step);
  const progress = ((currentIndex + 1) / ONBOARDING_STEPS.length) * 100;

  // ICP validation: ALL 4 fields required before continuing
  const icpIsValid =
    icp.industries.length > 0 &&
    icp.companySizes.length > 0 &&
    icp.seniority.length > 0 &&
    icp.countries.length > 0;

  // Human-readable hint for what's still missing
  const icpMissing: string[] = [];
  if (icp.industries.length === 0) icpMissing.push("Industries");
  if (icp.companySizes.length === 0) icpMissing.push("Company Size");
  if (icp.seniority.length === 0) icpMissing.push("Seniority");
  if (icp.countries.length === 0) icpMissing.push("Countries");
  const icpHint = icpMissing.length > 0
    ? `Select ${icpMissing.join(", ")} to continue`
    : "";

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
      // Token-based flow: save ICP to appointment, go to confirmation
      if (token && tokenData) {
        const saveRes = await fetch("/prospecting-os/api/onboarding/token-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            icp,
            plan: selectedPlan,
          }),
        });
        const saveData = (await saveRes.json()) as { ok?: boolean; error?: string };
        if (!saveData.ok) {
          setError(saveData.error || "Failed to save. Please try again.");
          setLoading(false);
          return;
        }

        // Go to payment
        if (selectedPlan === "micro") {
          try {
            const ckRes = await fetch("/prospecting-os/api/payment/create-checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan: "micro",
                email: tokenData.email,
                name: tokenData.name,
              }),
            });
            const ck = (await ckRes.json()) as { url?: string; method?: string };
            if (ck.url) { window.location.href = ck.url; return; }
          } catch {}
        }

        // For non-micro or fallback: show confirmation directly
        setStep("confirmation");
        setLoading(false);
        return;
      }

      // Auth-based flow (existing)
      // 1) Save onboarding data + mark pending_payment so reconciliation works
      const saveRes = await fetch("/prospecting-os/api/onboarding/save", {
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
      const saveData = (await saveRes.json()) as { ok?: boolean; error?: string };
      if (!saveData.ok) {
        setError(saveData.error || "Failed to save. Please try again.");
        setLoading(false);
        return;
      }

      // 2) Micro fast-path: skip the /checkout review screen; create the
      //    payment intent immediately and bounce the user to the gateway.
      //    All other plans go to /checkout for the existing review UI.
      if (selectedPlan === "micro") {
        try {
          const meRes = await fetch("/prospecting-os/api/me");
          const me = meRes.ok ? await meRes.json() : null;

          const ckRes = await fetch("/prospecting-os/api/payment/create-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan: "micro",
              userId: me?.id,
              email: me?.email,
            }),
          });
          const ck = (await ckRes.json()) as { url?: string; method?: string };

          if (ck.url) {
            window.location.href = ck.url;
            return;
          }
          // No gateway URL configured — fall through to /checkout for manual flow
          router.push("/checkout");
          return;
        } catch {
          router.push("/checkout");
          return;
        }
      }

      // Standard path
      router.push("/checkout");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
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

  // ─── Token loading state ──────────────────────────────────────────────
  if (token && tokenLoading) {
    return (
      <div style={{ minHeight: "100vh", background: styles.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: styles.accent, margin: "0 auto 12px" }} />
          <p style={{ color: styles.textSecondary, fontSize: "0.9rem" }}>Verifying your setup link...</p>
        </div>
      </div>
    );
  }

  // ─── Token error state ─────────────────────────────────────────────────
  if (token && error && !tokenData) {
    return (
      <div style={{ minHeight: "100vh", background: styles.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: "0 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <X size={24} style={{ color: "#ef4444" }} />
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px", color: styles.text }}>Invalid Link</h2>
          <p style={{ color: styles.textSecondary, fontSize: "0.85rem", margin: "0 0 16px" }}>{error}</p>
          <Link href="/" style={{ color: styles.accent, textDecoration: "none", fontWeight: 600 }}>Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: styles.bg, color: styles.text, fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}>
      {/* Confetti overlay for confirmation step */}
      {step === "confirmation" && <ConfettiOverlay />}

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
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease forwards;
          }
        `}</style>

        {/* Step counter */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{
            display: "inline-block", padding: "4px 14px", borderRadius: 999,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${styles.border}`,
            fontSize: "0.7rem", fontWeight: 600, color: styles.textTertiary,
            letterSpacing: "0.04em",
          }}>
            Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
          </span>
        </div>

        {/* Step 1: Welcome */}
        {step === "welcome" && (
          <div className="animate-fadeIn">
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: styles.badgeBg, color: styles.badgeText, fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                <Sparkles size={12} /> Setup Wizard
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px" }}>
                {token && tokenData
                  ? `Welcome${tokenData.name ? `, ${tokenData.name.split(" ")[0]}` : ""}!`
                  : "Let's Build Your Prospecting Engine"}
              </h1>
              <p style={{ color: styles.textSecondary, fontSize: "1rem", margin: 0 }}>
                {token && tokenData
                  ? `Your ${PLANS_DATA[tokenData.plan]?.name || tokenData.plan} setup is ready. Complete in 3 minutes.`
                  : "3 minutes to set up — start finding qualified leads today."}
              </p>
            </div>

            {token && tokenData && (
              <div style={{ background: "rgba(232,66,10,0.06)", border: "1px solid rgba(232,66,10,0.15)", borderRadius: 16, padding: 24, marginBottom: 24, textAlign: "center" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px" }}>{PLANS_DATA[tokenData.plan]?.name || tokenData.plan}</h3>
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: styles.accent }}>{PLANS_DATA[tokenData.plan]?.price || ""}</span>
                <span style={{ fontSize: "0.75rem", color: styles.textTertiary, marginLeft: 4 }}>{PLANS_DATA[tokenData.plan]?.interval || ""}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 16, textAlign: "left" }}>
                  {(PLANS_DATA[tokenData.plan]?.features || []).map((f: string) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: styles.textSecondary }}>
                      <CheckCircle2 size={12} style={{ color: styles.success, flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Name display — auto-populated, always shown */}
            <div style={{ background: styles.card, border: `1px solid ${styles.borderCard}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <label style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: styles.textTertiary, display: "block", marginBottom: 8 }}>
                Your Name
              </label>
              {name ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: styles.text }}>
                    {name}
                  </span>
                  <CheckCircle2 size={16} style={{ color: styles.success }} />
                  <span style={{ fontSize: "0.7rem", color: styles.success, fontWeight: 600 }}>
                    {token ? "From your booking" : "From your profile"}
                  </span>
                </div>
              ) : (
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name"
                  className="w-full h-[44px] px-4 rounded-xl text-sm outline-none bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-[#f5f4f1] font-[inherit] box-border transition-all focus:border-[#e8420a] focus:shadow-[0_0_0_3px_rgba(232,66,10,0.08)]"
                />
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 24 }}>
              <button
                onClick={() => setStep("icp")}
                disabled={!name.trim()}
                title={!name.trim() ? "Enter your name to continue" : ""}
                style={{
                  height: 44, padding: "0 24px", borderRadius: 999, border: "none",
                  background: name.trim() ? styles.accent : "rgba(255,255,255,0.06)",
                  color: name.trim() ? "#fff" : "rgba(255,255,255,0.25)",
                  fontWeight: 600, fontSize: "0.875rem",
                  cursor: name.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                  transition: "all 0.2s",
                }}>
                {name.trim() ? <>Continue <ArrowRight size={14} /></> : <>Enter Name to Continue <ArrowRight size={14} /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: ICP Setup */}
        {step === "icp" && (
          <div className="animate-fadeIn">
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
              <button
                onClick={() => setStep("plan")}
                disabled={!icpIsValid}
                title={icpHint}
                style={{
                  height: 44, padding: "0 24px", borderRadius: 999, border: "none",
                  background: icpIsValid ? styles.accent : "rgba(255,255,255,0.06)",
                  color: icpIsValid ? "#fff" : "rgba(255,255,255,0.25)",
                  fontWeight: 600, fontSize: "0.875rem", cursor: icpIsValid ? "pointer" : "not-allowed",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                  transition: "all 0.2s",
                }}>
                {icpIsValid ? <>Continue <ArrowRight size={14} /></> : <>Fill All Fields <ArrowRight size={14} /></>}
              </button>
              {!icpIsValid && icpMissing.length > 0 && (
                <p style={{ textAlign: "right", marginTop: 8, fontSize: "0.7rem", color: styles.textTertiary }}>
                  {icpHint}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Plan & Pay */}
        {step === "plan" && (
          <div className="animate-fadeIn">
            {token ? (
              /* ─── Token flow: plan locked, payment only ─── */
              <>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Complete Your Setup</h1>
                <p style={{ color: styles.textSecondary, margin: "0 0 32px" }}>
                  {selectedPlan === "micro"
                    ? "Pay $997 once. 50 ICP-verified leads delivered within 5 business days."
                    : `Your ${PLANS_DATA[selectedPlan]?.name || selectedPlan} plan is ready. Complete payment to activate.`}
                </p>

                {/* Locked plan display */}
                <div style={{ background: styles.card, border: `2px solid ${styles.accent}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 2px" }}>{PLANS_DATA[selectedPlan]?.name || selectedPlan}</h3>
                      <span style={{ fontSize: "0.75rem", color: styles.textTertiary }}>{PLANS_DATA[selectedPlan]?.interval || ""}</span>
                    </div>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>{PLANS_DATA[selectedPlan]?.price || ""}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                    {(PLANS_DATA[selectedPlan]?.features || []).map((f: string) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: styles.textSecondary }}>
                        <CheckCircle2 size={12} style={{ color: styles.success, flexShrink: 0 }} /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* ─── Auth flow: plan selection ─── */
              <>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Choose Your Plan</h1>
                <p style={{ color: styles.textSecondary, margin: "0 0 32px" }}>
                  {selectedPlan === "micro"
                    ? "Pay $997 once. 50 ICP-verified leads delivered within 5 business days."
                    : "Payment via Xflow Pay. Our team will send an invoice and activate your plan within 24 hours."}
                </p>

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
                        {plan.enterprise && (
                          <span style={{ position: "absolute", top: -10, right: 20, padding: "3px 12px", borderRadius: 999, background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)", fontSize: "0.65rem", fontWeight: 700 }}>
                            ENTERPRISE
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
              </>
            )}

            {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: 12 }}>{error}</p>}

            <button onClick={handleCheckout} disabled={loading} style={{
              width: "100%", height: 48, borderRadius: 999, border: "none", background: styles.accent,
              color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: loading ? 0.7 : 1, marginBottom: 16,
            }}>
              {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={16} />}
              {loading
                ? "Saving..."
                : selectedPlan === "micro"
                  ? "Pay $997 — Get 50 Leads in 5 Days"
                  : "Complete Setup"}
            </button>

            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
              <button onClick={() => setStep("icp")} style={{ background: "none", border: "none", color: styles.textSecondary, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Back
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === "confirmation" && (
          <div className="animate-fadeIn" style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(34,197,94,0.08)", border: "2px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <CheckCircle2 size={40} style={{ color: styles.success }} />
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px" }}>You&apos;re All Set!</h1>
            <p style={{ color: styles.textSecondary, fontSize: "1rem", maxWidth: 400, margin: "0 auto 32px" }}>
              Your dashboard is being prepared! Redirecting you to your portal...
            </p>

            {/* Countdown bar */}
            <p style={{ fontSize: "0.85rem", color: styles.textTertiary, marginBottom: 8 }}>
              Redirecting in <span style={{ color: styles.accent, fontWeight: 700 }}>{countdown}</span>s...
            </p>
            <div style={{ width: 200, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 999, margin: "0 auto 32px" }}>
              <div style={{
                height: "100%", borderRadius: 999,
                background: styles.accent,
                width: `${((3 - countdown) / 3) * 100}%`,
                transition: "width 1s linear",
              }} />
            </div>

            <Link
              href={token ? "/client-portal/login" : "/client-portal"}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold no-underline transition-all"
              style={{ background: styles.accent, color: "#fff", boxShadow: "0 0 24px rgba(232,66,10,0.3)" }}
            >
              Go to Client Portal <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
