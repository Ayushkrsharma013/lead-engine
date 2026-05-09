import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const accent = color || "#00d4ff";
  return (
    <div className={cn("w-full h-0.5 overflow-hidden", className)} style={{ background: "rgba(255,255,255,0.04)" }}>
      <div
        className="h-full transition-all duration-300 ease-out"
        style={{
          width: `${value}%`,
          background: `linear-gradient(90deg, ${accent}90, ${accent})`,
          boxShadow: value > 0 ? `0 0 8px ${accent}60` : "none",
        }}
      />
    </div>
  );
}
