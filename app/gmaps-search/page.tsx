"use client";

import { useState, useCallback, useRef } from "react";
import {
  MapPin, Search, Star, Phone, Globe, Building2,
  CheckSquare, Square, Download, RefreshCw, ChevronRight,
  AlertCircle, X, Zap, ExternalLink, TrendingUp, Layers, Send,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import Link from "next/link";
import type { GMapsBusiness } from "@/app/api/gmaps-search/route";

// ─── Quick-pick business types ────────────────────────────────────────────────

const QUICK_TYPES = [
  "Dentist", "Plumber", "Electrician", "HVAC", "Real Estate Agent",
  "Chiropractor", "Auto Repair", "Law Firm", "Gym", "Restaurant",
  "Roofer", "Pest Control", "Landscaper", "Cleaning Service", "Veterinarian",
];

type Mode = "quick" | "deep";

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#00ff88" : score >= 65 ? "#E8A840" : "#ff6b35";
  return (
    <span
      className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {score}
    </span>
  );
}

// ─── Star rating ──────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={11}
          fill={i <= full ? "#E8A840" : "transparent"}
          style={{ color: i <= full || (i === full + 1 && half) ? "#E8A840" : "var(--ink-4)" }}
        />
      ))}
    </span>
  );
}

// ─── Business card ────────────────────────────────────────────────────────────

