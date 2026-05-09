"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, Play, Download, X, RotateCcw, ChevronRight,
  Sparkles, Database, HardDrive, AlertCircle,
} from "lucide-react";
import type { Source, Lead, LogEntry, FilterState, SortState, PaginationState } from "@/lib/types";
import { DEFAULT_FILTERS, DEFAULT_SORT, DEFAULT_PAGINATION } from "@/lib/types";
import { MOCK_LINKEDIN, MOCK_GMAPS, MOCK_AMAZON, LOG_STEPS } from "@/lib/mock-data";
import { getStoredLeads, mergeLeads, deleteLeads, generateCSV, getStorageStats } from "@/lib/storage";
import { applyFilters, sortLeads, getActiveFilterChips, countActiveFilters } from "@/lib/filters";
import Navbar from "@/components/Navbar";
import FilterPanel from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import GDriveModal from "@/components/GDriveModal";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const ACCENT: Record<Source, string> = {
  linkedin: "#818cf8",
  gmaps:    "#34d399",
  amazon:   "#fb923c",
};
const MOCK_LEADS: Record<Source, Lead[]> = {
  linkedin: MOCK_LINKEDIN,
  gmaps:    MOCK_GMAPS,
  amazon:   MOCK_AMAZON,
};
type Tab = "all" | "latest";

