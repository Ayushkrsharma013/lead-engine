import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("w-full h-0.5 bg-[var(--line)] rounded overflow-hidden", className)}>
      <div
        className="h-full bg-[var(--accent)] rounded transition-all duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
