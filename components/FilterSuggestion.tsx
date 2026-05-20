"use client";

import { useState, useEffect } from "react";
import { Sparkles, Plus, X } from "lucide-react";

interface Suggestion {
  keyword: string;
  weight: number;
  action: "add" | "exclude";
}

interface FilterSuggestionProps {
  currentKeyword: string;
  onApply: (keyword: string, action: "add" | "exclude") => void;
}

export default function FilterSuggestion({ currentKeyword, onApply }: FilterSuggestionProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const encoded = encodeURIComponent(currentKeyword);
    fetch(`/prospecting-os/api/lead-feedback/suggestions?currentKeyword=${encoded}`)
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [currentKeyword]);

  if (loading || suggestions.length === 0) return null;

  return (
    <div
      className="px-3 py-2.5 rounded-xl"
      style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={11} style={{ color: "var(--info)" }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--info)" }}>
          AI Suggestions
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {suggestions.map(s => (
          <button
            key={`${s.action}-${s.keyword}`}
            onClick={() => onApply(s.keyword, s.action)}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left transition-all group"
            style={{
              background: s.action === "add" ? "rgba(0,255,136,0.05)" : "rgba(239,68,68,0.05)",
              border: s.action === "add" ? "1px solid rgba(0,255,136,0.15)" : "1px solid rgba(239,68,68,0.15)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.opacity = "0.8";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {s.action === "add" ? (
                <Plus size={9} className="shrink-0" style={{ color: "var(--positive)" }} />
              ) : (
                <X size={9} className="shrink-0" style={{ color: "#ef4444" }} />
              )}
              <span
                className="text-[11px] font-medium truncate"
                style={{ color: s.action === "add" ? "var(--positive)" : "#ef4444" }}
              >
                {s.keyword}
              </span>
            </div>
            <span
              className="text-[9px] font-bold shrink-0 ml-1"
              style={{ color: "var(--ink-3)" }}
            >
              {s.action === "add" ? "add" : "exclude"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
