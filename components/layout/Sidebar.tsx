"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, MessageSquare, Target,
  GitBranch, KanbanSquare, BarChart2, Briefcase,
  ChevronLeft, ChevronRight, Zap, Settings2, Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import ThemeToggle from "./ThemeToggle";
import type { ModuleName } from "@/lib/types";

type NavItemDef = { module: ModuleName; label: string; icon: LucideIcon; href: string };

const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Overview",
    items: [
      { module: "dashboard", label: "Command Center",    icon: LayoutDashboard, href: "/dashboard" },
      { module: "leads",     label: "Lead Intelligence", icon: Users,           href: "/leads" },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { module: "message-lab", label: "AI Message Lab", icon: MessageSquare, href: "/message-lab" },
      { module: "scorer",      label: "Lead Scorer",     icon: Target,        href: "/scorer" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { module: "sequences", label: "Sequence Builder", icon: GitBranch,     href: "/sequences" },
      { module: "kanban",    label: "Kanban Pipeline",  icon: KanbanSquare,  href: "/kanban" },
      { module: "analytics", label: "Analytics",         icon: BarChart2,     href: "/analytics" },
      { module: "clients",   label: "Client Manager",   icon: Briefcase,     href: "/clients" },
    ],
  },
];

const COLLAPSED_W = 64;
const EXPANDED_W = 248;

