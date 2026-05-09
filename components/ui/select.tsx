import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn("w-full h-9 rounded-md bg-white/5 border border-border px-3 text-sm text-text focus:outline-none focus:border-accent-blue/50 transition-colors appearance-none cursor-pointer", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";
