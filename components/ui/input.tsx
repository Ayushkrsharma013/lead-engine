import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
