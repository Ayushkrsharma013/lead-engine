"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageTitle } from "@/components/ui/PageTitle";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { RefreshCw, Database } from "lucide-react";
import type { PlanKey } from "@/lib/types";

const CRM_OPTIONS = [
  { name: "HubSpot", desc: "Two-way lead sync with HubSpot CRM", status: "coming-soon" },
  { name: "Salesforce", desc: "Push scored leads to Salesforce", status: "coming-soon" },
  { name: "Pipedrive", desc: "Create deals from qualified leads", status: "coming-soon" },
  { name: "Zoho CRM", desc: "Sync contacts and activities", status: "coming-soon" },
];

export default function CRMPage() {
  const [profile, setProfile] = useState<{ plan?: PlanKey; role?: string } | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/prospecting-os/api/client-portal/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setProfile(d.profile); setLoading(false); }).catch(() => setLoading(false)); }, []);

  return (
    <PlanGate module="crm-sync" plan={profile?.plan || null} role={profile?.role} requiredPlan="growth">
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <PageTitle title="CRM Sync" description="Sync your scored leads with your CRM" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {CRM_OPTIONS.map((crm, i) => (
            <motion.div key={crm.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)", opacity: 0.6 }}>
              <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2.5"><RefreshCw size={16} style={{ color: "var(--ink-4)" }} /><span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{crm.name}</span></div><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: "rgba(232,74,10,0.08)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.15)" }}>Coming Soon</span></div>
              <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{crm.desc}</p>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Database size={36} style={{ color: "var(--ink-4)", opacity: 0.3, margin: "0 auto 12px" }} />
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>CRM integrations are being built</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Contact your account manager for early access or custom integration requests.</p>
        </motion.div>
      </div>
    </PlanGate>
  );
}
