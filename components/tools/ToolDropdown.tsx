"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface ToolDropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ToolDropdown({
  value,
  options,
  onChange,
  placeholder = "Select...",
}: ToolDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const display = value || placeholder;
  const isPlaceholder = !value;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "13px 16px",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(232,66,10,0.5)" : "var(--border)"}`,
          borderRadius: 12,
          color: isPlaceholder ? "var(--text-tertiary)" : "var(--text-primary)",
          fontSize: 14,
          fontFamily: "Cabinet Grotesk, Geist, sans-serif",
          outline: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          transition: "border-color 0.15s ease",
        }}
      >
        <span style={{ textAlign: "left" }}>{display}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", flexShrink: 0 }}
        >
          <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 50,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "6px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {options.map((opt) => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "Cabinet Grotesk, Geist, sans-serif",
                    textAlign: "left",
                    cursor: "pointer",
                    border: "none",
                    background: isSelected
                      ? "rgba(232,66,10,0.10)"
                      : "transparent",
                    color: isSelected
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  {opt}
                  {isSelected && (
                    <span
                      style={{
                        float: "right",
                        fontSize: 11,
                        color: "var(--accent)",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
