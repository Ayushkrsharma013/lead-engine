"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, MessageSquare, BarChart2,
  GitBranch, Bell, CreditCard, Settings, LogOut,
  Plug, ShoppingBag, UserPlus, RefreshCw, User,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_MODULES, MODULE_LABELS, MODULE_ROUTES, MODULE_ICONS } from "@/lib/plan-modules";
import type { ModuleKey, PlanTier } from "@/lib/plan-modules";
import type { UserProfile, PlanKey } from "@/lib/types";

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Users, MessageSquare, BarChart2, GitBranch,
  CreditCard, Settings, Plug, ShoppingBag, UserPlus, RefreshCw, Bell,
};

const COLLAPSED_W = 64;
const EXPANDED_W = 220;

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
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
        router.replace("/dashboard");
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
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
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

  return (
    <div
      className="flex min-h-screen portal-secure"
      style={{ background: "var(--bg)", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Sidebar */}
      <aside className="shrink-0 flex flex-col relative" style={{
        width: sidebarW, background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)",
        transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
      }}>
        {/* Logo */}
        <Link href="/client-portal" className="flex items-center shrink-0 no-underline"
          style={{
            height: 56, paddingLeft: collapsed ? 0 : 16, paddingRight: collapsed ? 0 : 16,
            justifyContent: collapsed ? "center" : "flex-start",
            borderBottom: "1px solid var(--sidebar-border)",
          }}>
          <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS"
            className="w-7 h-7 rounded-lg shrink-0" />
          {!collapsed && (
            <span className="font-bold text-[14px] ml-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
              Prospecting<span style={{ color: "var(--accent)" }}>OS</span>
            </span>
          )}
        </Link>

        {/* Plan badge — hidden when collapsed */}
        {!collapsed && profile?.plan && (
          <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase"
              style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}>
              {profile.plan === "pilot" ? "Founder's Pilot"
                : profile.plan === "growth" ? "Growth"
                : profile.plan === "scale" ? "Scale"
                : profile.plan === "micro" ? "Micro-Offer"
                : profile.plan}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {visibleNav.map(item => {
            const active = item.href === "/client-portal" ? pathname === "/client-portal" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
                className="flex items-center rounded-lg transition-all duration-200 no-underline"
                style={{
                  height: 36, paddingLeft: collapsed ? 0 : 12, paddingRight: collapsed ? 0 : 12,
                  justifyContent: collapsed ? "center" : "flex-start", gap: collapsed ? 0 : 12,
                  color: active ? "var(--accent-ink)" : "var(--ink-3)",
                  background: active ? "linear-gradient(90deg, rgba(232,168,64,0.10), rgba(232,168,64,0.18))" : "transparent",
                }}>
                <Icon size={16} style={{ color: active ? "var(--accent)" : undefined, flexShrink: 0 }} />
                {!collapsed && <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          {/* Profile */}
          <Link href="/client-portal/profile"
            className="flex items-center rounded-lg transition-all duration-200 no-underline mx-2 mt-1.5"
            style={{
              height: 36, paddingLeft: collapsed ? 0 : 12,
              justifyContent: collapsed ? "center" : "flex-start", gap: collapsed ? 0 : 10,
              color: pathname === "/client-portal/profile" ? "var(--accent)" : "var(--ink-3)",
            }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(232,66,10,0.20), rgba(232,66,10,0.08))", border: "1px solid rgba(232,66,10,0.25)" }}>
              <span className="text-[9px] font-bold" style={{ color: "var(--accent)" }}>
                {(profile?.display_name || profile?.email || "U").charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && <span className="text-[12px] font-medium whitespace-nowrap truncate">{profile?.display_name || "Profile"}</span>}
          </Link>

          {/* Collapse toggle */}
          <button onClick={() => setCollapsed(c => !c)}
            className="flex items-center rounded-lg transition-all duration-200 mx-2 my-1.5"
            style={{
              width: collapsed ? 36 : "calc(100% - 16px)", height: 36,
              justifyContent: collapsed ? "center" : "flex-start", gap: 10,
              paddingLeft: collapsed ? 0 : 12, background: "transparent", border: "none",
              cursor: "pointer", color: "var(--ink-3)",
            }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!collapsed && <span className="text-[12px] font-medium whitespace-nowrap">Collapse</span>}
          </button>

          {/* Logout */}
          <button onClick={handleLogout}
            className="flex items-center rounded-lg transition-colors hover:bg-white/[0.04] mx-2 mb-3"
            style={{
              width: collapsed ? 36 : "calc(100% - 16px)", height: 36,
              justifyContent: collapsed ? "center" : "flex-start", gap: collapsed ? 0 : 10,
              paddingLeft: collapsed ? 0 : 12, background: "transparent", border: "none",
              cursor: "pointer", color: "var(--ink-3)",
            }}>
            <LogOut size={15} style={{ flexShrink: 0 }} />
            {!collapsed && <span className="text-[12px] font-medium whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              {profile?.display_name || profile?.email || "Client"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>{profile?.email}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
