"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, MessageSquare, Target,
  GitBranch, KanbanSquare, BarChart2, Briefcase,
  ChevronLeft, ChevronRight, Zap, Settings2,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import ThemeToggle from "./ThemeToggle";
import type { ModuleName } from "@/lib/types";

const NAV_ITEMS: { module: ModuleName; label: string; icon: LucideIcon; href: string }[] = [
  { module: "dashboard",    label: "Command Center",    icon: LayoutDashboard, href: "/dashboard" },
  { module: "leads",        label: "Lead Intelligence", icon: Users,           href: "/" },
  { module: "message-lab",  label: "AI Message Lab",    icon: MessageSquare,   href: "/message-lab" },
  { module: "scorer",       label: "Lead Scorer",        icon: Target,          href: "/scorer" },
  { module: "sequences",    label: "Sequence Builder",  icon: GitBranch,       href: "/sequences" },
  { module: "kanban",       label: "Kanban Pipeline",   icon: KanbanSquare,    href: "/kanban" },
  { module: "analytics",    label: "Analytics",          icon: BarChart2,       href: "/analytics" },
  { module: "clients",      label: "Client Manager",    icon: Briefcase,       href: "/clients" },
];

export default function ProSidebar() {
  const { state, dispatch } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = state.sidebarCollapsed;
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipY, setTooltipY] = useState(0);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="h-screen shrink-0 flex flex-col border-r relative z-20"
      style={{
        width: collapsed ? 56 : 232,
        background: "linear-gradient(180deg, var(--bg) 0%, var(--bg-grain) 100%)",
        borderColor: "var(--line)",
        transition: "width 150ms ease, background-color 150ms ease, border-color 150ms ease",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-14 px-3.5 shrink-0 relative"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
          }}
        >
          <Zap size={14} style={{ color: "var(--accent)" }} />
        </div>
        <div
          className="ml-2.5 overflow-hidden whitespace-nowrap"
          style={{
            opacity: collapsed ? 0 : 1,
            width: collapsed ? 0 : "auto",
            transition: "opacity 150ms ease, width 150ms ease",
          }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-[13px] tracking-tight" style={{ color: "var(--ink)" }}>
              LinkedIn
            </span>
            <span
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid var(--line)",
              }}
            >
              ProOS
            </span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-4 pt-1 pb-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>Overview</p>
        )}
        {NAV_ITEMS.slice(0, 2).map(item => (
          <div
            key={item.module}
            onMouseEnter={e => { setHoveredItem(item.label); setTooltipY((e.currentTarget as HTMLElement).getBoundingClientRect().top); }}
            onMouseLeave={() => { setHoveredItem(null); setTooltipY(0); }}
          >
            <NavItem item={item} active={isActive(item.href)} collapsed={collapsed} />
          </div>
        ))}

        <div className="mx-3 my-2" style={{ height: "1px", background: "var(--line)" }} />

        {!collapsed && (
          <p className="px-4 pt-1 pb-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>AI Tools</p>
        )}
        {NAV_ITEMS.slice(2, 4).map(item => (
          <div
            key={item.module}
            onMouseEnter={e => { setHoveredItem(item.label); setTooltipY((e.currentTarget as HTMLElement).getBoundingClientRect().top); }}
            onMouseLeave={() => { setHoveredItem(null); setTooltipY(0); }}
          >
            <NavItem item={item} active={isActive(item.href)} collapsed={collapsed} />
          </div>
        ))}

        <div className="mx-3 my-2" style={{ height: "1px", background: "var(--line)" }} />

        {!collapsed && (
          <p className="px-4 pt-1 pb-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>Pipeline</p>
        )}
        {NAV_ITEMS.slice(4).map(item => (
          <div
            key={item.module}
            onMouseEnter={e => { setHoveredItem(item.label); setTooltipY((e.currentTarget as HTMLElement).getBoundingClientRect().top); }}
            onMouseLeave={() => { setHoveredItem(null); setTooltipY(0); }}
          >
            <NavItem item={item} active={isActive(item.href)} collapsed={collapsed} />
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div className="shrink-0 py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
        <button
          onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
          className="w-full h-9 flex items-center gap-2 transition-colors hover:bg-[var(--surface-2)]"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : 14,
            color: "var(--ink-3)",
          }}
        >
          {collapsed
            ? <ChevronRight size={15} />
            : <><ChevronLeft size={15} /><span className="text-[12px] font-medium">Collapse</span></>
          }
        </button>

        <button
          onClick={() => router.push("/settings")}
          className="w-full h-9 flex items-center gap-2 transition-colors hover:bg-[var(--surface-2)]"
          style={{
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : 14,
            color: pathname === "/settings" ? "var(--accent)" : "var(--ink-3)",
          }}
          title="Settings"
        >
          <Settings2 size={15} />
          {!collapsed && <span className="text-[12px] font-medium">Settings</span>}
        </button>

        <div
          className="flex items-center py-0.5"
          style={{ paddingLeft: collapsed ? 0 : 14, justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <ThemeToggle />
          {!collapsed && (
            <span className="ml-1.5 text-[11px]" style={{ color: "var(--ink-4)" }}>Toggle theme</span>
          )}
        </div>

        {!collapsed && (
          <div className="px-3.5 py-1">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: "var(--accent-soft)",
                color: "var(--ink-4)",
                border: "1px solid var(--line)",
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
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
            style={{
              background: "var(--surface-elev)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-md)",
              color: "var(--ink)",
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
  item, active, collapsed,
}: {
  item: { module: ModuleName; label: string; icon: LucideIcon; href: string };
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 h-9 mx-1.5 rounded-lg transition-all duration-150 relative group hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      style={{
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : 12,
        paddingRight: collapsed ? 0 : 12,
        paddingTop: 8,
        paddingBottom: 8,
        background: active ? "var(--surface-elev)" : undefined,
        color: active ? "var(--ink)" : "var(--ink-3)",
        border: active ? "1px solid var(--line)" : "1px solid transparent",
        boxShadow: active ? "var(--shadow-sm)" : undefined,
      }}
    >
      <Icon
        size={16}
        style={{ color: active ? "var(--accent)" : undefined }}
      />

      <span
        className="text-[13px] font-medium whitespace-nowrap"
        style={{
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : "auto",
          overflow: "hidden",
          transition: "opacity 150ms ease",
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}