// ─── Agent Log ────────────────────────────────────────────────────────────────
function AgentLog({ log, accent }: { log: LogEntry[]; accent: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  return (
    <div className="border-t border-white/[0.06] bg-[#080b10] shrink-0">
      <div className="px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: accent }} />
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Agent Log</span>
      </div>
      <div className="px-4 pb-3 space-y-1 max-h-24 overflow-y-auto">
        {log.length === 0
          ? <p className="text-[11px] text-slate-700">Run the agent to see activity…</p>
          : log.map(e => (
            <div key={e.id} className="flex items-start gap-1.5 animate-fade-up">
              <ChevronRight size={9} className="mt-0.5 shrink-0"
                style={{ color: e.type === "success" ? "#10b981" : e.type === "warn" ? "#f59e0b" : "#6366f1" }} />
              <span className="text-[10px] text-slate-600 font-mono shrink-0">{e.ts}</span>
              <span className={cn("text-[11px]",
                e.type === "success" ? "text-emerald-400" : e.type === "warn" ? "text-amber-400" : "text-slate-400")}>
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
    <div className="flex items-center gap-5 px-5 py-2 border-b border-white/[0.04] bg-[#080b10] shrink-0">
      <Stat label="Total Leads" value={total.toLocaleString()} accent={accent} />
      <div className="w-px h-4 bg-white/[0.06]" />
      <Stat label="Verified Email" value={`${emailPct}%`} accent="#10b981" />
      <div className="w-px h-4 bg-white/[0.06]" />
      <Stat label="Avg Score" value={avgScore} accent="#f59e0b" />
      <div className="w-px h-4 bg-white/[0.06]" />
      <Stat label="Top Industry" value={topIndustry} accent="#a78bfa" />
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>{value}</span>
      <span className="text-[10px] text-slate-600">{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [source, setSource] = useState<Source>("linkedin");
  const [mock, setMock]     = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog]       = useState<LogEntry[]>([]);
  const [prog, setProg]     = useState(0);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort]     = useState<SortState>(DEFAULT_SORT);
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [tab, setTab]       = useState<Tab>("all");

  // The persistent lead database (loaded from localStorage)
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  // The leads returned by the most recent agent run
  const [latestLeads, setLatestLeads] = useState<Lead[]>([]);

  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "warn" | "error" } | null>(null);
  const [gdrive, setGdrive]     = useState(false);
  const [stats, setStats]       = useState({ total: 0, withEmail: 0, avgScore: 0, topIndustry: "—" });
  const abortRef = useRef(false);

  // ── Bootstrap: load all stored leads on mount ─────────────────────────────
  useEffect(() => {
    const stored = getStoredLeads();
    setAllLeads(stored);
    setStats(getStorageStats());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accent = ACCENT[source];

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Derived view ──────────────────────────────────────────────────────────
  // Which leads feed the table depends on active tab
  const sourceLeads = tab === "latest" ? latestLeads : allLeads;
  const filtered    = applyFilters(sourceLeads, filters);
  const sorted      = sortLeads(filtered, sort);
  // Pagination is done inside LeadsTable using `sorted` as the full set

  // ── Sort toggle ───────────────────────────────────────────────────────────
  const handleSort = (field: typeof sort.field) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "savedAt" ? "desc" : "asc" }
    );
    setPagination(p => ({ ...p, page: 1 }));
  };

  // Reset pagination when filters change
  const handleFilterChange = (f: FilterState) => {
    setFilters(f);
    setPagination(p => ({ ...p, page: 1 }));
  };

  // ── Run agent ─────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setLog([]);
    setProg(0);
    setSelected([]);

    const ts = () =>
      new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (mock) {
      const steps = LOG_STEPS[source];
      for (let i = 0; i < steps.length; i++) {
        if (abortRef.current) break;
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
        setLog(prev => [...prev, { id: i, ts: ts(), text: steps[i].text, type: steps[i].type }]);
        setProg(Math.round(((i + 1) / steps.length) * 100));
      }
      if (!abortRef.current) {
        const incoming = MOCK_LEADS[source];
        const { stored, added, updated } = mergeLeads(incoming);
        setAllLeads(stored);
        setLatestLeads(incoming);
        setStats(getStorageStats());
        setTab("latest");
        showToast(`✓ ${added} new · ${updated} updated leads`);
      }
    } else {
      try {
        setLog(prev => [...prev, { id: 0, ts: ts(), text: "Connecting to Apify API…", type: "info" }]);
        setProg(15);

        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, fields: {} }),
        });
        setProg(50);
        setLog(prev => [...prev, { id: 1, ts: ts(), text: "Actor running — awaiting results…", type: "info" }]);

        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error((e as { error?: string }).error || `HTTP ${res.status}`);
        }

        const data = await res.json() as { leads?: Record<string, unknown>[] };
        setProg(80);
        setLog(prev => [...prev, { id: 2, ts: ts(), text: `Processing ${data.leads?.length ?? 0} leads…`, type: "info" }]);

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

        const { stored, added, updated, rejected } = mergeLeads(liveLeads);
        setAllLeads(stored);
        setLatestLeads(liveLeads);
        setStats(getStorageStats());
        setTab("latest");
        setProg(100);

        const logMsg = `✓ ${added} new · ${updated} updated${rejected ? ` · ${rejected} rejected` : ""}`;
        setLog(prev => [...prev, { id: 3, ts: ts(), text: logMsg, type: "success" }]);
        showToast(logMsg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setLog(prev => [...prev, { id: 99, ts: ts(), text: `✗ ${msg}`, type: "warn" }]);
        showToast(msg, "error");
        setProg(0);
      }
    }
    setRunning(false);
  }, [source, mock]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const handleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSelectAll = () => {
    const { page, pageSize } = pagination;
    const pageIds = sorted.slice((page - 1) * pageSize, page * pageSize).map(l => l.id);
    setSelected(prev =>
      pageIds.every(id => prev.includes(id))
        ? prev.filter(id => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds]))
    );
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (ids: string[]) => {
    const remaining = deleteLeads(ids);
    setAllLeads(remaining);
    setLatestLeads(prev => prev.filter(l => !ids.includes(l.id)));
    setSelected(prev => prev.filter(id => !ids.includes(id)));
    setStats(getStorageStats());
    showToast(`${ids.length} lead${ids.length > 1 ? "s" : ""} deleted`);
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
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

  // For Google Drive export — all filtered+sorted (or selected)
  const driveLeads   = selected.length ? sorted.filter(l => selected.includes(l.id)) : sorted;
  const driveCsv     = generateCSV(driveLeads);
  const driveFile    = `leads-${tab === "latest" ? "latest" : "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

  // ── Filter chips ──────────────────────────────────────────────────────────
  const chips = getActiveFilterChips(filters);
  const removeChip = (group: keyof FilterState, value: string) => {
    if (group === "keyword")   handleFilterChange({ ...filters, keyword: "" });
    else if (group === "minScore") handleFilterChange({ ...filters, minScore: 0 });
    else if (group === "dateFrom") handleFilterChange({ ...filters, dateFrom: "" });
    else if (group === "dateTo")   handleFilterChange({ ...filters, dateTo: "" });
    else handleFilterChange({ ...filters, [group]: (filters[group] as string[]).filter(v => v !== value) });
  };

  // ── Source change ─────────────────────────────────────────────────────────
  const handleSourceChange = (s: Source) => {
    setSource(s);
    setSelected([]);
    setLog([]);
    setProg(0);
    setPagination(DEFAULT_PAGINATION);
  };

  const filterCount = countActiveFilters(filters);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080b10]">
      <Navbar source={source} setSource={handleSourceChange} mock={mock} setMock={setMock} savedCount={allLeads.length} />

      {/* Progress bar */}
      <div className="fixed top-14 left-0 right-0 z-40">
        <Progress value={running ? prog : 0} color={accent} />
      </div>

      {/* Body */}
      <div className="flex flex-1 mt-14 overflow-hidden">
        {/* Filter Panel */}
        <FilterPanel filters={filters} onChange={handleFilterChange} accent={accent} />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Search + actions bar */}
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/[0.06] bg-[#080b10] shrink-0">
            {/* Search */}
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search name, title, company, email, location…"
                value={filters.keyword}
                onChange={e => handleFilterChange({ ...filters, keyword: e.target.value })}
                className="w-full h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] pl-9 pr-9 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all"
              />
              {filters.keyword && (
                <button
                  onClick={() => handleFilterChange({ ...filters, keyword: "" })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] transition-all shrink-0"
              >
                <Download size={12} />
                {selected.length ? `CSV (${selected.length})` : "CSV"}
              </button>
            )}

            {/* Google Drive export */}
            {sorted.length > 0 && (
              <button
                onClick={() => setGdrive(true)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs text-blue-400 hover:text-blue-300 bg-blue-500/[0.08] hover:bg-blue-500/[0.12] border border-blue-500/20 transition-all shrink-0"
                title="Export to Google Drive"
              >
                <HardDrive size={12} />
                Drive
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-2 bg-[#080b10] border-b border-white/[0.04] flex-wrap shrink-0">
              <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">Filters:</span>
              {chips.map((chip, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300">
                  {chip.label}
                  <button onClick={() => removeChip(chip.group, chip.value)} className="hover:text-white ml-0.5">
                    <X size={9} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RotateCcw size={9} /> Clear all
              </button>
            </div>
          )}

          {/* Stats bar */}
          <StatsBar {...stats} accent={accent} />

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-white/[0.06] bg-[#080b10] shrink-0">
            {([
              {
                key: "all" as Tab,
                label: "All Saved Leads",
                count: applyFilters(allLeads, filters).length,
                total: allLeads.length,
                icon: Database,
              },
              {
                key: "latest" as Tab,
                label: "Latest Run",
                count: applyFilters(latestLeads, filters).length,
                total: latestLeads.length,
                icon: Sparkles,
              },
            ] as const).map(({ key, label, count, total, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSelected([]); setPagination(DEFAULT_PAGINATION); }}
                className={cn(
                  "flex items-center gap-2 h-8 px-3.5 rounded-lg text-xs font-medium transition-all",
                  tab === key
                    ? "bg-white/[0.08] text-slate-200 border border-white/[0.1]"
                    : "text-slate-500 hover:text-slate-400 hover:bg-white/[0.04]"
                )}
              >
                <Icon size={11} />
                {label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums",
                  tab === key ? "bg-white/10 text-slate-300" : "bg-white/5 text-slate-600"
                )}>
                  {count}{total > count ? `/${total}` : ""}
                </span>
              </button>
            ))}

            <div className="flex-1" />

            {filterCount > 0 && (
              <span className="text-[10px] text-slate-600 shrink-0">
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
            onPaginationChange={p => setPagination(p)}
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

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-5 right-5 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-fade-up z-50",
          toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
            : toast.type === "error" ? "bg-red-500/10 border-red-500/25 text-red-400"
            : "bg-amber-500/10 border-amber-500/25 text-amber-400"
        )}>
          {toast.type === "error" && <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
