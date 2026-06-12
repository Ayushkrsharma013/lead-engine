"use client";

import { useState } from "react";
import { Database, Loader2, CheckCircle, AlertCircle, RefreshCw, X } from "lucide-react";

interface SyncResult {
  runs_processed: number;
  leads_found: number;
  leads_imported: number;
  leads_skipped: number;
}

interface SyncApifyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = "idle" | "syncing" | "scoring" | "done" | "error";

export default function SyncApifyModal({ onClose, onSuccess }: SyncApifyModalProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [scored, setScored] = useState(0);
  const [hotQueued, setHotQueued] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSync = async () => {
    setPhase("syncing");
    setErrorMsg("");

    try {
      const syncRes = await fetch("/prospecting-os/api/leads/apify-sync", { method: "POST" });
      if (!syncRes.ok) {
        const err = await syncRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || `HTTP ${syncRes.status}`);
      }
      const syncData = await syncRes.json() as SyncResult;
      setResult(syncData);

      setPhase("scoring");
      const scoreRes = await fetch("/prospecting-os/api/leads/apify-sync/score", { method: "POST" });
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json() as { scored?: number; hot_leads_queued?: number };
        setScored(scoreData.scored ?? 0);
        setHotQueued(scoreData.hot_leads_queued ?? 0);
      }

      setPhase("done");
      onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 relative"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-[var(--muted)] hover:text-[var(--text)]"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}
          >
            <Database size={16} style={{ color: "var(--accent-blue)" }} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
              Sync Historical Apify Runs
            </h2>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Import all past actor runs into your database
            </p>
          </div>
        </div>

        {phase === "idle" && (
          <>
            <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
              This will fetch all past Apify actor runs and import new leads into your database.
              Duplicate leads (matched by email) will be skipped.
            </p>

            <div
              className="rounded-lg p-3 mb-5 text-[12px]"
              style={{
                background: "rgba(255,107,53,0.08)",
                border: "1px solid rgba(255,107,53,0.2)",
                color: "var(--accent-orange)",
              }}
            >
              One-time operation. This may take 30–60 seconds depending on run history.
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors text-[var(--muted)] border border-[var(--border)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSync}
                className="flex-1 h-9 rounded-lg text-[13px] font-semibold transition-all"
                style={{
                  background: "rgba(0,212,255,0.12)",
                  color: "var(--accent-blue)",
                  border: "1px solid rgba(0,212,255,0.3)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.2)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.12)";
                }}
              >
                Start Sync
              </button>
            </div>
          </>
        )}

        {(phase === "syncing" || phase === "scoring") && (
          <div className="flex flex-col items-center py-6 gap-4">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
            <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
              {phase === "syncing" ? "Fetching Apify runs and importing leads…" : "Scoring imported leads…"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              This may take up to 60 seconds
            </p>
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2" style={{ color: "var(--accent-green)" }}>
              <CheckCircle size={18} />
              <span className="text-[14px] font-semibold">Sync complete</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Runs processed", value: result.runs_processed },
                { label: "Leads found", value: result.leads_found },
                { label: "Leads imported", value: result.leads_imported },
                { label: "Already existed", value: result.leads_skipped },
                { label: "Leads scored", value: scored },
                ...(hotQueued > 0 ? [{ label: "Hot queued", value: hotQueued }] : []),
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg p-3"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="text-[18px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
                    {value.toLocaleString()}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full h-9 rounded-lg text-[13px] font-medium transition-colors"
              style={{
                background: "rgba(0,255,136,0.1)",
                color: "var(--accent-green)",
                border: "1px solid rgba(0,255,136,0.25)",
              }}
            >
              Done
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2" style={{ color: "var(--accent-orange)" }}>
              <AlertCircle size={18} />
              <span className="text-[14px] font-semibold">Sync failed</span>
            </div>
            <p className="text-[12px] p-3 rounded-lg" style={{
              background: "rgba(255,107,53,0.08)",
              border: "1px solid rgba(255,107,53,0.2)",
              color: "var(--accent-orange)",
            }}>
              {errorMsg}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium"
                style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => setPhase("idle")}
                className="flex-1 h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2"
                style={{
                  background: "rgba(0,212,255,0.12)",
                  color: "var(--accent-blue)",
                  border: "1px solid rgba(0,212,255,0.3)",
                }}
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
