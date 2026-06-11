"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ExternalLink, Check, ArrowRight, CreditCard, Sparkles } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import { PageTransition } from "@/components/ui/PageTransition";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import type { UserProfile, PlanKey } from "@/lib/types";

const PLAN_ORDER: PlanKey[] = ["micro", "pilot", "growth", "scale"];

function planRank(plan: PlanKey | null | undefined): number {
  if (!plan) return -1;
  const idx = PLAN_ORDER.indexOf(plan);
  return idx === -1 ? -1 : idx;
}

export default function ClientBillingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleCopyRef = async () => {
    if (!profile?.payment_ref) return;
    await navigator.clipboard.writeText(profile.payment_ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <PageTransition className="max-w-3xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </PageTransition>
    );
  }

  const currentPlanKey = (profile?.plan as PlanKey) || null;
  const currentPlan = currentPlanKey ? PLANS[currentPlanKey] : null;
  const currentRank = planRank(currentPlanKey);
  const upgradeOptions = PLAN_ORDER.filter((key) => planRank(key) > currentRank);

  return (
    <PageTransition className="max-w-3xl space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Billing</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
          Your plan, payment status, and upgrade options
        </p>
      </motion.div>

      {/* Current plan */}
      <AnimatedCard delay={0.1} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <CreditCard size={14} style={{ color: "#E84A0A" }} />
            Current Plan
          </h3>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
            style={{
              background: profile?.subscription_status === "active" ? "rgba(107,203,119,0.08)" : "rgba(232,74,10,0.10)",
              color: profile?.subscription_status === "active" ? "var(--positive)" : "#E84A0A",
            }}
          >
            {(profile?.subscription_status || "none").replace("_", " ")}
          </span>
        </div>

        {currentPlan ? (
          <>
            <p className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>{currentPlan.name}</p>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--ink-2)" }}>
              ${currentPlan.setupAmount.toLocaleString()}
              {currentPlan.monthlyAmount > 0 ? ` + $${currentPlan.monthlyAmount.toLocaleString()}/mo` : " one-time"}
            </p>
            <ul className="mt-4 space-y-1.5">
              {currentPlan.features.map((f, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.04 }}
                  className="text-[11px] flex items-start gap-1.5"
                  style={{ color: "var(--ink-3)" }}
                >
                  <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--positive)" }} />
                  <span>{f}</span>
                </motion.li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            No plan assigned yet. Contact your account manager.
          </p>
        )}
      </AnimatedCard>

      {/* Upgrade options */}
      {upgradeOptions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="space-y-3"
        >
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>
            Upgrade Options
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upgradeOptions.map((key, i) => {
              const plan = PLANS[key];
              const isHighlight = key === "growth";
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.3 }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className="rounded-xl p-5 flex flex-col"
                  style={{
                    background: "var(--surface)",
                    border: isHighlight ? "1px solid rgba(232,74,10,0.30)" : "1px solid var(--line)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>{plan.name}</p>
                    {isHighlight && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-bold"
                        style={{ background: "rgba(232,74,10,0.12)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.25)" }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] mb-3" style={{ color: "var(--ink-2)" }}>
                    ${plan.setupAmount.toLocaleString()}
                    {plan.monthlyAmount > 0 ? ` + $${plan.monthlyAmount.toLocaleString()}/mo` : " one-time"}
                  </p>
                  <ul className="space-y-1 flex-1 mb-4">
                    {plan.features.slice(0, 4).map((f, j) => (
                      <li key={j} className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--ink-3)" }}>
                        <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--positive)" }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/book"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold transition-all hover:opacity-90"
                    style={{
                      background: isHighlight ? "#E84A0A" : "var(--surface-2)",
                      color: isHighlight ? "#fff" : "var(--ink)",
                      border: isHighlight ? "none" : "1px solid var(--line)",
                    }}
                  >
                    Talk to us <ArrowRight size={12} />
                  </a>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Payment reference */}
      {profile?.payment_ref && (
        <AnimatedCard delay={0.3} className="p-5">
          <h3 className="text-[13px] font-semibold mb-2" style={{ color: "var(--ink)" }}>Payment Reference</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg text-[13px] font-mono"
              style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
              {profile.payment_ref}
            </code>
            <button onClick={handleCopyRef}
              className="p-2 rounded-lg transition-colors hover:bg-white/[0.05]"
              style={{ color: copied ? "var(--positive)" : "var(--ink-3)", background: "none", border: "none", cursor: "pointer" }}
              aria-label="Copy payment reference">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <AnimatePresence>
            {copied && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] mt-1.5"
                style={{ color: "var(--positive)" }}
              >
                Copied!
              </motion.p>
            )}
          </AnimatePresence>
        </AnimatedCard>
      )}

      {/* Help */}
      <AnimatedCard delay={0.35} className="p-5 text-center">
        <p className="text-[12px] mb-2" style={{ color: "var(--ink-3)" }}>
          Questions about your plan? Talk to your account manager directly.
        </p>
        <a href="/book"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium no-underline"
          style={{ color: "#E84A0A" }}>
          Book a call <ExternalLink size={12} />
        </a>
      </AnimatedCard>
    </PageTransition>
  );
}
