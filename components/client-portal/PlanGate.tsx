"use client";

import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { isModuleAvailable, canAccessPlan, MODULE_LABELS } from "@/lib/plan-modules";
import type { ModuleKey, PlanTier } from "@/lib/plan-modules";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/types";

interface PlanGateProps {
  module?: ModuleKey;
  plan: PlanKey | null;
  children: React.ReactNode;
  role?: string;
  /** Plan tier required to unlock this feature */
  requiredPlan?: PlanKey;
  /** Optional override for the upgrade target name */
  planName?: string;
}

export function PlanGate({
  module,
  plan,
  children,
  role,
  requiredPlan,
  planName,
}: PlanGateProps) {
  // QA agent bypasses all gates
  if (role === "qa_agent" || role === "super_admin") return <>{children}</>;

  // Module-based gating: check if module is in the plan's allowed list
  if (module && !isModuleAvailable(plan as PlanTier, module)) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <div
          className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{
            background: "rgba(232,168,64,0.10)",
            border: "1px solid rgba(232,168,64,0.20)",
          }}
        >
          <Lock size={16} style={{ color: "var(--accent)" }} />
        </div>
        <p className="text-[14px] font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
          {MODULE_LABELS[module]} not available
        </p>
        <p className="text-[12px] mb-4" style={{ color: "var(--ink-3)" }}>
          This feature is not included in your current plan. Upgrade to unlock.
        </p>
        <Link
          href="/client-portal/billing"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all hover:opacity-90"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          View upgrade options <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  // Required plan gating: check if user's plan tier meets the minimum
  if (requiredPlan && !canAccessPlan(plan as PlanTier, requiredPlan as PlanTier)) {
    const target = PLANS[requiredPlan];
    const displayName = planName ?? target?.name ?? requiredPlan;
    const monthlyAmount = target?.monthlyAmount ?? 0;
    const setupAmount = target?.setupAmount ?? 0;

    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <div
          className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{
            background: "rgba(232,168,64,0.10)",
            border: "1px solid rgba(232,168,64,0.20)",
          }}
        >
          <Lock size={16} style={{ color: "var(--accent)" }} />
        </div>
        <p className="text-[14px] font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
          Upgrade to {displayName} to unlock
        </p>
        <p className="text-[12px] mb-1" style={{ color: "var(--ink-3)" }}>
          This feature requires {displayName} or higher.
        </p>
        {target && (
          <p className="text-[11px] mb-4" style={{ color: "var(--ink-4)" }}>
            ${setupAmount.toLocaleString()} setup
            {monthlyAmount > 0 ? ` + $${monthlyAmount.toLocaleString()}/mo` : " (one-time)"}
          </p>
        )}
        <Link
          href="/client-portal/billing"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all hover:opacity-90"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          View upgrade options <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
