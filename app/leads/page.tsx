"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Play, Download, X, RotateCcw, ChevronRight,
  Sparkles, Database, HardDrive, CloudDownload, Flame, RefreshCw,
  ListChecks, GitBranch, ChevronDown,
} from "lucide-react";
import SyncApifyModal from "@/components/SyncApifyModal";
import NewScrapeModal from "@/components/NewScrapeModal";
import type { Source, Lead, LogEntry, FilterState, SortField } from "@/lib/types";
import { DEFAULT_FILTERS, DEFAULT_PAGINATION } from "@/lib/types";
import { applyFilters, sortLeads, getActiveFilterChips, countActiveFilters } from "@/lib/filters";
import { generateCSV, stableLeadId } from "@/lib/storage";
import { fetchLeadsFromDB, mergeLeadsInDB, deleteLeadsFromDB, computeStatsFromLeads, batchUpdateLeadStatus } from "@/lib/db";
import { useApp } from "@/lib/AppContext";
import TopBar from "@/components/layout/TopBar";
import FilterPanel from "@/components/FilterPanel";
import SaveFilterModal from "@/components/SaveFilterModal";
import LeadsTable from "@/components/LeadsTable";
import GDriveModal from "@/components/GDriveModal";
import ImportModal from "@/components/ImportModal";
import LeadControlCenter from "@/components/LeadControlCenter";
import { Progress } from "@/components/ui/progress";

const API_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
};

const ACCENT: Record<Source, string> = {
  linkedin: "var(--accent)",
  gmaps:    "var(--positive)",
  amazon:   "var(--negative)",
};

function getChipColor(group: keyof FilterState, value: string): string {
  switch (group) {
    case "keyword":       return "var(--accent)";
    case "seniority":     return "var(--accent)";
    case "jobFunction":   return "var(--info)";
    case "industries":    return "var(--positive)";
    case "companySizes":  return "var(--accent)";
    case "countries":     return "var(--info)";
    case "emailStatus":   return value === "verified" ? "var(--positive)" : value === "risky" ? "var(--info)" : "#6b6b80";
    case "minScore":      return "var(--negative)";
    case "sources":       return value === "linkedin" ? "var(--accent)" : value === "gmaps" ? "var(--positive)" : "var(--negative)";
    case "dateFrom":
    case "dateTo":        return "var(--accent)";
    default:              return "var(--accent)";
  }
}
const MOCK_LEADS: Record<Source, Lead[]> = {
  linkedin: [
    { id:"l1",name:"Emily Zhang",title:"Head of Sales",company:"Figma",industry:"Computer Software",location:"San Francisco, CA",email:"emily@figma.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/emilyzhang",website:"figma.com",companySize:"501-1000",score:93,source:"linkedin"},
    { id:"l2",name:"Jake Taylor",title:"CTO",company:"Loom",industry:"Internet",location:"New York, NY",email:"jake@loom.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/jaketaylor",website:"loom.com",companySize:"201-500",score:89,source:"linkedin"},
    { id:"l3",name:"David Kim",title:"Founder & CEO",company:"Retool",industry:"Internet",location:"Austin, TX",email:"david@retool.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/davidkim",website:"retool.com",companySize:"201-500",score:96,source:"linkedin"},
    { id:"l4",name:"Sarah Chen",title:"VP Marketing",company:"Notion",industry:"Productivity",location:"San Francisco, CA",email:"sarah@notion.so",emailStatus:"verified",linkedin:"https://linkedin.com/in/sarahchen",website:"notion.so",companySize:"501-1000",score:91,source:"linkedin"},
    { id:"l5",name:"Marcus Williams",title:"Director of Engineering",company:"Vercel",industry:"Developer Tools",location:"Remote, US",email:"marcus@vercel.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/marcuswilliams",website:"vercel.com",companySize:"201-500",score:87,source:"linkedin"},
    { id:"l6",name:"Amanda Foster",title:"VP Sales",company:"Airtable",industry:"Computer Software",location:"Los Angeles, CA",email:"amanda@airtable.com",emailStatus:"risky",linkedin:"https://linkedin.com/in/amandafoster",website:"airtable.com",companySize:"501-1000",score:82,source:"linkedin"},
    { id:"l7",name:"Chris Nakamura",title:"CMO",company:"Stripe",industry:"Financial Services",location:"Chicago, IL",email:"chris@stripe.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/chrisnakamura",website:"stripe.com",companySize:"1001-5000",score:88,source:"linkedin"},
    { id:"l8",name:"Priya Sharma",title:"Co-Founder",company:"DevTools Co",industry:"Software Development",location:"Bangalore, IN",email:"priya@devtools.co",emailStatus:"risky",linkedin:"https://linkedin.com/in/priyasharma",website:"devtools.co",companySize:"11-50",score:85,source:"linkedin"},
    { id:"l9",name:"Jordan Lee",title:"Founder & CTO",company:"Data Platform",industry:"Analytics",location:"Remote, US",email:"jordan@dataplatform.io",emailStatus:"verified",linkedin:"https://linkedin.com/in/jordanlee",website:"dataplatform.io",companySize:"51-200",score:94,source:"linkedin"},
    { id:"l10",name:"Rachel Kim",title:"Agency Director",company:"Growth Co",industry:"Marketing Agency",location:"New York, NY",email:"rachel@growthco.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/rachelkim",website:"growthco.com",companySize:"11-50",score:87,source:"linkedin"},
  ],
  gmaps: [
    { id:"g1",name:"Tom Baker",title:"Owner",company:"Baker's Cafe",industry:"Hospitality",location:"Portland, OR",email:"tom@bakerscafe.com",emailStatus:"verified",linkedin:"",website:"bakerscafe.com",companySize:"11-50",score:72,source:"gmaps"},
    { id:"g2",name:"Nina Patel",title:"Managing Director",company:"Sun Dental",industry:"Healthcare",location:"Austin, TX",email:"nina@sundental.com",emailStatus:"risky",linkedin:"https://linkedin.com/in/ninapatel",website:"sundental.com",companySize:"1-10",score:65,source:"gmaps"},
    { id:"g3",name:"Carlos Mendez",title:"Founder",company:"Mendez Law",industry:"Legal Services",location:"Miami, FL",email:"carlos@mendezlaw.com",emailStatus:"not_found",linkedin:"",website:"mendezlaw.com",companySize:"1-10",score:55,source:"gmaps"},
  ],
  amazon: [
    { id:"a1",name:"Lisa Wong",title:"CEO",company:"EcoGoods",industry:"Consumer Goods",location:"Seattle, WA",email:"lisa@ecogoods.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/lisawong",website:"ecogoods.com",companySize:"11-50",score:76,source:"amazon"},
    { id:"a2",name:"Alex Rodriguez",title:"Founder",company:"FitGear Pro",industry:"Sports & Outdoors",location:"Denver, CO",email:"alex@fitgearpro.com",emailStatus:"risky",linkedin:"https://linkedin.com/in/alexrodriguez",website:"fitgearpro.com",companySize:"1-10",score:67,source:"amazon"},
    { id:"a3",name:"Sarah Mitchell",title:"VP Operations",company:"HomeStyle",industry:"Home & Kitchen",location:"Atlanta, GA",email:"sarah@homestyle.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/sarahmitchell",website:"homestyle.com",companySize:"51-200",score:81,source:"amazon"},
  ],
};

