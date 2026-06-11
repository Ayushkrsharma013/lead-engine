"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/** A single pulsing skeleton bar */
export function SkeletonBar({ className = "", style }: SkeletonProps) {
  return (
    <motion.div
      className={`rounded-lg ${className}`}
      style={{ background: "rgba(255,255,255,0.04)", ...style }}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/** Card-shaped skeleton with multiple bars */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`rounded-xl p-5 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <SkeletonBar className="mb-3" style={{ height: 16, width: "40%" }} />
      <SkeletonBar className="mb-2" style={{ height: 12, width: "100%" }} />
      <SkeletonBar style={{ height: 12, width: "70%" }} />
    </motion.div>
  );
}

/** Table row skeleton */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBar
              key={c}
              className="flex-1"
              style={{ height: 12, width: `${60 + Math.random() * 40}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
