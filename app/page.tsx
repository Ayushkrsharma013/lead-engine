"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Play, Download, X, RotateCcw, ChevronRight, Sparkles, BookMarked } from "lucide-react";
import { Source, Lead, LogEntry, FilterState, DEFAULT_FILTERS } from "@/lib/types";
import { MOCK_LINKEDIN, MOCK_GMAPS, MOCK_AMAZON, LOG_STEPS } from "@/lib/mock-data";
import { getStoredLeads, mergeLeads, deleteLeads } from "@/lib/storage";
import { applyFilters, getActiveFilterChips, countActiveFilters } from "@/lib/filters";
import Navbar from "@/components/Navbar";
import FilterPanel from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const ACCENT: Record<Source, string> = {
  linkedin: "#818cf8",
  gmaps: "#34d399",
  amazon: "#fb923c",
};

const MOCK_LEADS: Record<Source, Lead[]> = {
  linkedin: MOCK_LINKEDIN,
  gmaps: MOCK_GMAPS,
  amazon: MOCK_AMAZON,
};

type Tab = "results" | "saved";

// ─── Log panel ────────────────────────────────────────────────
function AgentLog({ log, accent }: { log: LogEntry[]; accent: string }) {
  return (
    <div className="border-t border-white/[0.06] bg-[#080b10]">
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
      </div>
    </div>
  );
}

