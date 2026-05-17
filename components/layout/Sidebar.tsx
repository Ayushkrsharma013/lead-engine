"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, MessageSquare, Target,
  GitBranch, KanbanSquare, BarChart2, Briefcase,
  ChevronLeft, ChevronRight, ChevronDown, Settings2,
  Sparkles, Send, Bot, UserPlus, Zap, Cpu, Shield,
  HardDrive, Search, Workflow, BarChart3, FileText,
  Sun, Moon, LogOut, User, ChevronUp,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { createClient } from "@/lib/supabase/client";
import type { ModuleName } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  module: ModuleName;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

// ─── Menu structure ───────────────────────────────────────────────────────

const TREE_SECTIONS = new Set(["agent-workforce"]);

const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { id: "dashboard", module: "dashboard", label: "Command Center", icon: LayoutDashboard, href: "/dashboard" },
      { id: "leads", module: "leads", label: "Lead Intelligence", icon: Users, href: "/leads" },
    ],
  },
  {
    id: "agent-workforce",
    label: "Agent Workforce",
    items: [
      { id: "agents-command", module: "agent", label: "Command Center", icon: Cpu, href: "/admin/agents" },
      { id: "agent-finance", module: "agent", label: "Finance Agent", icon: Bot, href: "/agent/finance" },
      { id: "agent-data-janitor", module: "agent", label: "Data Janitor", icon: HardDrive, href: "/admin/agents/data-janitor" },
      { id: "agent-lead-scout", module: "agent", label: "Lead Scout", icon: Search, href: "/admin/agents/lead-scout" },
      { id: "agent-outreach", module: "agent", label: "Outreach Agent", icon: Send, href: "/admin/agents/outreach-agent" },
      { id: "agent-pipeline", module: "agent", label: "Pipeline Manager", icon: Workflow, href: "/admin/agents/pipeline-manager" },
      { id: "agent-icp", module: "agent", label: "ICP Analyst", icon: BarChart3, href: "/admin/agents/icp-analyst" },
      { id: "agent-reporter", module: "agent", label: "Client Reporter", icon: FileText, href: "/admin/agents/client-reporter" },
      { id: "agent-coach", module: "agent", label: "Message Coach", icon: MessageSquare, href: "/admin/agents/message-coach" },
    ],
  },
  {
    id: "ai-studio",
    label: "AI Studio",
    items: [
      { id: "message-lab", module: "message-lab", label: "AI Message Lab", icon: MessageSquare, href: "/message-lab" },
      { id: "scorer", module: "scorer", label: "Lead Scorer", icon: Target, href: "/scorer" },
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { id: "sequences", module: "sequences", label: "Sequence Builder", icon: GitBranch, href: "/sequences" },
      { id: "kanban", module: "kanban", label: "Kanban Pipeline", icon: KanbanSquare, href: "/kanban" },
      { id: "analytics", module: "analytics", label: "Analytics", icon: BarChart2, href: "/analytics" },
      { id: "clients", module: "clients", label: "Client Manager", icon: Briefcase, href: "/clients" },
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    items: [
      { id: "outreach", module: "outreach", label: "LinkedIn Outreach", icon: Send, href: "/outreach" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [],
  },
];

// ─── Route helpers ────────────────────────────────────────────────────────

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/leads") return pathname === "/leads";
  return pathname.startsWith(href);
}

// ─── Leaf nav item (no children) ──────────────────────────────────────────

function NavLeaf({
  item,
  collapsed,
  pathname,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="relative flex items-center rounded-lg group w-full"
      style={{
        height: 36,
        paddingLeft: collapsed ? 0 : 12,
        paddingRight: collapsed ? 0 : 2,
        justifyContent: collapsed ? "center" : "flex-start",
        gap: collapsed ? 0 : 10,
      }}
    >
      {/* Active pill */}
      {active && (
        <motion.div
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-lg"
          style={{
            background: "linear-gradient(90deg, rgba(232,168,64,0.10), rgba(232,168,64,0.18))",
            border: "1px solid rgba(232,168,64,0.15)",
            boxShadow: "0 1px 8px rgba(232,168,64,0.05)",
          }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        />
      )}

      {/* Hover overlay (inactive only) */}
      {!active && (
        <>
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: "linear-gradient(90deg, rgba(237,234,226,0.02), rgba(232,168,64,0.06))" }} />
          {/* Right-edge accent */}
          <div className="absolute inset-y-0 right-0 w-10 rounded-r-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
            style={{ background: "linear-gradient(270deg, rgba(232,168,64,0.12), transparent)" }} />
          <div className="absolute right-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ top: 8, bottom: 8, width: 2, background: "rgba(232,168,64,0.30)" }} />
        </>
      )}

      <Icon
        size={16}
        className="shrink-0 relative z-10"
        style={{
          color: active ? "var(--accent)" : undefined,
          transition: "color 200ms ease",
        }}
      />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            className="text-[13px] font-medium whitespace-nowrap relative z-10"
            style={{ color: active ? "var(--accent-ink)" : "var(--ink-3)" }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

// ─── Collapsible section header ───────────────────────────────────────────

function SectionHeader({
  section,
  open,
  onToggle,
  collapsed,
  pathname,
}: {
  section: NavSection;
  open: boolean;
  onToggle: () => void;
  collapsed: boolean;
  pathname: string;
}) {
  // Check if any child is active — highlight section header accordingly
  const hasActiveChild = section.items.some((item) => isActive(pathname, item.href));

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onToggle(); }}
      className="w-full flex items-center justify-between rounded-lg group transition-colors duration-150"
      style={{
        height: 30,
        paddingLeft: collapsed ? 0 : 12,
        paddingRight: collapsed ? 0 : 10,
        justifyContent: collapsed ? "center" : "flex-start",
        gap: collapsed ? 0 : 8,
        color: hasActiveChild ? "var(--accent-ink)" : "var(--ink-4)",
      }}
    >
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[9px] font-bold uppercase tracking-[0.16em] select-none"
            style={{ opacity: hasActiveChild ? 1 : 0.45 }}
          >
            {section.label}
          </motion.span>
        )}
      </AnimatePresence>

      {!collapsed && (
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="shrink-0"
          style={{ opacity: open ? 0.7 : 0.3 }}
        >
          <ChevronDown size={10} />
        </motion.div>
      )}
    </button>
  );
}

