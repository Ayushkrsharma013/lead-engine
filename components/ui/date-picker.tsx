"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DatePickerProps {
  value: string;       // ISO date string YYYY-MM-DD (or empty)
  onChange: (v: string) => void;
  placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder = "Select date…" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(value + "T00:00:00") : null;
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  // Sync view when opening
  useEffect(() => {
    if (open) {
      setViewYear(selected?.getFullYear() ?? today.getFullYear());
      setViewMonth(selected?.getMonth() ?? today.getMonth());
    }
  }, [open, selected, today]);

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

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const formatDisplay = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${MONTH_NAMES[Number(m) - 1].slice(0, 3)} ${Number(d)}, ${y}`;
  };

  const handleSelect = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  const isSelected = (day: number) =>
    selected?.getFullYear() === viewYear &&
    selected?.getMonth() === viewMonth &&
    selected?.getDate() === day;

  return (
    <div ref={containerRef} className="relative" style={{ zIndex: open ? 50 : "auto" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-9 rounded-lg px-3 flex items-center justify-between gap-2 text-[12px] outline-none transition-all duration-200"
        style={{
          color: value ? "var(--text)" : "var(--muted)",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
        }}
      >
        <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        <Calendar size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
      </button>

      {/* Calendar panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-50 p-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)",
              width: 248,
              transformOrigin: "top",
            }}
          >
            {/* Month header */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={goPrev}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--muted)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--muted)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div
              className="grid gap-0.5 mb-1"
              style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
            >
              {DAY_NAMES.map(dow => (
                <div
                  key={dow}
                  className="h-7 flex items-center justify-center text-[10px] font-semibold"
                  style={{ color: "var(--muted)", opacity: 0.6 }}
                >
                  {dow}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
            >
              {/* Empty cells before month start */}
              {Array.from({ length: startDow }).map((_, i) => (
                <div key={`empty-${i}`} className="h-7" />
              ))}

              {/* Day buttons */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const selectedDay = isSelected(day);
                const todayDay = isToday(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelect(day)}
                    className="h-7 rounded-lg flex items-center justify-center text-[11px] font-medium transition-all duration-100 relative"
                    style={{
                      color: selectedDay ? "var(--accent)" : "var(--text)",
                      background: selectedDay ? "rgba(232,168,64,0.12)" : "transparent",
                      border: selectedDay ? "1px solid rgba(232,168,64,0.25)" : "1px solid transparent",
                    }}
                    onMouseEnter={e => {
                      if (!selectedDay) (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
                    }}
                    onMouseLeave={e => {
                      if (!selectedDay) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {day}
                    {/* Today dot */}
                    {todayDay && !selectedDay && (
                      <div
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: "var(--accent)", opacity: 0.5 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
