"use client";
import { ExternalLink, Building2, MapPin, Users } from "lucide-react";
import { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

function ScorePill({ score }: { score: number }) {
  const cfg = score >= 85 ? { bg:"rgba(16,185,129,0.12)", col:"#10b981", bd:"rgba(16,185,129,0.25)" }
    : score >= 70 ? { bg:"rgba(245,158,11,0.12)", col:"#f59e0b", bd:"rgba(245,158,11,0.25)" }
    : { bg:"rgba(239,68,68,0.12)", col:"#ef4444", bd:"rgba(239,68,68,0.25)" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ background: cfg.bg, color: cfg.col, border: `1px solid ${cfg.bd}` }}>{score}</span>
  );
}

function EmailDot({ status }: { status: Lead["emailStatus"] }) {
  const cfg = { verified:{ col:"#10b981", label:"verified" }, risky:{ col:"#f59e0b", label:"risky" }, not_found:{ col:"#475569", label:"not found" } }[status];
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.col }} />
      <span className="text-xs" style={{ color: cfg.col }}>{cfg.label}</span>
    </span>
  );
}

interface LeadsTableProps { leads: Lead[]; running: boolean; accent: string; }

export default function LeadsTable({ leads, running, accent }: LeadsTableProps) {
  if (running) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto animate-spin" style={{ borderColor: `${accent}30`, borderTopColor: accent }} />
          <p className="text-sm text-slate-500">Agent is running…</p>
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto">
            <Users size={20} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No leads yet — run the agent to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-[#080b10] z-10">
          <tr className="border-b border-white/[0.06]">
            {["Name & Title","Company","Location","Email","LinkedIn","Score"].map(h => (
              <th key={h} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <tr key={lead.id} className={cn("border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors animate-fade-up group")} style={{ animationDelay: `${i * 30}ms` }}>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-200 text-[13px]">{lead.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{lead.title}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Building2 size={11} className="text-slate-600 shrink-0" />
                  <div>
                    <p className="text-[13px] text-slate-300">{lead.company}</p>
                    <p className="text-[11px] text-slate-600">{lead.industry}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} className="text-slate-600 shrink-0" />
                  <span className="text-[12px] text-slate-400">{lead.location}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <EmailDot status={lead.emailStatus} />
                  {lead.email && <p className="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">{lead.email}</p>}
                </div>
              </td>
              <td className="px-4 py-3">
                {lead.linkedin ? (
                  <a href={lead.linkedin} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                    <ExternalLink size={10} />View
                  </a>
                ) : <span className="text-slate-700 text-xs">—</span>}
              </td>
              <td className="px-4 py-3"><ScorePill score={lead.score} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