export default function ProSidebar() {
  const { state, dispatch } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = state.sidebarCollapsed;

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipY, setTooltipY] = useState(0);

  const [pillStyle, setPillStyle] = useState<{ top: number; height: number } | null>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  const isActive = useCallback((href: string) => {
    if (href === "/leads") return pathname === "/leads";
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }, [pathname]);

  // Find current active href for pill tracking
  const activeHref = NAV_GROUPS.flatMap(g => g.items).find(item => isActive(item.href))?.href ?? null;

  // Update pill position
  useEffect(() => {
    if (collapsed) { setPillStyle(null); return; }
    const raf = requestAnimationFrame(() => {
      const container = navContainerRef.current;
      if (!container) return;
      const activeEl = container.querySelector('[data-nav-active="true"]') as HTMLElement | null;
      if (activeEl) {
        const cRect = container.getBoundingClientRect();
        const aRect = activeEl.getBoundingClientRect();
        setPillStyle({ top: aRect.top - cRect.top, height: aRect.height });
      } else {
        setPillStyle(null);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeHref, collapsed, pathname]);

  return (
    <aside
      className="h-screen shrink-0 flex flex-col relative z-20"
      style={{
        width: collapsed ? COLLAPSED_W : EXPANDED_W,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 56,
          paddingLeft: collapsed ? 0 : 16,
          paddingRight: collapsed ? 0 : 16,
          justifyContent: collapsed ? "center" : "flex-start",
          borderBottom: "1px solid var(--sidebar-border)",
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid rgba(201,168,124,0.25)",
          }}
        >
          <Zap size={15} style={{ color: "var(--accent)" }} />
        </div>
        <div
          className="overflow-hidden whitespace-nowrap"
          style={{
            opacity: collapsed ? 0 : 1,
            width: collapsed ? 0 : "auto",
            marginLeft: collapsed ? 0 : 12,
            transition: "opacity 200ms ease, width 200ms ease, margin-left 200ms ease",
          }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-[14px] tracking-tight" style={{ color: "var(--ink)" }}>
              LinkedIn
            </span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid rgba(201,168,124,0.20)",
              }}
            >
              ProOS
            </span>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div ref={navContainerRef} className="flex-1 py-3 overflow-y-auto overflow-x-hidden relative">

        {/* Animated active pill */}
        {!collapsed && pillStyle && (
          <div
            className="absolute left-2 right-2 rounded-lg pointer-events-none"
            style={{
              top: pillStyle.top,
              height: pillStyle.height,
              background: "linear-gradient(90deg, rgba(201,168,124,0.10), rgba(201,168,124,0.18))",
              border: "1px solid rgba(201,168,124,0.15)",
              boxShadow: "0 1px 8px rgba(201,168,124,0.05)",
              transition: "top 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}

        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {/* Section label (expanded) */}
            {!collapsed && (
              <p
                className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.14em] select-none"
                style={{ color: "var(--ink-4)", opacity: 0.40 }}
              >
                {group.label}
              </p>
            )}
            {/* Group separator (collapsed) */}
            {collapsed && gi > 0 && (
              <div className="mx-4 my-2" style={{ height: 1, background: "var(--sidebar-border)" }} />
            )}
            <div className="space-y-0.5 px-2">
              {group.items.map(item => (
                <div
                  key={item.module}
                  onMouseEnter={e => {
                    if (!collapsed) return;
                    setHoveredItem(item.label);
                    setTooltipY((e.currentTarget as HTMLElement).getBoundingClientRect().top);
                  }}
                  onMouseLeave={() => { setHoveredItem(null); setTooltipY(0); }}
                >
                  <NavItem item={item} active={isActive(item.href)} collapsed={collapsed} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom Section ── */}
      <div
        className="shrink-0 py-1.5"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        {/* Agent */}
        <SidebarBottomButton
          collapsed={collapsed}
          active={!state.agentCollapsed}
          icon={Sparkles}
          label="Agent"
          onClick={() => dispatch({ type: "TOGGLE_AGENT" })}
        />

        {/* Settings */}
        <SidebarBottomButton
          collapsed={collapsed}
          active={pathname === "/settings"}
          icon={Settings2}
          label="Settings"
          onClick={() => router.push("/settings")}
        />

        {/* Collapse toggle */}
        <SidebarBottomButton
          collapsed={collapsed}
          active={false}
          icon={collapsed ? ChevronRight : ChevronLeft}
          label="Collapse"
          onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
        />

        {/* Theme toggle */}
        <div
          className="flex items-center py-0.5 rounded-lg mx-1.5 transition-colors duration-200"
          style={{
            paddingLeft: collapsed ? 0 : 12,
            justifyContent: collapsed ? "center" : "flex-start",
            height: 36,
            width: collapsed ? 36 : undefined,
            margin: collapsed ? "0 auto" : undefined,
          }}
        >
          <ThemeToggle />
          {!collapsed && (
            <span className="ml-1.5 text-[11px] select-none" style={{ color: "var(--ink-4)" }}>
              Toggle theme
            </span>
          )}
        </div>

        {/* Version badge */}
        {!collapsed && (
          <div className="px-4 pt-0.5 pb-1">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-block select-none"
              style={{
                background: "rgba(201,168,124,0.05)",
                color: "var(--ink-4)",
                border: "1px solid var(--sidebar-border)",
              }}
            >
              ProOS v1.0
            </span>
          </div>
        )}
      </div>

      {/* ── Collapsed tooltip ── */}
      {collapsed && hoveredItem && (
        <div
          className="fixed z-[9999] pointer-events-none animate-fade-in"
          style={{ left: COLLAPSED_W + 8, top: tooltipY - 12 }}
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

/* ── Reusable bottom button ── */
function SidebarBottomButton({
  collapsed, active, icon: Icon, label, onClick,
}: {
  collapsed: boolean;
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 rounded-lg transition-all duration-200"
      style={{
        height: 36,
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : 12,
        width: collapsed ? 36 : "calc(100% - 12px)",
        margin: collapsed ? "0 auto" : "0 6px",
        color: active ? "var(--accent)" : hovered ? "var(--ink-2)" : "var(--ink-3)",
        background: active
          ? "rgba(201,168,124,0.08)"
          : hovered
            ? "rgba(237,234,226,0.04)"
            : "transparent",
      }}
    >
      <Icon size={15} />
      {!collapsed && (
        <span className="text-[12px] font-medium whitespace-nowrap animate-fade-in">
          {label}
        </span>
      )}
    </button>
  );
}

/* ── Nav item ── */
function NavItem({
  item, active, collapsed,
}: {
  item: NavItemDef;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      data-nav-active={active ? "true" : "false"}
      className="flex items-center rounded-lg relative group"
      style={{
        height: 36,
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : 12,
        paddingRight: collapsed ? 0 : 12,
        color: active ? "var(--accent-ink)" : "var(--ink-3)",
        transition: "color 200ms ease, gap 200ms ease",
      }}
    >
      {/* Hover gradient (only when not active) */}
      {!active && (
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            background: "linear-gradient(90deg, rgba(237,234,226,0.02), rgba(201,168,124,0.06))",
          }}
        />
      )}

      {/* Right-edge accent bar on hover (only when not active) */}
      {!active && (
        <div
          className="absolute right-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            top: 8,
            bottom: 8,
            width: 2,
            background: "rgba(201,168,124,0.25)",
          }}
        />
      )}

      <Icon
        size={16}
        className="shrink-0"
        style={{
          color: active ? "var(--accent)" : undefined,
          transition: "color 200ms ease",
        }}
      />

      <span
        className="text-[13px] font-medium whitespace-nowrap"
        style={{
          display: collapsed ? "none" : "inline",
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? "translateX(-4px)" : "translateX(0)",
          transition: "opacity 200ms ease, transform 200ms ease",
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}
