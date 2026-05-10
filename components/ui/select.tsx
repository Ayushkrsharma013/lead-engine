import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors appearance-none cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
