"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Flame, MessageSquare, Calendar, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { UpgradeBanner } from "@/components/client-portal/UpgradeBanner";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import type { PlanKey } from "@/lib/types";

interface CoreStats { total: number; hot: number; contacted: number; avgScore: number; meetings: number; }
interface RecentLead { id: string; name: string; title: string; company: string; industry: string; score: number; status: string; }
interface Icebreaker { leadName: string; company: string; body: string; }

function StatCard({ label, value, subtext, trend, icon: Icon }: {
  label: string; value: number | string; subtext?: string; trend?: number; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="rounded-2xl p-5 hover:shadow-md transition-shadow"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-bold" style={{ color: "var(--ink-4)" }}>{label}</p>
          <p className="text-[28px] font-bold mt-1 tracking-tight" style={{ color: "var(--ink)" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
          {subtext && <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>{subtext}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: "rgba(232,74,10,0.08)", border: "1px solid rgba(232,74,10,0.12)" }}><Icon className="w-[18px] h-[18px]" /></div>
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

export default function ClientPortalDashboard() {
  const [profile, setProfile] = useState<{ plan?: PlanKey; display_name?: string } | null>(null);
  const [core, setCore] = useState<CoreStats>({ total: 0, hot: 0, contacted: 0, avgScore: 0, meetings: 0 });
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [icebreakers, setIcebreakers] = useState<Icebreaker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { const [meRes, dashRes] = await Promise.all([fetch("/prospecting-os/api/client-portal/me"), fetch("/prospecting-os/api/client-portal/dashboard")]); if (meRes.ok) setProfile((await meRes.json()).profile); if (dashRes.ok) { const d = await dashRes.json(); setCore(d.core || { total: 0, hot: 0, contacted: 0, avgScore: 0, meetings: 0 }); setRecentLeads(d.recentLeads || []); setIcebreakers(d.icebreakers || []); } } catch {} setLoading(false);
  })(); }, []);

  const plan = profile?.plan || "pilot";
  usePortalHeader({ title: "Overview", description: `${plan === "micro" ? "Micro-Offer" : plan === "pilot" ? "Founder's Pilot" : plan === "growth" ? "Growth" : "Scale"} plan` });

  if (loading) {
    return <div className="p-6 space-y-6">{/* skeleton */}</div>;
  }

  const ibMap = new Map(icebreakers.map(i => [i.leadName, i.body]));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {plan === "micro" && <UpgradeBanner currentPlan={plan} message="Upgrade to Founder's Pilot for sequences, integrations & more" targetPlan="pilot" />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads Generated", value: core.total, subtext: core.total > 0 ? `Avg score ${core.avgScore}` : "No leads yet", trend: core.total > 0 ? 12 : undefined, icon: Users },
          { label: "Hot Leads (Score ≥8.0)", value: core.hot, subtext: core.hot > 0 ? "Ready to reach out" : "Waiting", icon: Flame },
          { label: "Icebreakers Ready", value: icebreakers.length, subtext: icebreakers.length > 0 ? "Personalized messages" : "Generated for hot leads", icon: MessageSquare },
          { label: "Meetings Booked", value: core.meetings || 0, subtext: core.meetings > 0 ? "This month" : "Book your first", icon: Calendar },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.3 }}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}><Flame size={14} style={{ color: "#E84A0A" }} /> Recent high-score leads</h2>
          <Link href="/client-portal/leads" className="text-[11px] font-medium flex items-center gap-1 no-underline" style={{ color: "#E84A0A" }}>View all <ArrowRight size={11} /></Link>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {recentLeads.length === 0 ? (
            <div className="p-10 text-center"><Users size={36} style={{ color: "var(--ink-4)", opacity: 0.3, margin: "0 auto 12px" }} /><p className="text-[13px] font-medium" style={{ color: "var(--ink-3)" }}>No leads generated yet</p></div>
          ) : (
            <table className="min-w-full"><thead style={{ borderBottom: "1px solid var(--line)" }}><tr>{["Name","Title / Company","Score","Icebreaker"].map(h=><th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{color:"var(--ink-4)"}}>{h}</th>)}</tr></thead>
              <tbody>{recentLeads.slice(0,5).map(lead=>{const ib=ibMap.get(lead.name)||"";return(<motion.tr key={lead.id} initial={{opacity:0}} animate={{opacity:1}} style={{borderBottom:"1px solid var(--line)"}} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(237,234,226,0.02)"} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}><td className="px-5 py-3 text-[13px] font-medium" style={{color:"var(--ink)"}}>{lead.name||"—"}</td><td className="px-5 py-3 text-[12px]" style={{color:"var(--ink-3)"}}>{lead.title||"—"}{lead.company?`, ${lead.company}`:""}</td><td className="px-5 py-3"><span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{background:lead.score>=8?"rgba(34,197,94,0.10)":lead.score>=6?"rgba(232,168,64,0.10)":"rgba(100,100,120,0.08)",color:lead.score>=8?"var(--positive)":lead.score>=6?"var(--accent)":"var(--ink-4)"}}>{lead.score}</span></td><td className="px-5 py-3 text-[12px] max-w-[280px] truncate" style={{color:"var(--ink-3)"}}>{ib?`"${ib.slice(0,100)}${ib.length>100?"...":""}"`:"—"}</td></motion.tr>)})}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}
