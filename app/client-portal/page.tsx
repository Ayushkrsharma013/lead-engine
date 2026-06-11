"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Flame, MessageSquare, Calendar, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/ui/PageTitle";
import { UpgradeBanner } from "@/components/client-portal/UpgradeBanner";
import type { PlanKey } from "@/lib/types";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface CoreStats { total: number; hot: number; contacted: number; avgScore: number; meetings: number; }
interface RecentLead { id: string; name: string; title: string; company: string; industry: string; score: number; status: string; }
interface Icebreaker { leadName: string; company: string; body: string; }

/* ─── StatCard ──────────────────────────────────────────────────────── */

function StatCard({ label, value, subtext, trend, icon: Icon }: {
  label: string; value: number | string; subtext?: string; trend?: number; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="rounded-2xl p-5 hover:shadow-md transition-shadow"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-bold" style={{ color: "var(--ink-4)" }}>{label}</p>
          <p className="text-[28px] font-bold mt-1 tracking-tight" style={{ color: "var(--ink)" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
          {subtext && <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>{subtext}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: "rgba(232,74,10,0.08)", border: "1px solid rgba(232,74,10,0.12)" }}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3 text-[11px]">
          {trend > 0 ? <TrendingUp size={12} style={{ color: "var(--positive)" }} /> : trend < 0 ? <TrendingDown size={12} style={{ color: "var(--negative)" }} /> : null}
          <span style={{ color: trend > 0 ? "var(--positive)" : trend < 0 ? "var(--negative)" : "var(--ink-3)" }}>{Math.abs(trend)}%</span>
          <span style={{ color: "var(--ink-4)" }}>vs last week</span>
        </div>
      )}
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-3 w-24 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="h-3 w-32 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
        </div>
        <div className="h-10 w-10 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function ClientPortalDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ plan?: PlanKey; email?: string; display_name?: string } | null>(null);
  const [core, setCore] = useState<CoreStats>({ total: 0, hot: 0, contacted: 0, avgScore: 0, meetings: 0 });
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [icebreakers, setIcebreakers] = useState<Icebreaker[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const [meRes, dashRes] = await Promise.all([
          fetch("/prospecting-os/api/client-portal/me"),
          fetch("/prospecting-os/api/client-portal/dashboard"),
        ]);
        if (meRes.ok) { const me = await meRes.json(); setProfile(me.profile); }
        if (dashRes.ok) { const dash = await dashRes.json(); setCore(dash.core || { total: 0, hot: 0, contacted: 0, avgScore: 0, meetings: 0 }); setRecentLeads(dash.recentLeads || []); setIcebreakers(dash.icebreakers || []); }
      } catch {}
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <PageTitle title="Overview" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }

  const plan = profile?.plan || "pilot";
  const ibMap = new Map(icebreakers.map(i => [i.leadName, i.body]));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageTitle title="Overview" description={`${plan === "micro" ? "Micro-Offer" : plan === "pilot" ? "Founder's Pilot" : plan === "growth" ? "Growth" : "Scale"} plan`} />

      {plan === "micro" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-7">
          <UpgradeBanner currentPlan={plan} message="Upgrade to Founder's Pilot for sequences, integrations & more" targetPlan="pilot" />
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard label="Total Leads Generated" value={core.total} subtext={core.total > 0 ? `Avg score ${core.avgScore}` : "No leads yet"} trend={core.total > 0 ? 12 : undefined} icon={Users} />
        <StatCard label="Hot Leads (Score ≥80)" value={core.hot} subtext={core.hot > 0 ? "Ready to reach out" : "Waiting for scores ≥80"} icon={Flame} />
        <StatCard label="Icebreakers Ready" value={icebreakers.length} subtext={icebreakers.length > 0 ? "Personalized messages" : "Generated for hot leads"} icon={MessageSquare} />
        <StatCard label="Meetings Booked" value={core.meetings || 0} subtext={core.meetings > 0 ? "This month" : "Book your first meeting"} icon={Calendar} />
      </motion.div>

      {/* Recent Leads Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Flame size={15} style={{ color: "#E84A0A" }} /> Recent high-score leads
          </h2>
          <Link href="/client-portal/leads" className="text-[12px] font-medium flex items-center gap-1 no-underline transition-opacity hover:opacity-80" style={{ color: "#E84A0A" }}>
            View all leads <ArrowRight size={12} />
          </Link>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {recentLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={40} style={{ color: "var(--ink-4)", opacity: 0.3, margin: "0 auto 12px" }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--ink-3)" }}>No leads generated yet</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>Complete your onboarding or contact support to get started.</p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead style={{ borderBottom: "1px solid var(--line)" }}>
                <tr>
                  {["Name", "Title / Company", "Score", "Icebreaker (preview)"].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLeads.slice(0, 5).map(lead => {
                  const ibText = ibMap.get(lead.name) || "";
                  return (
                    <motion.tr key={lead.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ borderBottom: "1px solid var(--line)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <td className="px-6 py-3.5 text-[13px] font-medium" style={{ color: "var(--ink)" }}>{lead.name || "—"}</td>
                      <td className="px-6 py-3.5 text-[12px]" style={{ color: "var(--ink-3)" }}>{lead.title || "—"}{lead.company ? `, ${lead.company}` : ""}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full"
                          style={{ background: lead.score >= 80 ? "rgba(34,197,94,0.10)" : lead.score >= 60 ? "rgba(232,168,64,0.10)" : "rgba(100,100,120,0.08)", color: lead.score >= 80 ? "var(--positive)" : lead.score >= 60 ? "var(--accent)" : "var(--ink-4)" }}>{lead.score}</span>
                      </td>
                      <td className="px-6 py-3.5 text-[12px] max-w-[320px] truncate" style={{ color: "var(--ink-3)" }}>
                        {ibText ? `"${ibText.slice(0, 120)}${ibText.length > 120 ? "..." : ""}"` : "—"}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
}
