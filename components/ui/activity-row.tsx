import * as React from "react";
import { cn } from "@/lib/utils";

interface ActivityRowProps {
  kind: "stage" | "msg" | "meet" | "miss";
  icon: React.ElementType;
  name: string;
  action: string;
  target: string;
  meta?: string;
  timestamp: string;
}

const kindConfig = {
  stage: { bg: "var(--accent-soft)", color: "var(--accent)" },
  msg: { bg: "var(--info-soft)", color: "var(--info)" },
  meet: { bg: "var(--positive-soft)", color: "var(--positive)" },
  miss: { bg: "var(--negative-soft)", color: "var(--negative)" },
} as const;

export function ActivityRow({
  kind,
  icon: Icon,
  name,
  action,
  target,
  meta,
  timestamp,
}: ActivityRowProps) {
  const kc = kindConfig[kind];

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: kc.bg }}
      >
        <Icon size={16} strokeWidth={1.6} style={{ color: kc.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
            {name}
          </span>
          <span className="text-sm" style={{ color: "var(--ink-3)" }}>
            {action}
          </span>
          <span className="editorial text-sm" style={{ color: "var(--ink)" }}>
            {target}
          </span>
        </div>
        {meta && (
          <div className="flex items-center gap-2 mt-0.5">
            {meta.split("·").map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span
                    className="w-[3px] h-[3px] rounded-full shrink-0"
                    style={{ background: "var(--ink-4)" }}
                  />
                )}
                <span
                  className="text-[11.5px] font-mono truncate"
                  style={{ color: "var(--ink-3)" }}
                >
                  {part.trim()}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <span
        className="text-[11.5px] font-mono whitespace-nowrap shrink-0 mt-0.5"
        style={{ color: "var(--ink-3)" }}
      >
        {timestamp}
      </span>
    </div>
  );
}
