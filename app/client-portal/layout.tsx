"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, MessageSquare, BarChart2,
  GitBranch, Bell, CreditCard, Settings, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_MODULES } from "@/lib/types";
import type { UserProfile, PlanKey } from "@/lib/types";

const CLIENT_NAV = [
  { module: "overview", label: "Overview", href: "/client-portal", icon: LayoutDashboard },
  { module: "leads-view", label: "My Leads", href: "/client-portal/leads", icon: Users },
  { module: "icebreakers", label: "Icebreakers", href: "/client-portal/icebreakers", icon: MessageSquare },
  { module: "analytics", label: "Analytics", href: "/client-portal/analytics", icon: BarChart2 },
  { module: "sequences", label: "Sequences", href: "/client-portal/sequences", icon: GitBranch },
  { module: "slack-digest", label: "Slack Digest", href: "/client-portal/slack", icon: Bell },
  { module: "billing", label: "Billing", href: "/client-portal/billing", icon: CreditCard },
  { module: "settings", label: "Settings", href: "/client-portal/settings", icon: Settings },
];

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
        setAllowedModules(data.allowedModules as string[]);
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

  const visibleNav = CLIENT_NAV.filter(item =>
    allowedModules.includes(item.module) || profile?.role === "qa_agent" || profile?.role === "super_admin"
  );

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
