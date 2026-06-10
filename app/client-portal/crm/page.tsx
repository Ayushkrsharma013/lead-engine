"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { RefreshCw, Loader2 } from "lucide-react";
import type { PlanKey } from "@/lib/types";

const CRM_OPTIONS = [
  { name: "HubSpot", desc: "Two-way lead sync with HubSpot CRM", status: "coming-soon" },
  { name: "Salesforce", desc: "Push scored leads to Salesforce", status: "coming-soon" },
  { name: "Pipedrive", desc: "Create deals from qualified leads", status: "coming-soon" },
  { name: "Zoho CRM", desc: "Sync contacts and activities", status: "coming-soon" },
];

export default function CRMPage() {
  const [profile, setProfile] = useState<{ plan?: PlanKey; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/prospecting-os/api/client-portal/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProfile(d.profile); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <PlanGate module="crm-sync" plan={profile?.plan || null} role={profile?.role} requiredPlan="growth">
      <div className="max-w-3xl space-y-4 animate-fade-in">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>CRM Sync</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Sync your scored leads with your CRM</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CRM_OPTIONS.map(crm => (
            <div key={crm.name} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)", opacity: 0.6 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <RefreshCw size={16} style={{ color: "var(--ink-4)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{crm.name}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                  style={{ background: "rgba(232,168,64,0.08)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.15)" }}>
                  Coming Soon
                </span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{crm.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>CRM integrations are being built</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Contact your account manager for early access or custom integration requests.</p>
        </div>
      </div>
    </PlanGate>
  );
}
