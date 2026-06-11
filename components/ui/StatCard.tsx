"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  accent?: string;
  sub?: string;
  delay?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "var(--accent)",
  sub,
  delay = 0,
  className = "",
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={`rounded-xl p-4 text-center ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      {Icon && (
        <div className="flex justify-center mb-2">
          <Icon size={18} style={{ color: accent }} />
        </div>
      )}
      <p
        className="text-[20px] font-bold tabular-nums"
        style={{ color: "var(--ink)" }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p
        className="text-[10px] uppercase tracking-wide mt-0.5"
        style={{ color: "var(--ink-4)" }}
      >
        {label}
      </p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: "var(--ink-4)" }}>
          {sub}
        </p>
      )}
    </motion.div>
  );
}
