import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("w-full h-9 rounded-md bg-white/5 border border-border px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/30 transition-colors", className)} {...props} />
  )
);
Input.displayName = "Input";
