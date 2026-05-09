"use client";
import { Zap } from "lucide-react";
import { Source } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TABS: { id: Source; label: string; icon: string; color: string; bg: string }[] = [
  { id: "linkedin", label: "LinkedIn", icon: "in", color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  { id: "gmaps",    label: "Google Maps", icon: "G", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  { id: "amazon",   label: "Amazon",  icon: "a", color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
];

interface NavbarProps {
  source: Source;
  setSource: (s: Source) => void;
  mock: boolean;
  setMock: (v: boolean) => void;
}

export default function Navbar({ source, setSource, mock, setMock }: NavbarProps) {
  const active = TABS.find(t => t.id === source)!;
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/[0.06] bg-[#080b10]/95 backdrop-blur-sm flex items-center px-5 gap-6">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: active.bg, border: `1px solid ${active.color}30` }}>
          <Zap size={14} style={{ color: active.color }} />
        </div>
        <span className="font-semibold text-sm text-slate-100 tracking-tight">LeadGen<span className="font-bold" style={{ color: active.color }}>Engine</span></span>
      </div>

      <div className="flex items-center gap-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setSource(tab.id)}
            className={cn("flex items-center gap-2 h-8 px-3 rounded-md text-xs font-medium transition-all", source === tab.id ? "text-slate-100" : "text-slate-500 hover:text-slate-300 hover:bg-white/5")}
            style={source === tab.id ? { background: tab.bg, color: tab.color } : {}}>
            <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center" style={{ background: source === tab.id ? `${tab.color}30` : "rgba(255,255,255,0.08)", color: source === tab.id ? tab.color : "inherit" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5">
        <span className="text-xs text-slate-500">Mock mode</span>
        <Switch checked={mock} onChange={setMock} />
        <span className={cn("text-xs font-medium", mock ? "text-amber-400" : "text-emerald-400")}>{mock ? "ON" : "LIVE"}</span>
      </div>
    </nav>
  );
}
