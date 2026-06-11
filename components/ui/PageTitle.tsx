"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageTitleProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageTitle({ title, description, actions }: PageTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-7"
    >
      <div>
        <h1 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>
          {title}
        </h1>
        {description && (
          <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </motion.div>
  );
}
