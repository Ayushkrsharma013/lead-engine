"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { PageTransition } from "@/components/ui/PageTransition";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { RefreshCw, Loader2, Database } from "lucide-react";
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

  if (loading) {
    return (
      <PageTransition className="max-w-3xl space-y-4">
        <CardSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CardSkeleton /><CardSkeleton />
        </div>
      </PageTransition>
    );
  }

  return (
    <PlanGate module="crm-sync" plan={profile?.plan || null} role={profile?.role} requiredPlan="growth">
      <PageTransition className="max-w-3xl space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>CRM Sync</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Sync your scored leads with your CRM</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CRM_OPTIONS.map((crm, i) => (
            <motion.div
              key={crm.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
              className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", opacity: 0.6 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <RefreshCw size={16} style={{ color: "var(--ink-4)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{crm.name}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                  style={{ background: "rgba(232,74,10,0.08)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.15)" }}>
                  Coming Soon
                </span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{crm.desc}</p>
            </motion.div>
          ))}
        </div>

        <AnimatedCard delay={0.25} className="p-6 text-center">
          <Database size={36} style={{ color: "var(--ink-4)", margin: "0 auto 12px", opacity: 0.4 }} />
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>CRM integrations are being built</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Contact your account manager for early access or custom integration requests.</p>
        </AnimatedCard>
      </PageTransition>
    </PlanGate>
  );
}
