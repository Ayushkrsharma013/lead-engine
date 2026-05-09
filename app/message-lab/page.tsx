"use client";
import { MessageSquare } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

export default function MessageLabPage() {
  return (
    <>
      <TopBar title="AI Message Lab" subtitle="Generate personalized outreach with Claude" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <MessageSquare size={32} className="mx-auto text-muted/50" />
          <h2 className="text-lg font-semibold text-text">AI Message Lab</h2>
          <p className="text-sm text-muted">LinkedIn + Email message generation with Anthropic Claude — coming in Phase 2</p>
        </div>
      </div>
    </>
  );
}
