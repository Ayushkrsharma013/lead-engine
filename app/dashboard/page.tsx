"use client";
import { LayoutDashboard } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

export default function DashboardPage() {
  return (
    <>
      <TopBar title="Command Center" subtitle="Overview of your prospecting pipeline" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <LayoutDashboard size={32} className="mx-auto text-muted/50" />
          <h2 className="text-lg font-semibold text-text">Command Center</h2>
          <p className="text-sm text-muted">Dashboard with stats, activity feed, and quick actions — coming in Phase 2</p>
        </div>
      </div>
    </>
  );
}
