"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ArrowRight, Loader2, Shield, ExternalLink, Mail, Clock, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/stripe";
import type { UserProfile, PlanKey } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Checkout / Billing Page — Client-facing payment flow (Xflow Pay)
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

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/prospecting-os/login?redirect=/checkout"); return; }

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!prof) { setLoading(false); return; }
      setProfile(prof as UserProfile);
      setLoading(false);
    }
    init();
  }, []);

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
            <Link href="/dashboard" className="text-[13px] font-medium no-underline" style={{ color: "var(--ink-3, #808080)" }}>Dashboard</Link>
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
                  ${plan.amount.toLocaleString()}
                </span>
                <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                  {plan.interval === "month" ? "/ month" : "one-time"}
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

        {/* Payment instructions — only when pending */}
        <AnimatePresence>
          {isPending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="rounded-2xl p-6" style={{ background: "var(--surface-2, #0E0E0E)", border: "1px solid var(--line)" }}
            >
              <h3 className="flex items-center gap-2 text-[13px] font-semibold mb-4" style={{ color: "var(--ink)" }}>
                <Banknote size={15} style={{ color: "var(--accent, #E8A840)" }} />
                Payment Instructions
              </h3>

              <div className="space-y-3 mb-5">
                <Step num={1} title="Transfer the amount" desc="Send the plan amount to our bank account via ACH / wire." />
                <Step num={2} title="Share the reference" desc="Include the payment reference above in the transfer notes." />
                <Step num={3} title="We activate your plan" desc="Your plan goes live within 24 hours. You'll get a confirmation email." />
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: "rgba(232,168,64,0.06)", border: "1px solid rgba(232,168,64,0.15)" }}>
                <Clock size={15} style={{ color: "var(--accent, #E8A840)" }} />
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>What happens next?</p>
                  <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                    Once you send the payment, our finance team verifies the reference and activates your plan. You'll receive an email confirmation with dashboard access.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5">
                <Link
                  href="/book"
                  className="flex-1 text-center py-3 rounded-full text-[13px] font-semibold no-underline transition-all hover:opacity-90"
                  style={{ background: "var(--accent, #E8A840)", color: "#000" }}
                >
                  Book a Call — Questions? <ArrowRight size={13} className="inline ml-1" />
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

        {/* Active state — quick links */}
        <AnimatePresence>
          {isActive && (
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
                href="/dashboard"
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
