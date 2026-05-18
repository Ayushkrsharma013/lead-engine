"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Render a custom trigger button — receives selected label and open state */
  renderTrigger?: (label: string, open: boolean) => React.ReactNode;
  /** Render a custom option button */
  renderOption?: (option: DropdownOption, active: boolean, onClick: () => void) => React.ReactNode;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  renderTrigger,
  renderOption,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label || placeholder;

  // Click outside to close
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

  // Keyboard
  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); (containerRef.current?.querySelector("button") as HTMLElement)?.focus(); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
    },
    []
  );

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ zIndex: open ? 50 : "auto" }}>
      {/* Trigger */}
      {renderTrigger ? (
        renderTrigger(label, open)
      ) : (
        <DefaultTrigger label={label} open={open} isPlaceholder={!selected} onClick={() => setOpen(!open)} />
      )}

      {/* Options panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-50 py-1"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)",
              minWidth: "100%",
              transformOrigin: "top",
            }}
          >
            {options.map((option, idx) => {
              const active = option.value === value;
              return renderOption ? (
                renderOption(option, active, () => {
                  onChange(option.value);
                  setOpen(false);
                })
              ) : (
                <DefaultOption
                  key={option.value}
                  option={option}
                  active={active}
                  index={idx}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Default sub-components ─────────────────────────────────────────────────

function DefaultTrigger({ label, open, isPlaceholder, onClick }: {
  label: string; open: boolean; isPlaceholder: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-9 rounded-lg px-3 flex items-center justify-between gap-2 text-[12px] outline-none transition-all duration-200"
      style={{
        color: isPlaceholder ? "var(--muted)" : "var(--text)",
        background: "var(--surface2)",
        border: "1px solid var(--border)",
      }}
    >
      <span className="truncate">{label}</span>
      <motion.div
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        style={{ opacity: open ? 0.7 : 0.4, flexShrink: 0 }}
      >
        <ChevronDown size={12} />
      </motion.div>
    </button>
  );
}

function DefaultOption({ option, active, index, onClick }: {
  option: DropdownOption; active: boolean; index: number; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.15 }}
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 text-[12px] transition-colors duration-100 flex items-center gap-2"
      style={{
        color: active ? "var(--accent)" : "var(--text)",
        background: active ? "rgba(232,168,64,0.06)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {/* Active dot */}
      {active && (
        <motion.div
          layoutId="dropdown-active-dot"
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: "var(--accent)" }}
        />
      )}
      {!active && <div className="w-1.5 h-1.5 shrink-0" />}
      {option.label}
    </motion.button>
  );
}
