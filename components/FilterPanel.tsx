"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import type { FilterState } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";
import { countActiveFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

// ─── Chip multi-select ────────────────────────────────────────
function ChipGroup({ options, selected, onToggle, accent = "#818cf8" }: {
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
                : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-300"
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

// ─── Collapsible section ──────────────────────────────────────
function Section({ title, count, children, defaultOpen = true }: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.05]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {count ? (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded-full font-bold">
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

// ─── Score buttons ────────────────────────────────────────────
const SCORE_OPTIONS = [0, 70, 75, 80, 85, 90];

// ─── Filter data ──────────────────────────────────────────────
const SENIORITY = ["Owner / Founder", "C-Suite", "VP", "Director", "Manager", "Senior / Head"];
const FUNCTIONS = ["Sales", "Marketing", "Engineering", "Product", "Operations", "Finance", "HR / People", "Business Dev"];
const INDUSTRIES = ["SaaS / Software", "Fintech", "MarTech", "HealthTech", "E-commerce", "Consulting", "Media", "EdTech"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const COUNTRIES = ["United States", "Canada", "United Kingdom", "Australia", "Remote"];
const EMAIL_OPTS = ["verified", "risky", "not_found"];
const EMAIL_LABELS: Record<string, string> = { verified: "✓ Verified", risky: "⚠ Risky", not_found: "✗ Not found" };
const SOURCES = ["linkedin", "gmaps", "amazon"];
const SOURCE_LABELS: Record<string, string> = { linkedin: "LinkedIn", gmaps: "Google Maps", amazon: "Amazon" };

// ─── Main component ───────────────────────────────────────────
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

  return (
    <aside className="w-[272px] shrink-0 h-full bg-[#080b10] border-r border-white/[0.06] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Filters</span>
        {activeCount > 0 && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw size={10} />
            Reset all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Role & Experience */}
        <Section title="Role" count={filters.seniority.length + filters.jobFunction.length} defaultOpen>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Seniority Level</p>
          <ChipGroup options={SENIORITY} selected={filters.seniority} onToggle={v => toggle("seniority", v)} accent={accent} />
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-3 mb-1">Job Function</p>
          <ChipGroup options={FUNCTIONS} selected={filters.jobFunction} onToggle={v => toggle("jobFunction", v)} accent={accent} />
        </Section>

        {/* Company */}
        <Section title="Company" count={filters.industries.length + filters.companySizes.length} defaultOpen>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Industry</p>
          <ChipGroup options={INDUSTRIES} selected={filters.industries} onToggle={v => toggle("industries", v)} accent={accent} />
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-3 mb-1">Company Size</p>
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
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Minimum Score</p>
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

        {/* Source */}
        <Section title="Source" count={filters.sources.length} defaultOpen={false}>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {SOURCES.map(src => {
              const active = filters.sources.includes(src);
              const colors: Record<string, string> = { linkedin: "#818cf8", gmaps: "#34d399", amazon: "#fb923c" };
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
