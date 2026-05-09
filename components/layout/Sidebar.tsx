"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, MessageSquare, Target,
  GitBranch, KanbanSquare, BarChart2, Briefcase,
  ChevronLeft, ChevronRight, Zap,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import ThemeToggle from "./ThemeToggle";
import type { ModuleName } from "@/lib/types";

const NAV_ITEMS: { module: ModuleName; label: string; icon: LucideIcon; href: string; badge?: string }[] = [
  { module: "dashboard",    label: "Command Center",    icon: LayoutDashboard, href: "/dashboard" },
  { module: "leads",        label: "Lead Intelligence", icon: Users,           href: "/" },
  { module: "message-lab",  label: "AI Message Lab",    icon: MessageSquare,   href: "/message-lab" },
  { module: "scorer",       label: "Lead Scorer",        icon: Target,          href: "/scorer" },
  { module: "sequences",    label: "Sequence Builder",  icon: GitBranch,       href: "/sequences" },
  { module: "kanban",       label: "Kanban Pipeline",   icon: KanbanSquare,    href: "/kanban" },
  { module: "analytics",    label: "Analytics",          icon: BarChart2,       href: "/analytics" },
  { module: "clients",      label: "Client Manager",    icon: Briefcase,       href: "/clients" },
];

const GROUP_LABELS = ["Overview", "", "AI Tools", "", "Pipeline", "", "", ""];

export default function ProSidebar() {
  const { state, dispatch } = useApp();
  const pathname = usePathname();
  const collapsed = state.sidebarCollapsed;
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipY, setTooltipY] = useState(0);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="h-screen shrink-0 flex flex-col border-r border-border overflow-hidden relative z-20"
      style={{
        width: collapsed ? 56 : 220,
        background: "var(--surface)",
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Top ambient glow */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% -20%, rgba(0,212,255,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div className="flex items-center h-14 px-3.5 border-b border-border shrink-0 relative">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(124,58,237,0.15) 100%)",
            border: "1px solid rgba(0,212,255,0.3)",
            boxShadow: "0 0 12px rgba(0,212,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <Zap size={14} style={{ color: "var(--accent-blue)" }} />
        </div>
        <div
          className="ml-2.5 overflow-hidden whitespace-nowrap"
          style={{
            opacity: collapsed ? 0 : 1,
            width: collapsed ? 0 : "auto",
            transition: "opacity 200ms ease, width 250ms ease",
          }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-[13px] tracking-tight" style={{ color: "var(--text)" }}>
              LinkedIn
            </span>
            <span
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))",
                color: "var(--accent-blue)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}
            >
              ProOS
            </span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {/* Group 1: Command Center + Leads */}
        {!collapsed && (
          <p className="px-4 pt-1 pb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted/50">Overview</p>
        )}
        {NAV_ITEMS.slice(0, 2).map(item => (
          <NavItem
            key={item.module}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            onHover={(label, y) => { setHoveredItem(label); setTooltipY(y); }}
          />
        ))}

        <div className="mx-3 my-2" style={{ height: "1px", background: "var(--border)" }} />

        {/* Group 2: Message Lab + Scorer */}
        {!collapsed && (
          <p className="px-4 pt-1 pb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted/50">AI Tools</p>
        )}
        {NAV_ITEMS.slice(2, 4).map(item => (
          <NavItem
            key={item.module}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            onHover={(label, y) => { setHoveredItem(label); setTooltipY(y); }}
          />
        ))}

        <div className="mx-3 my-2" style={{ height: "1px", background: "var(--border)" }} />

        {/* Group 3: Pipeline modules */}
        {!collapsed && (
          <p className="px-4 pt-1 pb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted/50">Pipeline</p>
        )}
        {NAV_ITEMS.slice(4).map(item => (
          <NavItem
            key={item.module}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            onHover={(label, y) => { setHoveredItem(label); setTooltipY(y); }}
          />
        ))}
      </div>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-border py-1.5">
        {/* Collapse toggle */}
        <button
          onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
          className="w-full h-9 flex items-center gap-2 transition-colors"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : 14,
            color: "var(--muted)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {collapsed
            ? <ChevronRight size={15} />
            : <><ChevronLeft size={15} /><span className="text-[12px] font-medium">Collapse</span></>
          }
        </button>

        {/* Theme toggle */}
        <div
          className="flex items-center py-0.5"
          style={{ paddingLeft: collapsed ? 0 : 14, justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <ThemeToggle />
          {!collapsed && (
            <span className="ml-1.5 text-[11px] text-muted/60">Toggle theme</span>
          )}
        </div>

        {/* Version badge */}
        {!collapsed && (
          <div className="px-3.5 py-1">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: "rgba(0,212,255,0.06)",
                color: "var(--muted)",
                border: "1px solid rgba(0,212,255,0.1)",
              }}
            >
              ProOS v1.0
            </span>
          </div>
        )}
      </div>

      {/* Floating tooltip for collapsed mode */}
      {collapsed && hoveredItem && (
        <div
          className="fixed z-[9999] pointer-events-none animate-fade-in"
          style={{ left: 64, top: tooltipY - 14 }}
        >
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-text whitespace-nowrap"
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border-bright)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {hoveredItem}
          </div>
        </div>
      )}
    </aside>
  );
}

function NavItem({
  item, active, collapsed, onHover,
}: {
  item: { module: ModuleName; label: string; icon: LucideIcon; href: string };
  active: boolean;
  collapsed: boolean;
  onHover: (label: string | null, y: number) => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onMouseEnter={e => onHover(item.label, (e.currentTarget as HTMLElement).getBoundingClientRect().top)}
      onMouseLeave={() => onHover(null, 0)}
      className="flex items-center gap-2.5 h-9 mx-1.5 rounded-lg transition-all duration-150 relative group"
      style={{
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : 12,
        paddingRight: collapsed ? 0 : 12,
        background: active
          ? "linear-gradient(90deg, rgba(0,212,255,0.1) 0%, rgba(0,212,255,0.03) 100%)"
          : undefined,
        color: active ? "var(--text)" : "var(--muted)",
        boxShadow: active ? "inset 0 0 0 1px rgba(0,212,255,0.15)" : undefined,
      }}
      onMouseOver={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
          (e.currentTarget as HTMLElement).style.color = "var(--text)";
        }
      }}
      onMouseOut={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--muted)";
        }
      }}
    >
      {/* Active left accent */}
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full"
          style={{
            height: "60%",
            background: "linear-gradient(180deg, var(--accent-blue) 0%, rgba(0,212,255,0.4) 100%)",
            boxShadow: "0 0 8px var(--accent-blue)",
          }}
        />
      )}

      <Icon
        size={16}
        style={{
          color: active ? "var(--accent-blue)" : undefined,
          filter: active ? "drop-shadow(0 0 4px rgba(0,212,255,0.5))" : undefined,
        }}
      />

      <span
        className="text-[13px] font-medium whitespace-nowrap"
        style={{
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : "auto",
          overflow: "hidden",
          transition: "opacity 200ms ease",
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}
