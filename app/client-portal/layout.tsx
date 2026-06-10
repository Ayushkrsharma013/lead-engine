"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, MessageSquare, BarChart2,
  GitBranch, Bell, CreditCard, Settings, LogOut,
  Plug, ShoppingBag, UserPlus, RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_MODULES, MODULE_LABELS, MODULE_ROUTES, MODULE_ICONS } from "@/lib/plan-modules";
import type { ModuleKey, PlanTier } from "@/lib/plan-modules";
import type { UserProfile, PlanKey } from "@/lib/types";

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Users, MessageSquare, BarChart2, GitBranch,
  CreditCard, Settings, Plug, ShoppingBag, UserPlus, RefreshCw, Bell,
};

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
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
        // Build allowed modules from plan
        const plan = (prof.plan || "pilot") as PlanTier;
        const modules = (prof.role === "qa_agent" || prof.role === "super_admin")
          ? PLAN_MODULES.scale // all modules
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

  // Login page renders clean — no sidebar chrome
  if (pathname === "/client-portal/login") {
    return <>{children}</>;
  }

  // Build dynamic nav from plan modules
  const visibleNav = (allowedModules as string[])
    .filter((m): m is ModuleKey => m in MODULE_LABELS && m in MODULE_ROUTES)
    .map(m => ({
      module: m,
      label: MODULE_LABELS[m],
      href: MODULE_ROUTES[m],
      icon: ICON_MAP[MODULE_ICONS[m]] || LayoutDashboard,
    }));

  return (
    <div
      className="flex min-h-screen portal-secure"
      style={{ background: "var(--bg)", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Sidebar */}
      <aside className="flex-shrink-0 flex flex-col" style={{
        width: 220, background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)",
      }}>
        {/* Logo + Plan badge */}
        <div className="px-4 pt-5 pb-4" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <Link href="/client-portal" className="flex items-center gap-2.5 no-underline">
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-[14px]" style={{ color: "var(--ink)" }}>
              Prospecting<span style={{ color: "var(--accent)" }}>OS</span>
            </span>
          </Link>
          {profile?.plan && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase"
              style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}>
              {profile.plan === "pilot"
                ? "Founder's Pilot"
                : profile.plan === "growth"
                ? "Growth"
                : profile.plan === "scale"
                ? "Scale"
                : profile.plan === "micro"
                ? "Micro-Offer"
                : profile.plan}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {visibleNav.map(item => {
            const active = item.href === "/client-portal" ? pathname === "/client-portal" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200"
                style={{
                  color: active ? "var(--accent-ink)" : "var(--ink-3)",
                  background: active ? "linear-gradient(90deg, rgba(232,168,64,0.10), rgba(232,168,64,0.18))" : "transparent",
                }}>
                <Icon size={16} style={{ color: active ? "var(--accent)" : undefined }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* QA mode indicator */}
        {profile?.role === "qa_agent" && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-lg text-[10px] font-semibold"
            style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.20)", color: "var(--negative)" }}>
            QA MODE — Full access
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout}
          className="flex items-center gap-2.5 mx-2 mb-4 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/[0.04]"
          style={{ color: "var(--ink-3)" }}>
          <LogOut size={15} /> Sign Out
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              {profile?.display_name || profile?.email || "Client"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
              {profile?.email}
            </p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
