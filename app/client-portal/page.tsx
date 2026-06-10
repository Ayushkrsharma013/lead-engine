"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Users, MessageSquare, ArrowRight, Clock, Plug } from "lucide-react";
import { StatusBadge } from "@/components/client-portal/StatusBadge";
import { ProgressBar } from "@/components/client-portal/ProgressBar";
import { UpgradeBanner } from "@/components/client-portal/UpgradeBanner";
import { CardSkeleton } from "@/components/client-portal/LoadingSkeleton";
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
      <div className="max-w-4xl space-y-4 animate-fade-in">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const plan = profile?.plan || "pilot";
  const connectorCount = workspace?.connector_config ? Object.keys(workspace.connector_config).length : 0;

  return (
    <div className="max-w-4xl space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
          Welcome{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
          {plan === "micro" ? "Micro-Offer" : plan === "pilot" ? "Founder's Pilot" : plan === "growth" ? "Growth" : "Scale"} plan
        </p>
      </div>

      {plan === "micro" && (
        <UpgradeBanner currentPlan={plan} message="Upgrade to Founder's Pilot for sequences, integrations & more" targetPlan="pilot" />
      )}

      {/* Lead Pipeline Card */}
      <div className="rounded-xl p-5 transition-shadow hover:shadow-md" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Users size={16} style={{ color: "var(--accent)" }} />
            Lead Pipeline
          </h2>
          {leadStatus && <StatusBadge status={leadStatus.status} />}
        </div>

        {leadStatus ? (
          <>
            <ProgressBar value={leadStatus.leadsCount} max={leadStatus.planLimit} label="Leads Generated" className="mb-4" />
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[20px] font-bold" style={{ color: "var(--ink)" }}>{leadStatus.leadsCount}</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>Leads</p>
              </div>
              <div className="text-center">
                <p className="text-[20px] font-bold" style={{ color: "var(--ink)" }}>{leadStatus.icebreakersCount}</p>
                <p className="text-[10px] uppercase tracking-wide flex items-center justify-center gap-1" style={{ color: "var(--ink-4)" }}>
                  <MessageSquare size={10} /> Icebreakers
                </p>
              </div>
              <div className="text-center">
                <p className="text-[20px] font-bold" style={{ color: "var(--ink)" }}>{leadStatus.planLimit}</p>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>Plan Limit</p>
              </div>
            </div>
            {leadStatus.generatedAt && (
              <div className="flex items-center gap-1.5 mt-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
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
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/client-portal/leads" className="rounded-xl p-4 no-underline transition-shadow hover:shadow-md flex items-center gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Users size={16} style={{ color: "var(--accent)" }} />
          <div><p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>My Leads</p><p className="text-[11px]" style={{ color: "var(--ink-4)" }}>View pipeline</p></div>
          <ArrowRight size={14} className="ml-auto" style={{ color: "var(--ink-4)" }} />
        </Link>
        <Link href="/client-portal/icebreakers" className="rounded-xl p-4 no-underline transition-shadow hover:shadow-md flex items-center gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <MessageSquare size={16} style={{ color: "var(--accent)" }} />
          <div><p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Icebreakers</p><p className="text-[11px]" style={{ color: "var(--ink-4)" }}>Outreach ready</p></div>
          <ArrowRight size={14} className="ml-auto" style={{ color: "var(--ink-4)" }} />
        </Link>
        <Link href={connectorCount > 0 ? "/client-portal/connectors" : "/client-portal/billing"} className="rounded-xl p-4 no-underline transition-shadow hover:shadow-md flex items-center gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {connectorCount > 0 ? <Plug size={16} style={{ color: "#22c55e" }} /> : <Sparkles size={16} style={{ color: "var(--accent)" }} />}
          <div><p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{connectorCount > 0 ? "Connectors" : "Upgrade Plan"}</p>
            <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>{connectorCount > 0 ? `${connectorCount} active` : "Unlock more"}</p></div>
          <ArrowRight size={14} className="ml-auto" style={{ color: "var(--ink-4)" }} />
        </Link>
      </div>
    </div>
  );
}
