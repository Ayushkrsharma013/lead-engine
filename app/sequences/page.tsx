"use client";
import { GitBranch } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

export default function SequencesPage() {
  return (
    <>
      <TopBar title="Sequence Builder" subtitle="Multi-step outreach cadences" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <GitBranch size={32} className="mx-auto text-muted/50" />
          <h2 className="text-lg font-semibold text-text">Sequence Builder</h2>
          <p className="text-sm text-muted">Build multi-channel outreach sequences with templates — coming in Phase 3</p>
        </div>
      </div>
    </>
  );
}
