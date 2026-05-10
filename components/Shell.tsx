"use client";

import ProSidebar from "./layout/Sidebar";
import ToastContainer from "./Toast";
import CommandPalette from "./layout/CommandPalette";
import SettingsModal from "./SettingsModal";
import { useApp } from "@/lib/AppContext";
import { Zap } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg">
      <div className="text-center space-y-5 animate-fade-in">
        {/* Logo mark */}
        <div className="relative mx-auto w-14 h-14">
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.1))",
              border: "1px solid rgba(0,212,255,0.25)",
              boxShadow: "0 0 24px rgba(0,212,255,0.1)",
            }}
          />
          {/* Spinner ring */}
          <div
            className="absolute inset-1.5 rounded-xl border-2 border-t-transparent animate-spin"
            style={{
              borderColor: "rgba(0,212,255,0.15)",
              borderTopColor: "var(--accent-blue)",
              animationDuration: "0.8s",
              animationTimingFunction: "linear",
            }}
          />
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={16} style={{ color: "var(--accent-blue)" }} />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>LinkedIn ProOS</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Loading your workspace…</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-pulse-glow"
              style={{
                background: "var(--accent-blue)",
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
    <div className="flex h-screen overflow-hidden bg-bg">
      <ProSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {state.loading ? <LoadingScreen /> : children}
      </div>
      <ToastContainer />
      <CommandPalette />
      <SettingsModal />
    </div>
  );
}
