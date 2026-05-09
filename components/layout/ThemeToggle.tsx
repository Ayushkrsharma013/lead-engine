"use client";

import { Sun, Moon } from "lucide-react";
import { useApp } from "@/lib/AppContext";

export default function ThemeToggle() {
  const { state, dispatch } = useApp();
  const isDark = state.theme === "dark";

  return (
    <button
      onClick={() => dispatch({ type: "SET_THEME", payload: isDark ? "light" : "dark" })}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
      style={{ color: "var(--muted)" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = "var(--text)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = "var(--muted)";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark
        ? <Sun size={15} />
        : <Moon size={15} />
      }
    </button>
  );
}