function BusinessCard({
  biz, selected, imported, queued, onToggle,
}: {
  biz: GMapsBusiness;
  selected: boolean;
  imported: boolean;
  queued: boolean;
  onToggle: () => void;
}) {
  const isOperational = biz.businessStatus === "OPERATIONAL";
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-150 cursor-pointer select-none"
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(232,168,64,0.07) 0%, var(--surface) 100%)"
          : "var(--surface)",
        border: `1px solid ${selected ? "rgba(232,168,64,0.35)" : "var(--line)"}`,
        boxShadow: selected ? "0 0 0 1px rgba(232,168,64,0.12)" : "none",
        opacity: imported ? 0.55 : 1,
      }}
      onClick={imported ? undefined : onToggle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm truncate" style={{ color: "var(--ink)" }}>
              {biz.name}
            </span>
            {imported && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ background: "rgba(0,255,136,0.12)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.25)" }}
              >
                Imported
              </span>
            )}
            {queued && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ background: "rgba(0,212,255,0.12)", color: "var(--accent-blue)", border: "1px solid rgba(0,212,255,0.25)" }}>
                Queued
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(232,168,64,0.1)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.2)" }}
            >
              {biz.category}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: isOperational ? "rgba(0,255,136,0.08)" : "rgba(255,107,53,0.1)",
                color: isOperational ? "#00ff88" : "#ff6b35",
                border: `1px solid ${isOperational ? "rgba(0,255,136,0.2)" : "rgba(255,107,53,0.2)"}`,
              }}
            >
              {isOperational ? "Open" : biz.businessStatus.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={biz.score} />
          {imported
            ? <CheckSquare size={16} style={{ color: "#00ff88" }} />
            : selected
              ? <CheckSquare size={16} style={{ color: "var(--accent)" }} />
              : <Square size={16} style={{ color: "var(--ink-4)" }} />
          }
        </div>
      </div>

      {/* Rating */}
      {biz.rating > 0 && (
        <div className="flex items-center gap-1.5">
          <Stars rating={biz.rating} />
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--ink-2)" }}>
            {biz.rating.toFixed(1)}
          </span>
          <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
            ({biz.reviewCount.toLocaleString()} reviews)
          </span>
        </div>
      )}

      {/* Address */}
      <div className="flex items-start gap-1.5">
        <MapPin size={12} className="mt-0.5 shrink-0" style={{ color: "var(--ink-4)" }} />
        <span className="text-[11px] leading-tight" style={{ color: "var(--ink-3)" }}>{biz.address}</span>
      </div>

      {/* Phone + Website */}
      <div className="flex items-center gap-3 flex-wrap">
        {biz.phone ? (
          <div className="flex items-center gap-1">
            <Phone size={11} style={{ color: "#00ff88" }} />
            <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--ink-2)" }}>{biz.phone}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Phone size={11} style={{ color: "var(--ink-4)" }} />
            <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>No phone</span>
          </div>
        )}
        {biz.website ? (
          <a
            href={biz.website} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <Globe size={11} style={{ color: "var(--accent)" }} />
            <span className="text-[11px]" style={{ color: "var(--accent)" }}>Website</span>
            <ExternalLink size={9} style={{ color: "var(--accent)" }} />
          </a>
        ) : (
          <div className="flex items-center gap-1">
            <Globe size={11} style={{ color: "var(--ink-4)" }} />
            <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>No website</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4 space-y-3 animate-pulse"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", height: 180 }}
        >
          <div className="flex justify-between">
            <div className="h-4 w-2/3 rounded" style={{ background: "var(--surface-2)" }} />
            <div className="h-4 w-6 rounded" style={{ background: "var(--surface-2)" }} />
          </div>
          <div className="h-3 w-1/3 rounded" style={{ background: "var(--surface-2)" }} />
          <div className="h-3 w-full rounded" style={{ background: "var(--surface-2)" }} />
          <div className="h-3 w-3/4 rounded" style={{ background: "var(--surface-2)" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function GmapsSearchPage() {
  const [mode, setMode] = useState<Mode>("deep");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [maxResults, setMaxResults] = useState(50);

  const [results, setResults] = useState<GMapsBusiness[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [addingToOutreach, setAddingToOutreach] = useState(false);
  const [outreachResult, setOutreachResult] = useState<{ queued?: number; skipped?: number; error?: string } | null>(null);
  const [autoQueue, setAutoQueue] = useState(true);
  const [autoQueueResult, setAutoQueueResult] = useState<{ queued: number; qualifyingCount: number; assessed: number } | null>(null);
  const [scanningAll, setScanningAll] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number } | null>(null);

  // Deep scrape state
  const [deepRunId, setDeepRunId] = useState<string | null>(null);
  const [deepCrawled, setDeepCrawled] = useState(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  };

  // ── Quick search (Google Places API) ──────────────────────────────────────

  const handleQuickSearch = useCallback(async (pageToken?: string) => {
    if (!query.trim() || !location.trim()) { setError("Enter a business type and location."); return; }
    setError(""); setImportResult(null);
    if (!pageToken) { setLoading(true); setResults([]); setSelected(new Set()); setNextPageToken(null); }
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        q: query.trim(), location: location.trim(),
        ...(minRating > 0 ? { minRating: String(minRating) } : {}),
        ...(pageToken ? { pageToken } : {}),
      });
      const res = await fetch(`/prospecting-os/api/gmaps-search?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Search failed. Check your GOOGLE_MAPS_API_KEY."); return; }
      if (!pageToken) setResults(data.results || []);
      else setResults(prev => [...prev, ...(data.results || [])]);
      setNextPageToken(data.nextPageToken || null);
    } catch { setError("Network error — please try again."); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [query, location, minRating]);

  // ── Deep scrape (Apify compass~crawler-google-places) ────────────────────

  const pollDeep = useCallback(async (runId: string, rating: number) => {
    try {
      const res = await fetch(
        `/prospecting-os/api/gmaps-scrape?runId=${encodeURIComponent(runId)}&minRating=${rating}`,
      );
      const data = await res.json();

      if (data.status === "SUCCEEDED") {
        setResults(data.results || []);
        setLoading(false);
        setDeepRunId(null);
        stopPoll();
      } else if (data.status === "FAILED" || data.status === "ABORTED" || data.status === "TIMED-OUT") {
        setError(data.error || `Scrape ${data.status.toLowerCase()}`);
        setLoading(false);
        setDeepRunId(null);
        stopPoll();
      } else {
        setDeepCrawled(data.crawled || 0);
        pollRef.current = setTimeout(() => pollDeep(runId, rating), 3500);
      }
    } catch {
      setError("Polling error — please try again.");
      setLoading(false);
      setDeepRunId(null);
      stopPoll();
    }
  }, []);

  const handleDeepScrape = useCallback(async () => {
    if (!query.trim() || !location.trim()) { setError("Enter a business type and location."); return; }
    setError(""); setImportResult(null); setLoading(true);
    setResults([]); setSelected(new Set()); setDeepCrawled(0); stopPoll();

    try {
      const res = await fetch("/prospecting-os/api/gmaps-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), location: location.trim(), maxResults, minRating }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to start scrape. Check your APIFY_API_KEY."); setLoading(false); return; }
      setDeepRunId(data.runId);
      pollRef.current = setTimeout(() => pollDeep(data.runId, minRating), 3500);
    } catch { setError("Network error — please try again."); setLoading(false); }
  }, [query, location, maxResults, minRating, pollDeep]);

  const cancelDeep = () => {
    stopPoll();
    setLoading(false);
    setDeepRunId(null);
    setDeepCrawled(0);
  };

  // ── Shared: toggle selection ───────────────────────────────────────────────

  const toggleSelect = (placeId: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(placeId) ? n.delete(placeId) : n.add(placeId); return n; });
  };

  const toggleAll = () => {
    const importable = results.filter(r => !importedIds.has(r.placeId));
    setSelected(selected.size === importable.length ? new Set() : new Set(importable.map(r => r.placeId)));
  };

  // ── Import selected ────────────────────────────────────────────────────────

  const handleImport = async () => {
    const toImport = results.filter(r => selected.has(r.placeId));
    if (!toImport.length) return;
    setImporting(true); setImportResult(null); setAutoQueueResult(null);

    const endpoint = mode === "quick"
      ? { url: "/prospecting-os/api/gmaps-search", method: "POST" }
      : { url: "/prospecting-os/api/gmaps-scrape", method: "PATCH" };

    try {
      const res = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: toImport }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Import failed."); return; }
      setImportResult({ imported: data.imported, duplicates: data.duplicates });
      const newImportedIds = new Set([...importedIds, ...toImport.map(r => r.placeId)]);
      setImportedIds(newImportedIds);
      setSelected(new Set());

      // Auto-queue high-quality leads if toggle is on
      if (autoQueue && data.imported > 0) {
        const leadIds = toImport.map(r => `gmaps_${r.placeId}`);
        try {
          const aqRes = await fetch("/prospecting-os/api/gmaps-outreach/auto-queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadIds }),
          });
          const aqData = await aqRes.json();
          if (aqRes.ok && aqData.queued > 0) {
            setAutoQueueResult({ queued: aqData.queued, qualifyingCount: aqData.qualifyingCount, assessed: aqData.assessed });
            setQueuedIds(prev => {
              const next = new Set(prev);
              aqData.details?.filter((d: any) => d.action === "queued").forEach((d: any) => next.add(d.leadId.replace("gmaps_", "")));
              return next;
            });
          }
        } catch { /* non-critical */ }
      }
    } catch { setError("Import failed — please try again."); }
    finally { setImporting(false); }
  };

  // ── Scan all gmaps leads & auto-queue ─────────────────────────────────────

  const handleScanAll = async () => {
    setScanningAll(true); setAutoQueueResult(null);
    try {
      const res = await fetch("/prospecting-os/api/gmaps-outreach/auto-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setAutoQueueResult({ queued: data.queued, qualifyingCount: data.qualifyingCount, assessed: data.assessed });
      }
    } catch { /* non-critical */ }
    finally { setScanningAll(false); }
  };

  // ── Add to Outreach ────────────────────────────────────────────────────────

  const handleAddToOutreach = async () => {
    const toAdd = results.filter(r => selected.has(r.placeId));
    if (!toAdd.length) return;
    setAddingToOutreach(true);
    setOutreachResult(null);

    // Import any that haven't been imported yet first
    const notImported = toAdd.filter(r => !importedIds.has(r.placeId));
    if (notImported.length > 0) {
      const endpoint = mode === "quick"
        ? { url: "/prospecting-os/api/gmaps-search", method: "POST" }
        : { url: "/prospecting-os/api/gmaps-scrape", method: "PATCH" };
      try {
        const importRes = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ places: notImported }),
        });
        if (importRes.ok) {
          setImportedIds(prev => new Set([...prev, ...notImported.map(r => r.placeId)]));
        }
      } catch { /* non-critical — queue API will skip leads not in DB */ }
    }

    const leadIds = toAdd.map(r => `gmaps_${r.placeId}`);
    try {
      const res = await fetch("/prospecting-os/api/gmaps-outreach/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOutreachResult({ error: data.error || "Failed to add to outreach queue" });
        return;
      }
      setOutreachResult({ queued: data.queued, skipped: data.skipped });
      setQueuedIds(prev => new Set([...prev, ...toAdd.map(r => r.placeId)]));
    } catch {
      setOutreachResult({ error: "Network error — please try again" });
    } finally {
      setAddingToOutreach(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const ratingOptions = [
    { label: "Any", value: 0 }, { label: "3+", value: 3 }, { label: "3.5+", value: 3.5 },
    { label: "4+", value: 4 }, { label: "4.5+", value: 4.5 },
  ];
  const maxResultsOptions = [25, 50, 100, 150, 200];
  const importableCount = results.filter(r => !importedIds.has(r.placeId)).length;
  const selectedCount = selected.size;

  const inputCls = "w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none transition-colors";
  const inputStyle = { background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink)" };

  return (
    <>
      <TopBar title="Maps Prospecting" subtitle="Find local businesses on Google Maps and import as leads" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Mode tabs ── */}
        <div className="flex gap-2">
          {([
            { id: "deep" as Mode, label: "Deep Scrape", sub: "50–200 results · Apify", icon: Layers },
            { id: "quick" as Mode, label: "Quick Search", sub: "Up to 20 results · Google Places API", icon: Search },
          ] as const).map(({ id, label, sub, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setResults([]); setError(""); setImportResult(null); stopPoll(); setLoading(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150"
              style={{
                background: mode === id ? "rgba(232,168,64,0.10)" : "var(--surface)",
                border: `1px solid ${mode === id ? "rgba(232,168,64,0.35)" : "var(--line)"}`,
                flex: 1,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: mode === id ? "rgba(232,168,64,0.15)" : "var(--surface-2)" }}
              >
                <Icon size={15} style={{ color: mode === id ? "var(--accent)" : "var(--ink-4)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: mode === id ? "var(--accent)" : "var(--ink)" }}>
                  {label}
                </p>
                <p className="text-[10px]" style={{ color: "var(--ink-4)" }}>{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* ── Auto-queue toggle + scan all ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoQueue(!autoQueue)}
              className="relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-150 shrink-0"
              style={{
                background: autoQueue ? "rgba(0,255,136,0.25)" : "var(--surface-2)",
                border: `1px solid ${autoQueue ? "rgba(0,255,136,0.40)" : "var(--line)"}`,
              }}
            >
              <span
                className="inline-block w-4 h-4 rounded-full transition-transform duration-150"
                style={{
                  background: autoQueue ? "#00ff88" : "var(--ink-4)",
                  transform: autoQueue ? "translateX(22px)" : "translateX(4px)",
                }}
              />
            </button>
            <div>
              <span className="text-[12px] font-semibold" style={{ color: autoQueue ? "#00ff88" : "var(--ink-3)" }}>
                Auto-Queue High-Quality Leads
              </span>
              <p className="text-[10px]" style={{ color: "var(--ink-4)" }}>
                Score ≥75, ★ ≥4.0, has website/phone →
                routed to{" "}
                <span style={{ color: "var(--accent-green)" }}>GMap Outreach</span>
                {" "}on import
              </p>
            </div>
          </div>

          <button
            onClick={handleScanAll}
            disabled={scanningAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 disabled:opacity-50"
            style={{
              background: "rgba(0,255,136,0.08)",
              border: "1px solid rgba(0,255,136,0.20)",
              color: "var(--accent-green)",
            }}
          >
            {scanningAll ? (
              <><RefreshCw size={12} className="animate-spin" /> Scanning…</>
            ) : (
              <><Zap size={12} /> Scan All &amp; Auto-Queue</>
            )}
          </button>
        </div>

        {/* ── Search panel ── */}
        <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>

          {/* Inputs row */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-4)" }}>
                Business Type
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
                <input
                  value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (mode === "quick" ? handleQuickSearch() : handleDeepScrape())}
                  placeholder="e.g. Dentist, Plumber, HVAC…"
                  className={inputCls} style={inputStyle}
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-4)" }}>
                Location
              </label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
                <input
                  value={location} onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (mode === "quick" ? handleQuickSearch() : handleDeepScrape())}
                  placeholder="e.g. Austin TX, London UK, 90210…"
                  className={inputCls} style={inputStyle}
                />
              </div>
            </div>
            <div className="flex items-end">
              {loading && deepRunId ? (
                <button
                  onClick={cancelDeep}
                  className="px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150"
                  style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.25)" }}
                >
                  <X size={14} /> Cancel
                </button>
              ) : (
                <button
                  onClick={mode === "quick" ? () => handleQuickSearch() : handleDeepScrape}
                  disabled={loading}
                  className="px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                >
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Searching…</> : <><Search size={14} /> Search</>}
                </button>
              )}
            </div>
          </div>

          {/* Quick-pick chips */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TYPES.map(t => (
              <button key={t} onClick={() => setQuery(t)}
                className="text-[11px] px-2.5 py-1 rounded-full transition-all duration-100"
                style={{
                  background: query === t ? "rgba(232,168,64,0.15)" : "var(--surface-2)",
                  border: `1px solid ${query === t ? "rgba(232,168,64,0.35)" : "var(--line)"}`,
                  color: query === t ? "var(--accent)" : "var(--ink-3)",
                }}
              >{t}</button>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>Min Rating</span>
              <div className="flex gap-1">
                {ratingOptions.map(opt => (
                  <button key={opt.value} onClick={() => setMinRating(opt.value)}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-all duration-100"
                    style={{
                      background: minRating === opt.value ? "rgba(232,168,64,0.15)" : "var(--surface-2)",
                      border: `1px solid ${minRating === opt.value ? "rgba(232,168,64,0.35)" : "var(--line)"}`,
                      color: minRating === opt.value ? "var(--accent)" : "var(--ink-3)",
                    }}
                  >
                    {opt.value > 0 && <Star size={9} fill="#E8A840" style={{ color: "#E8A840" }} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {mode === "deep" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>Max Results</span>
                <div className="flex gap-1">
                  {maxResultsOptions.map(n => (
                    <button key={n} onClick={() => setMaxResults(n)}
                      className="text-[11px] px-2.5 py-1 rounded-full transition-all duration-100 tabular-nums"
                      style={{
                        background: maxResults === n ? "rgba(232,168,64,0.15)" : "var(--surface-2)",
                        border: `1px solid ${maxResults === n ? "rgba(232,168,64,0.35)" : "var(--line)"}`,
                        color: maxResults === n ? "var(--accent)" : "var(--ink-3)",
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl p-4"
            style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.25)" }}>
            <AlertCircle size={16} style={{ color: "#ff6b35" }} />
            <span className="text-sm flex-1" style={{ color: "#ff6b35" }}>{error}</span>
            <button onClick={() => setError("")}><X size={14} style={{ color: "var(--ink-4)" }} /></button>
          </div>
        )}

        {/* ── Import success ── */}
        {importResult && (
          <div className="flex items-center gap-3 rounded-xl p-4"
            style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.22)" }}>
            <Zap size={16} style={{ color: "#00ff88" }} />
            <span className="text-sm font-medium flex-1" style={{ color: "#00ff88" }}>
              {importResult.imported} new leads imported
              {importResult.duplicates > 0 ? `, ${importResult.duplicates} already in DB` : ""}
            </span>
            <Link href="/leads"
              className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 transition-opacity"
              style={{ color: "#00ff88" }}>
              View in Lead Intelligence <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {/* ── Auto-queue result ── */}
        {autoQueueResult && (
          <div className="flex items-center gap-3 rounded-xl p-4"
            style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.22)" }}>
            <Send size={16} style={{ color: "var(--accent-blue)" }} />
            <span className="text-sm font-medium flex-1" style={{ color: "var(--accent-blue)" }}>
              {autoQueueResult.queued} high-quality leads auto-routed to GMap Outreach
              {autoQueueResult.assessed > autoQueueResult.qualifyingCount
                ? ` (${autoQueueResult.qualifyingCount} qualified of ${autoQueueResult.assessed} assessed)`
                : ""}
            </span>
            <Link href="/outreach/gmaps"
              className="flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 transition-opacity"
              style={{ color: "var(--accent-blue)" }}>
              View Pipeline <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {/* ── Outreach queue result ── */}
        {outreachResult && (
          <div className="text-[11px] px-3 py-2 rounded-xl flex items-center gap-2"
            style={{
              background: outreachResult.error ? "rgba(255,107,53,0.1)" : "rgba(0,212,255,0.08)",
              color: outreachResult.error ? "var(--accent-orange)" : "var(--accent-blue)",
              border: `1px solid ${outreachResult.error ? "rgba(255,107,53,0.2)" : "rgba(0,212,255,0.2)"}`,
            }}>
            {outreachResult.error
              ? outreachResult.error
              : `${outreachResult.queued} added to outreach queue — pending runner execution`}
          </div>
        )}

        {/* ── Deep scrape progress ── */}
        {loading && deepRunId && (
          <div className="rounded-xl p-5 flex flex-col items-center gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  Scraping Google Maps…
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>
                  {deepCrawled > 0
                    ? `${deepCrawled} businesses found so far · fetching up to ${maxResults}`
                    : "Starting Apify actor · this takes 30–90 seconds"}
                </p>
              </div>
            </div>
            <div className="w-full max-w-sm rounded-full overflow-hidden" style={{ background: "var(--surface-2)", height: 4 }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  background: "var(--accent)",
                  width: deepCrawled > 0 ? `${Math.min((deepCrawled / maxResults) * 100, 95)}%` : "8%",
                }}
              />
            </div>
          </div>
        )}

        {/* ── Quick search loading skeleton ── */}
        {loading && !deepRunId && <Skeleton />}

        {/* ── Results ── */}
        {!loading && results.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {results.length} businesses
                </span>
                {importedIds.size > 0 && (
                  <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
                    · {importedIds.size} imported
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {importableCount > 0 && (
                  <button onClick={toggleAll}
                    className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-100"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-3)" }}>
                    {selectedCount === importableCount
                      ? <><CheckSquare size={12} /> Deselect all</>
                      : <><Square size={12} /> Select all ({importableCount})</>}
                  </button>
                )}
                {selectedCount > 0 && (
                  <>
                    <button onClick={handleImport} disabled={importing}
                      className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all duration-100 disabled:opacity-50"
                      style={{ background: "var(--accent)", color: "#000" }}>
                      {importing
                        ? <><RefreshCw size={12} className="animate-spin" /> Importing…</>
                        : <><Download size={12} /> Import {selectedCount} lead{selectedCount !== 1 ? "s" : ""}</>}
                    </button>
                    <button onClick={handleAddToOutreach} disabled={addingToOutreach || importing}
                      className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all duration-100 disabled:opacity-50"
                      style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)", color: "var(--accent-blue)" }}>
                      {addingToOutreach
                        ? <><RefreshCw size={12} className="animate-spin" /> Queuing…</>
                        : <><Send size={12} /> Add to Outreach ({selectedCount})</>}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map(biz => (
                <BusinessCard key={biz.placeId} biz={biz}
                  selected={selected.has(biz.placeId)}
                  imported={importedIds.has(biz.placeId)}
                  queued={queuedIds.has(biz.placeId)}
                  onToggle={() => toggleSelect(biz.placeId)}
                />
              ))}
            </div>

            {/* Quick search load more */}
            {mode === "quick" && nextPageToken && (
              <div className="flex justify-center pt-2">
                <button onClick={() => nextPageToken && handleQuickSearch(nextPageToken)} disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-50"
                  style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
                  {loadingMore
                    ? <><RefreshCw size={14} className="animate-spin" /> Loading more…</>
                    : <>Load next 20 <ChevronRight size={14} /></>}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Empty state ── */}
        {!loading && results.length === 0 && !error && (
          <div className="rounded-xl flex flex-col items-center justify-center py-20 gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(232,168,64,0.08)", border: "1px solid rgba(232,168,64,0.15)" }}>
              <MapPin size={24} style={{ color: "var(--accent)" }} />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                {mode === "deep" ? "Deep Scrape via Apify" : "Quick Search via Google Places"}
              </p>
              <p className="text-[12px]" style={{ color: "var(--ink-4)" }}>
                {mode === "deep"
                  ? `Uses your existing APIFY_API_KEY — up to ${maxResults} enriched businesses per search.`
                  : "Instant results — phone + website included. Requires GOOGLE_MAPS_API_KEY."}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-1">
              {[
                { icon: Phone, label: "Phone numbers" },
                { icon: Globe, label: "Websites" },
                { icon: TrendingUp, label: "ICP scoring" },
                { icon: Building2, label: mode === "deep" ? `${maxResults} results` : "20 results" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-4)" }}>
                  <Icon size={12} style={{ color: "var(--accent)" }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Info footer ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "rgba(232,168,64,0.04)", border: "1px solid rgba(232,168,64,0.10)" }}>
            <Layers size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
            <div className="text-[11px] space-y-0.5" style={{ color: "var(--ink-4)" }}>
              <p className="font-semibold" style={{ color: "var(--ink-3)" }}>Deep Scrape (recommended)</p>
              <p>Uses your existing <code className="px-1 py-0.5 rounded text-[10px]"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}>APIFY_API_KEY</code> — no new key needed.
                Runs <code className="px-1 py-0.5 rounded text-[10px]"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>compass~crawler-google-places</code>.
                50–200 results, async ~30–90s.</p>
            </div>
          </div>
          <div className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "rgba(232,168,64,0.04)", border: "1px solid rgba(232,168,64,0.10)" }}>
            <Search size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
            <div className="text-[11px] space-y-0.5" style={{ color: "var(--ink-4)" }}>
              <p className="font-semibold" style={{ color: "var(--ink-3)" }}>Quick Search</p>
              <p>Requires <code className="px-1 py-0.5 rounded text-[10px]"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}>GOOGLE_MAPS_API_KEY</code> in Vercel env.
                Enable <strong>Places API</strong> in Google Cloud Console. $200 free credit/month.</p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
