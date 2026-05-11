"use client";

import ProSidebar from "./layout/Sidebar";
import AgentPanel from "./AgentPanel";
import ToastContainer from "./Toast";
import CommandPalette from "./layout/CommandPalette";
import { useApp } from "@/lib/AppContext";
import { Zap } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg">
      <div className="text-center space-y-5 animate-fade-in">
        <div className="relative mx-auto w-14 h-14">
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-ink)",
            }}
          />
          <div
            className="absolute inset-1.5 rounded-xl border-2 border-t-transparent animate-spin"
            style={{
              borderColor: "var(--accent-soft)",
              borderTopColor: "var(--accent)",
              animationDuration: "0.8s",
              animationTimingFunction: "linear",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={16} style={{ color: "var(--accent)" }} />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>LinkedIn ProOS</p>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>Loading your workspace…</p>
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-pulse-live"
              style={{
                background: "var(--accent)",
                animationDelay: `${i * 0.2}s`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state } = useApp();

  return (
    <div className="flex h-screen overflow-hidden bg-bg relative" style={{ zIndex: 0 }}>
      <ProSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative" style={{ zIndex: 1 }}>
        {state.loading ? <LoadingScreen /> : children}
      </div>
      <AgentPanel />
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}
