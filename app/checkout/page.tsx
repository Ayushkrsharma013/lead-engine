"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ArrowRight, Loader2, Shield, ExternalLink, Mail, Clock, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/stripe";
import type { UserProfile, PlanKey } from "@/lib/types";
import { trackPayment } from "@/lib/analytics";

/* ═══════════════════════════════════════════════════════════════════════════
   Checkout / Billing Page — Client-facing payment flow
   Wrapped in Suspense for useSearchParams() SSR compatibility.
   ═══════════════════════════════════════════════════════════════════════════ */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 p-2 rounded-lg transition-colors hover:bg-white/[0.05]"
      style={{ color: copied ? "var(--success, #22c55e)" : "var(--text-tertiary, #7a7875)" }}
    >
      <Copy size={15} />
    </button>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [activationPolling, setActivationPolling] = useState(false);
  const [activated, setActivated] = useState(false);

  const justPaid = searchParams.get("paid") === "true";

  useEffect(() => {
    async function init() {
      const res = await fetch("/prospecting-os/api/me");
      if (res.status === 401) {
        router.replace("/prospecting-os/login?redirect=/checkout");
        return;
      }
      if (!res.ok) { setLoading(false); return; }
      const prof = await res.json();
      if (prof?.id) {
        setProfile(prof as UserProfile);
      }
      setLoading(false);
    }
    init();
  }, []);

  // Fire payment-conversion event when arriving back with ?paid=true
  useEffect(() => {
    if (!profile) return;
    if (!justPaid) return;
    const planKey = profile.plan as PlanKey | undefined;
    if (!planKey || !PLANS[planKey as keyof typeof PLANS]) return;
    const plan = PLANS[planKey as keyof typeof PLANS];
    const txnid =
      searchParams.get("txnid") ||
      profile.payment_ref ||
      `manual-${profile.id}`;
    trackPayment({ plan: planKey, amount: plan.setupAmount, txnid });
  }, [profile, justPaid, searchParams]);

  // Phase 3.1 — When user lands with ?paid=true, poll /api/me every 5s (up to 60s)
  // until subscription_status === "active". Webhook flips this on payment confirmation.
  useEffect(() => {
    if (!justPaid) return;
    if (!profile) return;
    if (profile.subscription_status === "active") {
      setActivated(true);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12; // 12 × 5s = 60s
    setActivationPolling(true);

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch("/prospecting-os/api/me");
        if (res.ok) {
          const fresh = await res.json();
          if (fresh?.id) {
            setProfile(fresh as UserProfile);
            if (fresh.subscription_status === "active") {
              setActivated(true);
              setActivationPolling(false);
              return;
            }
          }
        }
      } catch {
        // swallow — try again on next tick
      }
      if (attempts >= maxAttempts) {
        setActivationPolling(false);
        return;
      }
      setTimeout(tick, 5000);
    };

    const t = setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [justPaid, profile?.subscription_status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg, #000)" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent, #E8A840)" }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg, #000)" }}>
        <p style={{ color: "var(--ink-3, #808080)" }}>Unable to load billing info. Contact support.</p>
      </div>
    );
  }

  const plan = profile.plan ? PLANS[profile.plan as keyof typeof PLANS] : null;
  const status = profile.subscription_status;
  const isActive = status === "active";
  const isPending = status === "pending_payment";
  const isCancelled = status === "cancelled";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg, #000)", color: "var(--ink, #EBEBEB)", fontFamily: "'Geist', sans-serif" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", borderColor: "var(--line, rgba(255,255,255,0.06))" }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" className="w-7 h-7 rounded-lg" />
            <span className="font-semibold text-[14px]" style={{ color: "var(--ink)" }}>
              Prospecting<span style={{ color: "var(--accent, #E8A840)" }}>OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="text-[13px] font-medium no-underline" style={{ color: "var(--ink-3, #808080)" }}>Dashboard</Link>
            <Link href="/book" className="text-[13px] font-semibold px-4 py-2 rounded-full no-underline" style={{ background: "var(--accent, #E8A840)", color: "#000" }}>
              Need Help?
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] mb-1">
            {isActive ? "Your Plan" : isPending ? "Complete Your Setup" : "Billing"}
          </h1>
          <p className="text-[13px]" style={{ color: "var(--ink-3, #808080)" }}>
            {isActive ? "Your Prospecting OS subscription is active." : isPending ? "Your plan is selected — finalize payment to activate." : "View your billing status."}
          </p>
        </motion.div>

        {/* Plan card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-2xl p-6" style={{ background: "var(--surface-2, #0E0E0E)", border: "1px solid var(--line, rgba(255,255,255,0.06))" }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Plan Details</h3>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{
                background: isActive ? "rgba(107,203,119,0.10)" : isPending ? "rgba(232,168,64,0.10)" : "rgba(128,128,128,0.08)",
                color: isActive ? "var(--positive, #6BCB77)" : isPending ? "var(--accent, #E8A840)" : "var(--ink-3, #808080)",
                border: `1px solid ${isActive ? "rgba(107,203,119,0.20)" : isPending ? "rgba(232,168,64,0.20)" : "var(--line, rgba(255,255,255,0.06))"}`,
              }}>
              {isActive ? "Active" : isPending ? "Payment Pending" : isCancelled ? "Cancelled" : "No Plan"}
            </span>
          </div>

          {plan ? (
            <>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-[20px] font-bold" style={{ color: "var(--ink)" }}>{plan.name}</span>
                <span className="text-[18px] font-bold" style={{ color: "var(--accent-ink, #F0C060)" }}>
                  ${plan.setupAmount.toLocaleString()}
                </span>
                <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                  {plan.monthlyAmount > 0 ? `+ $${plan.monthlyAmount.toLocaleString()} / month` : "one-time"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {plan.features.slice(0, 6).map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ink-2, #B0B0B0)" }}>
                    <Check size={12} style={{ color: "var(--positive, #6BCB77)" }} /> {f}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[13px] mb-4" style={{ color: "var(--ink-3)" }}>No plan assigned. <Link href="/onboarding" style={{ color: "var(--accent-ink, #F0C060)" }}>Complete onboarding →</Link></p>
          )}

          {profile.payment_ref && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "var(--bg, #000)", border: "1px solid var(--line)" }}>
              <Banknote size={14} style={{ color: "var(--ink-4, #555)" }} />
              <code className="flex-1 text-[12px] font-mono" style={{ color: "var(--ink-2)" }}>{profile.payment_ref}</code>
              <CopyButton text={profile.payment_ref} />
            </div>
          )}

          {profile.subscription_activated_at && (
            <p className="text-[11px] mt-3" style={{ color: "var(--ink-4)" }}>
              Activated: {fmtDate(profile.subscription_activated_at)}
            </p>
          )}
        </motion.div>

        {/* Phase 3.1 — Post-payment activation polling card */}
        <AnimatePresence>
          {justPaid && activationPolling && !activated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="rounded-2xl p-6 text-center"
              style={{ background: "rgba(232,168,64,0.04)", border: "1px solid rgba(232,168,64,0.18)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(232,168,64,0.10)", border: "1px solid rgba(232,168,64,0.20)" }}>
                <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent, #E8A840)" }} />
              </div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--ink)" }}>Activating your account...</p>
              <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                Payment received. We are provisioning your client portal — this usually takes a few seconds.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 3.1 — Micro-offer activation success */}
        <AnimatePresence>
          {justPaid && activated && profile.plan === "micro" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="rounded-2xl p-6 text-center"
              style={{ background: "rgba(107,203,119,0.04)", border: "1px solid rgba(107,203,119,0.20)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(107,203,119,0.10)", border: "1px solid rgba(107,203,119,0.20)" }}>
                <Check size={18} style={{ color: "var(--positive, #6BCB77)" }} />
              </div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--ink)" }}>Your micro-offer is active</p>
              <p className="text-[12px] mb-4" style={{ color: "var(--ink-3)" }}>
                Sign in to your client portal to view your 50 ICP-verified leads. We will email your login credentials within the next minute.
              </p>
              <Link
                href="/client-portal/login"
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-[13px] font-semibold no-underline transition-all"
                style={{ background: "var(--accent, #E8A840)", color: "#000" }}
              >
                Open Client Portal <ArrowRight size={13} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment — only when pending */}
        <AnimatePresence>
          {isPending && !justPaid && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-2, #0E0E0E)", border: "1px solid var(--line)" }}
            >
              <h3 className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                <Banknote size={15} style={{ color: "var(--accent, #E8A840)" }} />
                Complete Your Payment
              </h3>

              {/* Primary: Card Payment */}
              <button
                onClick={async () => {
                  setCardLoading(true);
                  try {
                    const res = await fetch("/prospecting-os/api/payment/create-checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ plan: profile.plan, userId: profile.id, email: profile.email }),
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    } else {
                      setCardLoading(false);
                    }
                  } catch { setCardLoading(false); }
                }}
                disabled={cardLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-[13px] font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--accent, #E8A840)", color: "#000" }}
              >
                {cardLoading ? <Loader2 size={15} className="animate-spin" /> : null}
                Pay with Credit Card
              </button>

              {/* Secondary: Manual ACH/Wire */}
              <details className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                <summary className="cursor-pointer py-1 hover:text-[var(--ink-2)]">Manual Bank Transfer (ACH / Wire)</summary>
                <div className="mt-3 p-4 rounded-xl space-y-2" style={{ background: "var(--bg, #000)", border: "1px solid var(--line)" }}>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "var(--ink-4)" }}>Bank</span>
                    <span style={{ color: "var(--ink-2)" }}>JPMorgan Chase Bank, N.A</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "var(--ink-4)" }}>Account</span>
                    <code className="text-[11px]" style={{ color: "var(--ink-2)" }}>20000045886271</code>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "var(--ink-4)" }}>Routing (ACH)</span>
                    <code className="text-[11px]" style={{ color: "var(--ink-2)" }}>028000024</code>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "var(--ink-4)" }}>Reference</span>
                    <code className="text-[11px]" style={{ color: "var(--ink-2)" }}>{profile.payment_ref}</code>
                  </div>
                  <p className="text-[10px] mt-2" style={{ color: "var(--ink-4)" }}>Include the reference in transfer notes. Activation within 24 hours.</p>
                </div>
              </details>

              <div className="flex items-center gap-3 mt-4">
                <Link
                  href="/book"
                  className="flex-1 text-center py-3 rounded-full text-[13px] font-semibold no-underline transition-all hover:opacity-90"
                  style={{ background: "transparent", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                >
                  Book a Call — Questions?
                </Link>
                <button
                  onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
                  className="text-[12px] font-medium px-4 py-3 rounded-full transition-colors hover:bg-white/[0.04]"
                  style={{ color: "var(--ink-3)", border: "1px solid var(--line)" }}
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active state — quick links (hidden when micro success card is showing) */}
        <AnimatePresence>
          {isActive && !(justPaid && activated && profile.plan === "micro") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="rounded-2xl p-6 text-center" style={{ background: "rgba(107,203,119,0.04)", border: "1px solid rgba(107,203,119,0.12)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(107,203,119,0.10)", border: "1px solid rgba(107,203,119,0.20)" }}>
                <Shield size={18} style={{ color: "var(--positive, #6BCB77)" }} />
              </div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--ink)" }}>Your plan is active</p>
              <p className="text-[12px] mb-4" style={{ color: "var(--ink-3)" }}>
                Start using Prospecting OS — your pipeline is ready.
              </p>
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-[13px] font-semibold no-underline transition-all"
                style={{ background: "var(--accent, #E8A840)", color: "#000" }}
              >
                Go to Dashboard <ArrowRight size={13} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contact info */}
        <p className="text-center text-[11px]" style={{ color: "var(--ink-4)" }}>
          Questions about billing? <Link href="/book" style={{ color: "var(--accent-ink, #F0C060)" }}>Contact us</Link> or email <a href="mailto:billing@flow-forges.com" style={{ color: "var(--accent-ink)" }}>billing@flow-forges.com</a>
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg, #000)" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent, #E8A840)" }} />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

function Step({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
        style={{ background: "var(--accent-soft, rgba(232,168,64,0.12))", color: "var(--accent, #E8A840)", border: "1px solid rgba(232,168,64,0.20)" }}>
        {num}
      </div>
      <div>
        <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{title}</p>
        <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>{desc}</p>
      </div>
    </div>
  );
}
