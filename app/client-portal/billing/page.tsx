"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, ArrowRight, CreditCard, TrendingUp,
  BarChart3, Zap, Clock, Star, AlertTriangle,
} from "lucide-react";
import { PLANS } from "@/lib/stripe";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import type { PlanKey } from "@/lib/types";

const PLAN_ORDER: PlanKey[] = ["micro", "pilot", "growth", "scale"];
const rank = (p: PlanKey | null | undefined) => (p ? PLAN_ORDER.indexOf(p) : -1);

interface BillingData {
  profile: { plan: string; planName: string; subscriptionStatus: string; paymentRef: string | null; memberSince: string | null };
  plan: { key: string; name: string; setupAmount: number; monthlyAmount: number; features: string[]; isOneTime: boolean };
  usage: { leadsThisMonth: number; leadQuota: number; percentUsed: number };
  limits: Array<{ label: string; used: number; total: number; unit: string }>;
  transactions: Array<{ id: string; plan: string; amount: number; date: string; status: string }>;
  nextBilling: string | null;
}

const ADDONS = [
  { name: "Extra 50 Leads", price: "$297", desc: "50 ICP-verified leads within 48 hrs", icon: TrendingUp },
  { name: "Priority Support", price: "$197/mo", desc: "4-hr SLA + dedicated Slack channel", icon: Zap },
  { name: "Custom Sequences", price: "$497", desc: "3 custom outreach sequences", icon: BarChart3 },
];

const CS: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
};

function Bar({ used, total, color = "#E84A0A" }: { used: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.3 }}
        className="h-full rounded-full"
        style={{ background: pct >= 90 ? "#ef4444" : pct >= 70 ? "#E8A840" : color }}
      />
    </div>
  );
}

