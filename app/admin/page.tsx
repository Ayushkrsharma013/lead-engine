"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, DollarSign, BarChart3, UserCheck, ArrowRight, Settings, Activity } from "lucide-react";

interface Metrics {
  totalClients: number; activeSubscriptions: number;
  mrr: number; totalLeadsManaged: number;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/prospecting-os/api/admin/clients/metrics")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMetrics(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>Admin Dashboard</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Super-admin control panel</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Total Clients", value: metrics.totalClients.toLocaleString(), color: "#00b4ff" },
            { icon: UserCheck, label: "Active", value: metrics.activeSubscriptions.toLocaleString(), color: "#22c55e" },
            { icon: DollarSign, label: "MRR", value: `$${metrics.mrr.toLocaleString()}`, color: "#E8A840" },
            { icon: BarChart3, label: "Leads Managed", value: metrics.totalLeadsManaged.toLocaleString(), color: "#a855f7" },
          ].map(c => (
            <div key={c.label} className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div className="flex items-center gap-2.5 mb-2">
                <c.icon size={16} style={{ color: c.color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>{c.label}</span>
              </div>
              <p className="text-[24px] font-bold" style={{ color: "var(--ink)" }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--line)", height: 100 }} />
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Client Manager", desc: "Manage all client accounts", href: "/admin/clients", color: "#00b4ff" },
          { icon: UserCheck, label: "User Management", desc: "Add, edit, impersonate users", href: "/admin/users", color: "#22c55e" },
          { icon: Activity, label: "Agent Workforce", desc: "Monitor and trigger AI agents", href: "/admin/agents", color: "#a855f7" },
        ].map(link => (
          <Link key={link.href} href={link.href}
            className="rounded-xl p-5 no-underline transition-shadow hover:shadow-md"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <link.icon size={18} style={{ color: link.color }} />
              <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{link.label}</span>
              <ArrowRight size={14} className="ml-auto" style={{ color: "var(--ink-4)" }} />
            </div>
            <p className="text-[12px]" style={{ color: "var(--ink-4)" }}>{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
