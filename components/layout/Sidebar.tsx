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

const NAV_ITEMS: { module: ModuleName; label: string; icon: LucideIcon; href: string }[] = [
  { module: "dashboard",    label: "Command Center",    icon: LayoutDashboard, href: "/dashboard" },
  { module: "leads",        label: "Lead Intelligence", icon: Users,            href: "/" },
  { module: "message-lab",  label: "AI Message Lab",    icon: MessageSquare,   href: "/message-lab" },
  { module: "scorer",       label: "Lead Scorer",       icon: Target,          href: "/scorer" },
  { module: "sequences",    label: "Sequence Builder",  icon: GitBranch,       href: "/sequences" },
  { module: "kanban",       label: "Kanban Pipeline",   icon: KanbanSquare,    href: "/kanban" },
  { module: "analytics",    label: "Analytics",          icon: BarChart2,       href: "/analytics" },
  { module: "clients",      label: "Client Manager",    icon: Briefcase,       href: "/clients" },
];

export default function ProSidebar() {
  const { state, dispatch } = useApp();
  const pathname = usePathname();
  const collapsed = state.sidebarCollapsed;
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="h-screen shrink-0 flex flex-col bg-surface border-r border-border transition-all duration-200 ease-out overflow-hidden"
      style={{ width: collapsed ? 56 : 220 }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent-blue/15 border border-accent-blue/25 shrink-0">
          <Zap size={14} className="text-accent-blue" />
        </div>
        <span
          className="ml-2.5 font-semibold text-[13px] text-text whitespace-nowrap transition-opacity duration-150"
          style={{ opacity: collapsed ? 0 : 1, overflow: "hidden" }}
        >
          LinkedIn ProOS
        </span>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {/* Group 1: Command Center + Leads */}
        {NAV_ITEMS.slice(0, 2).map(item => (
          <NavItem
            key={item.module}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            onHover={setHoveredTooltip}
          />
        ))}

        <div className="mx-4 my-1.5 border-t border-border" />

        {/* Group 2: Message Lab + Scorer */}
        {NAV_ITEMS.slice(2, 4).map(item => (
          <NavItem
            key={item.module}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            onHover={setHoveredTooltip}
          />
        ))}

        <div className="mx-4 my-1.5 border-t border-border" />

        {/* Group 3: Sequences + Kanban + Analytics + Clients */}
        {NAV_ITEMS.slice(4).map(item => (
          <NavItem
            key={item.module}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            onHover={setHoveredTooltip}
          />
        ))}
      </div>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-border py-2">
        {/* Collapse toggle */}
        <button
          onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
          className="w-full h-10 flex items-center gap-2.5 px-4 text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
          style={{ justifyContent: collapsed ? "center" : "flex-start", paddingLeft: collapsed ? 0 : 16 }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <span
            className="text-[13px] font-medium whitespace-nowrap transition-opacity duration-150"
            style={{ opacity: collapsed ? 0 : 1 }}
          >
            Collapse
          </span>
        </button>

        {/* Theme toggle */}
        <div className="flex items-center px-4 py-1" style={{ justifyContent: collapsed ? "center" : "flex-start" }}>
          <ThemeToggle />
          {!collapsed && <span className="ml-2 text-[11px] text-muted">Toggle theme</span>}
        </div>

        {/* Version */}
        {!collapsed && (
          <div className="px-4 py-1">
            <span className="text-[10px] text-muted">ProOS v1.0</span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {collapsed && hoveredTooltip && (
        <div
          className="fixed z-[9999] px-3 py-1.5 rounded-md text-xs bg-surface2 border border-border text-text shadow-lg pointer-events-none"
          style={{ left: 64, top: "auto" }}
        >
          {hoveredTooltip}
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
  onHover: (label: string | null) => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onMouseEnter={() => onHover(item.label)}
      onMouseLeave={() => onHover(null)}
      className="flex items-center gap-2.5 h-10 mx-2 rounded-md transition-colors duration-150 text-muted hover:text-text hover:bg-white/[0.04]"
      style={{
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : 19,
        paddingRight: collapsed ? 0 : 16,
        borderLeft: active ? "3px solid var(--accent-blue)" : "3px solid transparent",
        background: active ? "rgba(0,212,255,0.07)" : undefined,
        color: active ? "var(--text)" : undefined,
      }}
    >
      <Icon size={18} style={{ color: active ? "var(--accent-blue)" : undefined }} />
      <span
        className="text-[13px] font-medium whitespace-nowrap transition-opacity duration-150"
        style={{ opacity: collapsed ? 0 : 1 }}
      >
        {item.label}
      </span>
    </Link>
  );
}
