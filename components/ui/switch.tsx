"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps { checked: boolean; onChange: (v: boolean) => void; className?: string; }

export function Switch({ checked, onChange, className }: SwitchProps) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn("relative w-9 h-5 rounded-full transition-colors focus:outline-none", checked ? "bg-accent-blue" : "bg-white/15", className)}>
      <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
    </button>
  );
}
