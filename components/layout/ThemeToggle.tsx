"use client";

import { Sun, Moon } from "lucide-react";
import { useApp } from "@/lib/AppContext";

export default function ThemeToggle() {
  const { state, dispatch } = useApp();
  const isDark = state.theme === "dark";

  return (
    <button
      onClick={() => dispatch({ type: "SET_THEME", payload: isDark ? "light" : "dark" })}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 hover:bg-[var(--surface-2)]"
      style={{ color: "var(--ink-3)" }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