const LOG_STEPS: Record<string, Array<{ text: string; type: "info" | "success" | "warn" }>> = {
  linkedin: [
    { text: "Initializing Apify actor: x_guru~Leads-Scraper", type: "info" },
    { text: "Applying filters: SaaS + B2B + Decision Makers", type: "info" },
    { text: "Querying 300M+ LinkedIn profiles…", type: "info" },
    { text: "Fetching page 1 of 4 (50 profiles each)", type: "info" },
    { text: "Fetching page 2 of 4 (50 profiles each)", type: "info" },
    { text: "Fetching page 3 of 4 (50 profiles each)", type: "info" },
    { text: "Fetching page 4 of 4 (50 profiles each)", type: "info" },
    { text: "Enriching emails via Hunter.io…", type: "info" },
    { text: "Computing ICP scores…", type: "info" },
    { text: "Complete! 86% email coverage achieved.", type: "success" },
  ],
  gmaps: [
    { text: "Launching Google Maps scraper…", type: "info" },
    { text: "Searching keyword: 'SaaS companies' in target cities", type: "info" },
    { text: "Extracting business profiles from Maps listings", type: "info" },
    { text: "Cross-referencing with LinkedIn for contact enrichment", type: "info" },
    { text: "Complete! Results enriched with emails.", type: "success" },
  ],
  amazon: [
    { text: "Scanning Amazon Seller Central data…", type: "info" },
    { text: "Filtering by category + revenue signals", type: "info" },
    { text: "Resolving seller identities via Hunter.io", type: "info" },
    { text: "Complete! Seller contacts resolved.", type: "success" },
  ],
};
type Tab = "all" | "latest";
type ScoreTab = "all" | "hot" | "warm" | "cold";