// ─── CSV export helper ─────────────────────────────────────────
function exportCSV(leads: Lead[], filename = "leads.csv") {
  const headers = ["Name", "Title", "Company", "Industry", "Location", "Email", "Email Status", "LinkedIn", "Website", "Company Size", "Score", "Source", "Saved At"];
  const rows = leads.map(l => [
    l.name, l.title, l.company, l.industry, l.location,
    l.email, l.emailStatus, l.linkedin, l.website,
    l.companySize, l.score, l.source, l.savedAt || "",
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

// ─── Main page ────────────────────────────────────────────────
export default function Home() {
  const [source, setSource] = useState<Source>("linkedin");
  const [mock, setMock] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [prog, setProg] = useState(0);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<Tab>("results");
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [savedLeads, setSavedLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "warn" } | null>(null);
  const abortRef = useRef(false);

  // Load from storage on mount
  useEffect(() => {
    setSavedLeads(getStoredLeads());
  }, []);

  const accent = ACCENT[source];

  // Show temporary toast
  const showToast = (msg: string, type: "success" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Run agent ────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setLog([]);
    setProg(0);
    setSelected([]);
    setTab("results");

    const ts = () => new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (mock) {
      const steps = LOG_STEPS[source];
      for (let i = 0; i < steps.length; i++) {
        if (abortRef.current) break;
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
        setLog(prev => [...prev, { id: i, ts: ts(), text: steps[i].text, type: steps[i].type }]);
        setProg(Math.round(((i + 1) / steps.length) * 100));
      }
      const incoming = MOCK_LEADS[source];
      const { stored, added, updated } = mergeLeads(incoming);
      setSearchResults(incoming);
      setSavedLeads(stored);
      showToast(`✓ ${added} new + ${updated} updated leads saved`);
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
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || "API error"); }
        const data = await res.json();
        setProg(85);
        setLog(prev => [...prev, { id: 2, ts: ts(), text: `Processing ${data.leads?.length || 0} leads…`, type: "info" }]);
        await new Promise(r => setTimeout(r, 500));
        const liveLeads: Lead[] = (data.leads || []).map((item: Record<string, unknown>, idx: number) => ({
          id: `live-${Date.now()}-${idx}`,
          name: String(item.full_name || item.name || ""),
          title: String(item.job_title || item.title || ""),
          company: String(item.job_company_name || item.company || ""),
          industry: String(item.job_company_industry || item.industry || ""),
          location: String(item.location_name || item.location || ""),
          email: Array.isArray(item.emails) && item.emails.length > 0
            ? String((item.emails[0] as Record<string, unknown>).address || item.emails[0] || "")
            : String(item.email || ""),
          emailStatus: (item.email_status || "not_found") as Lead["emailStatus"],
          linkedin: String(item.linkedin_url || ""),
          website: String(item.job_company_website || ""),
          companySize: String(item.job_company_size || ""),
          score: Math.floor(70 + Math.random() * 28),
          source,
        }));
        const { stored, added, updated } = mergeLeads(liveLeads);
        setSearchResults(liveLeads);
        setSavedLeads(stored);
        setProg(100);
        setLog(prev => [...prev, { id: 3, ts: ts(), text: `✓ ${added} new + ${updated} updated leads saved`, type: "success" }]);
        showToast(`✓ ${added} new leads saved to database`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setLog(prev => [...prev, { id: 99, ts: ts(), text: `✗ Error: ${msg}`, type: "warn" }]);
        showToast(msg, "warn");
      }
    }
    setRunning(false);
  }, [source, mock]);

  // ── Selection ────────────────────────────────────────────────
  const displayLeads = applyFilters(tab === "results" ? searchResults : savedLeads, filters);

  const handleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleSelectAll = () => {
    const ids = displayLeads.map(l => l.id);
    setSelected(prev => ids.every(id => prev.includes(id)) ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = (ids: string[]) => {
    const remaining = deleteLeads(ids);
    setSavedLeads(remaining);
    setSearchResults(prev => prev.filter(l => !ids.includes(l.id)));
    setSelected(prev => prev.filter(id => !ids.includes(id)));
    showToast(`${ids.length} leads deleted`);
  };

  // ── Export ───────────────────────────────────────────────────
  const handleExport = (ids?: string[]) => {
    const toExport = ids?.length
      ? displayLeads.filter(l => ids.includes(l.id))
      : displayLeads;
    exportCSV(toExport, `leads-${source}-${Date.now()}.csv`);
    showToast(`${toExport.length} leads exported`);
  };

  // ── Filter chips ─────────────────────────────────────────────
  const chips = getActiveFilterChips(filters);
  const removeChip = (group: keyof FilterState, value: string) => {
    if (group === "keyword") setFilters(f => ({ ...f, keyword: "" }));
    else if (group === "minScore") setFilters(f => ({ ...f, minScore: 0 }));
    else setFilters(f => ({ ...f, [group]: (f[group] as string[]).filter(v => v !== value) }));
  };

  // ── Source change ─────────────────────────────────────────────
  const handleSourceChange = (s: Source) => {
    setSource(s);
    setSelected([]);
    if (tab === "results") setSearchResults([]);
    setLog([]);
    setProg(0);
  };

  const filterCount = countActiveFilters(filters);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080b10]">
      <Navbar source={source} setSource={handleSourceChange} mock={mock} setMock={setMock} savedCount={savedLeads.length} />

      {/* Progress */}
      <div className="fixed top-14 left-0 right-0 z-40">
        <Progress value={running ? prog : 0} color={accent} />
      </div>

      {/* Body */}
      <div className="flex flex-1 mt-14 overflow-hidden">
        {/* Filter Panel */}
        <FilterPanel filters={filters} onChange={setFilters} accent={accent} />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Search bar + actions */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] bg-[#080b10]">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, title, company, location…"
                value={filters.keyword}
                onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
                className="w-full h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all"
              />
              {filters.keyword && (
                <button onClick={() => setFilters(f => ({ ...f, keyword: "" }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Run Agent */}
            <button onClick={handleRun} disabled={running}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}40` }}>
              {running
                ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accent}40`, borderTopColor: accent }} /> Running…</>
                : <><Sparkles size={13} /> Run Agent</>
              }
            </button>

            {/* Export all */}
            {displayLeads.length > 0 && (
              <button onClick={() => handleExport()}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] transition-all">
                <Download size={12} /> Export
              </button>
            )}
          </div>

          {/* Applied filter chips */}
          {chips.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-2 bg-[#080b10] border-b border-white/[0.04] flex-wrap">
              <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">Filters:</span>
              {chips.map((chip, i) => (
                <span key={i}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300">
                  {chip.label}
                  <button onClick={() => removeChip(chip.group, chip.value)} className="hover:text-white ml-0.5">
                    <X size={9} />
                  </button>
                </span>
              ))}
              <button onClick={() => setFilters(DEFAULT_FILTERS)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
                <RotateCcw size={9} /> Clear all
              </button>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-white/[0.06] bg-[#080b10]">
            {[
              { key: "results" as Tab, label: "Search Results", count: applyFilters(searchResults, filters).length, icon: Sparkles },
              { key: "saved" as Tab, label: "All Saved Leads", count: applyFilters(savedLeads, filters).length, icon: BookMarked },
            ].map(({ key, label, count, icon: Icon }) => (
              <button key={key} onClick={() => { setTab(key); setSelected([]); }}
                className={cn(
                  "flex items-center gap-2 h-8 px-3.5 rounded-lg text-xs font-medium transition-all",
                  tab === key
                    ? "bg-white/[0.08] text-slate-200 border border-white/[0.1]"
                    : "text-slate-500 hover:text-slate-400 hover:bg-white/[0.04]"
                )}>
                <Icon size={11} />
                {label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums",
                  tab === key ? "bg-white/10 text-slate-300" : "bg-white/5 text-slate-600"
                )}>
                  {count}
                </span>
              </button>
            ))}

            <div className="flex-1" />
            {filterCount > 0 && (
              <span className="text-[10px] text-slate-600">
                {filterCount} filter{filterCount > 1 ? "s" : ""} active
              </span>
            )}
          </div>

          {/* Leads table */}
          <LeadsTable
            leads={displayLeads}
            running={running}
            accent={accent}
            selected={selected}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onDelete={handleDelete}
            onExport={handleExport}
          />

          {/* Agent log */}
          {log.length > 0 && <AgentLog log={log} accent={accent} />}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-5 right-5 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-fade-up z-50",
          toast.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
            : "bg-amber-500/10 border-amber-500/25 text-amber-400"
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
