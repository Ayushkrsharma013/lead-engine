"use client";
import { KanbanSquare } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

export default function KanbanPage() {
  return (
    <>
      <TopBar title="Kanban Pipeline" subtitle="Drag-and-drop deal management" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <KanbanSquare size={32} className="mx-auto text-muted/50" />
          <h2 className="text-lg font-semibold text-text">Kanban Pipeline</h2>
          <p className="text-sm text-muted">7-column kanban board with drag-and-drop lead management — coming in Phase 3</p>
        </div>
      </div>
    </>
  );
}