export default function ClientBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/prospecting-os/api/client-portal/billing");
      if (r.ok) setData(await r.json());
      setLoading(false);
    })();
  }, []);

  const copy = async () => {
    if (!data?.profile.paymentRef) return;
    await navigator.clipboard.writeText(data.profile.paymentRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  usePortalHeader({
    title: "Billing & Plan",
    description: data ? `${data.profile.planName} · ${data.profile.subscriptionStatus.replace("_", " ")}` : "Loading…",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E84A0A] rounded-full"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>Could not load billing info. Please refresh the page.</p>
      </div>
    );
  }

  const ck = (data.profile.plan as PlanKey) || null;
  const cr = rank(ck);
  const nextPlanKey = cr >= 0 && cr < PLAN_ORDER.length - 1 ? PLAN_ORDER[cr + 1] : null;
  const nextPlan = nextPlanKey ? PLANS[nextPlanKey] : null;
  const isMaxTier = !nextPlanKey;
  const pct = data.usage.percentUsed;
  const isActive = data.profile.subscriptionStatus === "active";

  return (
    <div
      className="h-full p-3 lg:p-4 overflow-hidden"
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 10,
      }}
    >
      {/* ── Col 1, Row span 2 — Current Plan ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        className="rounded-xl p-4 flex flex-col min-h-0"
        style={{ ...CS, gridRow: "1 / span 2", gridColumn: "1" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: "var(--ink-3)" }}>
            <CreditCard size={12} style={{ color: "#E84A0A" }} />
            Current Plan
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-semibold capitalize"
            style={{
              background: isActive ? "rgba(107,203,119,0.08)" : "rgba(232,74,10,0.10)",
              color: isActive ? "var(--positive)" : "#E84A0A",
            }}
          >
            {data.profile.subscriptionStatus.replace("_", " ")}
          </span>
        </div>

        {/* Plan name + price */}
        <p className="text-[20px] font-bold leading-tight shrink-0" style={{ color: "var(--ink)" }}>
          {data.plan.name}
        </p>
        <p className="text-[13px] mt-0.5 shrink-0" style={{ color: "var(--ink-2)" }}>
          ${data.plan.setupAmount.toLocaleString()}
          {data.plan.monthlyAmount > 0 ? ` + $${data.plan.monthlyAmount.toLocaleString()}/mo` : " one-time"}
        </p>

        {data.nextBilling && (
          <p className="text-[10px] flex items-center gap-1 mt-1 shrink-0" style={{ color: "var(--ink-4)" }}>
            <Clock size={10} />
            Next billing: {new Date(data.nextBilling).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}

        {/* Divider */}
        <div className="my-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

        {/* Features — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {data.plan.features.map((f, j) => (
            <motion.div
              key={j}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + j * 0.04 }}
              className="text-[11px] flex items-start gap-1.5"
              style={{ color: "var(--ink-3)" }}
            >
              <Check size={10} className="mt-0.5 shrink-0" style={{ color: "var(--positive)" }} />
              <span>{f}</span>
            </motion.div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

        {/* Upgrade strip */}
        <div className="shrink-0">
          {isMaxTier ? (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-4)" }}>
              <Star size={11} style={{ color: "#E8A840" }} />
              You&apos;re on our highest plan
            </div>
          ) : nextPlan ? (
            <div>
              <p className="text-[10px] mb-1.5" style={{ color: "var(--ink-4)" }}>
                Next tier: <span style={{ color: "var(--ink-2)" }}>{nextPlan.name}</span>
                {" · "}${nextPlan.setupAmount.toLocaleString()}
                {nextPlan.monthlyAmount > 0 ? ` + $${nextPlan.monthlyAmount.toLocaleString()}/mo` : " one-time"}
              </p>
              <a
                href="/book"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold no-underline w-full justify-center transition-opacity hover:opacity-80"
                style={{ background: "rgba(232,74,10,0.12)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.25)" }}
              >
                Talk to us <ArrowRight size={11} />
              </a>
            </div>
          ) : null}
        </div>

        {/* Payment reference */}
        {data.profile.paymentRef && (
          <div className="mt-3 shrink-0">
            <p className="text-[10px] mb-1" style={{ color: "var(--ink-4)" }}>Payment Reference</p>
            <div className="flex items-center gap-1.5">
              <code
                className="flex-1 px-2 py-1 rounded text-[10px] font-mono truncate"
                style={{ background: "var(--bg)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--ink-3)" }}
              >
                {data.profile.paymentRef}
              </code>
              <button
                onClick={copy}
                className="p-1.5 rounded cursor-pointer"
                style={{ color: copied ? "var(--positive)" : "var(--ink-4)", background: "none", border: "none" }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
            <AnimatePresence>
              {copied && (
                <motion.p
                  initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-[9px] mt-0.5"
                  style={{ color: "var(--positive)" }}
                >
                  Copied!
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* ── Col 2, Row 1 — Lead Quota ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="rounded-xl p-4 flex flex-col min-h-0"
        style={{ ...CS, gridRow: "1", gridColumn: "2" }}
      >
        <h3 className="text-[11px] font-semibold mb-3 flex items-center gap-1.5 shrink-0" style={{ color: "var(--ink-3)" }}>
          <TrendingUp size={12} style={{ color: "#E84A0A" }} />
          Lead Quota — This Month
        </h3>
        <div className="flex items-center gap-4 flex-1 min-h-0">
          {/* Circular meter */}
          <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
              <motion.circle
                cx="40" cy="40" r="34" fill="none"
                stroke={pct >= 90 ? "#ef4444" : "#E84A0A"}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(100, pct) / 100) }}
                transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1], delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>{pct}%</span>
            </div>
          </div>
          <div>
            <p className="text-[24px] font-bold leading-none" style={{ color: "var(--ink)" }}>
              {data.usage.leadsThisMonth.toLocaleString()}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>
              / {data.usage.leadQuota.toLocaleString()} leads
            </p>
            {pct >= 80 && (
              <p className="text-[9px] mt-2 flex items-center gap-1 font-semibold" style={{ color: "#E8A840" }}>
                <AlertTriangle size={9} /> Approaching limit
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Col 3, Row 1 — Billing History ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="rounded-xl p-4 flex flex-col min-h-0"
        style={{ ...CS, gridRow: "1", gridColumn: "3" }}
      >
        <h3 className="text-[11px] font-semibold mb-3 shrink-0" style={{ color: "var(--ink-3)" }}>
          Billing History
        </h3>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {data.transactions.length > 0 ? (
            <div className="space-y-0">
              {data.transactions.slice(0, 6).map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: i < data.transactions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                >
                  <div>
                    <p className="text-[11px] font-semibold capitalize" style={{ color: "var(--ink)" }}>{t.plan}</p>
                    <p className="text-[9px]" style={{ color: "var(--ink-4)" }}>
                      {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold" style={{ color: "var(--ink)" }}>${t.amount.toLocaleString()}</p>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize"
                      style={{ background: "rgba(107,203,119,0.08)", color: "#6BCB77" }}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>No transactions yet.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Col 2, Row 2 — Plan Limits ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
        className="rounded-xl p-4 flex flex-col min-h-0"
        style={{ ...CS, gridRow: "2", gridColumn: "2" }}
      >
        <h3 className="text-[11px] font-semibold mb-3 shrink-0" style={{ color: "var(--ink-3)" }}>
          Plan Limits
        </h3>
        <div className="flex-1 min-h-0 flex flex-col justify-between">
          {data.limits.map((l, i) => (
            <div key={l.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium" style={{ color: "var(--ink-3)" }}>{l.label}</span>
                <span
                  className="text-[9px] font-semibold"
                  style={{ color: l.total === 0 ? "var(--ink-4)" : l.used >= l.total ? "#ef4444" : "var(--ink-3)" }}
                >
                  {l.total === 0 ? "Not included" : `${l.used}/${l.total}`}
                </span>
              </div>
              <Bar used={l.used} total={l.total} color={i === 0 ? "#E84A0A" : "#6BCB77"} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Col 3, Row 2 — Add-on Services ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-xl p-4 flex flex-col min-h-0"
        style={{ ...CS, gridRow: "2", gridColumn: "3" }}
      >
        <h3 className="text-[11px] font-semibold mb-3 shrink-0" style={{ color: "var(--ink-3)" }}>
          Add-on Services
        </h3>
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-2">
          {ADDONS.map((addon, i) => (
            <motion.div
              key={addon.name}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.24 + i * 0.05 }}
              whileHover={{ background: "rgba(255,255,255,0.04)", scale: 1.01 }}
              className="flex-1 rounded-lg px-3 py-2 cursor-pointer flex items-center gap-2.5"
              style={{ border: "1px solid rgba(255,255,255,0.05)", minHeight: 0 }}
            >
              <addon.icon size={13} style={{ color: "#E84A0A", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold" style={{ color: "var(--ink)" }}>{addon.name}</p>
                <p className="text-[9px] truncate" style={{ color: "var(--ink-4)" }}>{addon.desc}</p>
              </div>
              <span className="text-[10px] font-bold shrink-0" style={{ color: "#E84A0A" }}>{addon.price}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
