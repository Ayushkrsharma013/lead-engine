"use client";

import { usePathname } from "next/navigation";
import ProSidebar from "./layout/Sidebar";
import ToastContainer from "./Toast";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <ProSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
      <ToastContainer />
    </div>
  );
}
