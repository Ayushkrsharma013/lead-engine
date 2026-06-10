"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

interface UpgradeBannerProps {
  currentPlan: string;
  message?: string;
  targetPlan?: string;
}

export function UpgradeBanner({ currentPlan, message, targetPlan = "pilot" }: UpgradeBannerProps) {
  if (currentPlan === "scale") return null; // Already top tier

  return (
    <div
      className="rounded-xl p-5 flex items-center justify-between gap-4"
      style={{
        background: "linear-gradient(135deg, rgba(232,168,64,0.08), rgba(232,66,10,0.04))",
        border: "1px solid rgba(232,168,64,0.15)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(232,168,64,0.15)" }}
        >
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            {message || `Unlock more features with ${targetPlan === "pilot" ? "Founder's Pilot" : targetPlan}`}
          </p>
          <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            Currently on {currentPlan === "micro" ? "Micro-Offer" : currentPlan} plan
          </p>
        </div>
      </div>
      <Link
        href="/client-portal/billing"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold shrink-0 no-underline transition-all hover:opacity-90"
        style={{ background: "var(--accent)", color: "#000" }}
      >
        Upgrade <ArrowRight size={12} />
      </Link>
    </div>
  );
}
