"use client";
import { Target } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

export default function ScorerPage() {
  return (
    <>
      <TopBar title="Lead Scorer" subtitle="AI-powered ICP scoring" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Target size={32} className="mx-auto text-muted/50" />
          <h2 className="text-lg font-semibold text-text">Lead Scorer</h2>
          <p className="text-sm text-muted">Score leads 0-100 with Claude-powered ICP analysis — coming in Phase 2</p>
        </div>
      </div>
    </>
  );
}
