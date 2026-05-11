"use client";

import { PortalAuthProvider, usePortalAuth } from "@/lib/portal-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, Users, CreditCard, LogOut } from "lucide-react";
import Link from "next/link";

const NAV = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/leads", label: "Leads", icon: Users },
  { href: "/portal/billing", label: "Billing", icon: CreditCard },
];

function PortalShell({ children }: { children: React.ReactNode }) {
  const { state, logout } = usePortalAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { client, loading } = state;

  useEffect(() => {
    if (!loading && !client && pathname !== "/portal/login") {
      router.push("/portal/login");
    }
  }, [loading, client, pathname, router]);

  if (loading) return null;
  if (!client) return <>{children}</>;

  return (
    <div className="h-screen flex flex-col bg-bg">
      <header
        className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 56, background: "var(--sidebar-bg)", borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-6">
          <span className="text-[14px] font-bold tracking-tight" style={{ color: "var(--accent)" }}>
            {client.company}
          </span>
          <nav className="flex items-center gap-1">
            {NAV.map(item => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href} href={item.href}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all duration-200"
                  style={active ? {
                    background: "linear-gradient(90deg, rgba(201,168,124,0.10), rgba(201,168,124,0.16))",
                    color: "var(--accent-ink)", border: "1px solid rgba(201,168,124,0.18)",
                  } : {
                    background: "transparent", color: "var(--ink-3)", border: "1px solid transparent",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--ink-2)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; }}
                >
                  <Icon size={13} />{item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
            {client.name} · {client.monthlyRetainer ? `$${client.monthlyRetainer.toLocaleString()}/mo` : ""}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-all duration-200 rounded-lg px-2.5 py-1"
            style={{ color: "var(--ink-3)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--negative)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; }}
          >
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalAuthProvider>
      <PortalShell>{children}</PortalShell>
    </PortalAuthProvider>
  );
}
