"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import { ExternalLink, Calendar, Building2, Cloud, Zap, Code2 } from "lucide-react";
import type { PlanKey } from "@/lib/types";

const INTEGRATIONS = [
  { name: "Slack", desc: "Get daily lead digests & alerts in Slack", icon: "/prospecting-os/assets/Logo_Icon.png", href: "/client-portal/slack", available: true, color: "#E84A0A" },
  { name: "Google Calendar", desc: "Sync bookings with your calendar", icon: null, IconComp: Calendar, href: "/client-portal/integrations", available: false, color: "#4285F4" },
  { name: "HubSpot", desc: "Push leads to your CRM", icon: null, IconComp: Building2, href: "/client-portal/crm", available: false, color: "#FF7A59" },
  { name: "Salesforce", desc: "Sync leads and activities", icon: null, IconComp: Cloud, href: "/client-portal/crm", available: false, color: "#00A1E0" },
  { name: "Zapier", desc: "Connect to 5000+ apps via Zapier", icon: null, IconComp: Zap, href: "/client-portal/integrations", available: false, color: "#FF4A00" },
  { name: "API Access", desc: "REST API for custom integrations", icon: null, IconComp: Code2, href: "/client-portal/integrations", available: false, color: "#6b7280" },
];

export default function IntegrationsPage() {
  const [profile, setProfile] = useState<{ plan?: PlanKey; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/prospecting-os/api/client-portal/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setProfile(d.profile); setLoading(false); }).catch(() => setLoading(false)); }, []);
  usePortalHeader({ title: "Integrations", description: "Connect Prospecting OS with your existing tools" });

  return (
    <PlanGate module="integrations" plan={profile?.plan || null} role={profile?.role}>
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTEGRATIONS.map((integ, i) => {
          const Wrapper = integ.available
            ? ({ children }: { children: React.ReactNode }) => (
                <Link href={integ.href} className="no-underline block">{children}</Link>
              )
            : ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
          return (
            <motion.div
              key={integ.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={integ.available ? { scale: 1.02 } : {}}
            >
            <Wrapper>
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                background: "var(--surface)", border: "1px solid var(--line)",
                opacity: integ.available ? 1 : 0.5, cursor: integ.available ? "pointer" : "default",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: integ.available ? `${integ.color}15` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${integ.available ? `${integ.color}30` : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {integ.icon ? (
                  <img src={integ.icon} alt="" className="w-5 h-5" />
                ) : integ.IconComp ? (
                  <integ.IconComp size={18} style={{ color: integ.color }} />
                ) : null}
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
            </div>
            </Wrapper>
            </motion.div>
          );
        })}
        </div>
      </div>
    </PlanGate>
  );
}
