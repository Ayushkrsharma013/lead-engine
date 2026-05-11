"use client";

import { useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";
import { Search, Mail, Linkedin } from "lucide-react";
import type { Lead } from "@/lib/types";

const cardBg = "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))";
const cardBorder = "1px solid rgba(201,168,124,0.07)";

export default function PortalLeadsPage() {
  const { state } = usePortalAuth();
  const { client } = state;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    (async () => {
      try {
        const { data } = await supabase.from("leads").select("*").eq("client_id", client.id).order("saved_at", { ascending: false });
        if (data) setLeads(data as unknown as Lead[]);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [client]);

  const filtered = search
    ? leads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase()) || l.title.toLowerCase().includes(search.toLowerCase()))
    : leads;

  if (!client) return null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Your Leads</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{leads.length} leads assigned to {client.company}</p>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-3)" }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, or title..."
          className="w-full h-9 rounded-lg pl-9 pr-3 text-[12px] outline-none transition-all duration-200"
          style={{ color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
          onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
          onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"} />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
        {loading ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-3)" }}>{search ? "No leads match your search." : "No leads assigned yet."}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Name", "Title", "Company", "Score", "Email", "Status"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  <td className="px-5 py-3 text-[12px] font-medium" style={{ color: "var(--ink)" }}>
                    <div className="flex items-center gap-1.5">
                      {l.name}
                      {l.linkedin && <a href={l.linkedin} target="_blank" rel="noopener noreferrer"
                        className="transition-colors duration-150" style={{ color: "var(--ink-3)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--accent)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}>
                        <Linkedin size={10} /></a>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.title}</td>
                  <td className="px-5 py-3 text-[12px]" style={{ color: "var(--ink-3)" }}>{l.company}</td>
                  <td className="px-5 py-3">
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                      style={l.score >= 80 ? { background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.18)" }
                        : l.score >= 60 ? { background: "rgba(201,168,124,0.08)", color: "var(--accent)", border: "1px solid rgba(201,168,124,0.15)" }
                          : { background: "rgba(212,148,132,0.08)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.15)" }}>{l.score}</span>
                  </td>
                  <td className="px-5 py-3 text-[11px]">
                    {l.email ? <a href={`mailto:${l.email}`} className="flex items-center gap-1 transition-colors duration-150"
                      style={{ color: l.emailStatus === "verified" ? "var(--positive)" : "var(--ink-3)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--accent)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = l.emailStatus === "verified" ? "var(--positive)" : "var(--ink-3)"}>
                      <Mail size={10} /> {l.email}</a> : <span style={{ color: "var(--ink-4)" }}>—</span>}
                  </td>
                  <td className="px-5 py-3 text-[11px] capitalize" style={{ color: "var(--ink-3)" }}>{l.status || "new"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
