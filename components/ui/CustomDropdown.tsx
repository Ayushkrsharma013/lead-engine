"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  width?: number;
  className?: string;
}

export default function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchable = false,
  clearable = false,
  width,
  className = "",
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    if (!searchQuery) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search input when opening
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, searchable]);

  // Keyboard nav
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) { setOpen(true); setActiveIndex(0); }
        else setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        else setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (open && activeIndex >= 0 && filtered[activeIndex]) {
          onChange(filtered[activeIndex].value);
          setOpen(false);
          setSearchQuery("");
        } else {
          setOpen(true);
        }
        break;
      case "Escape":
        setOpen(false);
        setSearchQuery("");
        break;
    }
  }, [open, activeIndex, filtered, onChange]);

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current || activeIndex < 0) return;
    const items = listRef.current.children;
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ width: width || 180 }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) setActiveIndex(-1); }}
        onKeyDown={handleKey}
        className="flex items-center gap-2 h-10 rounded-xl px-3 w-full transition-colors duration-150"
        style={{
          background: "var(--surface)",
          border: open ? "1px solid rgba(232,66,10,0.35)" : "1px solid var(--line)",
          color: selected ? "var(--ink)" : "var(--ink-4)",
          cursor: "pointer",
        }}
      >
        {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
        <span className="flex-1 text-left text-[13px] font-medium truncate">
          {selected ? selected.label : placeholder}
        </span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={-1}
            onClick={e => { e.stopPropagation(); onChange(""); setSearchQuery(""); }}
            className="p-0.5 rounded transition-colors shrink-0 hover:bg-white/[0.05]"
            style={{ color: "var(--ink-4)" }}
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-200"
          style={{ color: "var(--ink-4)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-20 mt-1 rounded-xl overflow-hidden"
          style={{
            width: "100%",
            background: "var(--surface-elev)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Search input */}
          {searchable && (
            <div
              className="flex items-center gap-2 px-3 h-9"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <Search size={12} style={{ color: "var(--ink-4)" }} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setActiveIndex(0); }}
                placeholder="Type to filter..."
                onKeyDown={handleKey}
                className="flex-1 bg-transparent border-none outline-none text-[12px]"
                style={{ color: "var(--ink)" }}
              />
            </div>
          )}

          {/* Options */}
          <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--ink-4)" }}>
                No results
              </div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setSearchQuery(""); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className="flex items-center gap-2.5 w-full h-9 px-3 text-[13px] font-medium transition-colors duration-75"
                  style={{
                    background: i === activeIndex ? "rgba(255,255,255,0.04)" : "transparent",
                    color: opt.value === value ? "var(--accent)" : "var(--ink-2)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
