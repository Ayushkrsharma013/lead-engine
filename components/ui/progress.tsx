import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn("w-full h-0.5 bg-white/10 overflow-hidden", className)}>
      <div className="h-full transition-all duration-300 ease-out" style={{ width: `${value}%`, background: color || "rgb(99,102,241)" }} />
    </div>
  );
}
