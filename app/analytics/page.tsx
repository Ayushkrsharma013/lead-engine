"use client";
import { BarChart2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

export default function AnalyticsPage() {
  return (
    <>
      <TopBar title="Analytics" subtitle="Pipeline metrics and performance" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <BarChart2 size={32} className="mx-auto text-muted/50" />
          <h2 className="text-lg font-semibold text-text">Analytics</h2>
          <p className="text-sm text-muted">Charts and pipeline metrics with recharts — coming in Phase 4</p>
        </div>
      </div>
    </>
  );
}
