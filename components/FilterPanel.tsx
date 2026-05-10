"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw, Calendar, SlidersHorizontal } from "lucide-react";
import type { FilterState } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";
import { countActiveFilters } from "@/lib/filters";

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
            className={active ? "filter-chip-active" : "filter-chip"}
            style={active ? {
              background: `${accent}18`,
              borderColor: `${accent}50`,
              color: accent,
              boxShadow: `0 0 8px ${accent}12`,
            } : undefined}
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
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section-group">
      <button
        onClick={() => setOpen(!open)}
        className="section-header"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em]">
          {title}
          {count ? (
            <span className="section-count">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown
          size={11}
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 animate-fade-in">
          {children}
        </div>
      )}
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
const EMAIL_CONFIG: Record<string, { label: string; color: string }> = {
  verified:  { label: "Verified",   color: "#10b981" },
  risky:     { label: "Risky",      color: "#f59e0b" },
  not_found: { label: "Not found",  color: "#475569" },
};
const SOURCES        = ["linkedin", "gmaps", "amazon"];
const SOURCE_LABELS: Record<string, string> = { linkedin: "LinkedIn", gmaps: "Google Maps", amazon: "Amazon" };
const SOURCE_COLORS: Record<string, string> = { linkedin: "#00d4ff", gmaps: "#00ff88", amazon: "#ff6b35" };

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
    <aside
      className="w-[272px] shrink-0 h-full flex flex-col overflow-hidden"
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={12} style={{ color: "var(--accent-blue)" }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text)" }}>
            Filters
          </span>
          {activeCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{
                background: "rgba(0,212,255,0.15)",
                color: "var(--accent-blue)",
                border: "1px solid rgba(0,212,255,0.25)",
              }}
            >
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-text"
            style={{ color: "var(--muted)" }}
          >
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Role */}
        <Section title="Role" count={filters.seniority.length + filters.jobFunction.length} defaultOpen>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1 mt-1" style={{ color: "var(--muted)" }}>Seniority Level</p>
          <ChipGroup options={SENIORITY} selected={filters.seniority} onToggle={v => toggle("seniority", v)} accent={accent} />
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] mt-3 mb-1" style={{ color: "var(--muted)" }}>Job Function</p>
          <ChipGroup options={FUNCTIONS} selected={filters.jobFunction} onToggle={v => toggle("jobFunction", v)} accent={accent} />
        </Section>

        {/* Company */}
        <Section title="Company" count={filters.industries.length + filters.companySizes.length} defaultOpen>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1 mt-1" style={{ color: "var(--muted)" }}>Industry</p>
          <ChipGroup options={INDUSTRIES} selected={filters.industries} onToggle={v => toggle("industries", v)} accent={accent} />
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] mt-3 mb-1" style={{ color: "var(--muted)" }}>Company Size</p>
          <ChipGroup options={SIZES} selected={filters.companySizes} onToggle={v => toggle("companySizes", v)} accent={accent} />
        </Section>

        {/* Geography */}
        <Section title="Geography" count={filters.countries.length} defaultOpen={false}>
          <ChipGroup options={COUNTRIES} selected={filters.countries} onToggle={v => toggle("countries", v)} accent={accent} />
        </Section>

        {/* Email Quality */}
        <Section title="Email Quality" count={filters.emailStatus.length}>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EMAIL_OPTS.map(opt => {
              const active = filters.emailStatus.includes(opt);
              const { label, color } = EMAIL_CONFIG[opt];
              return (
                <button
                  key={opt}
                  onClick={() => toggle("emailStatus", opt)}
                  className={active ? "filter-chip-active" : "filter-chip"}
                  style={active ? {
                    background: `${color}18`,
                    borderColor: `${color}50`,
                    color,
                    boxShadow: `0 0 8px ${color}12`,
                  } : undefined}
                >
                  <span
                    className="filter-chip-dot"
                    style={{ background: active ? color : "rgba(255,255,255,0.2)" }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Lead Score */}
        <Section title="Lead Score" count={filters.minScore > 0 ? 1 : 0}>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-2 mt-1" style={{ color: "var(--muted)" }}>
            Minimum Score
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {SCORE_OPTIONS.map(score => {
              const active = filters.minScore === score;
              return (
                <button
                  key={score}
                  onClick={() => onChange({ ...filters, minScore: score })}
                  className={(active ? "filter-chip-active" : "filter-chip") + " tabular-nums"}
                  style={active ? {
                    background: `${accent}18`,
                    borderColor: `${accent}50`,
                    color: accent,
                    boxShadow: `0 0 8px ${accent}12`,
                  } : undefined}
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
              <label className="text-[9px] font-bold uppercase tracking-[0.1em] block mb-1.5" style={{ color: "var(--muted)" }}>From</label>
              <div className="relative">
                <Calendar size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
                  className="filter-date-input"
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.1em] block mb-1.5" style={{ color: "var(--muted)" }}>To</label>
              <div className="relative">
                <Calendar size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
                <input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={e => onChange({ ...filters, dateTo: e.target.value })}
                  className="filter-date-input"
                />
              </div>
            </div>
            {dateRangeCount > 0 && (
              <button
                onClick={() => onChange({ ...filters, dateFrom: "", dateTo: "" })}
                className="text-[11px] font-medium transition-colors hover:text-text"
                style={{ color: "var(--muted)" }}
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
              const c = SOURCE_COLORS[src];
              return (
                <button
                  key={src}
                  onClick={() => toggle("sources", src)}
                  className={active ? "filter-chip-active" : "filter-chip"}
                  style={active ? {
                    background: `${c}18`,
                    borderColor: `${c}50`,
                    color: c,
                    boxShadow: `0 0 8px ${c}12`,
                  } : undefined}
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
