"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  hover?: boolean;
  delay?: number;
}

export function AnimatedCard({
  children,
  hover = true,
  delay = 0,
  className = "",
  style,
  ...rest
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={
        hover
          ? { scale: 1.02, transition: { duration: 0.2 } }
          : undefined
      }
      className={`rounded-xl ${className}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
