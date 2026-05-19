"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Database, BarChart3, Target, Filter, AlertTriangle, Loader2, TrendingUp, CheckCircle2, Clock, Mail, Users } from "lucide-react";

interface FilterEstimate {
  expectedMin: number;
  expectedMax: number;
  emailCoverage: number;
  estimatedCredits: number;
  estimatedRuntime: string;
  difficulty: "low" | "medium" | "high";
  warnings: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLog = any;

interface ApifyUsage {
  remainingCredits: number;
  todayCredits: number;
  actorStatus: string;
  lastLog: AnyLog | null;
}

function estimateFromFilters(
  industryCount: number,
  locationCount: number,
  companySizeCount: number,
  minScore: number,
): FilterEstimate {
  const restrictiveness = (() => {
    let score = 0;
    if (industryCount > 0 && industryCount <= 2) score++;
    if (locationCount > 0 && locationCount <= 1) score++;
    if (companySizeCount > 0 && companySizeCount <= 1) score++;
    if (minScore >= 80) score++;
    return score;
  })();

  const warnings: string[] = [];
  if (industryCount === 1) warnings.push("Single industry may limit volume");
  if (locationCount === 1) warnings.push("Narrow to one location — try broadening");
  if (companySizeCount === 1) warnings.push("Single company size range may be restrictive");
  if (minScore >= 80) warnings.push("High score threshold — fewer matches");

  const base = restrictiveness >= 3 ? [20, 50] : restrictiveness >= 2 ? [60, 120] : [140, 250];
  const emailCov = restrictiveness >= 3 ? 55 : restrictiveness >= 2 ? 68 : 78;
  const credits = restrictiveness >= 3 ? 18 : restrictiveness >= 2 ? 35 : 65;

  return {
    expectedMin: base[0],
    expectedMax: base[1],
    emailCoverage: emailCov + Math.floor(Math.random() * 8),
    estimatedCredits: credits + Math.floor(Math.random() * 15),
    estimatedRuntime: restrictiveness >= 2 ? "3–6 min" : "2–4 min",
    difficulty: restrictiveness >= 3 ? "high" : restrictiveness >= 2 ? "medium" : "low",
    warnings,
  };
}

export default function LeadControlCenter({
  activeFilters,
  running,
  lastScrapeLog,
}: {
  activeFilters: { industries: string[]; locations: string[]; sizes: string[]; minScore: number };
  running: boolean;
  lastScrapeLog: AnyLog | null;
}) {
  const [usage, setUsage] = useState<ApifyUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/prospecting-os/api/leads/apify-usage", {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch {} finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  // Auto-refresh every 45s
  useEffect(() => {
    const i = setInterval(fetchUsage, 45000);
    return () => clearInterval(i);
  }, [fetchUsage]);

  const estimate = estimateFromFilters(
    activeFilters.industries.length,
    activeFilters.locations.length,
    activeFilters.sizes.length,
    activeFilters.minScore,
  );

  const statusColor =
    usage?.actorStatus === "healthy" ? "var(--accent-green)" :
    (usage?.remainingCredits || 0) < 100 ? "var(--negative)" :
    "var(--accent)";

  const runStatuses = [
    "Initializing actor",
    "Querying Apify",
    "Enriching leads",
    "Deduplicating",
    "Saving to Supabase",
    "Finalizing import",
  ];
  const [runStep, setRunStep] = useState(0);
  useEffect(() => {
    if (!running) { setRunStep(0); return; }
    const i = setInterval(() => setRunStep(s => Math.min(s + 1, runStatuses.length - 1)), 2000);
    return () => clearInterval(i);
  }, [running]);

  return (
    <div className="space-y-3 shrink-0">
      {/* Main control row */}
      <div className="flex items-stretch gap-3 flex-wrap">
        {/* Apify Credits */}
        <motion.div
          whileHover={{ y: -1 }}
          className="flex items-center gap-3 rounded-xl px-4 py-3 shrink-0"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}30` }}>
            {usageLoading ? <Loader2 size={14} className="animate-spin" style={{ color: statusColor }} /> :
             <Zap size={14} style={{ color: statusColor }} />}
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Apify Credits</div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
                {usage ? usage.remainingCredits.toLocaleString() : "—"}
              </span>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>remaining</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px]" style={{ color: "var(--muted)" }}>
                ~{estimate.estimatedCredits} est · {usage ? `${usage.todayCredits} today` : "—"}
              </span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
            </div>
          </div>
        </motion.div>

        {/* Filter Estimate */}
        <motion.div
          whileHover={{ y: -1 }}
          className="flex items-center gap-3 rounded-xl px-4 py-3 shrink-0"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(232,168,64,0.10)", border: "1px solid rgba(232,168,64,0.20)" }}>
            <Target size={14} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Expected Results</div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
                ~{estimate.expectedMin}–{estimate.expectedMax}
              </span>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>leads</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px]" style={{ color: "var(--muted)" }}>
                ~{estimate.emailCoverage}% email · {estimate.estimatedRuntime}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{
                background: estimate.difficulty === "low" ? "rgba(0,255,136,0.10)" :
                  estimate.difficulty === "medium" ? "rgba(232,168,64,0.10)" : "rgba(255,107,53,0.12)",
                color: estimate.difficulty === "low" ? "var(--accent-green)" :
                  estimate.difficulty === "medium" ? "var(--accent)" : "var(--accent-orange)",
              }}>
                {estimate.difficulty}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Last Run Stats */}
        {lastScrapeLog && lastScrapeLog.status === "completed" && (
          <motion.div
            whileHover={{ y: -1 }}
            className="flex items-center gap-3 rounded-xl px-4 py-3 shrink-0"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" }}>
              <BarChart3 size={14} style={{ color: "var(--accent-green)" }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Last Run</div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {lastScrapeLog.leads_fetched} fetched
                </span>
                <span className="text-[9px]" style={{ color: "var(--muted)" }}>·</span>
                <span className="text-[11px] font-semibold" style={{ color: "var(--accent-green)" }}>
                  +{lastScrapeLog.leads_added} added
                </span>
                <span className="text-[9px]" style={{ color: "var(--muted)" }}>·</span>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {lastScrapeLog.credits_consumed} credits
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail size={9} style={{ color: "var(--muted)" }} />
                <span className="text-[9px]" style={{ color: "var(--muted)" }}>{lastScrapeLog.emails_found} emails</span>
                <Users size={9} style={{ color: "var(--muted)", marginLeft: 4 }} />
                <span className="text-[9px]" style={{ color: "var(--muted)" }}>{lastScrapeLog.linkedin_matched}% match</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Run Status (when running) */}
        <AnimatePresence>
          {running && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 shrink-0"
              style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.20)" }}>
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-purple)" }} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent-purple)" }}>Running</div>
                <div className="text-[12px] font-medium" style={{ color: "var(--text)" }}>{runStatuses[runStep]}</div>
                <div className="flex gap-1 mt-1">
                  {runStatuses.map((_, i) => (
                    <div key={i} className="h-1 rounded-full transition-all duration-300"
                      style={{
                        width: 16,
                        background: i <= runStep ? "var(--accent-purple)" : "rgba(124,58,237,0.15)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filter warnings */}
      <AnimatePresence>
        {estimate.warnings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 rounded-lg px-3 py-2"
            style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.15)" }}
          >
            <AlertTriangle size={13} style={{ color: "var(--accent-orange)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <span className="text-[11px] font-semibold" style={{ color: "var(--accent-orange)" }}>Filter advisory — </span>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {estimate.warnings.join(" · ")}. Consider broadening for better yield.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
