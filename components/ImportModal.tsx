"use client";
import { useState, useEffect, useCallback } from "react";
import { X, CloudDownload, Loader2, Check, AlertCircle, CheckSquare, Square, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApifyRun {
  runId: string;
  finishedAt: string;
  leadCount: number;
  datasetId: string;
  hasMore?: boolean;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (added: number, updated: number) => void;
}

type Phase = "loading" | "ready" | "importing" | "done" | "error";

export default function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [runs, setRuns] = useState<ApifyRun[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(200);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ added: number; updated: number; total: number } | null>(null);

  // ─── Fetch runs on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setPhase("loading");
    setMessage("");
    setResult(null);
    setSelected(new Set());

    const API_HEADERS = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
    };

    fetch("/api/leads/import", { headers: API_HEADERS })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const list: ApifyRun[] = data.runs || [];
        setRuns(list);
        setSelected(new Set(list.map(r => r.runId)));
        setPhase("ready");
      })
      .catch(err => {
        setMessage(err instanceof Error ? err.message : "Failed to load runs");
        setPhase("error");
      });
  }, [open]);

  // ─── Toggle selection ────────────────────────────────────────────────────
  const toggle = useCallback((runId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId); else next.add(runId);
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(runs.map(r => r.runId)));
  const deselectAll = () => setSelected(new Set());

  const selectedRuns = runs.filter(r => selected.has(r.runId));
  const totalSelectedLeads = selectedRuns.reduce((s, r) => s + r.leadCount, 0);

  // ─── Import ──────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (selected.size === 0) return;
    setPhase("importing");
    setMessage("");

    const API_HEADERS = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
    };

    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({ runIds: Array.from(selected), limit }),
      });
      const data = await res.json() as { error?: string; added?: number; updated?: number; total?: number };

      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      const r = { added: data.added ?? 0, updated: data.updated ?? 0, total: data.total ?? 0 };
      setResult(r);
      setPhase("done");
      setMessage(`Imported ${r.total} leads (${r.added} new, ${r.updated} updated)`);
      onImported(r.added, r.updated);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
      setPhase("error");
    }
  };

  if (!open) return null;

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[640px] max-w-[96vw] max-h-[85vh] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-line shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-info/15 border border-accent-purple/25">
            <CloudDownload size={16} style={{ color: "var(--info)" }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Import Leads from Apify</p>
            <p className="text-xs text-ink-3">
              {phase === "loading" ? "Loading past runs…" : `${runs.length} runs available`}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Loading state */}
          {phase === "loading" && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-ink-3" />
              <span className="ml-3 text-sm text-ink-3">Fetching Apify runs…</span>
            </div>
          )}

          {/* Error state */}
          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-sm text-red-400">{message}</p>
              <button
                onClick={() => { setPhase("loading"); window.location.reload(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-accent bg-white/[0.04] border border-line hover:bg-white/[0.08] transition-all"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}

          {/* Run list */}
          {(phase === "ready" || phase === "importing") && (
            <>
              {/* Select controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-[11px] text-accent hover:text-accent/80 transition-colors">Select all</button>
                  <span className="text-ink-3/50">•</span>
                  <button onClick={deselectAll} className="text-[11px] text-ink-3 hover:text-ink transition-colors">Deselect all</button>
                </div>
                <span className="text-xs text-ink-3">
                  <strong className="text-ink">{selected.size}</strong> of {runs.length} runs •{" "}
                  <strong className="text-ink">{totalSelectedLeads.toLocaleString()}</strong> leads
                </span>
              </div>

              {/* Run rows */}
              <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                {runs.map(run => {
                  const isSel = selected.has(run.runId);
                  return (
                    <button
                      key={run.runId}
                      onClick={() => toggle(run.runId)}
                      disabled={phase === "importing"}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                        isSel
                          ? "bg-info/10 border border-accent-purple/20"
                          : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04] hover:border-line",
                        phase === "importing" && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="shrink-0">
                        {isSel
                          ? <CheckSquare size={16} style={{ color: "var(--info)" }} />
                          : <Square size={16} className="text-ink-3/40" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-ink truncate font-mono">
                          {run.runId.slice(0, 16)}…
                        </p>
                        <p className="text-[10px] text-ink-3">{formatDate(run.finishedAt)}</p>
                      </div>
                      <span className={cn(
                        "shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full",
                        run.leadCount > 0
                          ? "bg-accent/10 text-accent"
                          : "bg-white/[0.04] text-ink-3"
                      )}>
                        {run.leadCount}{run.hasMore ? "+" : ""} lead{run.leadCount !== 1 ? "s" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Limit control */}
              <div className="flex items-center gap-3 pt-2 border-t border-line">
                <label className="text-[11px] font-semibold text-ink shrink-0">Leads per run:</label>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  disabled={phase === "importing"}
                  className="flex-1 accent-[var(--info)]"
                />
                <span className="text-[11px] font-mono text-ink w-10 text-right">{limit}</span>
              </div>
            </>
          )}

          {/* Done state */}
          {phase === "done" && result && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <Check size={22} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-ink">Import Complete</p>
              <p className="text-xs text-ink-3 text-center">{message}</p>
              <div className="flex gap-6 mt-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-positive">{result.added}</p>
                  <p className="text-[10px] text-ink-3">New</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-accent">{result.updated}</p>
                  <p className="text-[10px] text-ink-3">Updated</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-ink">{result.total}</p>
                  <p className="text-[10px] text-ink-3">Total</p>
                </div>
              </div>
            </div>
          )}

          {/* Importing progress */}
          {phase === "importing" && (
            <div className="flex items-center justify-center py-6 gap-3">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--info)" }} />
              <span className="text-sm text-ink-3">Importing {selected.size} run{selected.size > 1 ? "s" : ""}…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm text-ink-3 hover:text-ink hover:bg-white/[0.05] transition-all"
          >
            {phase === "done" ? "Done" : "Cancel"}
          </button>
          {(phase === "ready" || phase === "importing") && (
            <button
              onClick={handleImport}
              disabled={phase === "importing" || selected.size === 0}
              className="h-9 px-5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "rgba(124,58,237,0.2)",
                color: "var(--info)",
                border: "1px solid rgba(124,58,237,0.35)",
                boxShadow: "0 0 14px rgba(124,58,237,0.18)",
              }}
            >
              {phase === "importing" && <Loader2 size={13} className="animate-spin" />}
              <CloudDownload size={13} />
              Import {selected.size} run{selected.size > 1 ? "s" : ""} ({totalSelectedLeads.toLocaleString()} leads)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
