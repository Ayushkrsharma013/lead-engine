"use client";

import { Search } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function TopBar({ title = "Lead Intelligence", subtitle, actions }: TopBarProps) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-bg/95 backdrop-blur-md flex items-center justify-between px-6 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h1 className="text-sm font-semibold text-text">{title}</h1>
          {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <kbd className="hidden md:inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-surface2 text-[10px] text-muted">
          <Search size={11} />
          <span>Cmd+K</span>
        </kbd>

        {actions}

        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}