// ─── Main sidebar component ───────────────────────────────────────────────

const COLLAPSED_W = 64;
const EXPANDED_W = 248;

export default function ProSidebar() {
  const { state, dispatch } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = state.sidebarCollapsed;

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipY, setTooltipY] = useState(0);
  const [userRole, setUserRole] = useState<string>("user");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<{ email: string; name: string; avatar: string | null } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile drawer on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  // Track open section IDs — overlay and ai-studio start collapsed if inactive
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const s = new Set<string>();
    // Auto-open sections that contain the active route
    for (const sec of NAV_SECTIONS) {
      if (sec.items.some((item) => isActive(pathname, item.href))) {
        s.add(sec.id);
      }
    }
    return s;
  });

  // Sync open sections when pathname changes
  useEffect(() => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      for (const sec of NAV_SECTIONS) {
        if (sec.items.some((item) => isActive(pathname, item.href))) {
          next.add(sec.id);
        }
      }
      return next;
    });
  }, [pathname]);

  // Fetch user role + profile
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      try {
        const { data } = await supabase.from("profiles").select("role, email, display_name, avatar_url").eq("id", user.id).single();
        if (data?.role) setUserRole(data.role as string);
        setProfile({
          email: data?.email || user.email || "",
          name: data?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar: data?.avatar_url || null,
        });
      } catch {
        setProfile({
          email: user.email || "",
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar: null,
        });
      }
    });
  }, []);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build dynamic sections
  const sections = NAV_SECTIONS.map((sec) => {
    if (sec.id === "operations") {
      const items: NavItem[] = [
        { id: "integrations", module: "settings", label: "Integrations", icon: Shield, href: "/integrations" },
      ];
      if (userRole === "super_admin") {
        items.push({ id: "admin-users", module: "agent", label: "Users", icon: UserPlus, href: "/admin/users" });
      }
      return { ...sec, items };
    }
    return sec;
  });

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
        <img
          src="/prospecting-os/assets/Logo_Icon.png"
          alt="Prospecting OS"
          className="w-8 h-8 rounded-lg object-contain shrink-0"
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
              animate={{ opacity: 1, width: "auto", marginLeft: 12 }}
              exit={{ opacity: 0, width: 0, marginLeft: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-[14px] tracking-tight" style={{ color: "var(--ink)" }}>
                  Prospecting
                </span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    border: "1px solid rgba(201,168,124,0.20)",
                  }}
                >
                  OS
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 px-2">
        {sections.map((section, si) => (
          <div key={section.id}>
            {/* Separator in collapsed mode */}
            {collapsed && si > 0 && (
              <div className="mx-4 my-2" style={{ height: 1, background: "var(--sidebar-border)" }} />
            )}

            {/* Section header */}
            <SectionHeader
              section={section}
              open={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              collapsed={collapsed}
              pathname={pathname}
            />

            {/* Items */}
            <AnimatePresence initial={false}>
              {openSections.has(section.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className={`space-y-0.5 mt-0.5 ${TREE_SECTIONS.has(section.id) ? "tree-section" : ""}`}>
                    {section.items.map((item, idx) => {
                      const isTree = TREE_SECTIONS.has(section.id);
                      const isLast = idx === section.items.length - 1;
                      return (
                        <div
                          key={item.id}
                          className={isTree ? `tree-item ${isLast ? "tree-item-last" : ""}` : ""}
                          onMouseEnter={(e) => {
                            if (!collapsed) return;
                            setHoveredItem(item.label);
                            setTooltipY((e.currentTarget as HTMLElement).getBoundingClientRect().top);
                          }}
                          onMouseLeave={() => { setHoveredItem(null); setTooltipY(0); }}
                        >
                          <NavLeaf item={item} collapsed={collapsed} pathname={pathname} />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* ── Bottom Section ── */}
      <div className="shrink-0 py-1.5" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <SidebarBottomButton
          collapsed={collapsed}
          active={!state.agentCollapsed}
          icon={Sparkles}
          label="Agent"
          onClick={() => dispatch({ type: "TOGGLE_AGENT" })}
        />
        <SidebarBottomButton
          collapsed={collapsed}
          active={false}
          icon={collapsed ? ChevronRight : ChevronLeft}
          label="Collapse"
          onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
        />

        {/* Profile Section with Dropup Drawer */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 rounded-lg transition-all duration-200 w-full group"
            style={{
              height: 36,
              justifyContent: collapsed ? "center" : "flex-start",
              paddingLeft: collapsed ? 0 : 12,
              width: collapsed ? 36 : "calc(100% - 12px)",
              margin: collapsed ? "0 auto" : "0 6px",
              background: profileOpen ? "rgba(232,168,64,0.08)" : "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {/* Avatar */}
            <div
              className="shrink-0 rounded-full flex items-center justify-center"
              style={{
                width: 22, height: 22,
                background: "linear-gradient(135deg, rgba(232,168,64,0.20), rgba(232,168,64,0.08))",
                border: "1px solid rgba(232,168,64,0.25)",
              }}
            >
              {profile?.avatar ? (
                <img src={profile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>
                  {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-[12px] font-medium whitespace-nowrap truncate"
                  style={{ color: profileOpen ? "var(--accent)" : "var(--ink-3)", flex: 1, textAlign: "left" }}
                >
                  {profile?.name || "User"}
                </motion.span>
              )}
            </AnimatePresence>
            {!collapsed && (
              <motion.div
                animate={{ rotate: profileOpen ? 180 : 0 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{ opacity: profileOpen ? 0.7 : 0.3, marginRight: 4 }}
              >
                <ChevronUp size={10} />
              </motion.div>
            )}
          </button>

          {/* Profile Dropup Drawer */}
          <AnimatePresence>
            {profileOpen && !collapsed && (
              <motion.div
                initial={{ opacity: 0, y: 8, scaleY: 0.8 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: 8, scaleY: 0.8 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 6,
                  right: 6,
                  marginBottom: 6,
                  padding: "10px",
                  borderRadius: 12,
                  background: "var(--surface-elev)",
                  border: "1px solid var(--line)",
                  boxShadow: "var(--shadow-lg)",
                  transformOrigin: "bottom",
                  zIndex: 100,
                }}
              >
                {/* Profile info */}
                <div style={{ padding: "8px 10px", marginBottom: 6, borderRadius: 8, background: "var(--surface-2)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                    {profile?.name || "User"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>
                    {profile?.email || ""}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "1px 8px", borderRadius: 9999,
                      background: "rgba(232,168,64,0.10)", color: "var(--accent)",
                      border: "1px solid rgba(232,168,64,0.15)",
                    }}>
                      {userRole === "super_admin" ? "Super Admin" : userRole === "client" ? "Client" : "User"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {/* Settings */}
                  <button
                    onClick={() => { setProfileOpen(false); router.push("/settings"); }}
                    className="flex items-center gap-2.5 rounded-lg transition-colors duration-150 w-full"
                    style={{
                      height: 34, padding: "0 10px", background: pathname === "/settings" ? "rgba(232,168,64,0.08)" : "transparent",
                      border: "none", cursor: "pointer", color: pathname === "/settings" ? "var(--accent)" : "var(--ink-3)",
                    }}
                  >
                    <Settings2 size={14} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Settings</span>
                  </button>

                  {/* Theme toggle */}
                  <button
                    onClick={() => dispatch({ type: "SET_THEME", payload: state.theme === "dark" ? "light" : "dark" })}
                    className="flex items-center gap-2.5 rounded-lg transition-colors duration-150 w-full"
                    style={{
                      height: 34, padding: "0 10px", background: "transparent",
                      border: "none", cursor: "pointer", color: "var(--ink-3)",
                    }}
                  >
                    {state.theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      {state.theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </span>
                  </button>

                  {/* Logout */}
                  <div style={{ marginTop: 2, paddingTop: 4, borderTop: "1px solid var(--line)" }}>
                    <button
                      onClick={() => {
                        const supabase = createClient();
                        supabase.auth.signOut().then(() => router.push("/login"));
                      }}
                      className="flex items-center gap-2.5 rounded-lg transition-colors duration-150 w-full"
                      style={{
                        height: 34, padding: "0 10px", background: "transparent",
                        border: "none", cursor: "pointer", color: "#E06060",
                      }}
                    >
                      <LogOut size={14} />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>Sign Out</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Elbow tree connector styles */}
      <style jsx>{`
        .tree-section {
          position: relative;
          padding-left: 18px;
        }
        /* Vertical trunk — gradient matching hover accent */
        .tree-section::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 2px;
          bottom: 8px;
          width: 2px;
          background: linear-gradient(
            180deg,
            rgba(232,168,64,0.15) 0%,
            rgba(232,168,64,0.06) 60%,
            rgba(232,168,64,0.02) 100%
          );
          border-radius: 1px;
        }
        /* Smooth elbow branch — border-left + border-bottom with radius */
        .tree-item {
          position: relative;
        }
        .tree-item::before {
          content: '';
          position: absolute;
          left: -11px;
          top: 12px;
          width: 10px;
          height: 12px;
          border-left: 2px solid rgba(232,168,64,0.12);
          border-bottom: 2px solid rgba(232,168,64,0.12);
          border-radius: 0 0 0 7px;
        }
        /* Last item — shorter vertical line (stop at elbow junction) */
        .tree-item-last::after {
          content: '';
          position: absolute;
          left: 7px;
          top: 24px;
          bottom: 0;
          width: 2px;
          background: var(--sidebar-bg);
        }
        /* Active / hover treatment to make branches more visible */
        .tree-item:hover::before {
          border-color: rgba(232,168,64,0.28);
        }
      `}</style>

      {/* ── Collapsed tooltip ── */}
      <AnimatePresence>
        {collapsed && hoveredItem && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            className="fixed z-[9999] pointer-events-none"
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
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

// ── Bottom button ─────────────────────────────────────────────────────────

function SidebarBottomButton({
  collapsed, active, icon: Icon, label, onClick,
}: {
  collapsed: boolean;
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg transition-all duration-200 group"
      style={{
        height: 36,
        justifyContent: collapsed ? "center" : "flex-start",
        paddingLeft: collapsed ? 0 : 12,
        width: collapsed ? 36 : "calc(100% - 12px)",
        margin: collapsed ? "0 auto" : "0 6px",
        color: active ? "var(--accent)" : "var(--ink-3)",
        background: active ? "rgba(232,168,64,0.08)" : "transparent",
      }}
    >
      <Icon size={15} className="relative z-10" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            className="text-[12px] font-medium whitespace-nowrap relative z-10"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
