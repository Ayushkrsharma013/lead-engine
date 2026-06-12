"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, Save, X } from "lucide-react";
import ThemedDatePicker from "@/components/ui/ThemedDatePicker";
import FilterSuggestion from "@/components/FilterSuggestion";
import type { FilterState } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";
import { countActiveFilters } from "@/lib/filters";

// ─── Sub-label ──────────────────────────────────────────────────────────────────
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[9px] font-bold uppercase tracking-[0.14em] mt-3 mb-1.5 select-none"
      style={{ color: "var(--ink-4)", opacity: 0.40 }}
    >
      {children}
    </p>
  );
}

// ─── Chip multi-select ────────────────────────────────────────────────────────
function ChipGroup({
  options, selected, onToggle, accent = "var(--accent)",
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={active ? "filter-chip-active" : "filter-chip"}
            style={active ? {
              background: `linear-gradient(90deg, ${accent}18, ${accent}14)`,
              borderColor: `${accent}30`,
              color: accent,
              boxShadow: `0 0 8px ${accent}10`,
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
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] select-none">
          {title}
          {count != null && count > 0 ? (
            <span className="section-count">
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown
          size={12}
          className="transition-transform duration-250"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
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
const INDUSTRIES  = [
  "SaaS / Software", "Fintech", "MarTech", "HealthTech", "E-commerce", "Consulting",
  "Media", "EdTech", "Cybersecurity", "AI / ML", "Legal Tech", "InsurTech",
  "Real Estate", "Logistics", "Manufacturing", "Retail", "Healthcare", "Finance",
];
const SIZES       = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"];
const COUNTRIES   = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany",
  "France", "India", "Netherlands", "Singapore", "Ireland", "Sweden",
  "Denmark", "Switzerland", "Israel", "United Arab Emirates", "Remote",
];
const US_REGIONS  = [
  "New York", "California", "Texas", "Florida", "Illinois",
  "Massachusetts", "Washington", "Georgia", "Pennsylvania", "Colorado",
  "Virginia", "North Carolina", "Arizona", "Oregon", "Minnesota",
];
const EU_REGIONS  = [
  "London", "Berlin", "Amsterdam", "Paris", "Stockholm",
  "Dublin", "Barcelona", "Munich", "Zurich", "Copenhagen",
];
const SALARY_OPTS = ["55,000", "85,000", "110,000", "150,000", "200,000"];
const EMAIL_OPTS  = ["verified", "risky", "not_found"];
const EMAIL_CONFIG: Record<string, { label: string; color: string }> = {
  verified:  { label: "Verified",   color: "var(--positive)" },
  risky:     { label: "Risky",      color: "var(--info)" },
  not_found: { label: "Not found",  color: "var(--ink-4)" },
};
const SOURCES        = ["linkedin", "gmaps", "amazon"];
const SOURCE_LABELS: Record<string, string> = { linkedin: "LinkedIn", gmaps: "Google Maps", amazon: "Amazon" };
const SOURCE_COLORS: Record<string, string> = { linkedin: "var(--accent)", gmaps: "var(--positive)", amazon: "var(--negative)" };

// ─── Main component ───────────────────────────────────────────────────────────
interface FilterPanelProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  accent: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSaveFilter?: () => void;
  onLoadFilter?: (config: FilterState) => void;
  savedFilterNames?: string[];
  onDeleteFilter?: (name: string) => void;
}

const COLLAPSED_W = 48;
const EXPANDED_W = 272;

export default function FilterPanel({ filters, onChange, accent, collapsed, onToggleCollapse, onSaveFilter, onLoadFilter, savedFilterNames, onDeleteFilter }: FilterPanelProps) {
  const toggle = (key: keyof FilterState, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onChange({ ...filters, [key]: next });
  };

  const activeCount = countActiveFilters(filters);
  const dateRangeCount = (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);

  return (
    <aside
      className="shrink-0 h-full flex flex-col overflow-hidden relative"
      style={{
        width: collapsed ? COLLAPSED_W : EXPANDED_W,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* ── Collapsed mode ── */}
      {collapsed ? (
        <>
          {/* Icon + active count */}
          <div
            className="flex flex-col items-center shrink-0"
            style={{
              height: 56,
              justifyContent: "center",
              borderBottom: "1px solid var(--sidebar-border)",
            }}
          >
            <div className="relative">
              <SlidersHorizontal size={16} style={{ color: activeCount > 0 ? "var(--accent)" : "var(--ink-3)" }} />
              {activeCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 text-[9px] px-1 py-0 rounded-full font-bold select-none"
                  style={{
                    background: "rgba(201,168,124,0.15)",
                    color: "var(--accent)",
                    border: "1px solid rgba(201,168,124,0.25)",
                    lineHeight: "12px",
                    minWidth: 14,
                    textAlign: "center",
                  }}
                >
                  {activeCount}
                </span>
              )}
            </div>
          </div>

          {/* Active filter indicator dots */}
          <div className="flex-1 flex flex-col items-center py-3 gap-1.5">
            {activeCount > 0 && (
              <>
                {filters.seniority.length > 0 && <IndicatorDot color={accent} />}
                {filters.jobFunction.length > 0 && <IndicatorDot color={accent} />}
                {filters.industries.length > 0 && <IndicatorDot color={accent} />}
                {filters.companySizes.length > 0 && <IndicatorDot color={accent} />}
                {filters.countries.length > 0 && <IndicatorDot color={accent} />}
                {(filters.regions || []).length > 0 && <IndicatorDot color={accent} />}
                {filters.companyDomains && <IndicatorDot color={accent} />}
                {(filters.salary || []).length > 0 && <IndicatorDot color={accent} />}
                {filters.emailStatus.length > 0 && <IndicatorDot color={accent} />}
                {filters.minScore > 0 && <IndicatorDot color={accent} />}
                {(filters.dateFrom || filters.dateTo) && <IndicatorDot color={accent} />}
                {filters.sources.length > 0 && <IndicatorDot color={accent} />}
                {filters.keyword && <IndicatorDot color={accent} />}
              </>
            )}
            {activeCount === 0 && (
              <div className="flex-1 flex items-center">
                <span
                  className="text-[8px] font-medium uppercase tracking-[0.12em] -rotate-90 whitespace-nowrap select-none"
                  style={{ color: "var(--ink-4)", opacity: 0.35 }}
                >
                  No filters
                </span>
              </div>
            )}
          </div>

          {/* Expand toggle */}
          <div
            className="shrink-0 py-1.5 flex justify-center"
            style={{ borderTop: "1px solid var(--sidebar-border)" }}
          >
            <button
              onClick={onToggleCollapse}
              className="flex items-center justify-center rounded-lg transition-all duration-200"
              style={{
                width: 36,
                height: 36,
                color: "var(--ink-3)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
                (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-4 shrink-0"
            style={{
              height: 56,
              borderBottom: "1px solid var(--sidebar-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={13} style={{ color: "var(--accent)" }} />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.12em] select-none"
                style={{ color: "var(--ink)" }}
              >
                Filters
              </span>
              {activeCount > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold select-none"
                  style={{
                    background: "rgba(201,168,124,0.08)",
                    color: "var(--accent)",
                    border: "1px solid rgba(201,168,124,0.15)",
                  }}
                >
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {activeCount > 0 && (
                <button
                  onClick={() => onChange(DEFAULT_FILTERS)}
                  className="flex items-center gap-1.5 text-[11px] font-medium rounded-lg transition-all duration-200 px-2.5 py-1"
                  style={{ color: "var(--ink-3)", background: "transparent" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              )}
              {/* Collapse toggle */}
              <button
                onClick={onToggleCollapse}
                className="flex items-center justify-center rounded-lg transition-all duration-200"
                style={{
                  width: 28,
                  height: 28,
                  color: "var(--ink-3)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                }}
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>

          {/* ── Sections ── */}
          <div className="flex-1 overflow-y-auto">
            {/* Role */}
            <Section title="Role" count={filters.seniority.length + filters.jobFunction.length} defaultOpen>
              <SubLabel>Seniority Level</SubLabel>
              <ChipGroup options={SENIORITY} selected={filters.seniority} onToggle={v => toggle("seniority", v)} accent={accent} />
              <SubLabel>Job Function</SubLabel>
              <ChipGroup options={FUNCTIONS} selected={filters.jobFunction} onToggle={v => toggle("jobFunction", v)} accent={accent} />
            </Section>

            {/* Company */}
            <Section
              title="Company"
              count={filters.industries.length + filters.companySizes.length + (filters.companyDomains ? 1 : 0)}
              defaultOpen
            >
              <SubLabel>Industry</SubLabel>
              <ChipGroup options={INDUSTRIES} selected={filters.industries} onToggle={v => toggle("industries", v)} accent={accent} />
              <SubLabel>Company Size</SubLabel>
              <ChipGroup options={SIZES} selected={filters.companySizes} onToggle={v => toggle("companySizes", v)} accent={accent} />
              <SubLabel>Company Domains</SubLabel>
              <input
                type="text"
                value={filters.companyDomains || ""}
                onChange={e => onChange({ ...filters, companyDomains: e.target.value })}
                placeholder="hubspot.com, salesforce.com"
                className="w-full text-[11px] rounded-lg px-2.5 py-1.5 outline-none transition-all"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                }}
                onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent-blue)"; }}
                onBlur={e => { (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"; }}
              />
              <p className="text-[9px] mt-1" style={{ color: "var(--ink-4)" }}>Comma-separated domains</p>
            </Section>

            {/* Geography */}
            <Section
              title="Geography"
              count={filters.countries.length + (filters.regions || []).length}
              defaultOpen={false}
            >
              <SubLabel>Country</SubLabel>
              <ChipGroup options={COUNTRIES} selected={filters.countries} onToggle={v => toggle("countries", v)} accent={accent} />
              <SubLabel>US States</SubLabel>
              <ChipGroup options={US_REGIONS} selected={filters.regions || []} onToggle={v => toggle("regions", v)} accent={accent} />
              <SubLabel>EU Cities</SubLabel>
              <ChipGroup options={EU_REGIONS} selected={filters.regions || []} onToggle={v => toggle("regions", v)} accent={accent} />
            </Section>

            {/* Salary */}
            <Section title="Salary (inferred)" count={(filters.salary || []).length} defaultOpen={false}>
              <SubLabel>Minimum Annual</SubLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SALARY_OPTS.map(opt => {
                  const active = (filters.salary || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggle("salary", opt)}
                      className={active ? "filter-chip-active" : "filter-chip"}
                      style={active ? {
                        background: `linear-gradient(90deg, ${accent}18, ${accent}14)`,
                        borderColor: `${accent}30`,
                        color: accent,
                        boxShadow: `0 0 8px ${accent}10`,
                      } : undefined}
                    >
                      ${Number(opt.replace(/,/g, "")).toLocaleString()}+
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] mt-1.5" style={{ color: "var(--ink-4)" }}>AI-inferred from role/company data</p>
            </Section>

            {/* Email Quality */}
            <Section title="Email Quality" count={filters.emailStatus.length} defaultOpen>
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
                        background: `linear-gradient(90deg, ${color}18, ${color}12)`,
                        borderColor: `${color}40`,
                        color,
                        boxShadow: `0 0 8px ${color}10`,
                      } : undefined}
                    >
                      <span
                        className="filter-chip-dot"
                        style={{
                          background: active ? color : "var(--ink-4)",
                          opacity: active ? 1 : 0.4,
                        }}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Lead Score */}
            <Section title="Lead Score" count={filters.minScore > 0 ? 1 : 0} defaultOpen>
              <SubLabel>Minimum Score</SubLabel>
              <div className="flex gap-1.5 flex-wrap">
                {SCORE_OPTIONS.map(score => {
                  const active = filters.minScore === score;
                  return (
                    <button
                      key={score}
                      onClick={() => onChange({ ...filters, minScore: score })}
                      className={(active ? "filter-chip-active" : "filter-chip") + " tabular-nums"}
                      style={active ? {
                        background: `linear-gradient(90deg, ${accent}18, ${accent}14)`,
                        borderColor: `${accent}30`,
                        color: accent,
                        boxShadow: `0 0 8px ${accent}10`,
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
                  <SubLabel>From</SubLabel>
                  <ThemedDatePicker
                    value={filters.dateFrom}
                    onChange={v => onChange({ ...filters, dateFrom: v || "" })}
                    placeholder="Start date"
                  />
                </div>
                <div>
                  <SubLabel>To</SubLabel>
                  <ThemedDatePicker
                    value={filters.dateTo}
                    onChange={v => onChange({ ...filters, dateTo: v || "" })}
                    placeholder="End date"
                  />
                </div>
                {dateRangeCount > 0 && (
                  <button
                    onClick={() => onChange({ ...filters, dateFrom: "", dateTo: "" })}
                    className="text-[11px] font-medium transition-colors duration-200 rounded-lg px-2.5 py-1"
                    style={{ color: "var(--ink-3)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
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
                        background: `linear-gradient(90deg, ${c}18, ${c}12)`,
                        borderColor: `${c}40`,
                        color: c,
                        boxShadow: `0 0 8px ${c}10`,
                      } : undefined}
                    >
                      {SOURCE_LABELS[src]}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Lead Limit */}
            <div className="px-3 py-2 space-y-1.5" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: "var(--ink-2)" }}>
                  Lead Limit: <strong style={{ color: "var(--accent-blue)" }}>{filters.leadLimit || 100}</strong>
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={filters.leadLimit || 100}
                onChange={e => onChange({ ...filters, leadLimit: Number(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${((filters.leadLimit || 100) - 10) / 490 * 100}%, var(--line) ${((filters.leadLimit || 100) - 10) / 490 * 100}%, var(--line) 100%)`,
                  accentColor: "var(--accent-blue)",
                }}
              />
              <div className="flex justify-between text-[9px]" style={{ color: "var(--ink-4)" }}>
                <span>10</span><span>500</span>
              </div>
            </div>

            {/* AI Filter Suggestions */}
            <div className="px-3 pb-2 shrink-0">
              <FilterSuggestion
                currentKeyword={filters.keyword || ""}
                onApply={(keyword, action) => {
                  if (action === "add") {
                    const current = filters.keyword ? filters.keyword.split(",").map(t => t.trim()).filter(Boolean) : [];
                    if (!current.includes(keyword)) {
                      onChange({ ...filters, keyword: [...current, keyword].join(", ") });
                    }
                  } else {
                    // exclude: remove from keyword if present
                    const current = filters.keyword ? filters.keyword.split(",").map(t => t.trim()).filter(Boolean) : [];
                    onChange({ ...filters, keyword: current.filter(k => k !== keyword).join(", ") });
                  }
                }}
              />
            </div>

            {/* Saved Filters */}
            {(onSaveFilter || (savedFilterNames && savedFilterNames.length > 0)) && (
              <div className="px-3 py-2 space-y-1.5 shrink-0" style={{ borderTop: "1px solid var(--line)" }}>
                {onSaveFilter && (
                  <button
                    onClick={onSaveFilter}
                    className="flex items-center gap-1.5 w-full h-7 px-2 rounded-md text-[11px] font-medium transition-all"
                    style={{ color: "var(--ink-3)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                      (e.currentTarget as HTMLElement).style.color = "var(--accent-blue)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                    }}
                  >
                    <Save size={12} /> Save current filters
                  </button>
                )}
                {savedFilterNames && savedFilterNames.length > 0 && savedFilterNames.map(name => (
                  <div key={name} className="flex items-center gap-1">
                    <button
                      onClick={() => onLoadFilter?.(filters)}
                      className="flex-1 text-left h-7 px-2 rounded-md text-[11px] font-medium truncate transition-all"
                      style={{ color: "var(--ink-2)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    >
                      {name}
                    </button>
                    <button
                      onClick={() => onDeleteFilter?.(name)}
                      className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors text-[var(--ink-4)] hover:text-[var(--negative)]"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function IndicatorDot({ color }: { color: string }) {
  return (
    <div
      className="w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: color, opacity: 0.5 }}
    />
  );
}
