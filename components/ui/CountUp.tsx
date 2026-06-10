"use client";

import { useEffect, useState, useRef } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  formatter?: (v: number) => string;
}

export default function CountUp({ value, duration = 600, formatter }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;

    if (from === value) {
      setDisplay(value);
      return;
    }

    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = formatter ? formatter(display) : display.toLocaleString();

  return <span>{formatted}</span>;
}
