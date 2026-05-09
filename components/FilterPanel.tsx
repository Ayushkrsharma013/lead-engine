"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Calendar } from "lucide-react";
import type { FilterState } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";
import { countActiveFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

// ─── Chip multi-select ────────────────────────────────────────────────────────
function ChipGroup({
  options, selected, onToggle, accent = "#00d4ff",
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium",
              active
                ? "text-white"
                : "bg-white/[0.04] border-white/[0.08] text-muted hover:border-white/20 hover:text-text"
            )}
            style={active ? { background: `${accent}25`, borderColor: `${accent}60`, color: accent } : {}}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({
  title, count, children, defaultOpen = true,
}: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted uppercase tracking-widest hover:text-text transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {count ? (
            <span className="text-[10px] bg-accent-blue/20 text-accent-blue border border-accent-blue/30 px-1.5 py-0.5 rounded-full font-bold">
              {count}
            </span>
          ) : null}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Data constants ───────────────────────────────────────────────────────────
const SCORE_OPTIONS = [0, 70, 75, 80, 85, 90];
const SENIORITY   = ["Owner / Founder", "C-Suite", "VP", "Director", "Manager", "Senior / Head"];
const FUNCTIONS   = ["Sales", "Marketing", "Engineering", "Product", "Operations", "Finance", "HR / People", "Business Dev"];
const INDUSTRIES  = ["SaaS / Software", "Fintech", "MarTech", "HealthTech", "E-commerce", "Consulting", "Media", "EdTech"];
const SIZES       = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const COUNTRIES   = ["United States", "Canada", "United Kingdom", "Australia", "Remote"];
const EMAIL_OPTS  = ["verified", "risky", "not_found"];
const EMAIL_LABELS: Record<string, string> = { verified: "✓ Verified", risky: "⚠ Risky", not_found: "✗ Not found" };
const SOURCES     = ["linkedin", "gmaps", "amazon"];
const SOURCE_LABELS: Record<string, string> = { linkedin: "LinkedIn", gmaps: "Google Maps", amazon: "Amazon" };

// ─── Main component ───────────────────────────────────────────────────────────
interface FilterPanelProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  accent: string;
}

export default function FilterPanel({ filters, onChange, accent }: FilterPanelProps) {
  const toggle = (key: keyof FilterState, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onChange({ ...filters, [key]: next });
  };

  const activeCount = countActiveFilters(filters);
  const dateRangeCount = (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);

  return (
    <aside className="w-[272px] shrink-0 h-full bg-bg border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[11px] font-bold text-text uppercase tracking-widest">Filters</span>
        {activeCount > 0 && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-[11px] text-muted hover:text-text transition-colors"
          >
            <RotateCcw size={10} />
            Reset all ({activeCount})
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Role */}
        <Section title="Role" count={filters.seniority.length + filters.jobFunction.length} defaultOpen>
          <p className="text-[10px] text-muted/70 uppercase tracking-wider mb-1">Seniority Level</p>
          <ChipGroup options={SENIORITY} selected={filters.seniority} onToggle={v => toggle("seniority", v)} accent={accent} />
          <p className="text-[10px] text-muted/70 uppercase tracking-wider mt-3 mb-1">Job Function</p>
          <ChipGroup options={FUNCTIONS} selected={filters.jobFunction} onToggle={v => toggle("jobFunction", v)} accent={accent} />
        </Section>

        {/* Company */}
        <Section title="Company" count={filters.industries.length + filters.companySizes.length} defaultOpen>
          <p className="text-[10px] text-muted/70 uppercase tracking-wider mb-1">Industry</p>
          <ChipGroup options={INDUSTRIES} selected={filters.industries} onToggle={v => toggle("industries", v)} accent={accent} />
          <p className="text-[10px] text-muted/70 uppercase tracking-wider mt-3 mb-1">Company Size</p>
          <ChipGroup options={SIZES} selected={filters.companySizes} onToggle={v => toggle("companySizes", v)} accent={accent} />
        </Section>

        {/* Geography */}
        <Section title="Geography" count={filters.countries.length}>
          <ChipGroup options={COUNTRIES} selected={filters.countries} onToggle={v => toggle("countries", v)} accent={accent} />
        </Section>

        {/* Email Quality */}
        <Section title="Email Quality" count={filters.emailStatus.length}>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EMAIL_OPTS.map(opt => {
              const active = filters.emailStatus.includes(opt);
              const color = opt === "verified" ? "#10b981" : opt === "risky" ? "#f59e0b" : "#475569";
              return (
                <button
                  key={opt}
                  onClick={() => toggle("emailStatus", opt)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium",
                    active ? "text-white" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                  )}
                  style={active ? { background: `${color}20`, borderColor: `${color}60`, color } : {}}
                >
                  {EMAIL_LABELS[opt]}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Lead Score */}
        <Section title="Lead Score" count={filters.minScore > 0 ? 1 : 0}>
          <p className="text-[10px] text-muted/70 uppercase tracking-wider mb-2">Minimum Score</p>
          <div className="flex gap-1.5 flex-wrap">
            {SCORE_OPTIONS.map(score => {
              const active = filters.minScore === score;
              return (
                <button
                  key={score}
                  onClick={() => onChange({ ...filters, minScore: score })}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium",
                    active ? "text-white" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                  )}
                  style={active ? { background: `${accent}25`, borderColor: `${accent}60`, color: accent } : {}}
                >
                  {score === 0 ? "Any" : `${score}+`}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Date Saved */}
        <Section title="Date Saved" count={dateRangeCount} defaultOpen={false}>
          <div className="mt-2 space-y-2.5">
            <div>
              <label className="text-[10px] text-muted/70 uppercase tracking-wider block mb-1">From</label>
              <div className="relative">
                <Calendar size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/70 pointer-events-none" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
                  className="w-full h-8 bg-white/[0.04] border border-white/[0.08] rounded-lg pl-7 pr-2 text-[11px] text-text focus:outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted/70 uppercase tracking-wider block mb-1">To</label>
              <div className="relative">
                <Calendar size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/70 pointer-events-none" />
                <input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={e => onChange({ ...filters, dateTo: e.target.value })}
                  className="w-full h-8 bg-white/[0.04] border border-white/[0.08] rounded-lg pl-7 pr-2 text-[11px] text-text focus:outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
            {dateRangeCount > 0 && (
              <button
                onClick={() => onChange({ ...filters, dateFrom: "", dateTo: "" })}
                className="text-[10px] text-muted hover:text-text transition-colors"
              >
                Clear dates
              </button>
            )}
          </div>
        </Section>

        {/* Source */}
        <Section title="Source" count={filters.sources.length} defaultOpen={false}>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {SOURCES.map(src => {
              const active = filters.sources.includes(src);
              const colors: Record<string, string> = { linkedin: "#00d4ff", gmaps: "#00ff88", amazon: "#ff6b35" };
              const c = colors[src];
              return (
                <button
                  key={src}
                  onClick={() => toggle("sources", src)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium",
                    active ? "text-white" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                  )}
                  style={active ? { background: `${c}20`, borderColor: `${c}50`, color: c } : {}}
                >
                  {SOURCE_LABELS[src]}
                </button>
              );
            })}
          </div>
        </Section>
      </div>
    </aside>
  );
}
