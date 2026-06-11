"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function TopBar({ title = "Lead Intelligence", subtitle, actions }: TopBarProps) {
  const router = useRouter();

  const handleSearch = () => {
    // Navigate to leads page with search focus
    router.push("/client-portal/leads");
  };

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-5 gap-4 relative"
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {/* Title area */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1
            className="text-[13px] font-semibold tracking-tight leading-tight truncate"
            style={{ color: "var(--ink)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-[11px] leading-tight mt-0.5 truncate"
              style={{ color: "var(--ink-3)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search — navigates to leads page */}
        <button
          className="hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer hover:border-[var(--line-strong)]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--ink-3)",
          }}
          onClick={handleSearch}
          title="Search leads"
        >
          <Search size={11} />
          <span>Search leads</span>
          <span
            className="px-1 py-0.5 rounded text-[9px] font-mono"
            style={{ background: "var(--surface-2)", color: "var(--ink-3)", border: "1px solid var(--line)" }}
          >
            ⌘K
          </span>
        </button>

        {actions}

        <div className="w-px h-5" style={{ background: "var(--line)" }} />
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}
