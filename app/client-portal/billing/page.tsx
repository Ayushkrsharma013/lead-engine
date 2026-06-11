"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ArrowRight, CreditCard, TrendingUp, BarChart3, Zap, Clock } from "lucide-react";
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
  { name: "Extra 50 Leads", price: "$297", desc: "One-time. 50 additional ICP-verified leads delivered within 48 hrs.", icon: TrendingUp },
  { name: "Priority Support", price: "$197/mo", desc: "4-hour response SLA. Dedicated Slack channel with delivery team.", icon: Zap },
  { name: "Custom Sequences", price: "$497", desc: "One-time. 3 custom outreach sequences tailored to your niche.", icon: BarChart3 },
];

const CARD = "rounded-xl p-5";
const CARD_STYLE = { background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 20px rgba(0,0,0,0.08)" };

function ProgressBar({ used, total, color = "#E84A0A" }: { used: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
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

  usePortalHeader({ title: "Billing & Plan", description: data ? `${data.profile.planName} · ${data.profile.subscriptionStatus.replace("_", " ")}` : "Loading…" });

  const ck = (data?.profile.plan as PlanKey) || null;
  const cr = rank(ck);
  const isMaxTier = cr >= PLAN_ORDER.length - 1;
  const up = isMaxTier ? [] : PLAN_ORDER.filter(k => rank(k) > cr);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E84A0A] rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl">
      {/* Row 1 — Current Plan + Usage Meter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Plan */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={CARD} style={CARD_STYLE}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
              <CreditCard size={14} style={{ color: "#E84A0A" }} /> Current Plan
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{ background: data?.profile.subscriptionStatus === "active" ? "rgba(107,203,119,0.08)" : "rgba(232,74,10,0.10)", color: data?.profile.subscriptionStatus === "active" ? "var(--positive)" : "#E84A0A" }}>
              {(data?.profile.subscriptionStatus || "none").replace("_", " ")}
            </span>
          </div>
          <p className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>{data?.plan.name}</p>
          <p className="text-[14px] mt-0.5" style={{ color: "var(--ink-2)" }}>
            ${data?.plan.setupAmount.toLocaleString()}{(data?.plan.monthlyAmount ?? 0) > 0 ? ` + $${data?.plan.monthlyAmount?.toLocaleString()}/mo` : " one-time"}
          </p>
          {data?.nextBilling && (
            <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--ink-4)" }}>
              <Clock size={11} /> Next billing: {new Date(data.nextBilling).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          <div className="mt-4 space-y-1.5">
            {data?.plan.features.slice(0, 5).map((f, j) => (
              <div key={j} className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--ink-3)" }}>
                <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--positive)" }} /><span>{f}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Usage Meter */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={CARD} style={CARD_STYLE}>
          <h3 className="text-[13px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <TrendingUp size={14} style={{ color: "#E84A0A" }} /> Lead Quota This Month
          </h3>
          {/* Circular-ish meter */}
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <motion.circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={data?.usage.percentUsed && data.usage.percentUsed >= 90 ? "#ef4444" : "#E84A0A"}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(100, data?.usage.percentUsed || 0) / 100) }}
                  transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1], delay: 0.2 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>{data?.usage.percentUsed || 0}%</span>
              </div>
            </div>
            <div>
              <p className="text-[20px] font-bold" style={{ color: "var(--ink)" }}>{data?.usage.leadsThisMonth?.toLocaleString()} <span className="text-[13px] font-normal" style={{ color: "var(--ink-3)" }}>/ {data?.usage.leadQuota?.toLocaleString()}</span></p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>leads generated this month</p>
              {data?.usage.percentUsed && data.usage.percentUsed >= 80 && (
                <p className="text-[10px] mt-1.5 font-semibold" style={{ color: "#E8A840" }}>⚠️ Approaching limit — consider upgrading</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Row 2 — Plan Limits */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={CARD} style={CARD_STYLE}>
        <h3 className="text-[13px] font-semibold mb-4" style={{ color: "var(--ink)" }}>Plan Limits & Usage</h3>
        <div className="space-y-3">
          {data?.limits.map((l, i) => (
            <div key={l.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium" style={{ color: "var(--ink-3)" }}>{l.label}</span>
                <span className="text-[10px] font-semibold" style={{ color: l.total === 0 ? "var(--ink-4)" : l.used >= l.total ? "#ef4444" : "var(--ink-2)" }}>
                  {l.total === 0 ? "Not included" : `${l.used}/${l.total} ${l.unit}`}
                </span>
              </div>
              <ProgressBar used={l.used} total={l.total} color={i === 0 ? "#E84A0A" : "#6BCB77"} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Row 3 — Billing History + Add-ons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Billing History */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={CARD} style={CARD_STYLE}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>Billing History</h3>
          {data?.transactions && data.transactions.length > 0 ? (
            <div className="space-y-2">
              {data.transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <p className="text-[11px] font-semibold capitalize" style={{ color: "var(--ink)" }}>{t.plan}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-4)" }}>{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold" style={{ color: "var(--ink)" }}>${t.amount.toLocaleString()}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold capitalize" style={{ background: "rgba(107,203,119,0.08)", color: "#6BCB77" }}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] py-4 text-center" style={{ color: "var(--ink-4)" }}>No transactions yet.</p>
          )}
        </motion.div>

        {/* Add-on Services */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Add-on Services</h3>
          {ADDONS.map((addon, i) => (
            <motion.div key={addon.name} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.05 }} whileHover={{ scale: 1.02, background: "rgba(255,255,255,0.05)" }} className={CARD} style={{ ...CARD_STYLE, cursor: "pointer" }}>
              <div className="flex items-start gap-3">
                <addon.icon size={16} style={{ color: "#E84A0A", marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>{addon.name}</p>
                    <span className="text-[11px] font-bold" style={{ color: "#E84A0A" }}>{addon.price}</span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>{addon.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Upgrade Options */}
      {up.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>Upgrade Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {up.map((key, i) => {
              const p = PLANS[key];
              const hl = key === "growth";
              return (
                <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 + i * 0.05 }} whileHover={{ scale: 1.02 }} className={CARD} style={{ ...CARD_STYLE, border: hl ? "1px solid rgba(232,74,10,0.30)" : CARD_STYLE.border }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>{p.name}</p>
                    {hl && <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{ background: "rgba(232,74,10,0.12)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.25)" }}>Recommended</span>}
                  </div>
                  <p className="text-[13px] mb-3" style={{ color: "var(--ink-2)" }}>${p.setupAmount.toLocaleString()}{p.monthlyAmount > 0 ? ` + $${p.monthlyAmount.toLocaleString()}/mo` : " one-time"}</p>
                  <div className="space-y-1 mb-4">
                    {p.features.slice(0, 4).map((f, j) => (
                      <div key={j} className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--ink-3)" }}>
                        <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--positive)" }} /><span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <a href="/book" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold no-underline" style={{ background: hl ? "#E84A0A" : "var(--surface-2)", color: hl ? "#fff" : "var(--ink)", border: hl ? "none" : "1px solid var(--line)" }}>
                    Talk to us <ArrowRight size={12} />
                  </a>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Payment Reference */}
      {data?.profile.paymentRef && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={CARD} style={CARD_STYLE}>
          <h3 className="text-[13px] font-semibold mb-2" style={{ color: "var(--ink)" }}>Payment Reference</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg text-[13px] font-mono" style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>{data.profile.paymentRef}</code>
            <button onClick={copy} className="p-2 rounded-lg transition-colors hover:bg-white/[0.05] cursor-pointer" style={{ color: copied ? "var(--positive)" : "var(--ink-3)", background: "none", border: "none" }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <AnimatePresence>
            {copied && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[11px] mt-1.5" style={{ color: "var(--positive)" }}>Copied!</motion.p>}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
