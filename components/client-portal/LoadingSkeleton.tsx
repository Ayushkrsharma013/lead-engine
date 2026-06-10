"use client";

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export function LoadingSkeleton({ lines = 3, className = "" }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg animate-pulse"
          style={{
            height: i === 0 ? 20 : 14,
            width: i === lines - 1 ? "60%" : "100%",
            background: "rgba(255,255,255,0.04)",
          }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl p-5 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="rounded-lg mb-3" style={{ height: 16, width: "40%", background: "rgba(255,255,255,0.04)" }} />
      <div className="rounded-lg mb-2" style={{ height: 12, width: "100%", background: "rgba(255,255,255,0.03)" }} />
      <div className="rounded-lg" style={{ height: 12, width: "70%", background: "rgba(255,255,255,0.03)" }} />
    </div>
  );
}
