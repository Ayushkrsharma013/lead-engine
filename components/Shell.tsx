"use client";

import ProSidebar from "./layout/Sidebar";
import ToastContainer from "./Toast";
import CommandPalette from "./layout/CommandPalette";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <ProSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}
