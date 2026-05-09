import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default"|"success"|"warning"|"error"|"muted";
}

export function Badge({ className, variant="default", ...props }: BadgeProps) {
  const v = {
    default: "bg-slate-700/50 text-slate-300",
    success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    warning: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    error: "bg-red-500/15 text-red-400 border border-red-500/25",
    muted: "bg-white/5 text-slate-500",
  }[variant];
  return <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", v, className)} {...props} />;
}
