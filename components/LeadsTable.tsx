"use client";
import { ExternalLink, Building2, MapPin, Users, Trash2, Download, Mail } from "lucide-react";
import { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

function ScorePill({ score }: { score: number }) {
  const cfg =
    score >= 85 ? { bg: "rgba(16,185,129,0.12)", col: "#10b981", bd: "rgba(16,185,129,0.25)" }
    : score >= 70 ? { bg: "rgba(245,158,11,0.12)", col: "#f59e0b", bd: "rgba(245,158,11,0.25)" }
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
    verified: { col: "#10b981", label: "Verified", icon: "●" },
    risky: { col: "#f59e0b", label: "Risky", icon: "◐" },
    not_found: { col: "#475569", label: "Not found", icon: "○" },
  }[status];
  return (
    <div className="space-y-0.5">
      <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: cfg.col }}>
        <span>{cfg.icon}</span>{cfg.label}
      </span>
      {email && (
        <p className="text-[10px] text-slate-600 font-mono truncate max-w-[160px]" title={email}>{email}</p>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: Lead["source"] }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    linkedin: { label: "in", color: "#818cf8", bg: "rgba(129,140,248,0.15)" },
    gmaps:    { label: "G",  color: "#34d399", bg: "rgba(52,211,153,0.15)" },
    amazon:   { label: "a",  color: "#fb923c", bg: "rgba(251,146,60,0.15)" },
  };
  const c = cfg[source];
  return (
    <span className="w-5 h-5 rounded text-[9px] font-bold inline-flex items-center justify-center shrink-0"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#818cf8", "#34d399", "#fb923c", "#f472b6", "#60a5fa", "#a78bfa"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border border-white/10"
      style={{ background: `${color}20`, color }}>
      {initials}
    </div>
  );
}

interface LeadsTableProps {
  leads: Lead[];
  running: boolean;
  accent: string;
  selected: string[];
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onDelete: (ids: string[]) => void;
  onExport: (ids: string[]) => void;
}

export default function LeadsTable({
  leads, running, accent, selected, onSelect, onSelectAll, onDelete, onExport
}: LeadsTableProps) {
  const allSelected = leads.length > 0 && leads.every(l => selected.includes(l.id));
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
            <p className="text-sm font-medium text-slate-300">Agent is working…</p>
            <p className="text-xs text-slate-600 mt-1">Fetching & enriching leads</p>
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
            <p className="text-sm font-semibold text-slate-300">No leads match your filters</p>
            <p className="text-xs text-slate-600 mt-1">Try adjusting filters or run the agent to fetch new leads</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0c1018] border-b border-white/[0.06] animate-fade-up">
          <span className="text-xs text-slate-400 font-medium">{selected.length} selected</span>
          <div className="flex-1" />
          <button onClick={() => onExport(selected)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/8 border border-white/10 transition-all">
            <Download size={11} /> Export
          </button>
          <button onClick={() => onDelete(selected)}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 transition-all">
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[#080b10]">
            <tr className="border-b border-white/[0.06]">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" checked={allSelected} onChange={onSelectAll}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-indigo-500 cursor-pointer" />
              </th>
              {["Name & Title", "Company", "Location", "Email", "LinkedIn", "Score", "Source"].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const isSelected = selected.includes(lead.id);
              return (
                <tr key={lead.id}
                  className={cn(
                    "border-b border-white/[0.04] transition-colors group cursor-pointer animate-fade-up",
                    isSelected ? "bg-indigo-500/[0.05]" : "hover:bg-white/[0.02]"
                  )}
                  style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
                  onClick={() => onSelect(lead.id)}>
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-3.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => onSelect(lead.id)}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-indigo-500 cursor-pointer" />
                  </td>
                  {/* Name */}
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={lead.name} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-200 truncate">{lead.name}</p>
                        <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{lead.title}</p>
                      </div>
                    </div>
                  </td>
                  {/* Company */}
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={11} className="text-slate-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] text-slate-300 truncate max-w-[130px]">{lead.company}</p>
                        <p className="text-[10px] text-slate-600 truncate max-w-[130px]">{lead.industry}</p>
                      </div>
                    </div>
                  </td>
                  {/* Location */}
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-slate-600 shrink-0" />
                      <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{lead.location}</span>
                    </div>
                  </td>
                  {/* Email */}
                  <td className="px-3 py-3.5">
                    <EmailStatus status={lead.emailStatus} email={lead.email} />
                  </td>
                  {/* LinkedIn */}
                  <td className="px-3 py-3.5">
                    {lead.linkedin
                      ? <a href={lead.linkedin} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                          <ExternalLink size={10} /> View
                        </a>
                      : <span className="text-slate-700 text-xs">—</span>
                    }
                  </td>
                  {/* Score */}
                  <td className="px-3 py-3.5"><ScorePill score={lead.score} /></td>
                  {/* Source */}
                  <td className="px-3 py-3.5"><SourceBadge source={lead.source} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
