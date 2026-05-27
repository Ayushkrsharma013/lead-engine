"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import type { UserProfile, PlanKey } from "@/lib/types";

interface EnrichedLead {
  id: string; name: string; company: string; score: number;
  icebreakers: Array<{ id: string; body: string; subject: string; tone: string }>;
}

export default function ClientIcebreakersPage() {
  const [leads, setLeads] = useState<EnrichedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
      }

      const leadsRes = await fetch("/prospecting-os/api/client-portal/icebreakers");
      if (leadsRes.ok) {
        const d = await leadsRes.json();
        setLeads(d.leads || []);
      }
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PlanGate module="icebreakers" plan={profile?.plan as PlanKey || null} role={profile?.role} requiredPlan="growth">
      <div className="max-w-5xl space-y-4 animate-fade-in">
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Icebreakers</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>AI-generated icebreakers for your top leads (score 60+)</p>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>No icebreakers available yet. Leads with scores above 60 will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map(lead => (
              <div key={lead.id} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{lead.name || "—"}</p>
                    <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>{lead.company || "—"} · Score: {lead.score}</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.20)" }}>
                    {lead.icebreakers.length} icebreaker{lead.icebreakers.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {expandedId === lead.id && lead.icebreakers.length > 0 && (
                  <div className="mt-3 pt-3 space-y-2 animate-fade-in" style={{ borderTop: "1px solid var(--line)" }}>
                    {lead.icebreakers.map(ib => (
                      <div key={ib.id} className="p-3 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)" }}>
                            {ib.tone || "friendly"}
                          </span>
                          {ib.subject && (
                            <span className="text-[11px] font-medium" style={{ color: "var(--ink-2)" }}>{ib.subject}</span>
                          )}
                        </div>
                        <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                          {ib.body?.length > 200 ? ib.body.slice(0, 200) + "..." : ib.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PlanGate>
  );
}
