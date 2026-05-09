"use client";
import { Briefcase } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

export default function ClientsPage() {
  return (
    <>
      <TopBar title="Client Manager" subtitle="Manage client accounts and reports" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Briefcase size={32} className="mx-auto text-muted/50" />
          <h2 className="text-lg font-semibold text-text">Client Manager</h2>
          <p className="text-sm text-muted">Client CRM with lead assignment and reporting — coming in Phase 4</p>
        </div>
      </div>
    </>
  );
}
