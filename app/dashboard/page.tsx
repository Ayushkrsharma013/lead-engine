"use client";

import { useState } from "react";
import {
  LayoutDashboard, Users, Zap, Send, TrendingUp, CalendarCheck,
  UserPlus, Mail, ArrowRight, Plus, Download, Target, Sparkles,
} from "lucide-react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { generateCSV } from "@/lib/storage";
import type { ActivityLogEntry } from "@/lib/types";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activityIcon(type: string) {
  switch (type) {
    case "lead_added":    return <UserPlus size={14} className="text-positive" />;
    case "message_sent":  return <Mail size={14} className="text-accent" />;
    case "scored_hot":    return <Zap size={14} className="text-negative" />;
    case "meeting_booked":return <CalendarCheck size={14} className="text-positive" />;
    case "lead_moved":    return <ArrowRight size={14} className="text-ink-3" />;
    default:              return <ArrowRight size={14} className="text-ink-3" />;
  }
}

interface StatCardProps {
  label: string; value: string | number; icon: React.ReactNode; accent: string;
}
function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div className="bg-surface border border-line rounded-lg p-5 hover:-translate-y-0.5 transition-transform duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-ink-3 font-medium">{label}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="text-[32px] font-bold text-ink tabular-nums">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { state, dispatch } = useApp();
  const { leads, messages, campaigns, activityLog } = state;

  const [newCampaign, setNewCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignIndustry, setCampaignIndustry] = useState("");

  // ─── Real computed stats ─────────────────────────────────────────────────
  const hotLeads = leads.filter(l => l.score > 80).length;
  const totalMessages = messages.length;
  const contactedLeads = leads.filter(l => l.status && l.status !== "new").length;
  const contactRate = leads.length > 0 ? Math.round((contactedLeads / leads.length) * 100) : 0;
  const meetingsBooked = leads.filter(l => l.status === "meeting" || l.status === "won").length;

  const handleExport = () => {
    const csv = generateCSV(leads);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `leads-export-${Date.now()}.csv`;
    a.click();
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) return;
    const { saveCampaign } = await import("@/lib/db");
    const c = await saveCampaign({ name: campaignName, targetIndustry: campaignIndustry, status: "active", leadIds: [] });
    dispatch({ type: "SAVE_CAMPAIGN", payload: c });
    setCampaignName("");
    setCampaignIndustry("");
    setNewCampaign(false);
  };

  // Get active campaigns (not complete)
  const activeCampaigns = campaigns.filter(c => c.status !== "complete");
  const recentActivity = (activityLog as ActivityLogEntry[]).slice(0, 10);

  return (
    <>
      <TopBar title="Command Center" subtitle="Overview of your prospecting pipeline" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Total Leads" value={leads.length.toLocaleString()} icon={<Users size={16} />} accent="var(--accent)" />
          <StatCard label="Hot Leads" value={hotLeads} icon={<Zap size={16} />} accent="var(--negative)" />
          <StatCard label="Messages Sent" value={totalMessages} icon={<Send size={16} />} accent="var(--accent)" />
          <StatCard label="Contact Rate" value={`${contactRate}%`} icon={<TrendingUp size={16} />} accent="var(--positive)" />
          <StatCard label="Meetings Won" value={meetingsBooked} icon={<CalendarCheck size={16} />} accent="var(--positive)" />
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-[1fr_400px] gap-4">
          {/* Activity Feed */}
          <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-ink-3 text-center py-8">No activity yet. Run the agent or score leads to see activity here.</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {recentActivity.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-white/[0.02] transition-colors">
                    {activityIcon(a.type)}
                    <span className="text-sm text-ink flex-1">{a.text}</span>
                    <span className="text-[11px] text-ink-3 shrink-0">{a.createdAt ? relativeTime(a.createdAt) : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Campaigns */}
          <div className="bg-surface border border-line rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink">Active Campaigns</h3>
              <button onClick={() => setNewCampaign(true)} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors">
                <Plus size={12} /> New
              </button>
            </div>

            {newCampaign && (
              <div className="mb-4 p-3 rounded-lg bg-surface2 border border-line space-y-2">
                <input
                  type="text" placeholder="Campaign name"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="w-full h-8 rounded-md bg-white/5 border border-line px-3 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40"
                />
                <input
                  type="text" placeholder="Target industry (optional)"
                  value={campaignIndustry}
                  onChange={e => setCampaignIndustry(e.target.value)}
                  className="w-full h-8 rounded-md bg-white/5 border border-line px-3 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-blue/40"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateCampaign} className="flex-1 h-7 rounded-md bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 transition-colors">Create</button>
                  <button onClick={() => setNewCampaign(false)} className="flex-1 h-7 rounded-md bg-white/5 text-ink-3 text-xs hover:bg-white/[0.08] transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {activeCampaigns.length === 0 ? (
              <p className="text-sm text-ink-3 text-center py-8">No active campaigns. Create one to start tracking outreach.</p>
            ) : (
              <div className="space-y-2">
                {activeCampaigns.map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{c.name}</p>
                      {c.targetIndustry && <p className="text-[11px] text-ink-3">{c.targetIndustry}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === "active" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 h-10 px-4 rounded-lg border border-line bg-transparent hover:bg-surface2 transition-colors text-sm text-ink">
            <UserPlus size={14} /> Add Lead
          </Link>
          <Link href="/message-lab" className="flex items-center gap-2 h-10 px-4 rounded-lg border border-line bg-transparent hover:bg-surface2 transition-colors text-sm text-ink">
            <Sparkles size={14} /> Generate Message
          </Link>
          <Link href="/scorer" className="flex items-center gap-2 h-10 px-4 rounded-lg border border-line bg-transparent hover:bg-surface2 transition-colors text-sm text-ink">
            <Target size={14} /> Score Lead
          </Link>
          <button onClick={handleExport} className="flex items-center gap-2 h-10 px-4 rounded-lg border border-line bg-transparent hover:bg-surface2 transition-colors text-sm text-ink">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
    </>
  );
}
