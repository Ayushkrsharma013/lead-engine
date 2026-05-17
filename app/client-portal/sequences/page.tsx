"use client";

import { useCallback, useEffect, useState } from "react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { createClient } from "@/lib/supabase/client";
import { Play, Pause, ChevronRight, Calendar } from "lucide-react";
import type { UserProfile, PlanKey } from "@/lib/types";

interface ActiveExecution {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step: number;
  status: string;
  variant: string;
  started_at: string;
  sequence_name: string;
  steps_count: number;
}

export default function ClientSequencesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ActiveExecution[]>([]);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (!meRes.ok) {
        setLoading(false);
        setError("Failed to load profile");
        return;
      }
      const d = await meRes.json();
      setProfile(d.profile);

      // Fetch active sequence executions joined with sequences
      const client = createClient();
      const { data, error: queryError } = await client
        .from("sequence_executions")
        .select("*, sequences!inner(id, name, steps)")
        .eq("status", "active")
        .order("started_at", { ascending: false });

      if (queryError) {
        setError(queryError.message);
      } else if (data) {
        const mapped: ActiveExecution[] = data.map(
          (r: Record<string, unknown>) => {
            const seq = r.sequences as Record<string, unknown> || {};
            const steps = (seq.steps as unknown[]) || [];
            return {
              id: String(r.id),
              sequence_id: String(r.sequence_id),
              lead_id: String(r.lead_id),
              current_step: Number(r.current_step),
              status: String(r.status),
              variant: String(r.variant || ""),
              started_at: String(r.started_at),
              sequence_name: String(seq.name || "Unknown"),
              steps_count: steps.length,
            };
          }
        );
        setExecutions(mapped);
      }
      setLoading(false);
    }
    init();
  }, []);

  // Group executions by sequence name
  const grouped = executions.reduce<
    Record<string, { name: string; executions: ActiveExecution[] }>
  >((acc, ex) => {
    if (!acc[ex.sequence_id]) {
      acc[ex.sequence_id] = { name: ex.sequence_name, executions: [] };
    }
    acc[ex.sequence_id].executions.push(ex);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PlanGate
      module="sequences"
      plan={(profile?.plan as PlanKey) || null}
      role={profile?.role}
      planName="Managed Scale"
    >
      <div className="max-w-5xl space-y-4 animate-fade-in">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>
            Sequences
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>
            Active outreach sequences running for your leads
          </p>
        </div>

        {error ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          >
            <p className="text-[13px]" style={{ color: "var(--negative)" }}>
              Failed to load sequences: {error}
            </p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          >
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No active sequences right now. Your account manager will launch
              campaigns for your leads.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([seqId, group]) => (
              <div
                key={seqId}
                className="rounded-xl overflow-hidden"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                }}
              >
                {/* Sequence header */}
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: "rgba(232,168,64,0.08)",
                        border: "1px solid rgba(232,168,64,0.15)",
                      }}
                    >
                      <Play
                        size={14}
                        style={{ color: "var(--accent)" }}
                      />
                    </div>
                    <div>
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: "var(--ink)" }}
                      >
                        {group.name}
                      </span>
                      <span
                        className="text-[10px] ml-2 px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(168,201,154,0.10)",
                          color: "var(--positive)",
                          border: "1px solid rgba(168,201,154,0.18)",
                        }}
                      >
                        Active
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--ink-4)" }}
                  >
                    {group.executions.length} lead
                    {group.executions.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Execution rows */}
                <table className="w-full">
                  <thead>
                    <tr
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      {["Lead", "Step", "Status", "Started", ""].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.10em]"
                          style={{ color: "var(--ink-4)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.executions.map((ex) => (
                      <tr
                        key={ex.id}
                        className="transition-colors duration-150"
                        style={{ borderBottom: "1px solid var(--line)" }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "rgba(237,234,226,0.02)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "transparent")
                        }
                      >
                        <td
                          className="px-5 py-3 text-[12px] font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {ex.lead_id.substring(0, 8)}...
                        </td>
                        <td
                          className="px-5 py-3 text-[12px]"
                          style={{ color: "var(--ink-2)" }}
                        >
                          Step {ex.current_step} of {ex.steps_count}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="px-2 py-0.5 rounded-full font-medium text-[10px]"
                            style={{
                              background:
                                "rgba(168,201,154,0.10)",
                              color: "var(--positive)",
                              border:
                                "1px solid rgba(168,201,154,0.18)",
                            }}
                          >
                            {ex.status}
                          </span>
                        </td>
                        <td
                          className="px-5 py-3 text-[11px]"
                          style={{ color: "var(--ink-4)" }}
                        >
                          <Calendar
                            size={10}
                            className="inline mr-1"
                          />
                          {new Date(
                            ex.started_at
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-3">
                          <ChevronRight
                            size={14}
                            style={{ color: "var(--ink-4)" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </PlanGate>
  );
}
