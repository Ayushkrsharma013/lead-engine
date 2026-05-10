"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, Play, Download, X, RotateCcw, ChevronRight,
  Sparkles, Database, HardDrive,
} from "lucide-react";
import type { Source, Lead, LogEntry, FilterState, SortField } from "@/lib/types";
import { DEFAULT_FILTERS, DEFAULT_PAGINATION } from "@/lib/types";
import { applyFilters, sortLeads, getActiveFilterChips, countActiveFilters } from "@/lib/filters";
import { generateCSV } from "@/lib/storage";
import { mergeLeadsInDB, deleteLeadsFromDB, computeStatsFromLeads } from "@/lib/db";
import { useApp } from "@/lib/AppContext";
import TopBar from "@/components/layout/TopBar";
import FilterPanel from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import GDriveModal from "@/components/GDriveModal";
import { Progress } from "@/components/ui/progress";

const ACCENT: Record<Source, string> = {
  linkedin: "#00d4ff",
  gmaps:    "#00ff88",
  amazon:   "#ff6b35",
};

function getChipColor(group: keyof FilterState, value: string): string {
  switch (group) {
    case "keyword":       return "#00d4ff";
    case "seniority":     return "#00d4ff";
    case "jobFunction":   return "#7c3aed";
    case "industries":    return "#00ff88";
    case "companySizes":  return "#00d4ff";
    case "countries":     return "#7c3aed";
    case "emailStatus":   return value === "verified" ? "#10b981" : value === "risky" ? "#f59e0b" : "#6b6b80";
    case "minScore":      return "#ff6b35";
    case "sources":       return value === "linkedin" ? "#00d4ff" : value === "gmaps" ? "#00ff88" : "#ff6b35";
    case "dateFrom":
    case "dateTo":        return "#00d4ff";
    default:              return "#00d4ff";
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

// ─── Agent Log ────────────────────────────────────────────────────────────────
function AgentLog({ log, accent }: { log: LogEntry[]; accent: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  return (
    <div
      className="shrink-0"
      style={{
        borderTop: "1px solid var(--border)",
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
          style={{ color: "var(--muted)" }}
        >
          Agent Log
        </span>
      </div>
      <div className="px-4 pb-3 space-y-1 max-h-24 overflow-y-auto">
        {log.length === 0
          ? <p className="text-[11px]" style={{ color: "var(--muted)", opacity: 0.5 }}>Run the agent to see activity…</p>
          : log.map(e => (
            <div key={e.id} className="flex items-start gap-1.5 animate-fade-up">
              <ChevronRight
                size={9}
                className="mt-0.5 shrink-0"
                style={{ color: e.type === "success" ? "#00ff88" : e.type === "warn" ? "#ff6b35" : "#00d4ff" }}
              />
              <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--muted)", opacity: 0.6 }}>{e.ts}</span>
              <span
                className="text-[11px]"
                style={{
                  color: e.type === "success" ? "var(--accent-green)"
                       : e.type === "warn"    ? "var(--accent-orange)"
                       : "var(--muted)",
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
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
    >
      <StatCard label="Total Leads"    value={total.toLocaleString()} accent={accent} />
      <StatCard label="Email Coverage" value={`${emailPct}%`}         accent="#00ff88" />
      <StatCard label="Avg ICP Score"  value={String(avgScore)}        accent="#ff6b35" />
      <StatCard label="Top Industry"   value={topIndustry}             accent="#7c3aed" />
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
      <span className="text-[10px] font-medium" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { state, dispatch } = useApp();
  const abortRef = useRef(false);

  const { leads, latestLeads, selected, filters, sort, pagination, tab, source, mock, running, log, progress: prog, stats } = state;
  const accent = ACCENT[source];

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  // Derived data
  const sourceLeads = tab === "latest" ? latestLeads : leads;
  const filtered = applyFilters(sourceLeads, filters);
  const sorted = sortLeads(filtered, sort);

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
        dispatch({ type: "APPEND_LOG", payload: { id: 0, ts: ts(), text: "Connecting to Apify API…", type: "info" } });
        dispatch({ type: "SET_PROGRESS", payload: 15 });

        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, fields: {} }),
        });
        dispatch({ type: "SET_PROGRESS", payload: 50 });
        dispatch({ type: "APPEND_LOG", payload: { id: 1, ts: ts(), text: "Actor running — awaiting results…", type: "info" } });

        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error((e as { error?: string }).error || `HTTP ${res.status}`);
        }

        const data = await res.json() as { leads?: Record<string, unknown>[] };
        dispatch({ type: "SET_PROGRESS", payload: 80 });
        dispatch({ type: "APPEND_LOG", payload: { id: 2, ts: ts(), text: `Processing ${data.leads?.length ?? 0} leads…`, type: "info" } });

        const liveLeads: Lead[] = (data.leads ?? []).map((item, idx) => ({
          id: `live-${Date.now()}-${idx}`,
          name:        String(item.full_name       || item.name     || ""),
          title:       String(item.job_title        || item.title    || ""),
          company:     String(item.job_company_name || item.company  || ""),
          industry:    String(item.job_company_industry || item.industry || ""),
          location:    String(item.location_name   || item.location || ""),
          email: Array.isArray(item.emails) && item.emails.length > 0
            ? String((item.emails[0] as Record<string, unknown>).address ?? item.emails[0] ?? "")
            : String(item.email || ""),
          emailStatus: (["verified","risky","not_found"].includes(String(item.email_status))
            ? item.email_status : "not_found") as Lead["emailStatus"],
          linkedin:    String(item.linkedin_url    || ""),
          website:     String(item.job_company_website || ""),
          companySize: String(item.job_company_size || ""),
          score:       Math.floor(70 + Math.random() * 28),
          source,
        }));

        const { stored, added, updated, rejected } = await mergeLeadsInDB(liveLeads);
        dispatch({ type: "MERGE_LEADS", payload: { stored, incoming: liveLeads, added, updated } });
        const newStats = await computeStatsFromLeads(stored);
        dispatch({ type: "SET_STATS", payload: newStats });
        dispatch({ type: "SET_PROGRESS", payload: 100 });

        const logMsg = `${added} new · ${updated} updated${rejected ? ` · ${rejected} rejected` : ""}`;
        dispatch({ type: "APPEND_LOG", payload: { id: 3, ts: ts(), text: logMsg, type: "success" } });
        showToast(logMsg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        dispatch({ type: "APPEND_LOG", payload: { id: 99, ts: ts(), text: `✗ ${msg}`, type: "warn" } });
        showToast(msg, "error");
        dispatch({ type: "SET_PROGRESS", payload: 0 });
      }
    }
    dispatch({ type: "SET_RUNNING", payload: false });
  }, [source, mock]);

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

  // Export CSV
  const getExportLeads = (ids?: string[]) =>
    ids?.length ? sorted.filter(l => ids.includes(l.id)) : sorted;

  const handleExportCSV = (ids?: string[]) => {
    const toExport = getExportLeads(ids);
    const csv = generateCSV(toExport);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `leads-${source}-${Date.now()}.csv`;
    a.click();
    showToast(`${toExport.length} leads exported as CSV`);
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* Top bar */}
      <TopBar />

      {/* Progress bar */}
      <div className="fixed top-14 left-0 right-0 z-40">
        <Progress value={running ? prog : 0} color={accent} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter Panel — vertical sidebar */}
        <FilterPanel filters={filters} onChange={handleFilterChange} accent={accent} />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Source tabs + mock toggle */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
          >
            {/* Source tabs */}
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
            >
              {(["linkedin", "gmaps", "amazon"] as Source[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleSourceChange(s)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium transition-all duration-200"
                  style={source === s ? {
                    background: `${ACCENT[s]}20`,
                    color: ACCENT[s],
                    boxShadow: `0 0 12px ${ACCENT[s]}20, inset 0 1px 0 rgba(255,255,255,0.05)`,
                    border: `1px solid ${ACCENT[s]}30`,
                  } : {
                    color: "var(--muted)",
                    border: "1px solid transparent",
                  }}
                >
                  <span
                    className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center"
                    style={{
                      background: source === s ? `${ACCENT[s]}35` : "rgba(255,255,255,0.06)",
                      color: source === s ? ACCENT[s] : "var(--muted)",
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
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
            >
              <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>Mock</span>
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
                style={{ color: mock ? "var(--accent-orange)" : "var(--accent-green)" }}
              >
                {mock ? "ON" : "LIVE"}
              </span>
            </div>

            <div className="flex-1" />
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              <span className="font-bold tabular-nums" style={{ color: "var(--text)" }}>{leads.length}</span>
              <span>saved leads</span>
            </div>
          </div>

          {/* Search + actions bar */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
          >
            {/* Search field */}
            <div className="flex-1 relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--muted)" }}
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:text-text"
                  style={{ color: "var(--muted)", background: "rgba(255,255,255,0.08)" }}
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

            {/* Export CSV */}
            {sorted.length > 0 && (
              <button
                onClick={() => handleExportCSV(selected.length ? selected : undefined)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium transition-all shrink-0"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "var(--muted)";
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
                  background: "rgba(0,212,255,0.06)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  color: "var(--accent-blue)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.12)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.35)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.06)";
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
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
            >
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] shrink-0"
                style={{ color: "var(--muted)" }}
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
                className="flex items-center gap-1 text-[11px] font-medium transition-colors ml-1 hover:text-text"
                style={{ color: "var(--muted)" }}
              >
                <RotateCcw size={9} /> Clear all
              </button>
            </div>
          )}

          {/* Stats bar */}
          <StatsBar {...stats} accent={accent} />

          {/* Tab bar */}
          <div
            className="flex items-center gap-1.5 px-4 py-2 shrink-0"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
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
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                } : {
                  border: "1px solid transparent",
                  color: "var(--muted)",
                }}
                onMouseEnter={e => {
                  if (tab !== key) (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }}
                onMouseLeave={e => {
                  if (tab !== key) (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                }}
              >
                <Icon size={11} />
                {label}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                  style={tab === key ? {
                    background: "rgba(255,255,255,0.1)",
                    color: "var(--text)",
                  } : {
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--muted)",
                  }}
                >
                  {count}{total > count ? `/${total}` : ""}
                </span>
              </button>
            ))}

            <div className="flex-1" />

            {filterCount > 0 ? (
              <span className="flex items-center gap-1.5 text-[10px] font-medium shrink-0" style={{ color: "var(--muted)" }}>
                <span
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    color: "var(--accent-blue)",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}
                >
                  {filterCount}
                </span>
                filter{filterCount > 1 ? "s" : ""}
                <span className="mx-0.5" style={{ opacity: 0.3 }}>·</span>
                <span className="tabular-nums" style={{ color: "var(--text)" }}>{sorted.length.toLocaleString()}</span>
                result{sorted.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[10px] font-medium shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
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
          />

          {/* Agent Log */}
          {log.length > 0 && <AgentLog log={log} accent={accent} />}
        </div>
      </div>

      {/* Google Drive Modal */}
      <GDriveModal
        open={gdrive}
        onClose={() => setGdrive(false)}
        csvContent={driveCsv}
        fileName={driveFile}
        leadCount={driveLeads.length}
      />
    </div>
  );
}
