"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { PlanKey } from "@/lib/types";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  micro: [
    "Single one-off lead drop",
    "Verified emails",
    "Basic ICP scoring",
  ],
  pilot: [
    "100 leads/month",
    "Verified emails + scores",
    "Weekly delivery",
    "Email support",
  ],
  growth: [
    "200+ leads/month",
    "Email + LinkedIn sequences",
    "A/B testing",
    "Bi-weekly strategy calls",
    "Dedicated Slack channel",
  ],
  scale: [
    "500+ leads/month",
    "Multi-touch sequences",
    "Advanced analytics + A/B winners",
    "Weekly strategy calls",
    "CRM sync",
  ],
};

const PLAN_LABEL: Record<PlanKey, string> = {
  micro: "Micro-Offer",
  pilot: "Founder's Pilot",
  growth: "Growth",
  scale: "Scale",
};

interface UpgradeCTAProps {
  currentPlan: PlanKey | null;
  targetPlan: PlanKey;
  ctaHref?: string;
  compact?: boolean;
}

export function UpgradeCTA({ currentPlan, targetPlan, ctaHref = "/book", compact = false }: UpgradeCTAProps) {
  const PLAN_ORDER: PlanKey[] = ["micro", "pilot", "growth", "scale"];
  const currentRank = currentPlan ? PLAN_ORDER.indexOf(currentPlan) : -1;
  const targetRank = PLAN_ORDER.indexOf(targetPlan);

  if (currentRank >= targetRank) return null;

  const features = PLAN_FEATURES[targetPlan];
  const label = PLAN_LABEL[targetPlan];

  return (
    <div
      className={`rounded-xl ${compact ? "p-4" : "p-5"}`}
      style={{
        background: "linear-gradient(135deg, rgba(232,168,64,0.06), rgba(232,168,64,0.02))",
        border: "1px solid rgba(232,168,64,0.15)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>
            Upgrade to {label}
          </p>
          <ul className="space-y-1">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                <CheckCircle2 size={12} style={{ color: "var(--accent)", opacity: 0.5 }} /> {f}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href={ctaHref}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all shrink-0"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Upgrade <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
