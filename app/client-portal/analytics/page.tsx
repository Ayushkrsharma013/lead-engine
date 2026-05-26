"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

export default function ClientAnalyticsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leads, setLeads] = useState<Array<{ score: number; status?: string; industry?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
      }
      const leadsRes = await fetch("/prospecting-os/api/client-portal/leads?limit=1000");
      if (leadsRes.ok) {
        const d = await leadsRes.json();
        setLeads(d.leads || []);
      }
      setLoading(false);
    }
    init();
  }, []);

  const total = leads.length;
  const byStatus: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  for (const l of leads) {
    const s = l.status || "new";
    byStatus[s] = (byStatus[s] || 0) + 1;
    const ind = l.industry || "Unknown";
    byIndustry[ind] = (byIndustry[ind] || 0) + 1;
  }

  const topIndustries = Object.entries(byIndustry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const maxIndustryCount = topIndustries.length > 0 ? topIndustries[0][1] : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PlanGate module="analytics" plan={profile?.plan as PlanKey || null} role={profile?.role} planName="Growth">
      <div className="max-w-5xl space-y-5 animate-fade-in">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Analytics</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Lead volume and score analysis</p>
        </div>

        {/* Status breakdown */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: "var(--ink-4)" }}>Lead Status Breakdown</h3>
          <div className="grid grid-cols-5 gap-3">
            {["new", "contacted", "replied", "won", "lost"].map(status => (
              <div key={status} className="text-center">
                <div className="text-[20px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                  {byStatus[status] || 0}
                </div>
                <div className="text-[10px] font-medium capitalize mt-1" style={{ color: "var(--ink-4)" }}>{status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Industry bars */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: "var(--ink-4)" }}>Top Industries</h3>
          {topIndustries.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>No data yet</p>
          ) : (
            <div className="space-y-2">
              {topIndustries.map(([industry, count]) => (
                <div key={industry} className="flex items-center gap-3">
                  <span className="w-20 text-[11px] truncate text-right" style={{ color: "var(--ink-3)" }}>{industry}</span>
                  <div className="flex-1 h-4 rounded-full relative overflow-hidden" style={{ background: "var(--bg)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(3, (count / maxIndustryCount) * 100)}%`,
                        background: "linear-gradient(90deg, var(--accent-soft), var(--accent))",
                      }} />
                  </div>
                  <span className="text-[11px] font-medium tabular-nums w-8 text-right" style={{ color: "var(--ink-2)" }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PlanGate>
  );
}
