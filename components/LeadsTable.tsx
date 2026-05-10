"use client";

import { ExternalLink, Building2, MapPin, Trash2, Download, Users, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { Lead, SortState, SortField, PaginationState } from "@/lib/types";
import { cn } from "@/lib/utils";
import Pagination from "./Pagination";

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScorePill({ score }: { score: number }) {
  const [color, bg, glow] = score >= 85
    ? ["var(--positive)", "rgba(0,255,136,0.1)", "0 0 8px rgba(0,255,136,0.3)"]
    : score >= 70
    ? ["var(--negative)", "rgba(255,107,53,0.1)", "0 0 8px rgba(255,107,53,0.2)"]
    : ["var(--negative)", "rgba(239,68,68,0.1)", "0 0 8px rgba(239,68,68,0.2)"];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums"
      style={{ background: bg, color, border: `1px solid ${color}30`, boxShadow: glow }}
    >
      {score}
    </span>
  );
}

function EmailStatus({ status, email }: { status: Lead["emailStatus"]; email: string }) {
  const cfg = {
    verified:  { col: "var(--positive)", label: "Verified",   dot: "●" },
    risky:     { col: "var(--info)", label: "Risky",      dot: "◐" },
    not_found: { col: "var(--ink-4)", label: "Not found",  dot: "○" },
  }[status];
  return (
    <div className="space-y-0.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: cfg.col }}>
        <span className="text-[8px]">{cfg.dot}</span>{cfg.label}
      </span>
      {email && (
        <p className="text-[10px] font-mono truncate max-w-[160px]" style={{ color: "var(--ink-3)", opacity: 0.7 }} title={email}>
          {email}
        </p>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: Lead["source"] }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    linkedin: { label: "in", color: "var(--accent)", bg: "var(--accent-soft)"  },
    gmaps:    { label: "G",  color: "var(--positive)", bg: "var(--positive-soft)"  },
    amazon:   { label: "a",  color: "var(--negative)", bg: "var(--negative-soft)" },
  };
  const c = cfg[source] || cfg.linkedin;
  return (
    <span
      className="w-5 h-5 rounded-md text-[9px] font-bold inline-flex items-center justify-center shrink-0"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}25` }}
    >
      {c.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
  const palette = ["#818cf8", "#34d399", "#fb923c", "#f472b6", "#60a5fa", "#a78bfa", "#38bdf8", "#4ade80"];
  const color = palette[(name.charCodeAt(0) || 0) % palette.length];
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Sortable header ──────────────────────────────────────────────────────────
function SortHeader({ field, label, sort, onSort }: { field: SortField; label: string; sort: SortState; onSort: (f: SortField) => void }) {
  const active = sort.field === field;
  return (
    <th
      className="text-left px-3 py-3 whitespace-nowrap cursor-pointer select-none group"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors"
        style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}
      >
        {label}
        {active
          ? sort.dir === "asc"
            ? <ChevronUp size={10} style={{ color: "var(--accent)" }} />
            : <ChevronDown size={10} style={{ color: "var(--accent)" }} />
          : <ChevronsUpDown size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        }
      </span>
    </th>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface LeadsTableProps {
  leads: Lead[];
  running: boolean;
  accent: string;
  selected: string[];
  sort: SortState;
  pagination: PaginationState;
  totalFiltered: number;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onDelete: (ids: string[]) => void;
  onExport: (ids: string[]) => void;
  onSort: (field: SortField) => void;
  onPaginationChange: (p: PaginationState) => void;
}

export default function LeadsTable({
  leads, running, accent, selected, sort, pagination, totalFiltered,
  onSelect, onSelectAll, onDelete, onExport, onSort, onPaginationChange,
}: LeadsTableProps) {
  const { page, pageSize } = pagination;
  const paginated = leads.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = paginated.length > 0 && paginated.every(l => selected.includes(l.id));
  const someSelected = selected.length > 0;

  // ── Running state ──
  if (running) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-5 animate-fade-in">
          <div className="relative mx-auto w-16 h-16">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: `${accent}10`,
                border: `1px solid ${accent}25`,
                boxShadow: `0 0 24px ${accent}15`,
              }}
            />
            <div
              className="absolute inset-1.5 rounded-xl border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${accent}25`, borderTopColor: accent, animationDuration: "0.75s", animationTimingFunction: "linear" }}
            />
            <div
              className="absolute inset-3.5 rounded-lg border border-t-transparent animate-spin"
              style={{ borderColor: `${accent}15`, borderTopColor: `${accent}80`, animationDuration: "0.5s", animationDirection: "reverse", animationTimingFunction: "linear" }}
            />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Agent is working…</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>Fetching & enriching leads from {accent === "var(--accent)" ? "LinkedIn" : accent === "var(--positive)" ? "Google Maps" : "Amazon"}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-xs animate-fade-in">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: `${accent}08`, border: `1px solid ${accent}18` }}
          >
            <Users size={26} style={{ color: accent, opacity: 0.5 }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>No leads match your filters</p>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--ink-3)" }}>
              Try adjusting your filters or run the agent to fetch new leads
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Bulk action bar */}
      {someSelected && (
        <div
          className="flex items-center gap-3 px-4 py-2 shrink-0 animate-fade-up"
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--line)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <span
            className="text-[12px] font-semibold px-2.5 py-1 rounded-lg"
            style={{
              background: "rgba(0,212,255,0.1)",
              color: "var(--accent)",
              border: "1px solid rgba(0,212,255,0.2)",
            }}
          >
            {selected.length} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => onExport(selected)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = "var(--line)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
          >
            <Download size={11} /> Export CSV
          </button>
          <button
            onClick={() => onDelete(selected)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "var(--negative-soft)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "var(--negative)",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.14)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--negative-soft)"; }}
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: "var(--bg)" }}>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                  style={{ accentColor: "var(--accent)" }}
                />
              </th>
              <SortHeader field="name"        label="Name & Title" sort={sort} onSort={onSort} />
              <SortHeader field="company"     label="Company"      sort={sort} onSort={onSort} />
              <SortHeader field="location"    label="Location"     sort={sort} onSort={onSort} />
              <SortHeader field="emailStatus" label="Email"        sort={sort} onSort={onSort} />
              <th className="text-left px-3 py-3 whitespace-nowrap">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ink-3)" }}>
                  LinkedIn
                </span>
              </th>
              <SortHeader field="score"   label="Score"  sort={sort} onSort={onSort} />
              <th className="text-left px-3 py-3 whitespace-nowrap">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ink-3)" }}>Src</span>
              </th>
              <SortHeader field="savedAt" label="Saved"  sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {paginated.map((lead, i) => {
              const isSelected = selected.includes(lead.id);
              const savedDate = lead.savedAt ? new Date(lead.savedAt) : null;
              return (
                <tr
                  key={lead.id}
                  className="group cursor-pointer transition-all duration-100 animate-fade-up"
                  style={{
                    borderBottom: "1px solid var(--line)",
                    animationDelay: `${Math.min(i * 15, 180)}ms`,
                    background: isSelected ? "rgba(0,212,255,0.04)" : undefined,
                  }}
                  onClick={() => onSelect(lead.id)}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelect(lead.id)}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: "var(--accent)" }}
                    />
                  </td>

                  {/* Name & Title */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={lead.name} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate max-w-[160px]" style={{ color: "var(--ink)" }}>
                          {lead.name || "—"}
                        </p>
                        <p className="text-[11px] truncate max-w-[160px]" style={{ color: "var(--ink-3)" }}>
                          {lead.title || "—"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={11} className="shrink-0" style={{ color: "var(--ink-3)", opacity: 0.6 }} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate max-w-[130px]" style={{ color: "var(--ink)" }}>
                          {lead.company || "—"}
                        </p>
                        <p className="text-[10px] truncate max-w-[130px]" style={{ color: "var(--ink-3)", opacity: 0.7 }}>
                          {lead.industry || ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="shrink-0" style={{ color: "var(--ink-3)", opacity: 0.6 }} />
                      <span className="text-[11px] truncate max-w-[120px]" style={{ color: "var(--ink-3)" }}>
                        {lead.location || "—"}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-3 py-3">
                    <EmailStatus status={lead.emailStatus} email={lead.email} />
                  </td>

                  {/* LinkedIn */}
                  <td className="px-3 py-3">
                    {lead.linkedin
                      ? (
                        <a
                          href={lead.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-medium transition-all px-2 py-0.5 rounded-md"
                          style={{
                            color: "var(--ink-3)",
                            background: "rgba(0,212,255,0.05)",
                            border: "1px solid rgba(0,212,255,0.1)",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)";
                            (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.1)";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.1)";
                            (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.05)";
                          }}
                        >
                          <ExternalLink size={9} /> View
                        </a>
                      )
                      : <span className="text-xs" style={{ color: "var(--ink-3)", opacity: 0.4 }}>—</span>
                    }
                  </td>

                  {/* Score */}
                  <td className="px-3 py-3"><ScorePill score={lead.score} /></td>

                  {/* Source */}
                  <td className="px-3 py-3"><SourceBadge source={lead.source} /></td>

                  {/* Saved At */}
                  <td className="px-3 py-3">
                    {savedDate
                      ? (
                        <div className="text-[10px] tabular-nums whitespace-nowrap" style={{ color: "var(--ink-3)" }}>
                          <span>{savedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          <br />
                          <span style={{ opacity: 0.6 }}>
                            {savedDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )
                      : <span className="text-xs" style={{ color: "var(--ink-3)", opacity: 0.4 }}>—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        pagination={pagination}
        total={totalFiltered}
        onChange={onPaginationChange}
        accent={accent}
      />
    </div>
  );
}
