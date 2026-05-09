"use client";
import { ExternalLink, Building2, MapPin, Trash2, Download, Users, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { Lead, SortState, SortField, PaginationState } from "@/lib/types";
import { cn } from "@/lib/utils";
import Pagination from "./Pagination";

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScorePill({ score }: { score: number }) {
  const cfg =
    score >= 85 ? { bg: "rgba(0,255,136,0.12)", col: "#00ff88", bd: "rgba(0,255,136,0.25)" }
    : score >= 70 ? { bg: "rgba(255,107,53,0.12)", col: "#ff6b35", bd: "rgba(255,107,53,0.25)" }
    : { bg: "rgba(239,68,68,0.12)", col: "#ef4444", bd: "rgba(239,68,68,0.25)" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tabular-nums"
      style={{ background: cfg.bg, color: cfg.col, border: `1px solid ${cfg.bd}` }}>
      {score}
    </span>
  );
}

function EmailStatus({ status, email }: { status: Lead["emailStatus"]; email: string }) {
  const cfg = {
    verified:  { col: "#00ff88", label: "Verified",   icon: "●" },
    risky:     { col: "#ff6b35", label: "Risky",      icon: "◐" },
    not_found: { col: "#475569", label: "Not found",  icon: "○" },
  }[status];
  return (
    <div className="space-y-0.5">
      <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: cfg.col }}>
        <span>{cfg.icon}</span>{cfg.label}
      </span>
      {email && (
        <p className="text-[10px] text-muted/70 font-mono truncate max-w-[160px]" title={email}>{email}</p>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: Lead["source"] }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    linkedin: { label: "in", color: "#00d4ff", bg: "rgba(0,212,255,0.15)" },
    gmaps:    { label: "G",  color: "#00ff88", bg: "rgba(0,255,136,0.15)"  },
    amazon:   { label: "a",  color: "#ff6b35", bg: "rgba(255,107,53,0.15)"  },
  };
  const c = cfg[source] || cfg.linkedin;
  return (
    <span className="w-5 h-5 rounded text-[9px] font-bold inline-flex items-center justify-center shrink-0"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
  const colors = ["#818cf8", "#34d399", "#fb923c", "#f472b6", "#60a5fa", "#a78bfa"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border border-border"
      style={{ background: `${color}20`, color }}>
      {initials}
    </div>
  );
}

// ─── Sortable column header ───────────────────────────────────────────────────
function SortHeader({
  field, label, sort, onSort,
}: {
  field: SortField;
  label: string;
  sort: SortState;
  onSort: (f: SortField) => void;
}) {
  const active = sort.field === field;
  return (
    <th
      className="text-left text-[10px] font-semibold text-muted uppercase tracking-wider px-3 py-3 whitespace-nowrap cursor-pointer select-none hover:text-text transition-colors group"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          sort.dir === "asc"
            ? <ChevronUp size={10} className="text-accent-blue" />
            : <ChevronDown size={10} className="text-accent-blue" />
        ) : (
          <ChevronsUpDown size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </span>
    </th>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface LeadsTableProps {
  leads: Lead[];          // already filtered & sorted — full list
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
  // Paginate the received leads slice
  const { page, pageSize } = pagination;
  const paginated = leads.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = paginated.length > 0 && paginated.every(l => selected.includes(l.id));
  const someSelected = selected.length > 0;

  if (running) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
            <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
            <div className="absolute inset-2 rounded-full border border-t-transparent animate-spin"
              style={{ animationDuration: "0.6s", borderColor: `${accent}20`, borderTopColor: `${accent}80` }} />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Agent is working…</p>
            <p className="text-xs text-muted/70 mt-1">Fetching & enriching leads</p>
          </div>
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-xs">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: `${accent}10`, border: `1px solid ${accent}20` }}>
            <Users size={24} style={{ color: accent, opacity: 0.6 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">No leads match your filters</p>
            <p className="text-xs text-muted/70 mt-1">Try adjusting filters or run the agent to fetch new leads</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2 bg-surface border-b border-border animate-fade-up shrink-0">
          <span className="text-xs text-muted font-medium">{selected.length} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => onExport(selected)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-text px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/[0.08] border border-border transition-all">
            <Download size={11} /> Export selected
          </button>
          <button
            onClick={() => onDelete(selected)}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 transition-all">
            <Trash2 size={11} /> Delete selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr className="border-b border-border">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent-blue cursor-pointer"
                />
              </th>
              <SortHeader field="name"        label="Name & Title" sort={sort} onSort={onSort} />
              <SortHeader field="company"     label="Company"      sort={sort} onSort={onSort} />
              <SortHeader field="location"    label="Location"     sort={sort} onSort={onSort} />
              <SortHeader field="emailStatus" label="Email"        sort={sort} onSort={onSort} />
              <th className="text-left text-[10px] font-semibold text-muted uppercase tracking-wider px-3 py-3 whitespace-nowrap">
                LinkedIn
              </th>
              <SortHeader field="score"   label="Score"  sort={sort} onSort={onSort} />
              <th className="text-left text-[10px] font-semibold text-muted uppercase tracking-wider px-3 py-3 whitespace-nowrap">
                Src
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
                  className={cn(
                    "border-b border-border transition-colors group cursor-pointer animate-fade-up",
                    isSelected ? "bg-accent-blue/[0.05]" : "hover:bg-white/[0.02]"
                  )}
                  style={{ animationDelay: `${Math.min(i * 15, 200)}ms` }}
                  onClick={() => onSelect(lead.id)}
                >
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => onSelect(lead.id)}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent-blue cursor-pointer" />
                  </td>
                  {/* Name */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={lead.name} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-text truncate max-w-[160px]">{lead.name || "—"}</p>
                        <p className="text-[11px] text-muted truncate max-w-[160px]">{lead.title || "—"}</p>
                      </div>
                    </div>
                  </td>
                  {/* Company */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={11} className="text-muted/70 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] text-text truncate max-w-[130px]">{lead.company || "—"}</p>
                        <p className="text-[10px] text-muted/70 truncate max-w-[130px]">{lead.industry || ""}</p>
                      </div>
                    </div>
                  </td>
                  {/* Location */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-muted/70 shrink-0" />
                      <span className="text-[11px] text-muted truncate max-w-[120px]">{lead.location || "—"}</span>
                    </div>
                  </td>
                  {/* Email */}
                  <td className="px-3 py-3">
                    <EmailStatus status={lead.emailStatus} email={lead.email} />
                  </td>
                  {/* LinkedIn */}
                  <td className="px-3 py-3">
                    {lead.linkedin
                      ? <a href={lead.linkedin} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent-blue transition-colors">
                          <ExternalLink size={10} /> View
                        </a>
                      : <span className="text-muted/50 text-xs">—</span>
                    }
                  </td>
                  {/* Score */}
                  <td className="px-3 py-3"><ScorePill score={lead.score} /></td>
                  {/* Source */}
                  <td className="px-3 py-3"><SourceBadge source={lead.source} /></td>
                  {/* Saved At */}
                  <td className="px-3 py-3">
                    {savedDate
                      ? <span className="text-[10px] text-muted/70 tabular-nums whitespace-nowrap">
                          {savedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          <br />
                          <span className="text-muted/50">{savedDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                        </span>
                      : <span className="text-muted/50 text-xs">—</span>
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
