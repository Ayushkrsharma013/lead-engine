"use client";
import { useState, useRef, useEffect } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, X } from "lucide-react";
import "react-day-picker/style.css";

interface Props {
  value?: string;
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

function fmt(v: string | undefined): string {
  if (!v) return "";
  const d = new Date(v + (v.includes("T") ? "" : "T00:00:00"));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ThemedDatePicker({ value, onChange, placeholder = "mm/dd/yyyy", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }} className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="filter-date-input flex items-center justify-between"
        style={{ textAlign: "left", paddingRight: 8 }}
      >
        <span style={{ color: value ? "var(--ink)" : "var(--ink-3)", opacity: value ? 1 : 0.6 }}>
          {value ? fmt(value) : placeholder}
        </span>
        <Calendar size={12} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 60,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "6px 8px",
              maxWidth: 260,
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            }}
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(d: Date | DateRange | undefined) => {
                if (d instanceof Date) {
                  onChange(d.toISOString().slice(0, 10));
                } else {
                  onChange(undefined);
                }
                setOpen(false);
              }}
              weekStartsOn={1}
              style={{
                "--rdp-day-width": "32px",
                "--rdp-day-height": "28px",
                "--rdp-day_button-width": "30px",
                "--rdp-day_button-height": "26px",
                "--rdp-nav_button-width": "28px",
                "--rdp-nav_button-height": "28px",
                fontSize: "11px",
              } as React.CSSProperties}
            />
            {value && (
              <button
                onClick={() => { onChange(undefined); setOpen(false); }}
                className="w-full mt-1 h-7 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                <X size={11} /> Clear date
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
