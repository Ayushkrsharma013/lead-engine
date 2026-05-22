"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, RefreshCw, CheckCircle2, Clock,
  AlertTriangle, Terminal, ChevronDown, ChevronUp,
  Copy, Wifi, WifiOff, Settings, Save,
  Globe, MessageSquare, Phone, CalendarCheck,
} from "lucide-react";
import type { GmapsRunnerConfig } from "@/app/api/outreach/gmaps-config/route";

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

interface GmapsQueueStatus {
  status: {
    pending: number;
    executing: number;
    done: number;
    failed: number;
    skipped: number;
  };
  runnerLive: boolean;
  lastRunAt: string | null;
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

// ─── Number input ───────────────────────────────────────────────────────────────

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
          min={min} max={max}
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

// ─── Runner settings accordion ─────────────────────────────────────────────────

function GmapRunnerSettings() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<GmapsRunnerConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`${BASE}/api/outreach/gmaps-config`)
      .then(r => r.ok ? r.json() : null)
      .then((d: GmapsRunnerConfig | null) => { if (d) setCfg(d); });
  }, [open]);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    const res = await fetch(`${BASE}/api/outreach/gmaps-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    if (res.ok) { setCfg(await res.json() as GmapsRunnerConfig); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  }

  function set<K extends keyof GmapsRunnerConfig>(key: K, val: GmapsRunnerConfig[K]) {
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
          <Settings size={15} style={{ color: "var(--accent-green)" }} />
          <span className="text-[13px] font-semibold">Runner Settings</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(0,255,136,0.08)", color: "var(--accent-green)" }}>
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
              <NumberInput label="Max form fills/day" value={cfg.maxFormFillsPerDay} min={1} max={50} unit="forms" onChange={v => set("maxFormFillsPerDay", v)} />
              <NumberInput label="Max SMS/day" value={cfg.maxSmsPerDay} min={1} max={50} unit="SMS" onChange={v => set("maxSmsPerDay", v)} />
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Active Hours (weekdays only)</p>
              <NumberInput label="Start hour (24h)" value={cfg.activeHoursStart} min={6} max={12} unit="AM" onChange={v => set("activeHoursStart", v)} />
              <NumberInput label="End hour (24h)" value={cfg.activeHoursEnd} min={14} max={23} unit="(18=6PM)" onChange={v => set("activeHoursEnd", v)} />
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
                background: saved ? "rgba(0,255,136,0.12)" : "rgba(0,255,136,0.10)",
                border: `1px solid ${saved ? "rgba(0,255,136,0.25)" : "rgba(0,255,136,0.20)"}`,
                color: saved ? "var(--accent-green)" : "var(--accent-green)",
              }}
            >
              <Save size={13} />
              {saving ? "Saving..." : saved ? "Saved" : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Setup guide accordion ──────────────────────────────────────────────────────

function GmapSetupGuide() {
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
      desc: "Installs Playwright + Supabase client + Twilio. Requires Node.js 18+.",
    },
    {
      key: "env",
      title: "Configure .env (one-time)",
      code: "cp .env.example .env\n# Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER",
      desc: "TWILIO credentials needed for SMS follow-ups. Form fill limits are controlled from the Settings panel above.",
    },
    {
      key: "browser",
      title: "Set up Chrome profile (one-time — optional)",
      code: "node gmaps-runner.js",
      desc: "No explicit setup needed. First run creates a persistent Chrome profile at ~/.gmaps-runner/profile. The runner uses stealth mode by default.",
    },
    {
      key: "run",
      title: "Start the runner",
      code: "node gmaps-runner.js",
      desc: "Polls queue every 5 min. Fills contact forms via Playwright, sends SMS via Twilio. Runs weekdays during active hours only. Keep this terminal open.",
    },
    {
      key: "autostart",
      title: "Auto-start with Windows (optional)",
      code: `schtasks /create /tn "GMap Runner" /tr "cmd /c cd /d D:\\Flow-Forges\\lead-engine\\runner && node gmaps-runner.js >> gmaps-runner.log 2>&1" /sc ONLOGON /f`,
      desc: "Starts the runner automatically when you log into Windows. Stops when PC is off — no 24/7 needed.",
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
          <Terminal size={15} style={{ color: "var(--accent-green)" }} />
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
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function GmapOutreachPage() {
  const [stats, setStats] = useState<GmapsStats | null>(null);
  const [queueStatus, setQueueStatus] = useState<GmapsQueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/gmaps-outreach/stats`);
      if (res.ok) setStats(await res.json() as GmapsStats);
    } catch { /* non-critical */ }
  }, []);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await (await fetch(`${BASE}/api/gmaps-outreach/stats`)).json();
      // Build queue status from the stats data
      const stats = data as GmapsStats | undefined;
      if (stats?.queue) {
        const byStatus = (s: string) => stats.queue.filter((q: { status: string }) => q.status === s).length;
        setQueueStatus({
          status: {
            pending: byStatus("pending"),
            executing: byStatus("executing"),
            done: byStatus("done"),
            failed: byStatus("failed"),
            skipped: byStatus("skipped"),
          },
          runnerLive: false, // determined by recent executed_at timestamps below
          lastRunAt: null,
        });

        // Runner is "live" if any item was executed in the last 10 minutes
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        const recentExec = stats.queue.some(
          (q: { executed_at: string | null }) => q.executed_at && new Date(q.executed_at).getTime() > tenMinAgo
        );
        const lastExec = stats.queue
          .filter((q: { executed_at: string | null }) => q.executed_at)
          .sort((a, b) => new Date(b.executed_at!).getTime() - new Date(a.executed_at!).getTime())[0];
        setQueueStatus(prev => prev ? {
          ...prev,
          runnerLive: recentExec,
          lastRunAt: lastExec?.executed_at ?? null,
        } : prev);
      }
    } catch { /* non-critical */ }
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    await Promise.all([fetchStats(), fetchQueueStatus()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchStats, fetchQueueStatus]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" }}>
            <MapPin size={16} style={{ color: "var(--accent-green)" }} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>GMap Outreach</h1>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Automated contact form fills + SMS follow-ups for Google Maps businesses
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: queueStatus?.runnerLive ? "rgba(0,255,136,0.08)" : "rgba(107,107,128,0.08)",
              border: `1px solid ${queueStatus?.runnerLive ? "rgba(0,255,136,0.20)" : "rgba(107,107,128,0.20)"}`,
              color: queueStatus?.runnerLive ? "var(--accent-green)" : "var(--muted)",
            }}
          >
            {queueStatus?.runnerLive ? <Wifi size={10} /> : <WifiOff size={10} />}
            {loading ? "..." : queueStatus?.runnerLive ? "Runner live" : "Runner offline"}
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

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading stats…</p>
        ) : stats ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <StatCard label="Pipeline Size" value={stats.pipelineSize} color="var(--accent-blue)" />
              <StatCard label="Forms Queued Today" value={stats.formsQueuedToday} color="var(--accent-blue)" />
              <StatCard label="Forms Sent Today" value={stats.formsSentToday} color="var(--accent-green)" />
              <StatCard label="SMS Sent Today" value={stats.smsSentToday} color="var(--accent-green)" />
              <StatCard label="Meetings Booked" value={stats.meetingsBooked} color="var(--accent-orange)" />
            </div>

            {/* Queue status breakdown */}
            {queueStatus && (
              <div className="grid grid-cols-5 gap-3">
                {(["pending", "executing", "done", "failed", "skipped"] as const).map((key) => {
                  const colorMap: Record<string, string> = {
                    pending: "#f59e0b",
                    executing: "var(--accent-blue)",
                    done: "var(--accent-green)",
                    failed: "var(--accent-orange)",
                    skipped: "var(--muted)",
                  };
                  return (
                    <div key={key} className="rounded-xl p-4 flex flex-col gap-1"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                      <span className="text-2xl font-bold tabular-nums" style={{ color: colorMap[key] }}>
                        {queueStatus.status[key] ?? 0}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Conversion rate */}
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <CalendarCheck size={16} style={{ color: "var(--accent-orange)" }} />
              <span className="text-[13px]" style={{ color: "var(--muted)" }}>
                Conversion rate (forms sent → meetings booked):
              </span>
              <span className="text-xl font-bold" style={{ color: "var(--accent-orange)" }}>
                {stats.conversionRate}
              </span>
            </div>

            {/* Queue table */}
            {stats.queue.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: "var(--muted)" }} />
                <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Queue is empty</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                  Go to Maps Prospecting, search for businesses, and use "Auto-Queue" to populate the pipeline.
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted)" }}>
                  Outreach Queue — Last 50 Items
                </h2>
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
                      {stats.queue.map((item) => {
                        const statusColor = item.status === "done" ? "var(--accent-green)"
                          : item.status === "failed" ? "var(--accent-orange)"
                          : item.status === "skipped" ? "var(--muted)"
                          : item.status === "executing" ? "var(--accent-blue)"
                          : "#f59e0b";
                        const stepLabel = item.step_number === 1 ? "Form" : "SMS";
                        const StepIcon = item.step_number === 1 ? Globe : MessageSquare;
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
                              <div className="flex items-center gap-1">
                                <StepIcon size={11} style={{
                                  color: item.step_number === 1 ? "var(--accent-blue)" : "var(--accent-purple)",
                                }} />
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                  style={{
                                    background: item.step_number === 1 ? "rgba(0,212,255,0.1)" : "rgba(124,58,237,0.1)",
                                    color: item.step_number === 1 ? "var(--accent-blue)" : "var(--accent-purple)",
                                  }}>
                                  {stepLabel}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                style={{ background: `${statusColor}18`, color: statusColor }}>
                                {item.status}
                              </span>
                              {item.error && (
                                <span className="ml-1 text-[10px]" style={{ color: "var(--accent-orange)" }} title={item.error}>
                                  <AlertTriangle size={10} />
                                </span>
                              )}
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
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: "var(--muted)" }} />
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              Failed to load stats. Make sure you are logged in as super_admin.
            </p>
          </div>
        )}

        {/* ── How this works ── */}
        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)" }}>
          <p className="text-[12px] font-semibold" style={{ color: "var(--accent-green)" }}>How this works</p>
          <div className="space-y-1.5">
            {[
              { icon: MapPin, text: "Import businesses from Google Maps via Maps Prospecting — use Auto-Queue to skip manual steps" },
              { icon: Globe, text: "Day 1: Local Playwright runner fills the contact form on each business's website at human pace" },
              { icon: Phone, text: "Day 3: If no booking yet, the runner sends a 160-char SMS follow-up via Twilio" },
              { icon: CalendarCheck, text: "When a business owner books a discovery call, the lead auto-moves to Meeting in your pipeline" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-2">
                <Icon size={12} className="mt-0.5 shrink-0" style={{ color: "var(--accent-green)" }} />
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <GmapRunnerSettings />
        <GmapSetupGuide />
      </div>
    </div>
  );
}
