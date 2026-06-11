"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { PageTransition } from "@/components/ui/PageTransition";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { StatCard } from "@/components/ui/StatCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { BarChart2, TrendingUp } from "lucide-react";
import type { UserProfile, PlanKey } from "@/lib/types";

interface DashboardData {
  statusBreakdown?: Array<{ status: string; count: number }>;
  industryBreakdown?: Array<{ industry: string; count: number }>;
}

const STATUS_LABELS = ["new", "contacted", "replied", "hot", "meeting", "won", "lost"];

export default function ClientAnalyticsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dash, setDash] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
      }
      const dashRes = await fetch("/prospecting-os/api/client-portal/dashboard");
      if (dashRes.ok) {
        const d = await dashRes.json();
        setDash(d);
      }
      setLoading(false);
    }
    init();
  }, []);

  const statusBreakdown = dash.statusBreakdown || [];
  const industryBreakdown = dash.industryBreakdown || [];
  const topIndustries = industryBreakdown.slice(0, 8);
  const maxIndustryCount = topIndustries.length > 0 ? topIndustries[0].count : 1;

  if (loading) {
    return (
      <PageTransition className="max-w-5xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </PageTransition>
    );
  }

  return (
    <PlanGate module="analytics" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="growth">
      <PageTransition className="max-w-5xl space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <h1 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <BarChart2 size={16} style={{ color: "#E84A0A" }} />
            Analytics
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Lead volume and score analysis</p>
        </motion.div>

        {/* Status breakdown */}
        <AnimatedCard delay={0.1} className="p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: "var(--ink-4)" }}>Lead Status Breakdown</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {STATUS_LABELS.map((status, i) => {
              const item = statusBreakdown.find(s => s.status === status);
              const count = item?.count || 0;
              return (
                <motion.div
                  key={status}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.04, duration: 0.3 }}
                  className="text-center"
                >
                  <motion.div
                    className="text-[22px] font-bold tabular-nums"
                    style={{ color: "var(--ink)" }}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.25 + i * 0.05, type: "spring", stiffness: 200 }}
                  >
                    {count}
                  </motion.div>
                  <div className="text-[10px] font-medium capitalize mt-1" style={{ color: "var(--ink-4)" }}>{status}</div>
                </motion.div>
              );
            })}
          </div>
        </AnimatedCard>

        {/* Industry bars */}
        <AnimatedCard delay={0.2} className="p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4 flex items-center gap-2" style={{ color: "var(--ink-4)" }}>
            <TrendingUp size={12} style={{ color: "#E84A0A" }} />
            Top Industries
          </h3>
          {topIndustries.length === 0 ? (
            <p className="text-[12px] py-4 text-center" style={{ color: "var(--ink-3)" }}>No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {topIndustries.map(({ industry, count }, i) => (
                <motion.div
                  key={industry}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.04, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <span className="w-20 text-[11px] truncate text-right" style={{ color: "var(--ink-3)" }}>{industry}</span>
                  <div className="flex-1 h-5 rounded-full relative overflow-hidden" style={{ background: "var(--bg)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(3, (count / maxIndustryCount) * 100)}%` }}
                      transition={{ delay: 0.35 + i * 0.05, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                      style={{ background: "linear-gradient(90deg, rgba(232,74,10,0.20), #E84A0A)" }}
                    />
                  </div>
                  <span className="text-[11px] font-medium tabular-nums w-8 text-right" style={{ color: "var(--ink-2)" }}>{count}</span>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatedCard>
      </PageTransition>
    </PlanGate>
  );
}
