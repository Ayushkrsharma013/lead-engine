"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send, RefreshCw, CheckCircle2, Clock, Users,
  AlertTriangle, Terminal, ChevronDown, ChevronUp,
  Copy, Wifi, WifiOff,
} from "lucide-react";
import type { LinkedInQueueItem, LinkedInDailyStats, QueueStatus } from "@/lib/linkedin-queue";

const BASE = "/prospecting-os";

interface QueueResponse {
  status: QueueStatus;
  pending: LinkedInQueueItem[];
  todayStats: LinkedInDailyStats;
  runnerLive: boolean;
  lastRunAt: string | null;
}

function UsageBar({ label, used, max, color }: { label: string; used: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {used}/{max}
        </span>
      </div>
      <div className="rounded-full h-1.5 overflow-hidden" style={{ background: "var(--surface2)" }}>
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function SetupGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const steps = [
    {
      key: "install",
      title: "Install runner dependencies (one-time)",
      code: "cd runner\nnpm install",
      desc: "Installs Playwright + Supabase client. Requires Node.js 18+.",
    },
    {
      key: "env",
      title: "Configure .env (one-time)",
      code: "cp .env.example .env\n# Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Vercel env",
      desc: "Only needs Supabase credentials. No LinkedIn password stored here.",
    },
    {
      key: "browser",
      title: "Set up Chrome profile (one-time)",
      code: "node linkedin-runner.js --setup",
      desc: "Opens a Chrome window. Log into LinkedIn manually. Close when done — your session is saved.",
    },
    {
      key: "run",
      title: "Start the runner",
      code: "node linkedin-runner.js",
      desc: "Polls queue every 5 min. Runs 8 AM–8 PM only. Keep this terminal open while working.",
    },
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ color: "var(--text)" }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={15} style={{ color: "var(--accent-blue)" }} />
          <span className="text-[13px] font-semibold">Local Runner Setup Guide</span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          {steps.map(({ key, title, code, desc }) => (
            <div key={key} className="rounded-lg p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>{desc}</p>
              <div className="relative rounded-md overflow-hidden" style={{ background: "#0a0a12" }}>
                <pre className="text-[11px] px-3 py-2 pr-10 overflow-x-auto font-mono leading-relaxed" style={{ color: "#a8e6cf" }}>
                  {code}
                </pre>
                <button
                  onClick={() => copy(code, key)}
                  className="absolute top-2 right-2 p-1 rounded"
                  style={{ color: "var(--muted)" }}
                  title="Copy"
                >
                  <Copy size={12} />
                </button>
                {copied === key && (
                  <span className="absolute top-2 right-7 text-[10px]" style={{ color: "var(--accent-green)" }}>copied</span>
                )}
              </div>
            </div>
          ))}

          <div
            className="flex items-start gap-2 rounded-lg px-4 py-3"
            style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.20)" }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent-orange)" }} />
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              <span className="font-semibold" style={{ color: "var(--accent-orange)" }}>LinkedIn ToS:</span>{" "}
              This automation uses your real account. Stay within limits: 10 connections/day, 20 DMs/day.
              Always use a dedicated LinkedIn account, not your main one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    connection_request: { bg: "rgba(0,212,255,0.10)", color: "var(--accent-blue)", label: "Connect" },
    dm: { bg: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", label: "DM" },
    follow_up: { bg: "rgba(245,158,11,0.10)", color: "#f59e0b", label: "Follow-up" },
    profile_view: { bg: "rgba(107,107,128,0.10)", color: "var(--muted)", label: "View" },
  };
  const s = styles[type] ?? styles.profile_view;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function OutreachPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${BASE}/api/outreach/queue`);
      if (res.ok) setData(await res.json() as QueueResponse);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const stats = data?.todayStats;
  const status = data?.status;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" }}>
            <Send size={16} style={{ color: "var(--accent-blue)" }} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>LinkedIn Outreach</h1>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Queue-based safe outreach — runs from your local machine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: data?.runnerLive ? "rgba(0,255,136,0.08)" : "rgba(107,107,128,0.08)",
              border: `1px solid ${data?.runnerLive ? "rgba(0,255,136,0.20)" : "rgba(107,107,128,0.20)"}`,
              color: data?.runnerLive ? "var(--accent-green)" : "var(--muted)",
            }}
          >
            {data?.runnerLive ? <Wifi size={10} /> : <WifiOff size={10} />}
            {loading ? "..." : data?.runnerLive ? "Runner live" : "Runner offline"}
          </div>

          <button
            onClick={() => load(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
            title="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <UsageBar label="Connections today" used={stats?.connectionsSent ?? 0} max={10} color="var(--accent-blue)" />
          <UsageBar label="DMs today" used={stats?.dmsSent ?? 0} max={20} color="var(--accent-purple)" />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {(["pending", "executing", "done", "failed"] as const).map((key) => {
            const colorMap = {
              pending: "#f59e0b",
              executing: "var(--accent-blue)",
              done: "var(--accent-green)",
              failed: "var(--accent-orange)",
            };
            return (
              <div key={key} className="rounded-xl p-4 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: colorMap[key] }}>
                  {loading ? "—" : (status?.[key] ?? 0)}
                </span>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>
            Next Pending Actions
          </h2>

          {(data?.pending?.length ?? 0) === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: "var(--muted)" }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Queue is empty</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Approve a Telegram action from the Outreach Agent to populate the queue.
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    {["Lead", "Type", "Scheduled", "Message preview"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.pending?.map((item, i) => (
                    <tr key={item.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5 font-medium max-w-[140px] truncate" style={{ color: "var(--text)" }}>
                        {item.leadId}
                      </td>
                      <td className="px-4 py-2.5">
                        <ActionBadge type={item.actionType} />
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--muted)" }}>
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(item.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 max-w-xs truncate" style={{ color: "var(--muted)" }}>
                        {item.message?.slice(0, 60) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)" }}>
          <p className="text-[12px] font-semibold" style={{ color: "var(--accent-blue)" }}>How this works</p>
          <div className="space-y-1.5">
            {[
              { icon: Users, text: "Outreach Agent (8 AM) finds qualified leads and sends a Telegram approval request" },
              { icon: CheckCircle2, text: "You approve in Telegram — actions are written to this queue" },
              { icon: Send, text: "Local runner on your machine executes actions at human pace (30–120s delay)" },
              { icon: Clock, text: "10 connection requests/day · 20 DMs/day · runs 8 AM–8 PM only" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-2">
                <Icon size={12} className="mt-0.5 shrink-0" style={{ color: "var(--accent-blue)" }} />
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <SetupGuide />
      </div>
    </div>
  );
}
