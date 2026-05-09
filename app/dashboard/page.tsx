"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Zap, Send, TrendingUp, CalendarCheck,
  UserPlus, Mail, ArrowRight, Plus, Download, Target, Sparkles,
} from "lucide-react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { getActivityLog, getCampaigns } from "@/lib/db";
import { generateCSV } from "@/lib/storage";
import type { ActivityLogEntry, Campaign } from "@/lib/types";

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
    case "lead_added":    return <UserPlus size={14} className="text-accent-green" />;
    case "message_sent":  return <Mail size={14} className="text-accent-blue" />;
    case "scored_hot":    return <Zap size={14} className="text-accent-orange" />;
    case "meeting_booked":return <CalendarCheck size={14} className="text-accent-green" />;
    case "lead_moved":    return <ArrowRight size={14} className="text-muted" />;
    default:              return <ArrowRight size={14} className="text-muted" />;
  }
}

interface StatCardProps {
  label: string; value: string | number; icon: React.ReactNode; accent: string;
}
function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 hover:-translate-y-0.5 transition-transform duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted font-medium">{label}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="text-[32px] font-bold text-text tabular-nums">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { state, dispatch } = useApp();
  const { leads, messages } = state;
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [campaignList, setCampaignList] = useState<Campaign[]>([]);
  const [newCampaign, setNewCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignIndustry, setCampaignIndustry] = useState("");

  useEffect(() => {
    getActivityLog(10).then(setActivity).catch(() => {});
    getCampaigns().then(setCampaignList).catch(() => {});
  }, [leads.length]);

  const hotLeads = leads.filter(l => l.score > 80).length;
  const meetingsBooked = leads.filter(l => l.emailStatus === "verified").length; // proxy for now
  const totalMessages = messages.length;

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
    setCampaignList(prev => [c, ...prev]);
    setCampaignName("");
    setCampaignIndustry("");
    setNewCampaign(false);
    dispatch({ type: "SAVE_CAMPAIGN", payload: c });
  };

  return (
    <>
      <TopBar title="Command Center" subtitle="Overview of your prospecting pipeline" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Total Leads" value={leads.length.toLocaleString()} icon={<Users size={16} />} accent="#00d4ff" />
          <StatCard label="Hot Leads" value={hotLeads} icon={<Zap size={16} />} accent="#ff6b35" />
          <StatCard label="Messages Sent" value={totalMessages} icon={<Send size={16} />} accent="#00d4ff" />
          <StatCard label="Avg Reply Rate" value="23%" icon={<TrendingUp size={16} />} accent="#00ff88" />
          <StatCard label="Meetings Booked" value={meetingsBooked} icon={<CalendarCheck size={16} />} accent="#00ff88" />
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-[1fr_400px] gap-4">
          {/* Activity Feed */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text mb-4">Recent Activity</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No activity yet. Run the agent or score leads to see activity here.</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {activity.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-white/[0.02] transition-colors">
                    {activityIcon(a.type)}
                    <span className="text-sm text-text flex-1">{a.text}</span>
                    <span className="text-[11px] text-muted shrink-0">{a.createdAt ? relativeTime(a.createdAt) : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Campaigns */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text">Active Campaigns</h3>
              <button onClick={() => setNewCampaign(true)} className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors">
                <Plus size={12} /> New
              </button>
            </div>

            {newCampaign && (
              <div className="mb-4 p-3 rounded-lg bg-surface2 border border-border space-y-2">
                <input
                  type="text" placeholder="Campaign name"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="w-full h-8 rounded-md bg-white/5 border border-border px-3 text-xs text-text placeholder:text-muted focus:outline-none focus:border-accent-blue/40"
                />
                <input
                  type="text" placeholder="Target industry (optional)"
                  value={campaignIndustry}
                  onChange={e => setCampaignIndustry(e.target.value)}
                  className="w-full h-8 rounded-md bg-white/5 border border-border px-3 text-xs text-text placeholder:text-muted focus:outline-none focus:border-accent-blue/40"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateCampaign} className="flex-1 h-7 rounded-md bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-colors">Create</button>
                  <button onClick={() => setNewCampaign(false)} className="flex-1 h-7 rounded-md bg-white/5 text-muted text-xs hover:bg-white/[0.08] transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {campaignList.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No campaigns yet. Create one to start tracking outreach.</p>
            ) : (
              <div className="space-y-2">
                {campaignList.filter(c => c.status !== "complete").map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{c.name}</p>
                      {c.targetIndustry && <p className="text-[11px] text-muted">{c.targetIndustry}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === "active" ? "bg-accent-green/15 text-accent-green" : "bg-accent-orange/15 text-accent-orange"
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
          <Link href="/" className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-transparent hover:bg-surface2 transition-colors text-sm text-text">
            <UserPlus size={14} /> Add Lead
          </Link>
          <Link href="/message-lab" className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-transparent hover:bg-surface2 transition-colors text-sm text-text">
            <Sparkles size={14} /> Generate Message
          </Link>
          <Link href="/scorer" className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-transparent hover:bg-surface2 transition-colors text-sm text-text">
            <Target size={14} /> Score Lead
          </Link>
          <button onClick={handleExport} className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-transparent hover:bg-surface2 transition-colors text-sm text-text">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
    </>
  );
}
