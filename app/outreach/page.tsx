"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send, RefreshCw, CheckCircle2, Clock, Users,
  AlertTriangle, Terminal, ChevronDown, ChevronUp,
  Copy, Wifi, WifiOff, Settings, Save,
} from "lucide-react";
import type { LinkedInQueueItem, LinkedInDailyStats, QueueStatus } from "@/lib/linkedin-queue";
import type { RunnerConfig } from "@/app/api/outreach/config/route";

const BASE = "/prospecting-os";

interface GmapsStats {
  pipelineSize: number;
  formsQueuedToday: number;
  formsSentToday: number;
  smsSentToday: number;
  meetingsBooked: number;
  conversionRate: string;
  queue: Array<{
    id: string;
    lead_id: string;
    action_type: string;
    status: string;
    step_number: number;
    scheduled_for: string;
    executed_at: string | null;
    error: string | null;
    leads: { name: string; company: string; industry: string; location: string };
  }>;
}

type OutreachTab = "linkedin" | "gmaps";

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

function NumberInput({
  label, value, min, max, onChange, unit,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          className="w-20 px-2 py-1.5 rounded-md text-[12px] font-mono tabular-nums text-center focus:outline-none"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />
        {unit && <span className="text-[11px]" style={{ color: "var(--muted)" }}>{unit}</span>}
        <span className="text-[10px]" style={{ color: "var(--muted)" }}>({min}–{max})</span>
      </div>
    </div>
  );
}

