import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default"|"success"|"warning"|"error"|"muted";
}

export function Badge({ className, variant="default", ...props }: BadgeProps) {
  const v = {
    default: "bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)]",
    success: "bg-[var(--positive-soft)] text-[var(--positive)] border border-[var(--positive)]/25",
    warning: "bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info)]/25",
    error: "bg-[var(--negative-soft)] text-[var(--negative)] border border-[var(--negative)]/25",
    muted: "bg-[var(--surface-2)] text-[var(--ink-3)]",
  }[variant];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", v, className)} {...props} />
  );
}
