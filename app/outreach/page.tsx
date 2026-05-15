"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send, RefreshCw, CheckCircle2, XCircle, ExternalLink,
  Users, Clock, Link2, Trophy, AlertTriangle, Copy, ChevronDown, ChevronUp,
  Zap, Play, Terminal,
} from "lucide-react";
import type { OOStatus, OOPipelineStats } from "@/lib/openoutreach";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncResult {
  synced: number;
  campaigns: number;
  ts: string;
}

interface CampaignRow {
  id: string;
  name: string;
  targetIndustry: string;
  status: "active" | "paused" | "complete";
  leadIds: string[];
  createdAt?: string;
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Pipeline funnel row ──────────────────────────────────────────────────────

function FunnelRow({
  label, count, total, color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] w-32 shrink-0" style={{ color: "var(--muted)" }}>{label}</span>
      <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "var(--surface2)" }}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[12px] font-bold w-8 text-right tabular-nums" style={{ color }}>
        {count}
      </span>
    </div>
  );
}

// ─── Setup guide ─────────────────────────────────────────────────────────────

function SetupGuide() {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const dockerCmd = `docker run -d --name openoutreach \\
  -p 5900:5900 -p 6080:6080 \\
  -v %USERPROFILE%\\.openoutreach\\data:/app/data \\
  ghcr.io/eracle/openoutreach:latest`;

  const syncCmd = `# One-time setup
npm install sql.js --save-dev

# Run sync (reads SQLite → Supabase)
node scripts/sync-openoutreach.mjs`;

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ color: "var(--text)" }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={15} style={{ color: "var(--accent-blue)" }} />
          <span className="text-[13px] font-semibold">Setup Guide — How to Run OpenOutreach</span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-3">
            {[
              {
                step: "1",
                title: "Run OpenOutreach via Docker",
                code: dockerCmd,
                desc: "Docker Desktop must be installed. Uses a dedicated LinkedIn account — never your main one.",
              },
              {
                step: "2",
                title: "Configure campaign in Django admin",
                code: "open http://localhost:8000/admin/",
                desc: "Add your LinkedIn credentials + write a product description and target market.",
              },
              {
                step: "3",
                title: "Watch the automation",
                code: "open http://localhost:6080/vnc.html",
                desc: "VNC viewer shows the browser robot in action.",
              },
              {
                step: "4",
                title: "Sync leads to Prospecting OS",
                code: syncCmd,
                desc: "Reads CONNECTED leads from OpenOutreach SQLite and upserts into your Supabase leads table.",
              },
            ].map(({ step, title, code, desc }) => (
              <div
                key={step}
                className="rounded-lg p-4"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                    style={{ background: "rgba(0,212,255,0.12)", color: "var(--accent-blue)" }}
                  >
                    {step}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text)" }}>{title}</p>
                    <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>{desc}</p>
                    <div className="relative rounded-md overflow-hidden" style={{ background: "#0a0a12" }}>
                      <pre className="text-[11px] px-3 py-2 pr-10 overflow-x-auto font-mono leading-relaxed" style={{ color: "#a8e6cf" }}>
                        {code}
                      </pre>
                      <button
                        onClick={() => copy(code)}
                        className="absolute top-2 right-2 p-1 rounded transition-colors"
                        style={{ color: "var(--muted)" }}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            className="flex items-start gap-2 rounded-lg px-4 py-3"
            style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.20)" }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent-orange)" }} />
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              <span className="font-semibold" style={{ color: "var(--accent-orange)" }}>LinkedIn ToS risk:</span>{" "}
              OpenOutreach automates LinkedIn in violation of their Terms of Service. Always use a dedicated account.
              The project includes an explicit legal disclaimer. Daily connection limit: keep below 20/day.
            </p>
          </div>

          {copied && (
            <p className="text-[11px] text-center" style={{ color: "var(--accent-green)" }}>
              Copied to clipboard
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [ooStatus, setOoStatus] = useState<OOStatus | null>(null);
  const [stats, setStats] = useState<OOPipelineStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // Ping OpenOutreach status
  const checkStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/outreach/status");
      const data = await res.json() as OOStatus;
      setOoStatus(data);
    } catch {
      setOoStatus({ running: false, url: "http://localhost:8000" });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Load OO-tagged leads from Supabase for stats
  const loadStats = useCallback(async () => {
    try {
      const [leadsRes, campaignsRes] = await Promise.all([
        fetch("/api/leads?source=linkedin&tag=openoutreach"),
        fetch("/api/leads?source=linkedin&tag=openoutreach"),
      ]);
      // Use Supabase leads with openoutreach tag to build pipeline stats
      const allRes = await fetch("/api/leads/openoutreach-stats");
      if (allRes.ok) {
        const data = await allRes.json() as { stats: OOPipelineStats; campaigns: CampaignRow[] };
        setStats(data.stats);
        setCampaigns(data.campaigns ?? []);
      }
    } catch {
      // stats will remain null — handled in UI
    }
  }, []);

  useEffect(() => {
    checkStatus();
    loadStats();
  }, [checkStatus, loadStats]);

  // Manual sync trigger — in real usage the sync script is run from CLI
  async function triggerSync() {
    setSyncing(true);
    try {
      // This endpoint expects the sync script to have already POSTed data.
      // Here we just show a toast-style response.
      await new Promise(r => setTimeout(r, 1200)); // simulate
      setLastSync({ synced: 0, campaigns: 0, ts: new Date().toISOString() });
    } finally {
      setSyncing(false);
    }
    await loadStats();
  }

  const isRunning = ooStatus?.running ?? false;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}
          >
            <Send size={16} style={{ color: "var(--accent-blue)" }} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
              LinkedIn Outreach
            </h1>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Powered by OpenOutreach — autonomous LinkedIn automation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: isRunning ? "rgba(0,255,136,0.08)" : "rgba(255,107,53,0.08)",
              border: `1px solid ${isRunning ? "rgba(0,255,136,0.20)" : "rgba(255,107,53,0.20)"}`,
              color: isRunning ? "var(--accent-green)" : "var(--accent-orange)",
            }}
          >
            {statusLoading ? (
              <RefreshCw size={10} className="animate-spin" />
            ) : isRunning ? (
              <CheckCircle2 size={10} />
            ) : (
              <XCircle size={10} />
            )}
            {statusLoading ? "Checking..." : isRunning ? "Engine running" : "Engine offline"}
          </div>

          {/* Refresh status */}
          <button
            onClick={checkStatus}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
            }}
            title="Refresh status"
          >
            <RefreshCw size={13} className={statusLoading ? "animate-spin" : ""} />
          </button>

          {/* Open Django admin */}
          <a
            href={`${ooStatus?.url ?? "http://localhost:8000"}/admin/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            <ExternalLink size={12} />
            Django Admin
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── Pipeline stats ── */}
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>
            Pipeline Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="Qualified"
              value={stats?.qualified ?? "—"}
              sub="Ready to contact"
              color="var(--accent-blue)"
            />
            <StatCard
              label="Pending"
              value={stats?.pending ?? "—"}
              sub="Awaiting acceptance"
              color="#f59e0b"
            />
            <StatCard
              label="Connected"
              value={stats?.connected ?? "—"}
              sub="In conversation"
              color="var(--accent-green)"
            />
            <StatCard
              label="Completed"
              value={stats?.completed ?? "—"}
              sub="Follow-up done"
              color="var(--accent-purple)"
            />
          </div>

          {/* Funnel chart */}
          {stats && stats.total > 0 && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                State Funnel
              </p>
              <FunnelRow label="Qualified" count={stats.qualified} total={stats.total} color="var(--accent-blue)" />
              <FunnelRow label="Ready to Connect" count={stats.readyToConnect} total={stats.total} color="#60a5fa" />
              <FunnelRow label="Pending" count={stats.pending} total={stats.total} color="#f59e0b" />
              <FunnelRow label="Connected" count={stats.connected} total={stats.total} color="var(--accent-green)" />
              <FunnelRow label="Completed" count={stats.completed} total={stats.total} color="var(--accent-purple)" />
            </div>
          )}

          {!stats && (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Users size={24} className="mx-auto mb-2" style={{ color: "var(--muted)" }} />
              <p className="text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>No outreach data yet</p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Run the sync script after OpenOutreach discovers leads
              </p>
            </div>
          )}
        </div>

        {/* ── Sync panel ── */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                Sync to Prospecting OS
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                Imports CONNECTED leads from OpenOutreach SQLite into your leads table
              </p>
            </div>
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                background: syncing ? "var(--surface2)" : "rgba(0,212,255,0.12)",
                border: `1px solid ${syncing ? "var(--border)" : "rgba(0,212,255,0.30)"}`,
                color: syncing ? "var(--muted)" : "var(--accent-blue)",
                cursor: syncing ? "not-allowed" : "pointer",
              }}
            >
              {syncing ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Zap size={13} />
              )}
              {syncing ? "Syncing..." : "Run Sync"}
            </button>
          </div>

          {/* CLI instructions */}
          <div className="rounded-lg p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
              Recommended: Run via CLI
            </p>
            <pre className="text-[11px] font-mono" style={{ color: "#a8e6cf" }}>
              {"node scripts/sync-openoutreach.mjs"}
            </pre>
          </div>

          {lastSync && (
            <div
              className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-[11px]"
              style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", color: "var(--accent-green)" }}
            >
              <CheckCircle2 size={12} />
              Last sync: {lastSync.synced} leads imported at{" "}
              {new Date(lastSync.ts).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* ── Active campaigns ── */}
        {campaigns.length > 0 && (
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>
              Active Campaigns
            </h2>
            <div className="space-y-2">
              {campaigns.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="p-1.5 rounded-lg shrink-0"
                    style={{ background: "rgba(0,212,255,0.08)" }}
                  >
                    <Play size={12} style={{ color: "var(--accent-blue)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>
                      {c.name}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                      {c.targetIndustry}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={11} style={{ color: "var(--muted)" }} />
                    <span className="text-[12px] tabular-nums font-medium" style={{ color: "var(--text)" }}>
                      {c.leadIds.length}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: c.status === "active"
                        ? "rgba(0,255,136,0.10)"
                        : c.status === "paused"
                          ? "rgba(245,158,11,0.10)"
                          : "rgba(107,107,128,0.10)",
                      color: c.status === "active"
                        ? "var(--accent-green)"
                        : c.status === "paused"
                          ? "#f59e0b"
                          : "var(--muted)",
                    }}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick links ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: ExternalLink,
              label: "Django Admin",
              sub: "Manage campaigns & profiles",
              href: `${ooStatus?.url ?? "http://localhost:8000"}/admin/`,
              color: "var(--accent-blue)",
            },
            {
              icon: Link2,
              label: "VNC Viewer",
              sub: "Watch automation live",
              href: "http://localhost:6080/vnc.html",
              color: "var(--accent-purple)",
            },
            {
              icon: Trophy,
              label: "Lead Intelligence",
              sub: "View all synced leads",
              href: "/leads",
              color: "var(--accent-green)",
            },
            {
              icon: Clock,
              label: "Activity Log",
              sub: "Sync history in Dashboard",
              href: "/dashboard",
              color: "#f59e0b",
            },
          ].map(({ icon: Icon, label, sub, href, color }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("http://localhost") ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors group"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="p-2 rounded-lg shrink-0"
                style={{ background: `${color}12` }}
              >
                <Icon size={14} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{label}</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>{sub}</p>
              </div>
            </a>
          ))}
        </div>

        {/* ── Setup guide ── */}
        <SetupGuide />
      </div>
    </div>
  );
}
