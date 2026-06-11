"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { PageTransition } from "@/components/ui/PageTransition";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Plug, ExternalLink, Loader2 } from "lucide-react";
import type { PlanKey } from "@/lib/types";

const INTEGRATIONS = [
  { name: "Slack", desc: "Get daily lead digests & alerts in Slack", icon: "/prospecting-os/assets/connectors/slack.svg", href: "/client-portal/slack", available: true },
  { name: "Google Calendar", desc: "Sync bookings with your calendar", icon: null, href: "/client-portal/integrations", available: false },
  { name: "HubSpot", desc: "Push leads to your CRM", icon: null, href: "/client-portal/crm", available: false },
  { name: "Salesforce", desc: "Sync leads and activities", icon: null, href: "/client-portal/crm", available: false },
  { name: "Zapier", desc: "Connect to 5000+ apps via Zapier", icon: null, href: "/client-portal/integrations", available: false },
  { name: "API Access", desc: "REST API for custom integrations", icon: null, href: "/client-portal/integrations", available: false },
];

export default function IntegrationsPage() {
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
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </PageTransition>
    );
  }

  return (
    <PlanGate module="integrations" plan={profile?.plan || null} role={profile?.role}>
      <PageTransition className="max-w-3xl space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Integrations</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Connect Prospecting OS with your existing tools</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTEGRATIONS.map((integ, i) => (
            <motion.a
              key={integ.name}
              href={integ.available ? integ.href : undefined}
              onClick={e => { if (!integ.available) e.preventDefault(); }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
              whileHover={integ.available ? { scale: 1.02 } : {}}
              className="rounded-xl p-4 no-underline flex items-start gap-3"
              style={{
                background: "var(--surface)", border: "1px solid var(--line)",
                opacity: integ.available ? 1 : 0.5, cursor: integ.available ? "pointer" : "default",
              }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: integ.available ? "rgba(232,74,10,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${integ.available ? "rgba(232,74,10,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}>
                {integ.icon ? <img src={integ.icon} alt="" className="w-5 h-5" /> : <Plug size={18} style={{ color: "var(--ink-4)" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{integ.name}</span>
                  {integ.available ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>Active</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: "rgba(255,255,255,0.04)", color: "var(--ink-4)" }}>Coming soon</span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>{integ.desc}</p>
              </div>
              {integ.available && <ExternalLink size={12} style={{ color: "var(--ink-4)" }} />}
            </motion.a>
          ))}
        </div>
      </PageTransition>
    </PlanGate>
  );
}