function RunnerSettings() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<RunnerConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`${BASE}/api/outreach/config`)
      .then(r => r.ok ? r.json() : null)
      .then((d: RunnerConfig | null) => { if (d) setCfg(d); });
  }, [open]);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    const res = await fetch(`${BASE}/api/outreach/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    if (res.ok) { setCfg(await res.json() as RunnerConfig); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  }

  function set<K extends keyof RunnerConfig>(key: K, val: RunnerConfig[K]) {
    setCfg(prev => prev ? { ...prev, [key]: val } : prev);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ color: "var(--text)" }}
      >
        <div className="flex items-center gap-2">
          <Settings size={15} style={{ color: "var(--accent-blue)" }} />
          <span className="text-[13px] font-semibold">Runner Settings</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(0,212,255,0.08)", color: "var(--accent-blue)" }}>
            saved to cloud — no .env edit needed
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && cfg && (
        <div className="px-5 pb-5 space-y-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Daily Caps</p>
              <NumberInput label="Max connections/day" value={cfg.maxConnectionsPerDay} min={1} max={20} unit="connections" onChange={v => set("maxConnectionsPerDay", v)} />
              <NumberInput label="Max DMs/day" value={cfg.maxDmsPerDay} min={1} max={50} unit="DMs" onChange={v => set("maxDmsPerDay", v)} />
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Active Hours</p>
              <NumberInput label="Start hour (24h)" value={cfg.activeHoursStart} min={6} max={12} unit="AM" onChange={v => set("activeHoursStart", v)} />
              <NumberInput label="End hour (24h)" value={cfg.activeHoursEnd} min={14} max={23} unit="(14=2PM)" onChange={v => set("activeHoursEnd", v)} />
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Delays (human pacing)</p>
              <NumberInput label="Min delay between actions" value={cfg.minDelaySeconds} min={10} max={300} unit="sec" onChange={v => set("minDelaySeconds", v)} />
              <NumberInput label="Max delay between actions" value={cfg.maxDelaySeconds} min={30} max={600} unit="sec" onChange={v => set("maxDelaySeconds", v)} />
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Break Schedule</p>
              <NumberInput label="Break after every N actions" value={cfg.breakEveryNActions} min={2} max={20} unit="actions" onChange={v => set("breakEveryNActions", v)} />
              <NumberInput label="Break duration" value={cfg.breakDurationMinutes} min={5} max={60} unit="min" onChange={v => set("breakDurationMinutes", v)} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Runner reads these on every startup. Restart the runner after saving.
            </p>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                background: saved ? "rgba(0,255,136,0.12)" : "rgba(0,212,255,0.12)",
                border: `1px solid ${saved ? "rgba(0,255,136,0.25)" : "rgba(0,212,255,0.25)"}`,
                color: saved ? "var(--accent-green)" : "var(--accent-blue)",
              }}
            >
              <Save size={13} />
              {saving ? "Saving..." : saved ? "Saved" : "Save settings"}
            </button>
          </div>

          <div
            className="flex items-start gap-2 rounded-lg px-4 py-3"
            style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.20)" }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent-orange)" }} />
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              <span className="font-semibold" style={{ color: "var(--accent-orange)" }}>LinkedIn limits:</span>{" "}
              Max 20 connections/day (100/week). Staying at 10–15/day is safest.
              DMs have no hard limit but 20–30/day is conservative.
            </p>
          </div>
        </div>
      )}
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
      desc: "Only needs Supabase credentials. Limits are controlled from the Settings panel above.",
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
      desc: "Polls queue every 5 min. Runs during active hours only. Keep this terminal open while working.",
    },
    {
      key: "autostart",
      title: "Auto-start with Windows (optional — no 24/7 needed)",
      code: `schtasks /create /tn "LinkedIn Runner" /tr "cmd /c cd /d D:\\Flow-Forges\\lead-engine\\runner && node linkedin-runner.js >> runner.log 2>&1" /sc ONLOGON /f`,
      desc: "Starts the runner automatically when you log into Windows. Stops when PC is off — no need to keep it running 24/7.",
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
              This automation uses your real account. Always use a dedicated LinkedIn account, not your main one.
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
  const [activeTab, setActiveTab] = useState<OutreachTab>("linkedin");
  const [gmapsStats, setGmapsStats] = useState<GmapsStats | null>(null);
  const [gmapsLoading, setGmapsLoading] = useState(false);

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

  const fetchGmapsStats = useCallback(async () => {
    setGmapsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/gmaps-outreach/stats`);
      if (res.ok) setGmapsStats(await res.json() as GmapsStats);
    } catch { /* non-critical */ }
    finally { setGmapsLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (activeTab === "gmaps") fetchGmapsStats();
  }, [activeTab, fetchGmapsStats]);

  const stats = data?.todayStats;
  const status = data?.status;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Tab switcher */}
      <div className="flex items-center gap-2 px-6 pt-4 shrink-0">
        {(["linkedin", "gmaps"] as OutreachTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="text-[12px] font-semibold px-4 py-2 rounded-lg transition-all duration-150"
            style={{
              background: activeTab === tab ? "var(--accent-blue)" : "var(--surface2)",
              color: activeTab === tab ? "#000" : "var(--muted)",
              border: `1px solid ${activeTab === tab ? "var(--accent-blue)" : "var(--border)"}`,
            }}
          >
            {tab === "linkedin" ? "LinkedIn Queue" : "GMap Outreach"}
          </button>
        ))}
      </div>

      {/* GMap Outreach tab */}
      {activeTab === "gmaps" && (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {gmapsLoading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading stats…</p>}
          {!gmapsLoading && gmapsStats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {[
                  { label: "Pipeline Size", value: gmapsStats.pipelineSize, color: "var(--accent-blue)" },
                  { label: "Forms Queued Today", value: gmapsStats.formsQueuedToday, color: "var(--accent-blue)" },
                  { label: "Forms Sent Today", value: gmapsStats.formsSentToday, color: "var(--accent-green)" },
                  { label: "SMS Sent Today", value: gmapsStats.smsSentToday, color: "var(--accent-green)" },
                  { label: "Meetings Booked", value: gmapsStats.meetingsBooked, color: "var(--accent-orange)" },
                ].map(card => (
                  <div key={card.label}
                    className="rounded-xl p-4 flex flex-col gap-1"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>{card.label}</span>
                    <span className="text-2xl font-bold tabular-nums" style={{ color: card.color }}>
                      {card.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="text-[13px]" style={{ color: "var(--muted)" }}>Conversion rate (forms sent → meetings):</span>
                <span className="text-xl font-bold" style={{ color: "var(--accent-orange)" }}>
                  {gmapsStats.conversionRate}
                </span>
              </div>
              {gmapsStats.queue.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>
                  No items in queue yet. Import Google Maps businesses and click &quot;Add to Outreach&quot;.
                </p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                        {["Business", "Industry", "Step", "Status", "Scheduled", "Executed"].map(h => (
                          <th key={h} className="text-left px-3 py-2 font-semibold"
                            style={{ color: "var(--muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gmapsStats.queue.map(item => {
                        const statusColor = item.status === "done" ? "var(--accent-green)"
                          : item.status === "failed" ? "var(--accent-orange)"
                          : item.status === "skipped" ? "var(--muted)"
                          : "var(--accent-blue)";
                        const stepLabel = item.step_number === 1 ? "Form" : "SMS";
                        return (
                          <tr key={item.id}
                            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                            <td className="px-3 py-2 font-medium" style={{ color: "var(--text)" }}>
                              {item.leads?.company || item.leads?.name || item.lead_id.slice(0, 12)}
                            </td>
                            <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                              {item.leads?.industry ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                style={{
                                  background: item.step_number === 1 ? "rgba(0,212,255,0.1)" : "rgba(124,58,237,0.1)",
                                  color: item.step_number === 1 ? "var(--accent-blue)" : "var(--accent-purple)",
                                }}>
                                {stepLabel}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                style={{ background: `${statusColor}18`, color: statusColor }}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 tabular-nums" style={{ color: "var(--muted)" }}>
                              {new Date(item.scheduled_for).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 tabular-nums" style={{ color: "var(--muted)" }}>
                              {item.executed_at ? new Date(item.executed_at).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {!gmapsLoading && !gmapsStats && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Failed to load stats. Make sure you are logged in as super_admin.</p>
          )}
        </div>
      )}

      {/* LinkedIn Queue tab — existing content */}
      {activeTab === "linkedin" && <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
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
              { icon: Send, text: "Local runner on your machine executes actions at human pace" },
              { icon: Clock, text: "Runs only during your configured active hours — no 24/7 needed" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-2">
                <Icon size={12} className="mt-0.5 shrink-0" style={{ color: "var(--accent-blue)" }} />
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <RunnerSettings />
        <SetupGuide />
      </div>
      </div>}

    </div>
  );
}
