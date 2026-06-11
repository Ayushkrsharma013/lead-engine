"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Users, MessageSquare, ArrowRight, Clock, Plug } from "lucide-react";
import { StatusBadge } from "@/components/client-portal/StatusBadge";
import { ProgressBar } from "@/components/client-portal/ProgressBar";
import { UpgradeBanner } from "@/components/client-portal/UpgradeBanner";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { StatCard } from "@/components/ui/StatCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import type { PlanKey } from "@/lib/types";

interface LeadStatus {
  status: "pending" | "processing" | "ready" | "failed";
  leadsCount: number;
  planLimit: number;
  icebreakersCount: number;
  generatedAt: string | null;
  icpLocked: boolean;
}

interface WorkspaceData {
  plan: PlanKey;
  connector_config?: Record<string, unknown> | null;
  leads_generation_status?: string;
  leads_count?: number;
  leads_generated_at?: string | null;
  icp_locked?: boolean;
}

export default function ClientPortalDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ plan?: PlanKey; email?: string; display_name?: string; role?: string } | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [leadStatus, setLeadStatus] = useState<LeadStatus | null>(null);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (!meRes.ok) { setLoading(false); return; }
      const me = await meRes.json();
      setProfile(me.profile);
      setWorkspace(me.workspace);

      try {
        const statusRes = await fetch("/prospecting-os/api/leads/status");
        if (statusRes.ok) {
          const s = await statusRes.json();
          const plan = (me.profile?.plan || "pilot") as PlanKey;
          const limits: Record<string, number> = { micro: 50, pilot: 100, growth: 200, scale: 500 };
          setLeadStatus({
            status: s.status || "pending",
            leadsCount: s.leadsCount || 0,
            planLimit: limits[plan] || 50,
            icebreakersCount: s.icebreakersCount || 0,
            generatedAt: s.generatedAt || null,
            icpLocked: s.icpLocked || false,
          });
        }
      } catch {}

      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <PageTransition className="max-w-4xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </PageTransition>
    );
  }

  const plan = profile?.plan || "pilot";
  const connectorCount = workspace?.connector_config ? Object.keys(workspace.connector_config).length : 0;

  return (
    <PageTransition className="max-w-4xl space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <h1 className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>
          Welcome{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
          {plan === "micro" ? "Micro-Offer" : plan === "pilot" ? "Founder's Pilot" : plan === "growth" ? "Growth" : "Scale"} plan
        </p>
      </motion.div>

      {plan === "micro" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <UpgradeBanner currentPlan={plan} message="Upgrade to Founder's Pilot for sequences, integrations & more" targetPlan="pilot" />
        </motion.div>
      )}

      {/* Lead Pipeline Card */}
      <AnimatedCard delay={0.15} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Users size={16} style={{ color: "#E84A0A" }} />
            Lead Pipeline
          </h2>
          {leadStatus && <StatusBadge status={leadStatus.status} />}
        </div>

        {leadStatus ? (
          <>
            <ProgressBar value={leadStatus.leadsCount} max={leadStatus.planLimit} label="Leads Generated" className="mb-5" />
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Leads" value={leadStatus.leadsCount} accent="#E84A0A" />
              <StatCard label="Icebreakers" value={leadStatus.icebreakersCount} icon={MessageSquare} accent="#E84A0A" />
              <StatCard label="Plan Limit" value={leadStatus.planLimit} accent="var(--ink-2)" />
            </div>
            {leadStatus.generatedAt && (
              <div className="flex items-center gap-1.5 mt-5 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                <Clock size={12} style={{ color: "var(--ink-4)" }} />
                <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
                  Last generated: {new Date(leadStatus.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>No leads generated yet</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Complete onboarding or contact support to get started.</p>
          </div>
        )}
      </AnimatedCard>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: "/client-portal/leads", icon: Users, title: "My Leads", desc: "View pipeline" },
          { href: "/client-portal/icebreakers", icon: MessageSquare, title: "Icebreakers", desc: "Outreach ready" },
          {
            href: connectorCount > 0 ? "/client-portal/connectors" : "/client-portal/billing",
            icon: connectorCount > 0 ? Plug : Sparkles,
            title: connectorCount > 0 ? "Connectors" : "Upgrade Plan",
            desc: connectorCount > 0 ? `${connectorCount} active` : "Unlock more",
            accent: connectorCount > 0 ? "#22c55e" : undefined,
          },
        ].map((link, i) => (
          <motion.div
            key={link.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
          >
            <Link
              href={link.href}
              className="rounded-xl p-4 no-underline flex items-center gap-3"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <link.icon size={16} style={{ color: link.accent || "#E84A0A" }} />
              </motion.div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{link.title}</p>
                <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{link.desc}</p>
              </div>
              <motion.div
                className="ml-auto"
                whileHover={{ x: 3 }}
                transition={{ duration: 0.15 }}
              >
                <ArrowRight size={14} style={{ color: "var(--ink-4)" }} />
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </div>
    </PageTransition>
  );
}
