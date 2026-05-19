"use client";
import { useState, useEffect, useCallback } from "react";
import { X, CloudDownload, Loader2, AlertCircle, Check, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Lead } from "@/lib/types";

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
  onImported: (added: number, updated: number, total: number, leads: Lead[]) => void;
}

type Phase = "loading" | "ready" | "importing" | "error";

const API_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
};

async function fetchRuns(): Promise<{ runs: ApifyRun[]; importedRunIds: string[] }> {
  const res = await fetch("/prospecting-os/api/leads/import", { headers: API_HEADERS });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { runs: data.runs || [], importedRunIds: data.importedRunIds || [] };
}

export default function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [runs, setRuns] = useState<ApifyRun[]>([]);
  const [importedRunIds, setImportedRunIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");

  const loadRuns = useCallback(async () => {
    if (!open) return;
    let cancelled = false;

    setPhase("loading");
    setMessage("");
    setSelectedRunId(null);

    try {
      const { runs: list, importedRunIds: ids } = await fetchRuns();
      if (!cancelled) {
        setRuns(list);
        setImportedRunIds(ids);
        setPhase("ready");
      }
    } catch (err) {
      if (!cancelled) {
        setMessage(err instanceof Error ? err.message : "Failed to load runs");
        setPhase("error");
      }
    }

    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) loadRuns();
  }, [open, loadRuns]);

  const selectedRun = runs.find(r => r.runId === selectedRunId);
  const isSelectedImported = selectedRunId ? importedRunIds.includes(selectedRunId) : false;
  const totalSelectedLeads = selectedRun?.leadCount ?? 0;

  const freshRuns = runs.filter(r => !importedRunIds.includes(r.runId));
  const importedRuns = runs.filter(r => importedRunIds.includes(r.runId));

  const handleImport = useCallback(async () => {
    if (!selectedRunId || isSelectedImported) return;
    setPhase("importing");
    setMessage("");

    try {
      const res = await fetch("/prospecting-os/api/leads/import", {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({ runId: selectedRunId }),
      });
      const data = await res.json() as {
        error?: string; alreadyImported?: boolean; added?: number; updated?: number;
        total?: number; leads?: Lead[]; importedRunIds?: string[];
      };

      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.alreadyImported) {
        setMessage("This run was already imported.");
        setPhase("ready");
        // Still update tracking
        setImportedRunIds(prev => [...new Set([...prev, selectedRunId])]);
        return;
      }

      // Record as imported locally
      setImportedRunIds(prev => [...new Set([...prev, selectedRunId])]);
      setSelectedRunId(null);

      await onImported(data.added ?? 0, data.updated ?? 0, data.total ?? 0, data.leads ?? []);
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to import leads");
      setPhase("error");
    }
  }, [selectedRunId, isSelectedImported, onImported, onClose]);

  const handleRetry = useCallback(() => {
    loadRuns();
  }, [loadRuns]);

  if (!open) return null;

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
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
              {phase === "loading" ? "Loading past runs…" : `${freshRuns.length} runs available · ${importedRuns.length} imported`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={phase === "importing"}
            className="text-ink-3 hover:text-ink transition-colors p-1 disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {phase === "loading" && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-ink-3" />
              <span className="ml-3 text-sm text-ink-3">Fetching Apify runs…</span>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-sm text-red-400 text-center">{message}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-accent bg-white/[0.04] border border-line hover:bg-white/[0.08] transition-all"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}

          {(phase === "ready" || phase === "importing") && (
            <>
              {/* Fresh runs — importable */}
              {freshRuns.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-3">Select a run to import its leads</span>
                    {selectedRun && !isSelectedImported && (
                      <span className="text-xs text-ink-3">
                        <strong className="text-ink">{totalSelectedLeads.toLocaleString()}</strong> leads
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                    {freshRuns.map(run => {
                      const isSel = selectedRunId === run.runId;
                      return (
                        <button
                          key={run.runId}
                          onClick={() => setSelectedRunId(run.runId)}
                          disabled={phase === "importing"}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                            isSel
                              ? "bg-info/10 border border-accent-purple/30 shadow-[0_0_12px_rgba(124,58,237,0.12)]"
                              : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04] hover:border-line",
                            phase === "importing" && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className={cn(
                            "shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                            isSel ? "border-[var(--info)] bg-[var(--info)]" : "border-ink-3/30"
                          )}>
                            {isSel && <Check size={10} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-ink truncate font-mono">
                              {run.runId.slice(0, 20)}…
                            </p>
                            <p className="text-[10px] text-ink-3">{formatDate(run.finishedAt)}</p>
                          </div>
                          <span className={cn(
                            "shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full",
                            run.leadCount > 0 ? "bg-accent/10 text-accent" : "bg-white/[0.04] text-ink-3"
                          )}>
                            {run.leadCount}{run.hasMore ? "+" : ""} lead{run.leadCount !== 1 ? "s" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Imported runs — disabled, at bottom */}
              {importedRuns.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Imported</span>
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  </div>

                  <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 opacity-60">
                    {importedRuns.map(run => (
                      <div
                        key={run.runId}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.01] border border-transparent cursor-default"
                      >
                        <div className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-accent-green/15">
                          <CheckCircle2 size={12} style={{ color: "var(--accent-green)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-ink-3 truncate font-mono">
                            {run.runId.slice(0, 20)}…
                          </p>
                          <p className="text-[10px] text-ink-3">{formatDate(run.finishedAt)}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-green/10"
                          style={{ color: "var(--accent-green)" }}>
                          Imported ✓
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {freshRuns.length === 0 && importedRuns.length > 0 && (
                <p className="text-center text-sm text-ink-3 py-8">
                  All runs have been imported.
                </p>
              )}

              {freshRuns.length === 0 && importedRuns.length === 0 && (
                <p className="text-center text-sm text-ink-3 py-12">
                  No completed Apify runs found. Run the agent first.
                </p>
              )}

              {/* Importing progress */}
              {phase === "importing" && (
                <div className="flex items-center justify-center py-4 gap-3">
                  <Loader2 size={18} className="animate-spin" style={{ color: "var(--info)" }} />
                  <span className="text-sm text-ink-3">Importing leads from selected run…</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line shrink-0">
          <button
            onClick={onClose}
            disabled={phase === "importing"}
            className="h-9 px-4 rounded-lg text-sm text-ink-3 hover:text-ink hover:bg-white/[0.05] transition-all disabled:opacity-30"
          >
            Cancel
          </button>
          {(phase === "ready" || phase === "importing") && (
            <button
              onClick={handleImport}
              disabled={phase === "importing" || !selectedRunId || isSelectedImported}
              className="h-9 px-5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "rgba(124,58,237,0.2)",
                color: "var(--info)",
                border: "1px solid rgba(124,58,237,0.35)",
                boxShadow: "0 0 14px rgba(124,58,237,0.18)",
              }}
            >
              {phase === "importing" ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Importing leads…
                </>
              ) : isSelectedImported ? (
                <>
                  <CheckCircle2 size={13} />
                  Already Imported
                </>
              ) : (
                <>
                  <CloudDownload size={13} />
                  Import{selectedRun ? ` ${totalSelectedLeads.toLocaleString()} leads` : ""}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
