"use client";

import { canAccessModule } from "@/lib/plan-gate";
import type { PlanKey, UserRole } from "@/lib/types";

interface PlanGateProps {
  module: string;
  plan: PlanKey | null;
  children: React.ReactNode;
  role?: UserRole;
  planName?: string; // for upgrade prompt: which plan unlocks this
}

export function PlanGate({ module, plan, children, role, planName = "Managed Growth" }: PlanGateProps) {
  if (role === "qa_agent") return <>{children}</>;

  const allowed = canAccessModule(plan, module);
  if (allowed) return <>{children}</>;

  return (
    <div className="rounded-xl p-8 text-center"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--ink)" }}>
        Upgrade to unlock this feature
      </p>
      <p className="text-[12px] mb-4" style={{ color: "var(--ink-3)" }}>
        This feature requires the {planName} plan.
      </p>
      <a href="/prospecting-os/client-portal/billing"
        className="text-[13px] font-medium transition-opacity hover:opacity-80"
        style={{ color: "var(--accent-ink)" }}>
        View upgrade options →
      </a>
    </div>
  );
}
