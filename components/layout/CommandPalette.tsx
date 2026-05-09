"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Search, LayoutDashboard, Users, MessageSquare, Target,
  GitBranch, KanbanSquare, BarChart2, Briefcase, ArrowRight, Zap,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import type { ModuleName } from "@/lib/types";

const MODULES: { name: string; icon: LucideIcon; path: string; module: ModuleName; desc: string }[] = [
  { name: "Command Center",    icon: LayoutDashboard, path: "/dashboard",   module: "dashboard",    desc: "Overview & campaigns" },
  { name: "Lead Intelligence", icon: Users,           path: "/",            module: "leads",        desc: "Browse & filter leads" },
  { name: "AI Message Lab",    icon: MessageSquare,   path: "/message-lab", module: "message-lab",  desc: "Generate outreach with Claude" },
  { name: "Lead Scorer",       icon: Target,          path: "/scorer",      module: "scorer",       desc: "ICP scoring & analysis" },
  { name: "Sequence Builder",  icon: GitBranch,       path: "/sequences",   module: "sequences",    desc: "Build outreach sequences" },
  { name: "Kanban Pipeline",   icon: KanbanSquare,    path: "/kanban",      module: "kanban",       desc: "Visual deal pipeline" },
  { name: "Analytics",          icon: BarChart2,       path: "/analytics",   module: "analytics",    desc: "Performance metrics" },
  { name: "Client Manager",    icon: Briefcase,       path: "/clients",     module: "clients",      desc: "Manage client accounts" },
];

const QUICK_ACTIONS = [
  { name: "Run Lead Agent",     path: "/",            desc: "Fetch new leads from LinkedIn", icon: Zap },
  { name: "Generate Message",   path: "/message-lab", desc: "Create AI-powered outreach",    icon: MessageSquare },
  { name: "Score a Lead",       path: "/scorer",      desc: "Run ICP scoring analysis",      icon: Target },
];

export default function CommandPalette() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const matchedLeads = q
    ? leads.filter(l => l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q)).slice(0, 4)
    : [];

  const matchedModules = q
    ? MODULES.filter(m => m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q))
    : MODULES;

  const matchedActions = q
    ? QUICK_ACTIONS.filter(a => a.name.toLowerCase().includes(q))
    : QUICK_ACTIONS;

  type ResultItem =
    | { type: "lead"; label: string; sub: string; path: string; lead: typeof leads[number] }
    | { type: "module"; label: string; sub: string; path: string; module: ModuleName; icon: LucideIcon }
    | { type: "action"; label: string; sub: string; path: string; icon: LucideIcon };

  const allResults: ResultItem[] = [
    ...matchedLeads.map(l => ({
      type: "lead" as const,
      label: l.name,
      sub: `${l.title} · ${l.company}`,
      path: "/",
      lead: l,
    })),
    ...matchedModules.map(m => ({
      type: "module" as const,
      label: m.name,
      sub: m.desc,
      path: m.path,
      module: m.module,
      icon: m.icon,
    })),
    ...matchedActions.map(a => ({
      type: "action" as const,
      label: a.name,
      sub: a.desc,
      path: a.path,
      icon: a.icon,
    })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && allResults[highlight]) execute(allResults[highlight]);
    if (e.key === "Escape") setOpen(false);
  };

  const execute = (item: ResultItem) => {
    setOpen(false);
    if (item.type === "module") {
      dispatch({ type: "SET_MODULE", payload: item.module });
    }
    router.push(item.path);
  };

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[highlight] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlight]);

  if (!open) return null;

  // Group labels
  const hasLeads   = matchedLeads.length > 0;
  const hasModules = matchedModules.length > 0;
  const hasActions = !q && matchedActions.length > 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center"
      style={{ paddingTop: "14vh" }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      />

      {/* Panel */}
      <div
        className="relative w-[560px] max-w-[95vw] overflow-hidden animate-scale-in"
        style={{
          background: "rgba(13,13,18,0.96)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(0,212,255,0.15)",
          borderRadius: "16px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(0,212,255,0.08)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}
          >
            <Search size={14} style={{ color: "var(--accent-blue)" }} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlight(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search leads, modules, actions…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text)" }}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto py-2" ref={listRef}>
          {allResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <Search size={16} style={{ color: "var(--muted)" }} />
              </div>
              <p className="text-sm" style={{ color: "var(--muted)" }}>No results for "{query}"</p>
            </div>
          ) : (
            <>
              {/* Lead results */}
              {hasLeads && (
                <>
                  <GroupLabel label="Leads" />
                  {matchedLeads.map((lead, i) => {
                    const idx = i;
                    const active = idx === highlight;
                    return (
                      <ResultRow
                        key={`lead-${lead.id}`}
                        active={active}
                        onClick={() => execute(allResults[idx])}
                        onMouseEnter={() => setHighlight(idx)}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                          style={{ background: "rgba(124,58,237,0.2)", color: "var(--accent-purple)" }}
                        >
                          {lead.name?.[0] || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{lead.name}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{lead.title} · {lead.company}</p>
                        </div>
                        <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.12)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.2)" }}>Lead</span>
                      </ResultRow>
                    );
                  })}
                </>
              )}

              {/* Module results */}
              {hasModules && (
                <>
                  <GroupLabel label={q ? "Modules" : "Navigate to"} />
                  {matchedModules.map((mod, i) => {
                    const idx = matchedLeads.length + i;
                    const active = idx === highlight;
                    const Icon = mod.icon;
                    return (
                      <ResultRow
                        key={`module-${mod.module}`}
                        active={active}
                        onClick={() => execute(allResults[idx])}
                        onMouseEnter={() => setHighlight(idx)}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.12)" }}
                        >
                          <Icon size={13} style={{ color: "var(--accent-blue)" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{mod.name}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{mod.desc}</p>
                        </div>
                        <ArrowRight size={12} style={{ color: "var(--muted)", opacity: 0.5 }} className="shrink-0" />
                      </ResultRow>
                    );
                  })}
                </>
              )}

              {/* Quick actions */}
              {hasActions && (
                <>
                  <GroupLabel label="Quick Actions" />
                  {matchedActions.map((action, i) => {
                    const idx = matchedLeads.length + matchedModules.length + i;
                    const active = idx === highlight;
                    const Icon = action.icon;
                    return (
                      <ResultRow
                        key={`action-${action.name}`}
                        active={active}
                        onClick={() => execute(allResults[idx])}
                        onMouseEnter={() => setHighlight(idx)}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(0,212,255,0.06)" }}
                        >
                          <Icon size={13} style={{ color: "var(--accent-blue)" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{action.name}</p>
                          <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{action.desc}</p>
                        </div>
                        <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,212,255,0.08)", color: "var(--accent-blue)", border: "1px solid rgba(0,212,255,0.15)" }}>Action</span>
                      </ResultRow>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-3">
            <KbdHint keys={["↑", "↓"]} label="navigate" />
            <KbdHint keys={["↵"]} label="open" />
          </div>
          <span className="text-[10px]" style={{ color: "var(--muted)" }}>
            {allResults.length} result{allResults.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p
      className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em]"
      style={{ color: "var(--muted)", opacity: 0.7 }}
    >
      {label}
    </p>
  );
}

function ResultRow({
  children, active, onClick, onMouseEnter,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
      style={{
        background: active ? "rgba(0,212,255,0.06)" : "transparent",
        borderLeft: active ? "2px solid rgba(0,212,255,0.5)" : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map(k => (
        <kbd
          key={k}
          className="text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {k}
        </kbd>
      ))}
      <span className="text-[10px] ml-0.5" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}
