import * as React from "react";
import { cn } from "@/lib/utils";

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, active, onClick, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center",
        "text-[11px] font-mono font-medium uppercase",
        "px-[9px] py-[4px] rounded-full border",
        "transition-all duration-150",
        "active:translate-y-[0.5px]",
        "focus-visible:outline-none",
        active
          ? "bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line)]"
          : "bg-transparent text-[var(--ink-3)] border-[var(--line)] hover:border-[var(--line-strong)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]",
        className
      )}
    >
      {label}
    </button>
  );
}
