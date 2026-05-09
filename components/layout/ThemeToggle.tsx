"use client";

import { Sun, Moon } from "lucide-react";
import { useApp } from "@/lib/AppContext";

export default function ThemeToggle() {
  const { state, dispatch } = useApp();
  const isDark = state.theme === "dark";

  return (
    <button
      onClick={() => dispatch({ type: "SET_THEME", payload: isDark ? "light" : "dark" })}
      className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-text hover:bg-white/[0.06] transition-colors"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
