import * as React from "react";
import { cn } from "@/lib/utils";
import { Spark } from "./spark";

interface MetricProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  color?: string;
  sparklineData?: number[];
  primary?: boolean;
  className?: string;
}

export function Metric({
  label,
  value,
  unit,
  delta,
  icon,
  color,
  sparklineData,
  primary,
  className,
}: MetricProps) {
  const accentColor = color || "var(--accent)";

  return (
    <div
      className={cn(
        "relative rounded-2xl p-5 border shadow-[var(--shadow-md)] overflow-hidden",
        className
      )}
      style={{
        background: primary
          ? "radial-gradient(ellipse 60% 100% at 100% 0%, var(--accent-soft), transparent), var(--surface)"
          : "var(--surface)",
        borderColor: "var(--line)",
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="text-[11.5px] font-medium tracking-[0.10em] uppercase"
          style={{ color: "var(--ink-3)" }}
        >
          {label}
        </span>
        {icon && (
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-soft)" }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono font-medium tracking-[-0.03em] leading-none",
            primary ? "text-[44px]" : "text-[38px]"
          )}
          style={{ color: "var(--ink)" }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-lg" style={{ color: "var(--ink-3)" }}>
            {unit}
          </span>
        )}
      </div>

      {(delta || sparklineData) && (
        <div className="mt-3 flex items-center justify-between">
          {delta && (
            <span
              className="text-sm font-medium flex items-center gap-1"
              style={{
                color: delta.positive
                  ? "var(--positive)"
                  : "var(--negative)",
              }}
            >
              <span className="text-[15px] leading-none">
                {delta.positive ? "↑" : "↓"}
              </span>
              {delta.value}
            </span>
          )}
          {sparklineData && (
            <div className="ml-auto">
              <Spark data={sparklineData} color={accentColor} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