// ─── Agent Log ────────────────────────────────────────────────────────────────
function AgentLog({ log, accent }: { log: LogEntry[]; accent: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  return (
    <div
      className="shrink-0"
      style={{
        borderTop: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div className="px-4 py-2 flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse-glow"
          style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
        />
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em]"
          style={{ color: "var(--ink-3)" }}
        >
          Agent Log
        </span>
      </div>
      <div className="px-4 pb-3 space-y-1 max-h-24 overflow-y-auto">
        {log.length === 0
          ? <p className="text-[11px]" style={{ color: "var(--ink-3)", opacity: 0.5 }}>Run the agent to see activity…</p>
          : log.map(e => (
            <div key={e.id} className="flex items-start gap-1.5 animate-fade-up">
              <ChevronRight
                size={9}
                className="mt-0.5 shrink-0"
                style={{ color: e.type === "success" ? "var(--positive)" : e.type === "warn" ? "var(--negative)" : "var(--accent)" }}
              />
              <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--ink-3)", opacity: 0.6 }}>{e.ts}</span>
              <span
                className="text-[11px]"
                style={{
                  color: e.type === "success" ? "var(--positive)"
                       : e.type === "warn"    ? "var(--negative)"
                       : "var(--ink-3)",
                }}
              >
                {e.text}
              </span>
            </div>
          ))
        }
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({ total, withEmail, avgScore, topIndustry, accent }: {
  total: number; withEmail: number; avgScore: number; topIndustry: string; accent: string;
}) {
  if (total === 0) return null;
  const emailPct = total > 0 ? Math.round((withEmail / total) * 100) : 0;
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 shrink-0"
      style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
    >
      <StatCard label="Total Leads"    value={total.toLocaleString()} accent={accent} />
      <StatCard label="Email Coverage" value={`${emailPct}%`}         accent="var(--positive)" />
      <StatCard label="Avg ICP Score"  value={String(avgScore)}        accent="var(--negative)" />
      <StatCard label="Top Industry"   value={topIndustry}             accent="var(--info)" />
    </div>
  );
}
function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{
        background: `${accent}08`,
        border: `1px solid ${accent}18`,
      }}
    >
      <span className="text-[13px] font-bold tabular-nums leading-none" style={{ color: accent }}>{value}</span>
      <span className="text-[10px] font-medium" style={{ color: "var(--ink-3)" }}>{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { state, dispatch } = useApp();
  const abortRef = useRef(false);

  const { leads, latestLeads, selected, filters, sort, pagination, tab, source, mock, running, log, progress: prog, stats } = state;
  const accent = ACCENT[source];

  const showToast = useCallback((msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  }, [dispatch]);

  const [scoreTab, setScoreTab] = useState<ScoreTab>("all");
  const [lastScrapeLog, setLastScrapeLog] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    fetch("/prospecting-os/api/leads/apify-usage", {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}` },
    }).then(r => r.json()).then(d => setLastScrapeLog(d.lastLog)).catch(() => {});
  }, []);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [newScrapeOpen, setNewScrapeOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkSeqOpen, setBulkSeqOpen] = useState(false);
  const [sequences, setSequences] = useState<Array<{ id: string; name: string }>>([]);

  // Derived data
  const sourceLeads = tab === "latest" ? latestLeads : leads;
  const scoreFiltered = scoreTab === "hot" ? sourceLeads.filter(l => l.score >= 80)
    : scoreTab === "warm" ? sourceLeads.filter(l => l.score >= 50 && l.score < 80)
    : scoreTab === "cold" ? sourceLeads.filter(l => l.score < 50)
    : sourceLeads;
  const filtered = applyFilters(scoreFiltered, filters);
  const sorted = sortLeads(filtered, sort);

  const hotCount = sourceLeads.filter(l => l.score >= 80).length;
  const warmCount = sourceLeads.filter(l => l.score >= 50 && l.score < 80).length;
  const coldCount = sourceLeads.filter(l => l.score < 50).length;

  // Sort toggle
  const handleSort = (field: SortField) => {
    dispatch({
      type: "SET_SORT",
      payload: sort.field === field
        ? { field, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "savedAt" ? "desc" : "asc" },
    });
  };

  const handleFilterChange = (f: FilterState) => {
    dispatch({ type: "SET_FILTERS", payload: f });
  };

  // Run agent
  const handleRun = useCallback(async () => {
    abortRef.current = false;
    dispatch({ type: "SET_RUNNING", payload: true });
    dispatch({ type: "CLEAR_LOG" });
    dispatch({ type: "SET_PROGRESS", payload: 0 });
    dispatch({ type: "SET_LEAD_SELECTION", payload: [] });

    const ts = () =>
      new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (mock) {
      const steps = LOG_STEPS[source];
      for (let i = 0; i < steps.length; i++) {
        if (abortRef.current) break;
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
        dispatch({ type: "APPEND_LOG", payload: { id: i, ts: ts(), text: steps[i].text, type: steps[i].type } });
        dispatch({ type: "SET_PROGRESS", payload: Math.round(((i + 1) / steps.length) * 100) });
      }
      if (!abortRef.current) {
        const incoming = MOCK_LEADS[source];
        const { stored, added, updated } = await mergeLeadsInDB(incoming);
        dispatch({ type: "MERGE_LEADS", payload: { stored, incoming, added, updated } });
        const newStats = await computeStatsFromLeads(stored);
        dispatch({ type: "SET_STATS", payload: newStats });
        showToast(`${added} new · ${updated} updated leads`);
      }
    } else {
      try {
        // Step 1: Start the actor
        dispatch({ type: "APPEND_LOG", payload: { id: 0, ts: ts(), text: "Starting Apify actor…", type: "info" } });
        dispatch({ type: "SET_PROGRESS", payload: 10 });

        const startRes = await fetch("/prospecting-os/api/leads", {
          method: "POST",
          headers: API_HEADERS,
          body: JSON.stringify({ source, fields: { limit: String(filters.leadLimit || 100) }, filters }),
        });

        if (!startRes.ok) {
          const e = await startRes.json().catch(() => ({}));
          throw new Error((e as { error?: string }).error || `HTTP ${startRes.status}`);
        }

        const startData = await startRes.json() as { runId?: string; error?: string };
        if (!startData.runId) throw new Error(startData.error || "Failed to start actor");

        const runId = startData.runId;
        dispatch({ type: "APPEND_LOG", payload: { id: 1, ts: ts(), text: `Actor started — run ${runId}`, type: "info" } });
        dispatch({ type: "SET_PROGRESS", payload: 20 });

        // Step 2: Poll for results
        let pollCount = 0;
        const maxPolls = 120; // 10 minutes at 5s intervals
        let completed = false;

        while (pollCount < maxPolls && !abortRef.current) {
          await new Promise(r => setTimeout(r, 5000));
          pollCount++;

          const pollRes = await fetch(`/prospecting-os/api/leads?runId=${encodeURIComponent(runId)}`, { headers: API_HEADERS });

          let pollData: { status?: string; leads?: Record<string, unknown>[]; error?: string; totalFetched?: number; matched?: number } = {};
          try { pollData = await pollRes.json(); } catch {
            const text = await pollRes.text().catch(() => "");
            throw new Error(`API returned non-JSON (HTTP ${pollRes.status}): ${text.slice(0, 100)}`);
          }

          // Permanent errors — fail fast, don't keep polling
          if (!pollRes.ok && pollRes.status >= 400 && pollRes.status < 500) {
            throw new Error(pollData.error || `Poll failed with HTTP ${pollRes.status}`);
          }

          // Transient errors — log and keep polling
          if (!pollRes.ok) {
            dispatch({ type: "APPEND_LOG", payload: { id: 2 + pollCount, ts: ts(), text: `Poll ${pollCount}: HTTP ${pollRes.status} — retrying…`, type: "warn" } });
            continue;
          }

          // Error embedded in 200 response (e.g. FAILED status from Apify)
          if (pollData.error) {
            throw new Error(pollData.error);
          }

          if (pollData.status === "SUCCEEDED") {
            dispatch({ type: "SET_PROGRESS", payload: 80 });
            let totalFetched = (pollData as any).totalFetched ?? pollData.leads?.length ?? 0;
            const matched = (pollData as any).matched ?? pollData.leads?.length ?? 0;
            dispatch({ type: "APPEND_LOG", payload: {
              id: 2 + pollCount, ts: ts(),
              text: totalFetched > matched
                ? `Fetched ${totalFetched} leads from Apify, ${matched} matched your filters`
                : `Fetched ${totalFetched} leads from Apify — processing…`,
              type: "info",
            } });

            const liveLeads: Lead[] = (pollData.leads ?? []).map((item) => {
              // Apify actor returns emails in various shapes — handle all cases
              const extractEmail = (): string => {
                if (Array.isArray(item.emails) && item.emails.length > 0) {
                  const first = item.emails[0];
                  if (typeof first === "object" && first !== null)
                    return String((first as Record<string, unknown>).address || first || "");
                  return String(first || "");
                }
                if (typeof item.emails === "string" && item.emails.trim()) return item.emails.trim();
                if (typeof item.work_email === "string" && item.work_email.trim()) return item.work_email.trim();
                if (typeof item.email === "string" && item.email.trim()) return item.email.trim();
                if (typeof item.personal_emails === "string") {
                  const first = item.personal_emails.split(/\s+/)[0];
                  if (first) return first;
                }
                if (Array.isArray(item.personal_emails) && item.personal_emails.length > 0)
                  return String(item.personal_emails[0]);
                return "";
              };

              const email = extractEmail().toLowerCase().trim();
              const linkedin = String(item.linkedin_url || "").trim();
              const name = String(item.full_name || item.name || "").trim();
              const company = String(item.job_company_name || item.company || "").trim();

              return {
                id:          stableLeadId(email, linkedin, name, company),
                name,
                title:       String(item.job_title        || item.title    || ""),
                company,
                industry:    String(item.job_company_industry || item.industry || ""),
                location:    String(item.location_name   || item.location || ""),
                email,
                emailStatus: (["verified","risky","not_found"].includes(String(item.emailStatus || item.email_status))
                  ? String(item.emailStatus || item.email_status) : email ? "verified" : "not_found") as Lead["emailStatus"],
                linkedin,
                website:     String(item.job_company_website || ""),
                companySize: String(item.job_company_size || ""),
                score:       typeof item.score === "number" ? item.score : (email ? 85 : linkedin ? 80 : 70),
                source:      (["linkedin","gmaps","amazon"].includes(typeof item.source === "string" ? item.source : source) ? (item.source || source) : "linkedin") as Lead["source"],
              };
            });

            const { added, updated } = await mergeLeadsInDB(liveLeads);
            // Force full refresh from Supabase so filters show new leads immediately
            const freshLeads = await fetchLeadsFromDB();
            dispatch({ type: "SET_LEADS", payload: freshLeads });
            dispatch({ type: "SET_LEAD_SELECTION", payload: [] });
            const newStats = await computeStatsFromLeads(freshLeads);
            dispatch({ type: "SET_STATS", payload: newStats });
            dispatch({ type: "SET_PROGRESS", payload: 100 });

            totalFetched = (pollData as any).totalFetched ?? liveLeads.length;
            const totalMatched = (pollData as any).matched ?? liveLeads.length;
            let logMsg: string;
            if (added === 0 && updated === 0 && totalFetched > 0) {
              logMsg = `Fetched ${totalFetched} leads, ${totalMatched} matched filters — all already in database`;
            } else if (added === 0 && updated === 0 && totalFetched === 0) {
              logMsg = "No leads found matching your filters. Try broadening your criteria.";
            } else {
              logMsg = `Fetched ${totalFetched} from Apify, ${totalMatched} matched filters (${added} new · ${updated} updated)`;
            }
            dispatch({ type: "APPEND_LOG", payload: { id: 999, ts: ts(), text: logMsg, type: "success" } });
            showToast(logMsg);
            completed = true;
            break;
          }

          if (pollData.status === "FAILED" || pollData.status === "ABORTED" || pollData.status === "TIMED-OUT") {
            throw new Error(`Actor run ${pollData.status}`);
          }

          // Still running — update progress
          const pct = Math.min(20 + Math.floor(pollCount / maxPolls * 50), 70);
          dispatch({ type: "SET_PROGRESS", payload: pct });
          dispatch({ type: "APPEND_LOG", payload: { id: 2 + pollCount, ts: ts(), text: `Poll ${pollCount}: still running…`, type: "info" } });
        }

        if (!completed && !abortRef.current) {
          throw new Error("Timed out waiting for actor — it may still complete on Apify");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        dispatch({ type: "APPEND_LOG", payload: { id: 99, ts: ts(), text: `✗ ${msg}`, type: "warn" } });
        showToast(msg, "error");
        dispatch({ type: "SET_PROGRESS", payload: 0 });
      }
    }
    dispatch({ type: "SET_RUNNING", payload: false });
  }, [source, mock]);

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const handleImported = useCallback(async (added: number, updated: number, total: number, leads: Lead[]) => {
    const stored = await fetchLeadsFromDB();
    // Use MERGE_LEADS to populate both "All Saved Leads" AND "Latest Run" tabs
    dispatch({ type: "MERGE_LEADS", payload: { stored, incoming: leads, added, updated } });
    dispatch({ type: "SET_FILTERS", payload: DEFAULT_FILTERS });
    dispatch({ type: "SET_PAGINATION", payload: DEFAULT_PAGINATION });
    const newStats = await computeStatsFromLeads(stored);
    dispatch({ type: "SET_STATS", payload: newStats });
    if (added > 0) {
      showToast(`${added} new leads imported successfully`);
    } else if (updated > 0) {
      showToast(`${updated} leads updated — already in database, showing in Latest Run`);
    } else {
      showToast(`No new leads — all ${total} leads already in database`);
    }
  }, [dispatch, showToast]);

  // Selection
  const handleSelect = (id: string) => dispatch({ type: "TOGGLE_LEAD_SELECTION", payload: id });

  const handleSelectAll = () => {
    const { page, pageSize } = pagination;
    const pageIds = sorted.slice((page - 1) * pageSize, page * pageSize).map(l => l.id);
    if (pageIds.every(id => selected.includes(id))) {
      dispatch({ type: "SET_LEAD_SELECTION", payload: selected.filter(id => !pageIds.includes(id)) });
    } else {
      dispatch({ type: "SET_LEAD_SELECTION", payload: Array.from(new Set([...selected, ...pageIds])) });
    }
  };

  // Delete
  const handleDelete = async (ids: string[]) => {
    const stored = await deleteLeadsFromDB(ids);
    dispatch({ type: "DELETE_LEADS", payload: { stored, deletedIds: ids } });
    const newStats = await computeStatsFromLeads(stored);
    dispatch({ type: "SET_STATS", payload: newStats });
    showToast(`${ids.length} lead${ids.length > 1 ? "s" : ""} deleted`);
  };

  // Move to Hot
  const handleMoveToHot = useCallback(async (ids: string[]) => {
    try {
      const stored = await batchUpdateLeadStatus(ids, "hot");
      dispatch({ type: "SET_LEADS", payload: stored });
      dispatch({ type: "SET_LEAD_SELECTION", payload: [] });
      const newStats = await computeStatsFromLeads(stored);
      dispatch({ type: "SET_STATS", payload: newStats });
      showToast(`${ids.length} lead${ids.length > 1 ? "s" : ""} moved to Hot`);
    } catch {
      showToast("Failed to update leads", "error");
    }
  }, [dispatch, showToast]);

  // Bulk status change
  const handleBulkStatus = useCallback(async (status: string) => {
    if (!selected.length) return;
    try {
      const stored = await batchUpdateLeadStatus(selected, status as never);
      dispatch({ type: "SET_LEADS", payload: stored });
      dispatch({ type: "SET_LEAD_SELECTION", payload: [] });
      const newStats = await computeStatsFromLeads(stored);
      dispatch({ type: "SET_STATS", payload: newStats });
      showToast(`${selected.length} lead${selected.length > 1 ? "s" : ""} → ${status}`);
    } catch {
      showToast("Failed to update status", "error");
    }
    setBulkStatusOpen(false);
  }, [selected, dispatch, showToast]);

  // Bulk add to sequence
  const handleBulkSequence = useCallback(async (sequenceId: string, sequenceName: string) => {
    if (!selected.length) return;
    try {
      const res = await fetch("/prospecting-os/api/sequence/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId, leadIds: selected }),
      });
      if (!res.ok) throw new Error("Launch failed");
      dispatch({ type: "SET_LEAD_SELECTION", payload: [] });
      showToast(`${selected.length} lead${selected.length > 1 ? "s" : ""} enrolled in "${sequenceName}"`);
    } catch {
      showToast("Failed to enroll in sequence", "error");
    }
    setBulkSeqOpen(false);
  }, [selected, dispatch, showToast]);

  // Load sequences when bulk sequence picker opens
  useEffect(() => {
    if (!bulkSeqOpen) return;
    fetch("/prospecting-os/api/sequences")
      .then(r => r.json())
      .then((d: { sequences?: Array<{ id: string; name: string }> }) => setSequences(d.sequences || []))
      .catch(() => {});
  }, [bulkSeqOpen]);

  // Export CSV
  const getExportLeads = (ids?: string[]) =>
    ids?.length ? sorted.filter(l => ids.includes(l.id)) : sorted;

  const handleExportCSV = (ids?: string[]) => {
    const toExport = getExportLeads(ids);
    const csv = generateCSV(toExport);
    const filename = `leads-${source}-${Date.now()}.csv`;
    // Download the CSV
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = filename;
    a.click();
    // Open Google Sheets to import the file
    window.open("https://docs.google.com/spreadsheets/u/0/create?usp=sheets_home", "_blank");
    showToast(`${toExport.length} leads exported — open in Google Sheets`);
  };

  const driveLeads = selected.length ? sorted.filter(l => selected.includes(l.id)) : sorted;
  const driveCsv = generateCSV(driveLeads);
  const driveFile = `leads-${tab === "latest" ? "latest" : "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

  // Filter chips
  const chips = getActiveFilterChips(filters);
  const removeChip = (group: keyof FilterState, value: string) => {
    if (group === "keyword")   handleFilterChange({ ...filters, keyword: "" });
    else if (group === "minScore") handleFilterChange({ ...filters, minScore: 0 });
    else if (group === "dateFrom") handleFilterChange({ ...filters, dateFrom: "" });
    else if (group === "dateTo")   handleFilterChange({ ...filters, dateTo: "" });
    else handleFilterChange({ ...filters, [group]: (filters[group] as string[]).filter(v => v !== value) });
  };

  const handleSourceChange = (s: Source) => {
    dispatch({ type: "SET_SOURCE", payload: s });
    dispatch({ type: "SET_LEAD_SELECTION", payload: [] });
    dispatch({ type: "CLEAR_LOG" });
    dispatch({ type: "SET_PROGRESS", payload: 0 });
    dispatch({ type: "SET_PAGINATION", payload: DEFAULT_PAGINATION });
  };

  const filterCount = countActiveFilters(filters);
  const [gdrive, setGdrive] = useState(false);
  const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [savedFilterNames, setSavedFilterNames] = useState<string[]>([]);

  const fetchSavedFilters = useCallback(async () => {
    try {
      const res = await fetch("/prospecting-os/api/filters");
      if (res.ok) {
        const data = await res.json();
        setSavedFilterNames((data.filters || []).map((f: { name: string }) => f.name));
      }
    } catch {}
  }, []);

  useEffect(() => { fetchSavedFilters(); }, [fetchSavedFilters]);

  const handleSaveFilter = async (name: string) => {
    await fetch("/prospecting-os/api/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config: filters }),
    });
    fetchSavedFilters();
  };

  const handleLoadFilter = useCallback(async (name: string) => {
    try {
      const res = await fetch("/prospecting-os/api/filters");
      if (res.ok) {
        const data = await res.json();
        const match = (data.filters || []).find((f: { name: string; filter_config: FilterState }) => f.name === name);
        if (match) {
          dispatch({ type: "SET_FILTERS", payload: match.filter_config });
          showToast(`Loaded filter: ${name}`);
        }
      }
    } catch { showToast("Failed to load filter", "error"); }
  }, [dispatch, showToast]);

  const handleDeleteFilter = useCallback(async (name: string) => {
    try {
      const res = await fetch("/prospecting-os/api/filters");
      if (res.ok) {
        const data = await res.json();
        const match = (data.filters || []).find((f: { id: string; name: string }) => f.name === name);
        if (match) {
          await fetch(`/prospecting-os/api/filters/${match.id}`, { method: "DELETE" });
          fetchSavedFilters();
          showToast(`Deleted filter: ${name}`);
        }
      }
    } catch { showToast("Failed to delete filter", "error"); }
  }, [fetchSavedFilters, showToast]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* Top bar */}
      <TopBar />

      {/* Progress bar */}
      <div className="fixed top-14 left-0 right-0 z-40">
        <Progress value={running ? prog : 0} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter Panel — vertical sidebar */}
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          accent={accent}
          collapsed={filterPanelCollapsed}
          onToggleCollapse={() => setFilterPanelCollapsed(prev => !prev)}
          onSaveFilter={() => setSaveFilterOpen(true)}
          savedFilterNames={savedFilterNames}
          onLoadFilter={async (config) => {
            dispatch({ type: "SET_FILTERS", payload: config });
          }}
          onDeleteFilter={handleDeleteFilter}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Source tabs + mock toggle */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
          >
            {/* Source tabs */}
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-xl"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              {(["linkedin", "gmaps", "amazon"] as Source[]).filter(s => state.enabledSources[s]).map(s => (
                <button
                  key={s}
                  onClick={() => handleSourceChange(s)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium transition-all duration-200"
                  style={source === s ? {
                    background: `${ACCENT[s]}20`,
                    color: ACCENT[s],
                    boxShadow: `0 0 12px ${ACCENT[s]}20, inset 0 1px 0 var(--surface-2)`,
                    border: `1px solid ${ACCENT[s]}30`,
                  } : {
                    color: "var(--ink-3)",
                    border: "1px solid transparent",
                  }}
                >
                  <span
                    className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center"
                    style={{
                      background: source === s ? `${ACCENT[s]}35` : "var(--surface-2)",
                      color: source === s ? ACCENT[s] : "var(--ink-3)",
                    }}
                  >
                    {s === "linkedin" ? "in" : s === "gmaps" ? "G" : "a"}
                  </span>
                  {s === "linkedin" ? "LinkedIn" : s === "gmaps" ? "Google Maps" : "Amazon"}
                </button>
              ))}
            </div>

            {/* Mock / Live toggle */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
            >
              <span className="text-[11px] font-medium" style={{ color: "var(--ink-3)" }}>Mock</span>
              <button
                role="switch"
                aria-checked={mock}
                onClick={() => dispatch({ type: "SET_MOCK", payload: !mock })}
                className="relative w-8 h-4 rounded-full transition-all duration-200 focus:outline-none"
                style={{ background: mock ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.12)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm"
                  style={{ transform: mock ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
              <span
                className="text-[11px] font-bold w-7"
                style={{ color: mock ? "var(--negative)" : "var(--positive)" }}
              >
                {mock ? "ON" : "LIVE"}
              </span>
            </div>

            <div className="flex-1" />
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                color: "var(--ink-3)",
              }}
            >
              <span className="font-bold tabular-nums" style={{ color: "var(--ink)" }}>{leads.length}</span>
              <span>saved leads</span>
            </div>
          </div>

          {/* Search + actions bar */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
          >
            {/* Search field */}
            <div className="flex-1 relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--ink-3)" }}
              />
              <input
                type="text"
                placeholder="Search leads by name, title, company, email…"
                value={filters.keyword}
                onChange={e => handleFilterChange({ ...filters, keyword: e.target.value })}
                className={`search-input ${filters.keyword ? "has-value" : ""}`}
              />
              {filters.keyword ? (
                <button
                  onClick={() => handleFilterChange({ ...filters, keyword: "" })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:text-ink"
                  style={{ color: "var(--ink-3)", background: "var(--line)" }}
                >
                  <X size={11} />
                </button>
              ) : (
                <span className="search-shortcut">⌘K</span>
              )}
            </div>

            {/* Run Agent — premium glow button */}
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: running
                  ? `${accent}20`
                  : `linear-gradient(135deg, ${accent}30 0%, ${accent}15 100%)`,
                color: accent,
                border: `1px solid ${accent}40`,
                boxShadow: running ? "none" : `0 0 16px ${accent}20`,
              }}
              onMouseEnter={e => {
                if (!running) {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${accent}35`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${accent}60`;
                }
              }}
              onMouseLeave={e => {
                if (!running) {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${accent}20`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${accent}40`;
                }
              }}
            >
              {running ? (
                <>
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${accent}40`, borderTopColor: accent }}
                  />
                  Running…
                </>
              ) : (
                <>
                  <Play size={12} fill="currentColor" />
                  Run Agent
                </>
              )}
            </button>

            {/* New Scrape — trigger live actor run */}
            <button
              onClick={() => setNewScrapeOpen(true)}
              disabled={running}
              title="Trigger a new Apify scrape with custom search params"
              className="flex items-center gap-2 h-9 px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(0,212,255,0.08)",
                color: "var(--accent-blue)",
                border: "1px solid rgba(0,212,255,0.25)",
              }}
              onMouseEnter={e => {
                if (!running) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.16)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.4)";
                }
              }}
              onMouseLeave={e => {
                if (!running) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.08)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.25)";
                }
              }}
            >
              <Play size={12} fill="currentColor" />
              New Scrape
            </button>

            {/* Import from Apify */}
            <button
              onClick={() => setImportModalOpen(true)}
              disabled={running}
              title="Browse and import leads from past Apify runs"
              className="flex items-center gap-2 h-9 px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--info-soft)",
                color: "var(--info)",
                border: "1px solid rgba(124,58,237,0.35)",
                boxShadow: "0 0 14px rgba(124,58,237,0.18)",
              }}
              onMouseEnter={e => {
                if (!running) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.22)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 22px rgba(124,58,237,0.3)";
                }
              }}
              onMouseLeave={e => {
                if (!running) {
                  (e.currentTarget as HTMLElement).style.background = "var(--info-soft)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 14px rgba(124,58,237,0.18)";
                }
              }}
            >
              <CloudDownload size={13} />
              Import
            </button>

            {/* Move to Hot — visible when leads selected in Latest Run tab */}
            {tab === "latest" && selected.length > 0 && (
              <button
                onClick={() => handleMoveToHot(selected)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold transition-all shrink-0"
                title="Mark selected leads as Hot"
                style={{
                  background: "rgba(255,107,53,0.15)",
                  color: "var(--accent-orange)",
                  border: "1px solid rgba(255,107,53,0.35)",
                  boxShadow: "0 0 12px rgba(255,107,53,0.12)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,107,53,0.25)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 18px rgba(255,107,53,0.22)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,107,53,0.15)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px rgba(255,107,53,0.12)";
                }}
              >
                <Flame size={13} />
                Hot ({selected.length})
              </button>
            )}

            {/* Bulk Status Change — visible when leads selected */}
            {selected.length > 0 && (
              <div className="relative shrink-0">
                <button
                  onClick={() => { setBulkStatusOpen(o => !o); setBulkSeqOpen(false); }}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: bulkStatusOpen ? "rgba(0,212,255,0.18)" : "rgba(0,212,255,0.08)",
                    color: "var(--accent)",
                    border: "1px solid rgba(0,212,255,0.35)",
                  }}
                >
                  <ListChecks size={13} />
                  Status
                  <motion.div
                    animate={{ rotate: bulkStatusOpen ? 180 : 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    style={{ display: "flex" }}
                  >
                    <ChevronDown size={11} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {bulkStatusOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                      className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-50 py-1"
                      style={{ minWidth: 140, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)", transformOrigin: "top" }}
                    >
                      {(["new","contacted","replied","hot","meeting","won","lost"] as const).map((s, idx) => (
                        <motion.button
                          key={s}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.15 }}
                          onClick={() => handleBulkStatus(s)}
                          className="w-full text-left px-3 py-2 text-xs capitalize transition-colors"
                          style={{ color: "var(--text)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          {s}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Bulk Add to Sequence — visible when leads selected */}
            {selected.length > 0 && (
              <div className="relative shrink-0">
                <button
                  onClick={() => { setBulkSeqOpen(o => !o); setBulkStatusOpen(false); }}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: bulkSeqOpen ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.08)",
                    color: "var(--info)",
                    border: "1px solid rgba(124,58,237,0.35)",
                  }}
                >
                  <GitBranch size={13} />
                  Sequence
                  <motion.div
                    animate={{ rotate: bulkSeqOpen ? 180 : 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    style={{ display: "flex" }}
                  >
                    <ChevronDown size={11} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {bulkSeqOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                      className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-50 py-1"
                      style={{ minWidth: 180, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)", transformOrigin: "top" }}
                    >
                      {sequences.length === 0 ? (
                        <p className="px-3 py-2 text-xs" style={{ color: "var(--muted)" }}>No sequences found</p>
                      ) : sequences.map((seq, idx) => (
                        <motion.button
                          key={seq.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.15 }}
                          onClick={() => handleBulkSequence(seq.id, seq.name)}
                          className="w-full text-left px-3 py-2 text-xs truncate transition-colors"
                          style={{ color: "var(--text)", maxWidth: 220 }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          {seq.name}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Export CSV */}
            {sorted.length > 0 && (
              <button
                onClick={() => handleExportCSV(selected.length ? selected : undefined)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium transition-all shrink-0"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-3)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "var(--line)";
                  (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                  (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                }}
              >
                <Download size={12} />
                {selected.length ? `CSV (${selected.length})` : "CSV"}
              </button>
            )}

            {/* Google Drive export */}
            {sorted.length > 0 && (
              <button
                onClick={() => setGdrive(true)}
                title="Export to Google Drive"
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium transition-all shrink-0"
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  color: "var(--accent)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)/50";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.2)";
                }}
              >
                <HardDrive size={12} />
                Drive
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-4 py-2 flex-wrap shrink-0 animate-fade-in"
              style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
            >
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] shrink-0"
                style={{ color: "var(--ink-3)" }}
              >
                Active:
              </span>
              {chips.map((chip, i) => {
                const chipColor = getChipColor(chip.group, chip.value);
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium animate-fade-in"
                    style={{
                      background: `${chipColor}12`,
                      border: `1px solid ${chipColor}30`,
                      color: chipColor,
                    }}
                  >
                    {chip.label}
                    <button
                      onClick={() => removeChip(chip.group, chip.value)}
                      className="transition-opacity hover:opacity-60 ml-0.5"
                      style={{ color: chipColor }}
                    >
                      <X size={9} />
                    </button>
                  </span>
                );
              })}
              <button
                onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                className="flex items-center gap-1 text-[11px] font-medium transition-colors ml-1 hover:text-ink"
                style={{ color: "var(--ink-3)" }}
              >
                <RotateCcw size={9} /> Clear all
              </button>
            </div>
          )}

          {/* AI Control Center */}
          <LeadControlCenter
            activeFilters={{
              industries: filters.industries || [],
              locations: filters.countries || [],
              sizes: filters.companySizes || [],
              minScore: filters.minScore || 0,
            }}
            running={running}
            lastScrapeLog={lastScrapeLog as any}
          />

          {/* Stats bar */}
          <StatsBar {...stats} accent={accent} />

          {/* Score tier tabs — Framer Motion polished */}
          <div
            className="flex items-center gap-1 px-4 py-2 shrink-0 flex-wrap"
            style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
          >
            {([
              { key: "all" as ScoreTab, label: "All Leads", count: sourceLeads.length },
              { key: "hot" as ScoreTab, label: "Hot", count: hotCount, accent: "var(--negative)" },
              { key: "warm" as ScoreTab, label: "Warm", count: warmCount, accent: "var(--accent)" },
              { key: "cold" as ScoreTab, label: "Cold", count: coldCount, accent: "var(--ink-3)" },
            ]).map(({ key, label, count, accent: tabAccent }) => {
              const active = scoreTab === key;
              const a = tabAccent || "var(--ink-3)";
              return (
                <motion.button
                  key={key}
                  onClick={() => {
                    setScoreTab(key);
                    dispatch({ type: "SET_PAGINATION", payload: DEFAULT_PAGINATION });
                  }}
                  whileHover={active ? {} : { scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-medium"
                  style={active ? {
                    background: `${a}18`,
                    border: `1px solid ${a}40`,
                    color: a,
                    boxShadow: `0 0 10px ${a}18`,
                    fontWeight: 600,
                  } : {
                    background: "transparent",
                    border: "1px solid transparent",
                    color: "var(--ink-3)",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                      (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                      (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                    }
                  }}
                >
                  {key === "hot" && <Flame size={11} />}
                  {key === "warm" && (
                    <motion.span
                      animate={{ opacity: active ? 1 : 0.5 }}
                      style={{
                        width: 6, height: 6, borderRadius: 9999, background: a,
                        boxShadow: active ? `0 0 4px ${a}` : "none",
                      }}
                    />
                  )}
                  {label}
                  <motion.span
                    animate={{
                      background: active ? `${a}24` : "var(--surface-2)",
                      color: active ? a : "var(--ink-3)",
                    }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums"
                  >
                    {count}
                  </motion.span>
                </motion.button>
              );
            })}
          </div>

          {/* Tab bar */}
          <div
            className="flex items-center gap-1.5 px-4 py-2 shrink-0"
            style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}
          >
            {([
              { key: "all" as Tab, label: "All Saved Leads", count: applyFilters(leads, filters).length, total: leads.length, icon: Database },
              { key: "latest" as Tab, label: "Latest Run", count: applyFilters(latestLeads, filters).length, total: latestLeads.length, icon: Sparkles },
            ] as const).map(({ key, label, count, total, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  dispatch({ type: "SET_TAB", payload: key });
                  dispatch({ type: "SET_LEAD_SELECTION", payload: [] });
                  dispatch({ type: "SET_PAGINATION", payload: DEFAULT_PAGINATION });
                }}
                className="flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-medium transition-all duration-150"
                style={tab === key ? {
                  background: "var(--surface-2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--ink)",
                  boxShadow: "inset 0 1px 0 var(--surface-2)",
                } : {
                  border: "1px solid transparent",
                  color: "var(--ink-3)",
                }}
                onMouseEnter={e => {
                  if (tab !== key) (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                }}
                onMouseLeave={e => {
                  if (tab !== key) (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                }}
              >
                <Icon size={11} />
                {label}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                  style={tab === key ? {
                    background: "rgba(255,255,255,0.1)",
                    color: "var(--ink)",
                  } : {
                    background: "var(--surface-2)",
                    color: "var(--ink-3)",
                  }}
                >
                  {count}{total > count ? `/${total}` : ""}
                </span>
              </button>
            ))}

            <div className="flex-1" />

            {filterCount > 0 ? (
              <span className="flex items-center gap-1.5 text-[10px] font-medium shrink-0" style={{ color: "var(--ink-3)" }}>
                <span
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    color: "var(--accent)",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}
                >
                  {filterCount}
                </span>
                filter{filterCount > 1 ? "s" : ""}
                <span className="mx-0.5" style={{ opacity: 0.3 }}>·</span>
                <span className="tabular-nums" style={{ color: "var(--ink)" }}>{sorted.length.toLocaleString()}</span>
                result{sorted.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[10px] font-medium shrink-0 tabular-nums" style={{ color: "var(--ink-3)" }}>
                {sorted.length.toLocaleString()} result{sorted.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Leads Table */}
          <LeadsTable
            leads={sorted}
            running={running}
            accent={accent}
            selected={selected}
            sort={sort}
            pagination={pagination}
            totalFiltered={sorted.length}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onDelete={handleDelete}
            onExport={ids => handleExportCSV(ids)}
            onSort={handleSort}
            onPaginationChange={p => dispatch({ type: "SET_PAGINATION", payload: p })}
            onRunWithFilters={sorted.length === 0 && filterCount > 0 ? () => handleRun() : undefined}
          />

          {/* Agent Log */}
          {log.length > 0 && <AgentLog log={log} accent={accent} />}
        </div>
      </div>

      {/* Google Drive Modal */}
      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={handleImported}
      />
      <GDriveModal
        open={gdrive}
        onClose={() => setGdrive(false)}
        csvContent={driveCsv}
        fileName={driveFile}
        leadCount={driveLeads.length}
      />

      <SaveFilterModal
        open={saveFilterOpen}
        onClose={() => setSaveFilterOpen(false)}
        onSave={handleSaveFilter}
      />

      {syncModalOpen && (
        <SyncApifyModal
          onClose={() => setSyncModalOpen(false)}
          onSuccess={async () => {
            const stored = await fetchLeadsFromDB();
            dispatch({ type: "SET_LEADS", payload: stored });
            const newStats = await computeStatsFromLeads(stored);
            dispatch({ type: "SET_STATS", payload: newStats });
          }}
        />
      )}

      {newScrapeOpen && (
        <NewScrapeModal
          onClose={() => setNewScrapeOpen(false)}
          onSuccess={() => {
            showToast("Scrape complete — use Sync History to import leads");
          }}
        />
      )}
    </div>
  );
}
