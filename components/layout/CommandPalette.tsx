"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Search, ArrowRight, LayoutDashboard, Users, MessageSquare, Target, GitBranch, KanbanSquare, BarChart2, Briefcase } from "lucide-react";
import { useApp } from "@/lib/AppContext";
import type { ModuleName } from "@/lib/types";

const MODULES: { name: string; icon: LucideIcon; path: string; module: ModuleName }[] = [
  { name: "Command Center", icon: LayoutDashboard, path: "/dashboard", module: "dashboard" },
  { name: "Lead Intelligence", icon: Users, path: "/", module: "leads" },
  { name: "AI Message Lab", icon: MessageSquare, path: "/message-lab", module: "message-lab" },
  { name: "Lead Scorer", icon: Target, path: "/scorer", module: "scorer" },
  { name: "Sequence Builder", icon: GitBranch, path: "/sequences", module: "sequences" },
  { name: "Kanban Pipeline", icon: KanbanSquare, path: "/kanban", module: "kanban" },
  { name: "Analytics", icon: BarChart2, path: "/analytics", module: "analytics" },
  { name: "Client Manager", icon: Briefcase, path: "/clients", module: "clients" },
];

const ACTIONS = [
  { name: "Add Lead", path: "/", desc: "Add a new lead manually" },
  { name: "Generate Message", path: "/message-lab", desc: "Create outreach with Claude" },
  { name: "Score Lead", path: "/scorer", desc: "Run ICP scoring" },
  { name: "Export CSV", path: "/", desc: "Export all leads as CSV" },
];

export default function CommandPalette() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const leads = state.leads;
  const q = query.toLowerCase().trim();

  const matchedLeads = q ? leads.filter(l =>
    l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q)
  ).slice(0, 5) : [];

  const matchedModules = q ? MODULES.filter(m =>
    m.name.toLowerCase().includes(q)
  ) : MODULES;

  const matchedActions = q ? ACTIONS.filter(a =>
    a.name.toLowerCase().includes(q)
  ) : [];

  const allResults = [
    ...matchedLeads.map(l => ({ type: "lead" as const, label: `${l.name} — ${l.company}`, sub: l.title, path: "/", lead: l })),
    ...matchedModules.map(m => ({ type: "module" as const, label: m.name, sub: "", path: m.path, module: m.module })),
    ...matchedActions.map(a => ({ type: "action" as const, label: a.name, sub: a.desc, path: a.path })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && allResults[highlight]) {
      execute(allResults[highlight]);
    }
    if (e.key === "Escape") setOpen(false);
  };

  const execute = (item: typeof allResults[number]) => {
    setOpen(false);
    if (item.type === "module") {
      dispatch({ type: "SET_MODULE", payload: item.module! });
    }
    router.push(item.path);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div
        className="relative w-[520px] max-w-[95vw] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Search size={15} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlight(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search leads, modules, actions…"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted border border-border">ESC</kbd>
        </div>

        <div className="max-h-[350px] overflow-y-auto py-2">
          {allResults.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">No results found</p>
          ) : (
            allResults.map((item, i) => (
              <button
                key={`${item.type}-${i}`}
                onClick={() => execute(item)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === highlight ? "bg-white/[0.06]" : ""
                }`}
              >
                {item.type === "lead" && (
                  <div className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-[10px] font-bold shrink-0">
                    {item.lead?.name?.[0] || "?"}
                  </div>
                )}
                {item.type === "module" && <ArrowRight size={12} className="text-muted shrink-0" />}
                {item.type === "action" && <ArrowRight size={12} className="text-accent-blue shrink-0" />}
                <div className="min-w-0">
                  <span className="text-xs text-text">{item.label}</span>
                  {item.sub && <span className="text-[10px] text-muted ml-1.5">{item.sub}</span>}
                </div>
                <span className="text-[9px] text-muted/50 shrink-0 ml-auto uppercase">
                  {item.type === "lead" ? "Lead" : item.type === "module" ? "Module" : "Action"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
