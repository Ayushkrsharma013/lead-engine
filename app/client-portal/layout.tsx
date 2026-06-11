"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, MessageSquare, BarChart2,
  GitBranch, Bell, CreditCard, Settings, LogOut,
  Plug, ShoppingBag, UserPlus, RefreshCw, User,
  ChevronLeft, ChevronRight, Menu, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_MODULES, MODULE_LABELS, MODULE_ROUTES, MODULE_ICONS } from "@/lib/plan-modules";
import type { ModuleKey, PlanTier } from "@/lib/plan-modules";
import type { UserProfile } from "@/lib/types";
import TopBar from "@/components/layout/TopBar";
import { PortalHeaderProvider, usePortalHeader } from "@/lib/PortalHeaderContext";
import ProfileModal from "@/components/client-portal/ProfileModal";

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Users, MessageSquare, BarChart2, GitBranch,
  CreditCard, Settings, Plug, ShoppingBag, UserPlus, RefreshCw, Bell,
};

const COLLAPSED_W = 64;
const EXPANDED_W = 220;
const LinkMotion = motion(Link);

function TopBarWithContext({ profile }: { profile: UserProfile | null }) {
  const { config } = usePortalHeader();
  const planBadge = profile?.plan && (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
      style={{ background: "rgba(232,74,10,0.10)", color: "#E84A0A", border: "1px solid rgba(232,74,10,0.20)" }}>
      {profile.plan === "pilot" ? "Founder's Pilot"
        : profile.plan === "growth" ? "Growth"
        : profile.plan === "scale" ? "Scale"
        : profile.plan === "micro" ? "Micro-Offer"
        : profile.plan}
    </span>
  );

  return (
    <TopBar
      title={config.title}
      subtitle={config.description || profile?.email}
      actions={
        <div className="flex items-center gap-2">
          {config.actions}
          {planBadge}
        </div>
      }
    />
  );
}

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (pathname === "/client-portal/login") {
        if (!ignore) setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (ignore) return;
      if (!user) { router.replace("/client-portal/login"); return; }

      const res = await fetch("/prospecting-os/api/client-portal/me");
      if (ignore) return;
      if (!res.ok) { router.replace("/client-portal/login"); return; }
      const data = await res.json();
      const prof = data.profile as UserProfile;

      if (prof.role !== "client" && prof.role !== "qa_agent" && prof.role !== "super_admin") {
        router.replace("/admin/dashboard");
        return;
      }

      if (!ignore) {
        setProfile(prof);
        const plan = (prof.plan || "pilot") as PlanTier;
        const modules = (prof.role === "qa_agent" || prof.role === "super_admin")
          ? PLAN_MODULES.scale
          : PLAN_MODULES[plan] || PLAN_MODULES.pilot;
        setAllowedModules(modules);
        setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, [pathname, router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/client-portal/login");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E84A0A] rounded-full"
        />
      </div>
    );
  }

  if (pathname === "/client-portal/login") {
    return <>{children}</>;
  }

  const visibleNav = (allowedModules as string[])
    .filter((m): m is ModuleKey => m in MODULE_LABELS && m in MODULE_ROUTES)
    .map(m => ({
      module: m,
      label: MODULE_LABELS[m],
      href: MODULE_ROUTES[m],
      icon: ICON_MAP[MODULE_ICONS[m]] || LayoutDashboard,
    }));

  const sidebarW = collapsed ? COLLAPSED_W : EXPANDED_W;

  const sidebarContent = (
    <>
      {/* Logo */}
      <Link href="/client-portal" className="flex items-center shrink-0 no-underline"
        style={{
          height: 56, paddingLeft: collapsed ? 0 : 16, paddingRight: collapsed ? 0 : 16,
          justifyContent: collapsed ? "center" : "flex-start",
          borderBottom: "1px solid var(--sidebar-border)",
        }}>
        <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS"
          className="w-7 h-7 rounded-lg shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="font-bold text-[14px] ml-2.5 whitespace-nowrap overflow-hidden"
              style={{ color: "var(--ink)" }}
            >
              Prospecting<span style={{ color: "#E84A0A" }}>OS</span>
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {visibleNav.map((item, i) => {
          const active = item.href === "/client-portal" ? pathname === "/client-portal" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <LinkMotion href={item.href} title={collapsed ? item.label : undefined}
                whileHover={{
                  x: 3,
                  background: "rgba(255,255,255,0.04)",
                  transition: { type: "spring" as const, stiffness: 500, damping: 30 },
                }}
                whileTap={{ scale: 0.96, x: 0 }}
                className="flex items-center rounded-lg no-underline cursor-pointer"
                style={{
                  height: 36, paddingLeft: collapsed ? 0 : 12, paddingRight: collapsed ? 0 : 12,
                  justifyContent: collapsed ? "center" : "flex-start", gap: collapsed ? 0 : 12,
                  color: active ? "#fff" : "var(--ink-3)",
                  background: active ? "linear-gradient(90deg, rgba(232,74,10,0.15), rgba(232,74,10,0.25))" : "transparent",
                }}>
                <motion.span
                  whileHover={{ rotate: active ? 0 : -8, scale: 1.15 }}
                  transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                  style={{ display: "inline-flex", flexShrink: 0 }}
                >
                  <Icon size={16} style={{ color: active ? "#E84A0A" : undefined }} />
                </motion.span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[13px] font-medium whitespace-nowrap">{item.label}</motion.span>
                  )}
                </AnimatePresence>
              </LinkMotion>
            </motion.div>
          );
        })}
      </nav>

      <div className="shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <button
          onClick={() => setProfileModalOpen(true)}
          className="flex items-center rounded-lg transition-colors duration-200 no-underline mx-2 mt-1.5 border-none cursor-pointer"
          style={{
            height: 36, paddingLeft: collapsed ? 0 : 12, width: collapsed ? 36 : "calc(100% - 16px)",
            justifyContent: collapsed ? "center" : "flex-start", gap: collapsed ? 0 : 10,
            color: "var(--ink-3)", background: "transparent",
          }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, rgba(232,74,10,0.20), rgba(232,74,10,0.08))", border: "1px solid rgba(232,74,10,0.25)" }}>
            <span className="text-[9px] font-bold" style={{ color: "#E84A0A" }}>
              {(profile?.display_name || profile?.email || "U").charAt(0).toUpperCase()}
            </span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[12px] font-medium whitespace-nowrap truncate">{profile?.display_name || "Profile"}</motion.span>
            )}
          </AnimatePresence>
        </button>

        <button onClick={() => setCollapsed(c => !c)}
          className="flex items-center rounded-lg transition-colors hover:bg-white/[0.04] mx-2 my-1.5"
          style={{
            width: collapsed ? 36 : "calc(100% - 16px)", height: 36,
            justifyContent: collapsed ? "center" : "flex-start", gap: 10,
            paddingLeft: collapsed ? 0 : 12, background: "transparent", border: "none",
            cursor: "pointer", color: "var(--ink-3)",
          }}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[12px] font-medium whitespace-nowrap">Collapse</motion.span>
            )}
          </AnimatePresence>
        </button>

        <button onClick={handleLogout}
          className="flex items-center rounded-lg transition-colors hover:bg-white/[0.04] mx-2 mb-3"
          style={{
            width: collapsed ? 36 : "calc(100% - 16px)", height: 36,
            justifyContent: collapsed ? "center" : "flex-start", gap: collapsed ? 0 : 10,
            paddingLeft: collapsed ? 0 : 12, background: "transparent", border: "none",
            cursor: "pointer", color: "var(--ink-3)",
          }}>
          <LogOut size={15} style={{ flexShrink: 0 }} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[12px] font-medium whitespace-nowrap">Sign Out</motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </>
  );

  return (
    <PortalHeaderProvider>
      <div
        className="flex min-h-screen portal-secure"
        style={{ background: "var(--bg)", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Mobile hamburger */}
        <button
          className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg"
          style={{ background: "var(--sidebar-bg)", border: "1px solid var(--sidebar-border)", color: "var(--ink)" }}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
              onClick={() => setMobileOpen(false)}
            />
          )}
        </AnimatePresence>

        <aside className="hidden lg:flex shrink-0 flex-col relative" style={{
          width: sidebarW,
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
        }}>
          {sidebarContent}
        </aside>

        <AnimatePresence>
          {mobileOpen && (
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="lg:hidden fixed top-0 left-0 z-50 h-full flex flex-col shadow-xl"
              style={{ width: 260, background: "rgba(15,15,15,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
            >
              {sidebarContent}
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBarWithContext profile={profile} />
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </PortalHeaderProvider>
  );
}
