"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany",
  "France", "India", "Brazil", "Netherlands", "Singapore", "Ireland",
  "Spain", "Italy", "Sweden", "Denmark", "Norway", "Finland",
  "Switzerland", "Belgium", "Austria", "New Zealand", "Israel",
  "United Arab Emirates", "Japan", "South Korea", "Mexico",
];

const SIZES = ["Any", "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"];

interface NewScrapeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = "idle" | "running" | "done" | "error";

interface ScrapeResult {
  leadsFound: number;
  runId: string;
}

export default function NewScrapeModal({ onClose, onSuccess }: NewScrapeModalProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [titles, setTitles] = useState("");
  const [country, setCountry] = useState("United States");
  const [size, setSize] = useState("Any");
  const [limit, setLimit] = useState(100);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleScrape = async () => {
    setPhase("running");
    setErrorMsg("");

    try {
      const fields: Record<string, string | number> = { limit };
      if (country !== "Any") fields.country = country;
      if (size !== "Any") fields.size = size;
      if (titles.trim()) fields.titles = titles.trim();

      const startRes = await fetch("/prospecting-os/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: "linkedin", fields }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || `HTTP ${startRes.status}`);
      }
      const { runId } = await startRes.json() as { runId: string };

      // Poll until SUCCEEDED or FAILED (max 5 minutes / 60 × 5s)
      let status = "RUNNING";
      let leadsFound = 0;
      for (let attempt = 0; attempt < 60 && status === "RUNNING"; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(
          `/prospecting-os/api/leads?runId=${encodeURIComponent(runId)}`
        );
        const pollData = await pollRes.json() as { status: string; leads?: unknown[] };
        status = pollData.status;
        if (status === "SUCCEEDED") {
          leadsFound = pollData.leads?.length ?? 0;
          break;
        }
        if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
          throw new Error(`Scrape ${status.toLowerCase()}`);
        }
      }
      if (status === "RUNNING") throw new Error("Scrape timed out after 5 minutes");

      setResult({ leadsFound, runId });
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
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 text-[var(--muted)] hover:text-[var(--text)]"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}
          >
            <Play size={14} style={{ color: "var(--accent-blue)" }} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>New Scrape</h2>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Trigger a new Apify actor run with custom params
            </p>
          </div>
        </div>

        {phase === "idle" && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Job Titles (comma-separated)
              </label>
              <input
                type="text"
                placeholder="CTO, VP Engineering, Head of Product"
                value={titles}
                onChange={e => setTitles(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  Country
                </label>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-[13px] outline-none appearance-none"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                >
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  Company Size
                </label>
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-[13px] outline-none appearance-none"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                >
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Max Leads
              </label>
              <div className="flex gap-2">
                {[50, 100, 200, 500].map(n => (
                  <button
                    key={n}
                    onClick={() => setLimit(n)}
                    className="flex-1 h-8 rounded-lg text-[12px] font-medium transition-colors"
                    style={{
                      background: limit === n ? "rgba(0,212,255,0.15)" : "var(--surface-2)",
                      border: `1px solid ${limit === n ? "rgba(0,212,255,0.4)" : "var(--border)"}`,
                      color: limit === n ? "var(--accent-blue)" : "var(--muted)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors duration-150 text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                onClick={handleScrape}
                className="flex-1 h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-all duration-150 bg-[rgba(0,212,255,0.12)] hover:bg-[rgba(0,212,255,0.2)] text-[var(--accent-blue)] border border-[rgba(0,212,255,0.3)]"
              >
                <Play size={13} /> Start Scrape
              </button>
            </div>
          </div>
        )}

        {phase === "running" && (
          <div className="flex flex-col items-center py-8 gap-4">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
            <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
              Running Apify actor…
            </p>
            <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
              Polling every 5 seconds — up to 5 minutes
            </p>
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2" style={{ color: "var(--accent-green)" }}>
              <CheckCircle size={18} />
              <span className="text-[14px] font-semibold">Scrape complete</span>
            </div>
            <div
              className="rounded-lg p-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="text-[22px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
                {result.leadsFound.toLocaleString()}
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>Leads found</div>
              <div className="text-[10px] mt-2 font-mono truncate" style={{ color: "var(--muted)" }}>
                Run ID: {result.runId}
              </div>
            </div>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Use &ldquo;Sync History&rdquo; to import these leads into your database.
            </p>
            <button
              onClick={onClose}
              className="w-full h-9 rounded-lg text-[13px] font-medium"
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
              <span className="text-[14px] font-semibold">Scrape failed</span>
            </div>
            <p
              className="text-[12px] p-3 rounded-lg"
              style={{
                background: "rgba(255,107,53,0.08)",
                border: "1px solid rgba(255,107,53,0.2)",
                color: "var(--accent-orange)",
              }}
            >
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
                className="flex-1 h-9 rounded-lg text-[13px] font-semibold"
                style={{
                  background: "rgba(0,212,255,0.12)",
                  color: "var(--accent-blue)",
                  border: "1px solid rgba(0,212,255,0.3)",
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
