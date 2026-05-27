"use client";

import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { canAccessModule } from "@/lib/plan-gate";
import { PLANS } from "@/lib/stripe";
import type { PlanKey, UserRole } from "@/lib/types";

interface PlanGateProps {
  module: string;
  plan: PlanKey | null;
  children: React.ReactNode;
  role?: UserRole;
  /**
   * Plan tier required to unlock this feature. Must be a valid PlanKey
   * (pilot | growth | scale | micro) so we can pull display name + price
   * from the canonical PLANS object instead of duplicating copy.
   */
  requiredPlan?: PlanKey;
  /**
   * Optional override if the upgrade target isn't a single plan
   * (e.g. "Managed Growth or higher"). Falls back to PLANS[requiredPlan].name.
   */
  planName?: string;
}

export function PlanGate({
  module,
  plan,
  children,
  role,
  requiredPlan = "growth",
  planName,
}: PlanGateProps) {
  if (role === "qa_agent") return <>{children}</>;

  const allowed = canAccessModule(plan, module);
  if (allowed) return <>{children}</>;

  const target = PLANS[requiredPlan];
  const displayName = planName ?? target?.name ?? "a higher";
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

      <p
        className="text-[14px] font-semibold mb-1.5"
        style={{ color: "var(--ink)" }}
      >
        Upgrade to unlock this feature
      </p>
      <p className="text-[12px] mb-1" style={{ color: "var(--ink-3)" }}>
        Available on the {displayName} plan
        {monthlyAmount > 0 ? ` and above` : ""}.
      </p>

      {target ? (
        <p className="text-[11px] mb-4" style={{ color: "var(--ink-4)" }}>
          ${setupAmount.toLocaleString()} setup
          {monthlyAmount > 0
            ? ` + $${monthlyAmount.toLocaleString()}/mo`
            : " (one-time)"}
        </p>
      ) : (
        <div className="mb-4" />
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
