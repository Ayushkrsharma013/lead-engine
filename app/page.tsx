"use client";
import { useState, useCallback, useRef } from "react";
import { Source, Lead, LogEntry, Stats } from "@/lib/types";
import { MOCK_LINKEDIN, MOCK_GMAPS, MOCK_AMAZON, LOG_STEPS } from "@/lib/mock-data";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import LeadsTable from "@/components/LeadsTable";
import { Progress } from "@/components/ui/progress";

const ACCENT: Record<Source, string> = {
  linkedin: "#818cf8",
  gmaps: "#34d399",
  amazon: "#fb923c",
};

const MOCK_LEADS: Record<Source, Lead[]> = {
  linkedin: MOCK_LINKEDIN,
  gmaps: MOCK_GMAPS,
  amazon: MOCK_AMAZON,
};

function buildStats(leads: Lead[]): Stats {
  const withEmail = leads.filter(l => l.emailStatus === "verified").length;
  const avgScore = leads.length ? Math.round(leads.reduce((a, l) => a + l.score, 0) / leads.length) : 0;
  const industryCount: Record<string, number> = {};
  leads.forEach(l => { industryCount[l.industry] = (industryCount[l.industry] || 0) + 1; });
  const topIndustry = Object.entries(industryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return { total: leads.length, withEmail, avgScore, topIndustry };
}

export default function Home() {
  const [source, setSource] = useState<Source>("linkedin");
  const [mock, setMock] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [prog, setProg] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const abortRef = useRef(false);

  const accent = ACCENT[source];

  const handleRun = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setDone(false);
    setLeads([]);
    setLog([]);
    setProg(0);
    setStats(null);

    if (mock) {
      const steps = LOG_STEPS[source];
      for (let i = 0; i < steps.length; i++) {
        if (abortRef.current) break;
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLog(prev => [...prev, { id: i, ts, text: steps[i].text, type: steps[i].type }]);
        setProg(Math.round(((i + 1) / steps.length) * 100));
      }
      const mockLeads = MOCK_LEADS[source];
      setLeads(mockLeads);
      setStats(buildStats(mockLeads));
    } else {
      try {
        const ts = () => new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLog(prev => [...prev, { id: 0, ts: ts(), text: "Connecting to Apify API…", type: "info" }]);
        setProg(10);

        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, fields }),
        });

        setProg(40);
        setLog(prev => [...prev, { id: 1, ts: ts(), text: "Actor started, fetching leads…", type: "info" }]);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "API error");
        }

        const data = await res.json();
        setProg(90);
        setLog(prev => [...prev, { id: 2, ts: ts(), text: `Processing ${data.leads?.length || 0} results…`, type: "info" }]);

        await new Promise(r => setTimeout(r, 600));
        const liveLeads: Lead[] = (data.leads || []).map((item: Record<string, unknown>, idx: number) => ({
          id: `live-${idx}`,
          name: String(item.full_name || item.name || ""),
          title: String(item.job_title || item.title || ""),
          company: String(item.job_company_name || item.company || ""),
          industry: String(item.job_company_industry || item.industry || ""),
          location: String(item.location_name || item.location || ""),
          email: Array.isArray(item.emails) && item.emails.length > 0
            ? String((item.emails[0] as Record<string, unknown>).address || item.emails[0] || "")
            : String(item.email || ""),
          emailStatus: (item.email_status || "not_found") as Lead["emailStatus"],
          linkedin: String(item.linkedin_url || ""),
          website: String(item.job_company_website || ""),
          companySize: String(item.job_company_size || ""),
          score: Math.floor(70 + Math.random() * 28),
          source,
        }));

        setProg(100);
        setLog(prev => [...prev, { id: 3, ts: ts(), text: `✓ ${liveLeads.length} leads fetched successfully`, type: "success" }]);
        setLeads(liveLeads);
        setStats(buildStats(liveLeads));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLog(prev => [...prev, { id: 99, ts, text: `✗ Error: ${msg}`, type: "warn" }]);
      }
    }

    setRunning(false);
    setDone(true);
  }, [source, mock, fields]);

  const handleExport = useCallback(() => {
    const headers = ["Name","Title","Company","Industry","Location","Email","Email Status","LinkedIn","Website","Company Size","Score"];
    const rows = leads.map(l => [l.name, l.title, l.company, l.industry, l.location, l.email, l.emailStatus, l.linkedin, l.website, l.companySize, l.score]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${source}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [leads, source]);

  const handleSourceChange = (s: Source) => {
    setSource(s);
    setLeads([]);
    setLog([]);
    setProg(0);
    setDone(false);
    setStats(null);
    setFields({});
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar source={source} setSource={handleSourceChange} mock={mock} setMock={setMock} />

      <div className="fixed top-14 left-0 right-0 z-40">
        <Progress value={running ? prog : done ? 100 : 0} color={accent} />
      </div>

      <div className="flex flex-1 mt-14 overflow-hidden">
        <Sidebar
          source={source}
          running={running}
          done={done}
          log={log}
          stats={stats}
          fields={fields}
          setFields={setFields}
          onRun={handleRun}
          onExport={handleExport}
          accent={accent}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-[#080b10]">
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-200">
                {source === "linkedin" ? "LinkedIn Leads" : source === "gmaps" ? "Google Maps Businesses" : "Amazon Sellers"}
              </h2>
              {leads.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${accent}15`, color: accent }}>
                  {leads.length} leads
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!mock && (
                <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  ● LIVE API
                </span>
              )}
              {mock && (
                <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                  ◎ MOCK DATA
                </span>
              )}
            </div>
          </div>

          <LeadsTable leads={leads} running={running} accent={accent} />
        </main>
      </div>
    </div>
  );
}
