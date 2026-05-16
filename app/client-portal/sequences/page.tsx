"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

export default function ClientSequencesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PlanGate module="sequences" plan={profile?.plan as PlanKey || null} role={profile?.role} planName="Managed Scale">
      <div className="max-w-5xl space-y-4 animate-fade-in">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Sequences</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Active outreach sequences running for your leads</p>
        </div>

        <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            Active sequences will be displayed here once your account manager launches campaigns for your leads.
          </p>
        </div>
      </div>
    </PlanGate>
  );
}
