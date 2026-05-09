"use client";

import ProSidebar from "./layout/Sidebar";
import ToastContainer from "./Toast";
import CommandPalette from "./layout/CommandPalette";
import { useApp } from "@/lib/AppContext";

function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg">
      <div className="text-center space-y-4">
        <div className="relative mx-auto w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-accent-blue/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-accent-blue animate-spin" />
        </div>
        <p className="text-sm text-muted">Loading…</p>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state } = useApp();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <ProSidebar />
      {state.loading ? <LoadingScreen /> : children}
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}
