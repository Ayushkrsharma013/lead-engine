"use client";

import { useState, useCallback } from "react";
import {
  MapPin, Search, Star, Phone, Globe, Building2,
  CheckSquare, Square, Download, RefreshCw, ChevronRight,
  AlertCircle, X, Zap, ExternalLink, TrendingUp,
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

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "#00ff88" :
    score >= 65 ? "#E8A840" :
    "#ff6b35";
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
          fill={i <= full ? "#E8A840" : i === full + 1 && half ? "url(#half)" : "transparent"}
          style={{ color: i <= full || (i === full + 1 && half) ? "#E8A840" : "var(--ink-4)" }}
        />
      ))}
    </span>
  );
}

// ─── Business card ────────────────────────────────────────────────────────────

function BusinessCard({
  biz,
  selected,
  imported,
  onToggle,
}: {
  biz: GMapsBusiness;
  selected: boolean;
  imported: boolean;
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
          {imported ? (
            <CheckSquare size={16} style={{ color: "#00ff88" }} />
          ) : selected ? (
            <CheckSquare size={16} style={{ color: "var(--accent)" }} />
          ) : (
            <Square size={16} style={{ color: "var(--ink-4)" }} />
          )}
        </div>
      </div>

      {/* Rating + reviews */}
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
        <span className="text-[11px] leading-tight" style={{ color: "var(--ink-3)" }}>
          {biz.address}
        </span>
      </div>

      {/* Phone + Website */}
      <div className="flex items-center gap-3 flex-wrap">
        {biz.phone ? (
          <div className="flex items-center gap-1">
            <Phone size={11} style={{ color: "#00ff88" }} />
            <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--ink-2)" }}>
              {biz.phone}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Phone size={11} style={{ color: "var(--ink-4)" }} />
            <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>No phone</span>
          </div>
        )}
        {biz.website ? (
          <a
            href={biz.website}
            target="_blank"
            rel="noopener noreferrer"
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GmapsSearchPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [results, setResults] = useState<GMapsBusiness[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number } | null>(null);

  const handleSearch = useCallback(async (pageToken?: string) => {
    if (!query.trim() || !location.trim()) {
      setError("Enter a business type and location to search.");
      return;
    }
    setError("");
    setImportResult(null);
    if (!pageToken) {
      setLoading(true);
      setResults([]);
      setSelected(new Set());
      setNextPageToken(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        location: location.trim(),
        ...(minRating > 0 ? { minRating: String(minRating) } : {}),
        ...(pageToken ? { pageToken } : {}),
      });
      const res = await fetch(`/prospecting-os/api/gmaps-search?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Search failed. Check your API key.");
        return;
      }
      if (!pageToken) {
        setResults(data.results || []);
      } else {
        setResults(prev => [...prev, ...(data.results || [])]);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, location, minRating]);

  const toggleSelect = (placeId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(placeId) ? next.delete(placeId) : next.add(placeId);
      return next;
    });
  };

  const toggleAll = () => {
    const importable = results.filter(r => !importedIds.has(r.placeId));
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map(r => r.placeId)));
    }
  };

  const handleImport = async () => {
    const toImport = results.filter(r => selected.has(r.placeId));
    if (!toImport.length) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/prospecting-os/api/gmaps-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: toImport }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setImportResult({ imported: data.imported, duplicates: data.duplicates });
      setImportedIds(prev => new Set([...prev, ...toImport.map(r => r.placeId)]));
      setSelected(new Set());
    } catch {
      setError("Import failed — please try again.");
    } finally {
      setImporting(false);
    }
  };

  const ratingOptions = [
    { label: "Any", value: 0 },
    { label: "3+", value: 3 },
    { label: "3.5+", value: 3.5 },
    { label: "4+", value: 4 },
    { label: "4.5+", value: 4.5 },
  ];

  const importableCount = results.filter(r => !importedIds.has(r.placeId)).length;
  const selectedCount = selected.size;

  return (
    <>
      <TopBar title="Maps Prospecting" subtitle="Find local businesses from Google Maps and import as leads" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Search Panel ── */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          {/* Row 1: inputs */}
          <div className="flex gap-3 flex-wrap">
            {/* Business type */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-4)" }}>
                Business Type
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. Dentist, Plumber, HVAC…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>

            {/* Location */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-4)" }}>
                Location
              </label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. Austin TX, London UK, 90210…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            </div>

            {/* Search button */}
            <div className="flex items-end">
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 disabled:opacity-50"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                {loading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
          </div>

          {/* Row 2: quick-pick types */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_TYPES.map(t => (
              <button
                key={t}
                onClick={() => { setQuery(t); }}
                className="text-[11px] px-2.5 py-1 rounded-full transition-all duration-100"
                style={{
                  background: query === t ? "rgba(232,168,64,0.15)" : "var(--surface-2)",
                  border: `1px solid ${query === t ? "rgba(232,168,64,0.35)" : "var(--line)"}`,
                  color: query === t ? "var(--accent)" : "var(--ink-3)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Row 3: min rating filter */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>
              Min Rating
            </span>
            <div className="flex gap-1">
              {ratingOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMinRating(opt.value)}
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
        </div>

        {/* ── Error ── */}
        {error && (
          <div
            className="flex items-center gap-3 rounded-xl p-4"
            style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.25)" }}
          >
            <AlertCircle size={16} style={{ color: "#ff6b35" }} />
            <span className="text-sm" style={{ color: "#ff6b35" }}>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto"
              style={{ color: "var(--ink-4)" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Import success ── */}
        {importResult && (
          <div
            className="flex items-center gap-3 rounded-xl p-4"
            style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.22)" }}
          >
            <Zap size={16} style={{ color: "#00ff88" }} />
            <span className="text-sm font-medium" style={{ color: "#00ff88" }}>
              {importResult.imported} leads imported
              {importResult.duplicates > 0 ? `, ${importResult.duplicates} already in DB` : ""}
            </span>
            <Link
              href="/leads"
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: "#00ff88" }}
            >
              View in Lead Intelligence
              <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
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
        )}

        {/* ── Results ── */}
        {!loading && results.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {results.length} businesses found
                </span>
                <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
                  {importedIds.size > 0 && `· ${importedIds.size} already imported`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {importableCount > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-100"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      color: "var(--ink-3)",
                    }}
                  >
                    {selectedCount === importableCount ? (
                      <><CheckSquare size={12} /> Deselect all</>
                    ) : (
                      <><Square size={12} /> Select all ({importableCount})</>
                    )}
                  </button>
                )}
                {selectedCount > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all duration-100 disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "#000" }}
                  >
                    {importing ? (
                      <><RefreshCw size={12} className="animate-spin" /> Importing…</>
                    ) : (
                      <><Download size={12} /> Import {selectedCount} lead{selectedCount !== 1 ? "s" : ""}</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map(biz => (
                <BusinessCard
                  key={biz.placeId}
                  biz={biz}
                  selected={selected.has(biz.placeId)}
                  imported={importedIds.has(biz.placeId)}
                  onToggle={() => toggleSelect(biz.placeId)}
                />
              ))}
            </div>

            {/* Load more */}
            {nextPageToken && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => handleSearch(nextPageToken)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-50"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    color: "var(--ink-2)",
                  }}
                >
                  {loadingMore ? (
                    <><RefreshCw size={14} className="animate-spin" /> Loading more…</>
                  ) : (
                    <>Load more results <ChevronRight size={14} /></>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Empty state ── */}
        {!loading && results.length === 0 && !error && (
          <div
            className="rounded-xl flex flex-col items-center justify-center py-20 gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(232,168,64,0.08)", border: "1px solid rgba(232,168,64,0.15)" }}
            >
              <MapPin size={24} style={{ color: "var(--accent)" }} />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                Search local businesses
              </p>
              <p className="text-[12px]" style={{ color: "var(--ink-4)" }}>
                Pick a business type and location — get phone, website, rating, and address for every result.
              </p>
            </div>
            <div className="flex items-center gap-4 mt-2">
              {[
                { icon: Phone, label: "Phone numbers" },
                { icon: Globe, label: "Websites" },
                { icon: TrendingUp, label: "ICP scoring" },
                { icon: Building2, label: "20 results/search" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-4)" }}>
                  <Icon size={12} style={{ color: "var(--accent)" }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── API key missing hint ── */}
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: "rgba(232,168,64,0.05)", border: "1px solid rgba(232,168,64,0.12)" }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          <div className="text-[11px] space-y-0.5" style={{ color: "var(--ink-4)" }}>
            <p className="font-semibold" style={{ color: "var(--ink-3)" }}>Needs a Google Maps API key</p>
            <p>
              Add <code
                className="px-1 py-0.5 rounded text-[10px]"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}
              >
                GOOGLE_MAPS_API_KEY
              </code>{" "}
              to your Vercel environment variables.
              Enable <strong>Places API</strong> in Google Cloud Console.
              New accounts get $200 free credit/month (~540 searches).
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
