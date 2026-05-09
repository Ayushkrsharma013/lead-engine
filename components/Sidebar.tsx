"use client";
import { Play, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LogEntry, Source, Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  source: Source;
  running: boolean;
  done: boolean;
  log: LogEntry[];
  stats: Stats | null;
  fields: Record<string, string>;
  setFields: (f: Record<string, string>) => void;
  onRun: () => void;
  onExport: () => void;
  accent: string;
}

const FIELD_CONFIG: Record<Source, Array<{ key: string; label: string; type: "input"|"select"; options?: string[] }>> = {
  linkedin: [
    { key: "titles", label: "Job Titles", type: "input" },
    { key: "seniority", label: "Seniority", type: "select", options: ["Any","Founder/CEO","VP/Director","Manager","Senior"] },
    { key: "industry", label: "Industry", type: "select", options: ["Any","SaaS / Software","Fintech","MarTech","HealthTech","E-commerce"] },
    { key: "size", label: "Company Size", type: "select", options: ["Any","1-10","11-50","51-200","201-500"] },
    { key: "country", label: "Country", type: "select", options: ["United States","Canada","United Kingdom","Australia"] },
    { key: "limit", label: "Max Results", type: "select", options: ["50","100","200","500"] },
  ],
  gmaps: [
    { key: "keyword", label: "Search Keyword", type: "input" },
    { key: "location", label: "Location", type: "input" },
    { key: "category", label: "Business Type", type: "select", options: ["Any","Tech Agency","SaaS Company","Startup","Consulting"] },
    { key: "limit", label: "Max Results", type: "select", options: ["20","50","100"] },
  ],
  amazon: [
    { key: "category", label: "Product Category", type: "input" },
    { key: "minRevenue", label: "Min Est. Revenue", type: "select", options: ["Any","$10K/mo","$50K/mo","$100K/mo"] },
    { key: "sellerType", label: "Seller Type", type: "select", options: ["Any","FBA","FBM","Private Label"] },
    { key: "limit", label: "Max Results", type: "select", options: ["20","50","100"] },
  ],
};

export default function Sidebar({ source, running, done, log, stats, fields, setFields, onRun, onExport, accent }: SidebarProps) {
  const fieldConfig = FIELD_CONFIG[source];

  return (
    <aside className="w-[280px] shrink-0 h-full border-r border-white/[0.06] bg-[#0c1018] flex flex-col overflow-hidden">
      <div className="p-4 space-y-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Search Filters</p>
        {fieldConfig.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs text-slate-400">{f.label}</label>
            {f.type === "input" ? (
              <Input placeholder={`Enter ${f.label.toLowerCase()}...`} value={fields[f.key] || ""} onChange={e => setFields({ ...fields, [f.key]: e.target.value })} />
            ) : (
              <Select value={fields[f.key] || ""} onChange={e => setFields({ ...fields, [f.key]: e.target.value })}>
                {f.options?.map(o => <option key={o} value={o} className="bg-[#0c1018]">{o}</option>)}
              </Select>
            )}
          </div>
        ))}

        <Button className="w-full mt-2" style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}30` }}
          onClick={onRun} disabled={running}>
          <Play size={13} className={running ? "animate-pulse" : ""} />
          {running ? "Running…" : "Run Agent"}
        </Button>
      </div>

      <Separator />

      {stats && (
        <div className="p-4 grid grid-cols-2 gap-2">
          {[
            { label: "Leads", value: stats.total },
            { label: "With Email", value: `${stats.withEmail}` },
            { label: "Avg Score", value: `${stats.avgScore}` },
            { label: "Top Industry", value: stats.topIndustry.split(" ")[0], small: true },
          ].map(s => (
            <div key={s.label} className="rounded-md bg-white/[0.03] border border-white/[0.05] p-2.5">
              <p className="text-[10px] text-slate-500 mb-0.5">{s.label}</p>
              <p className={cn("font-semibold truncate", s.small ? "text-xs" : "text-sm")} style={{ color: accent }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {done && (
        <>
          <Separator />
          <div className="p-4">
            <Button variant="outline" className="w-full" onClick={onExport}>
              <Download size={13} />Export CSV
            </Button>
          </div>
        </>
      )}

      <Separator />

      <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Agent Log</p>
        {log.length === 0 && <p className="text-xs text-slate-600">Run the agent to see activity…</p>}
        {log.map(entry => (
          <div key={entry.id} className="flex gap-2 items-start animate-fade-up">
            <ChevronRight size={10} className="mt-0.5 shrink-0" style={{ color: entry.type === "success" ? "#10b981" : entry.type === "warn" ? "#f59e0b" : "#6366f1" }} />
            <div>
              <span className="text-[10px] text-slate-600 font-mono">{entry.ts} </span>
              <span className={cn("text-[11px]", entry.type === "success" ? "text-emerald-400" : entry.type === "warn" ? "text-amber-400" : "text-slate-400")}>{entry.text}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
