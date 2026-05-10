import * as React from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  eyebrow?: string;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Panel({
  title,
  eyebrow,
  count,
  actions,
  children,
  className,
}: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border shadow-[var(--shadow-md)] overflow-hidden",
        className
      )}
      style={{
        background: "var(--surface)",
        borderColor: "var(--line)",
      }}
    >
      {title && (
        <div
          className="flex items-center justify-between px-[18px] py-[22px]"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex flex-col gap-0.5">
            {eyebrow && (
              <span className="editorial text-sm" style={{ color: "var(--ink-3)" }}>
                {eyebrow}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span
                className="text-[15px] font-semibold leading-none"
                style={{ color: "var(--ink)" }}
              >
                {title}
              </span>
              {count !== undefined && (
                <span
                  className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-[6px] rounded-full text-[11px] font-mono font-medium border"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    borderColor: "var(--line)",
                  }}
                >
                  {count}
                </span>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
