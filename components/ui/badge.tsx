import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default"|"success"|"warning"|"error"|"muted";
}

export function Badge({ className, variant="default", ...props }: BadgeProps) {
  const v = {
    default: "bg-white/5 text-text",
    success: "bg-accent-green/15 text-accent-green border border-accent-green/25",
    warning: "bg-accent-orange/15 text-accent-orange border border-accent-orange/25",
    error: "bg-red-500/15 text-red-400 border border-red-500/25",
    muted: "bg-white/5 text-muted",
  }[variant];
  return <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", v, className)} {...props} />;
}
