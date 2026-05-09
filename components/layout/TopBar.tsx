"use client";

import { Search } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function TopBar({ title = "Lead Intelligence", subtitle, actions }: TopBarProps) {
  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-5 gap-4 relative"
      style={{
        background: "rgba(var(--surface-raw, 13,13,18), 0.92)",
        backdropFilter: "blur(16px) saturate(1.8)",
        WebkitBackdropFilter: "blur(16px) saturate(1.8)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 1px 0 var(--border-subtle)",
      }}
    >
      {/* Subtle top shimmer line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.2), transparent)",
          opacity: 0.6,
        }}
      />

      {/* Title area */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1
            className="text-[13px] font-semibold tracking-tight leading-tight truncate"
            style={{ color: "var(--text)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] leading-tight mt-0.5 truncate" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Cmd+K hint */}
        <button
          className="hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            color: "var(--muted)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-bright)";
            (e.currentTarget as HTMLElement).style.color = "var(--text)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLElement).style.color = "var(--muted)";
          }}
          onClick={() => {
            const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
            document.dispatchEvent(ev);
          }}
        >
          <Search size={11} />
          <span>Search</span>
          <span
            className="px-1 py-0.5 rounded text-[9px] font-mono"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
          >
            ⌘K
          </span>
        </button>

        {actions}

        <div className="w-px h-5 bg-border mx-0.5" />
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}
