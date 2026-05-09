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
import FilterPanel from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import GDriveModal from "@/components/GDriveModal";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const ACCENT: Record<Source, string> = {
  linkedin: "#00d4ff",
  gmaps:    "#00ff88",
  amazon:   "#ff6b35",
};
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
    <div className="border-t border-border bg-bg shrink-0">
      <div className="px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: accent }} />
        <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">Agent Log</span>
      </div>
      <div className="px-4 pb-3 space-y-1 max-h-24 overflow-y-auto">
        {log.length === 0
          ? <p className="text-[11px] text-muted/50">Run the agent to see activity…</p>
          : log.map(e => (
            <div key={e.id} className="flex items-start gap-1.5 animate-fade-up">
              <ChevronRight size={9} className="mt-0.5 shrink-0"
                style={{ color: e.type === "success" ? "#00ff88" : e.type === "warn" ? "#ff6b35" : "#00d4ff" }} />
              <span className="text-[10px] text-muted/70 font-mono shrink-0">{e.ts}</span>
              <span className={cn("text-[11px]",
                e.type === "success" ? "text-accent-green" : e.type === "warn" ? "text-accent-orange" : "text-muted")}>
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
    <div className="flex items-center gap-5 px-5 py-2 border-b border-border bg-bg shrink-0">
      <Stat label="Total Leads" value={total.toLocaleString()} accent={accent} />
      <div className="w-px h-4 bg-border" />
      <Stat label="Verified Email" value={`${emailPct}%`} accent="#00ff88" />
      <div className="w-px h-4 bg-border" />
      <Stat label="Avg Score" value={avgScore} accent="#ff6b35" />
      <div className="w-px h-4 bg-border" />
      <Stat label="Top Industry" value={topIndustry} accent="#7c3aed" />
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>{value}</span>
      <span className="text-[10px] text-muted/70">{label}</span>
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
      {/* Progress bar */}
      <div className="fixed top-14 left-0 right-0 z-40">
        <Progress value={running ? prog : 0} color={accent} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter Panel */}
        <FilterPanel filters={filters} onChange={handleFilterChange} accent={accent} />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Source tabs + mock toggle */}
          <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border bg-bg shrink-0">
            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-border">
              {(["linkedin", "gmaps", "amazon"] as Source[]).map(tab => (
                <button key={tab} onClick={() => handleSourceChange(tab)}
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all",
                    source === tab ? "shadow-sm" : "text-muted hover:text-text"
                  )}
                  style={source === tab ? { background: ACCENT[tab] + "20" as string, color: ACCENT[tab] } : {}}>
                  <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center"
                    style={{
                      background: source === tab ? ACCENT[tab] + "30" as string : "rgba(255,255,255,0.06)",
                      color: source === tab ? ACCENT[tab] : "inherit"
                    }}>
                    {tab === "linkedin" ? "in" : tab === "gmaps" ? "G" : "a"}
                  </span>
                  {tab === "linkedin" ? "LinkedIn" : tab === "gmaps" ? "Google Maps" : "Amazon"}
                </button>
              ))}
            </div>

            {/* Mock toggle */}
            <div className="flex items-center gap-2.5 ml-4">
              <span className="text-xs text-muted">Mock</span>
              <button role="switch" aria-checked={mock}
                onClick={() => dispatch({ type: "SET_MOCK", payload: !mock })}
                className={cn("relative w-9 h-5 rounded-full transition-colors focus:outline-none", mock ? "bg-accent-blue" : "bg-white/15")}>
                <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", mock && "translate-x-4")} />
              </button>
              <span className={cn("text-xs font-semibold w-7", mock ? "text-accent-orange" : "text-accent-green")}>
                {mock ? "ON" : "LIVE"}
              </span>
            </div>

            <div className="flex-1" />
            <span className="text-xs text-muted">
              <span className="font-semibold text-text">{leads.length}</span> saved leads
            </span>
          </div>

          {/* Search + actions bar */}
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border bg-bg shrink-0">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search name, title, company, email, location…"
                value={filters.keyword}
                onChange={e => handleFilterChange({ ...filters, keyword: e.target.value })}
                className="w-full h-9 rounded-lg bg-white/[0.05] border border-border pl-9 pr-9 text-sm text-text placeholder:text-muted/70 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all"
              />
              {filters.keyword && (
                <button
                  onClick={() => handleFilterChange({ ...filters, keyword: "" })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Run Agent */}
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}40` }}
            >
              {running
                ? <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
                    Running…
                  </>
                : <><Play size={12} /> Run Agent</>
              }
            </button>

            {/* Export CSV */}
            {sorted.length > 0 && (
              <button
                onClick={() => handleExportCSV(selected.length ? selected : undefined)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs text-muted hover:text-text bg-white/[0.04] hover:bg-white/[0.07] border border-border transition-all shrink-0"
              >
                <Download size={12} />
                {selected.length ? `CSV (${selected.length})` : "CSV"}
              </button>
            )}

            {/* Google Drive export */}
            {sorted.length > 0 && (
              <button
                onClick={() => setGdrive(true)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs text-accent-blue hover:text-accent-blue/80 bg-accent-blue/[0.08] hover:bg-accent-blue/[0.12] border border-accent-blue/20 transition-all shrink-0"
                title="Export to Google Drive"
              >
                <HardDrive size={12} />
                Drive
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-2 bg-bg border-b border-border flex-wrap shrink-0">
              <span className="text-[10px] text-muted/70 uppercase tracking-wider shrink-0">Filters:</span>
              {chips.map((chip, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-border text-text">
                  {chip.label}
                  <button onClick={() => removeChip(chip.group, chip.value)} className="hover:text-white ml-0.5">
                    <X size={9} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-text transition-colors"
              >
                <RotateCcw size={9} /> Clear all
              </button>
            </div>
          )}

          {/* Stats bar */}
          <StatsBar {...stats} accent={accent} />

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-bg shrink-0">
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
                className={cn(
                  "flex items-center gap-2 h-8 px-3.5 rounded-lg text-xs font-medium transition-all",
                  tab === key
                    ? "bg-white/[0.08] text-text border border-border"
                    : "text-muted hover:text-muted hover:bg-white/[0.04]"
                )}
              >
                <Icon size={11} />
                {label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums",
                  tab === key ? "bg-white/10 text-text" : "bg-white/5 text-muted/70"
                )}>
                  {count}{total > count ? `/${total}` : ""}
                </span>
              </button>
            ))}

            <div className="flex-1" />

            {filterCount > 0 && (
              <span className="text-[10px] text-muted/70 shrink-0">
                {filterCount} filter{filterCount > 1 ? "s" : ""} active · {sorted.length.toLocaleString()} results
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
