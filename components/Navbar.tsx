"use client";
import { Zap, Database } from "lucide-react";
import { Source } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TABS: { id: Source; label: string; icon: string; color: string; bg: string }[] = [
  { id: "linkedin", label: "LinkedIn",     icon: "in", color: "#00d4ff", bg: "rgba(0,212,255,0.12)" },
  { id: "gmaps",    label: "Google Maps",  icon: "G",  color: "#00ff88", bg: "rgba(0,255,136,0.12)" },
  { id: "amazon",   label: "Amazon",       icon: "a",  color: "#ff6b35", bg: "rgba(255,107,53,0.12)" },
];

interface NavbarProps {
  source: Source;
  setSource: (s: Source) => void;
  mock: boolean;
  setMock: (v: boolean) => void;
  savedCount: number;
}

export default function Navbar({ source, setSource, mock, setMock, savedCount }: NavbarProps) {
  const active = TABS.find(t => t.id === source)!;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-bg/95 backdrop-blur-md flex items-center px-5 gap-5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: active.bg, border: `1px solid ${active.color}30` }}>
          <Zap size={14} style={{ color: active.color }} />
        </div>
        <span className="font-semibold text-sm text-text tracking-tight">
          LeadGen<span className="font-bold" style={{ color: active.color }}>Engine</span>
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-white/[0.08]" />

      {/* Source tabs */}
      <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-border">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setSource(tab.id)}
            className={cn(
              "flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all",
              source === tab.id ? "shadow-sm" : "text-muted hover:text-text"
            )}
            style={source === tab.id ? { background: tab.bg, color: tab.color } : {}}>
            <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center"
              style={{
                background: source === tab.id ? `${tab.color}30` : "rgba(255,255,255,0.06)",
                color: source === tab.id ? tab.color : "inherit"
              }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Saved leads count */}
      {savedCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted bg-white/[0.04] border border-border rounded-lg px-3 py-1.5">
          <Database size={12} className="text-accent-blue" />
          <span><span className="font-semibold text-text">{savedCount}</span> saved leads</span>
        </div>
      )}

      {/* Mock toggle */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-muted">Mock</span>
        <Switch checked={mock} onChange={setMock} />
        <span className={cn("text-xs font-semibold w-7", mock ? "text-amber-400" : "text-emerald-400")}>
          {mock ? "ON" : "LIVE"}
        </span>
      </div>
    </nav>
  );
}
