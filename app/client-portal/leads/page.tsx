"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, ExternalLink, Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import type { UserProfile, PlanKey } from "@/lib/types";

interface LeadRow { id: string; name: string; title: string; company: string; linkedin_url: string; score: number; }

function Watermark({ email }: { email: string }) {
  if (!email) return null;
  const lines: string[] = [];
  for (let r=0;r<20;r++) for(let c=0;c<6;c++) lines.push(`<span style="position:absolute;top:${r*80+(c%3)*25}px;left:${c*280+(r%4)*40}px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.03);white-space:nowrap;pointer-events:none;transform:rotate(-15deg);font-family:monospace;">${email} · CONFIDENTIAL</span>`);
  return <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}} dangerouslySetInnerHTML={{__html:lines.join("")}}/>;
}

export default function ClientLeadsPage() {
  const [leads,setLeads]=useState<LeadRow[]>([]);const [count,setCount]=useState(0);const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(1);const [scoreMin,setScoreMin]=useState(0);const [view,setView]=useState<"all"|"hot">("all");
  const [hotCount,setHotCount]=useState(0);const [profile,setProfile]=useState<UserProfile|null>(null);const [search,setSearch]=useState("");
  const limit=25;const effMin=view==="hot"?8:scoreMin;

  useEffect(()=>{ (async()=>{ const meRes=await fetch("/prospecting-os/api/client-portal/me"); if(meRes.ok) setProfile((await meRes.json()).profile); const hotRes=await fetch("/prospecting-os/api/client-portal/leads?limit=1&score_min=8"); if(hotRes.ok) setHotCount((await hotRes.json()).count||0); })(); },[]);
  useEffect(()=>{ (async()=>{ setLoading(true); const p=new URLSearchParams({page:String(page),limit:String(limit)}); if(effMin>0) p.set("score_min",String(effMin)); if(search.trim()) p.set("search",search.trim()); const res=await fetch(`/prospecting-os/api/client-portal/leads?${p}`); if(res.ok){const d=await res.json();setLeads(d.leads||[]);setCount(d.count||0);} setLoading(false); })(); },[page,effMin,search]);

  usePortalHeader({
    title: "My Leads",
    description: `${count.toLocaleString()} leads in your workspace`,
    actions: <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--ink-4)"}}/><input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search leads…" className="h-8 pl-9 pr-3 rounded-lg text-[11px] outline-none w-44" style={{background:"var(--surface-2)",border:"1px solid var(--line)",color:"var(--ink)"}}/></div>,
  });

  const totalPages=Math.ceil(count/limit);

  return (
    <PlanGate module="leads" plan={profile?.plan as PlanKey||null} role={profile?.role} requiredPlan="pilot">
      <Watermark email={profile?.email||""}/>
      <div className="p-4 lg:p-6 space-y-4" style={{position:"relative",zIndex:1}}>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg p-0.5" style={{background:"var(--surface-2)",border:"1px solid var(--line)"}}>
            <button onClick={()=>{setView("all");setPage(1);setScoreMin(0);}} className="px-3 py-1.5 rounded-md text-[11px] font-medium" style={{background:view==="all"?"var(--surface)":"transparent",color:view==="all"?"var(--ink)":"var(--ink-3)"}}>All</button>
            <button onClick={()=>{setView("hot");setPage(1);}} className="px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1" style={{background:view==="hot"?"var(--surface)":"transparent",color:view==="hot"?"#e06060":"var(--ink-3)"}}><Flame size={12}/>Hot{hotCount>0&&<span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{background:"rgba(224,96,96,0.12)",color:"#e06060"}}>{hotCount}</span>}</button>
          </div>
          {view==="all"&&<div className="flex items-center gap-1"><span className="text-[10px] font-medium" style={{color:"var(--ink-4)"}}>Score:</span>{[0,4,6,8].map(s=><button key={s} onClick={()=>{setScoreMin(s);setPage(1);}} className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{background:scoreMin===s?"var(--accent-soft)":"transparent",color:scoreMin===s?"var(--accent-ink)":"var(--ink-3)",border:`1px solid ${scoreMin===s?"rgba(232,74,10,0.25)":"var(--line)"}`}}>{s===0?"All":`${s}+`}</button>)}</div>}
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{background:"var(--surface)",border:"1px solid var(--line)"}}>
          {loading?<div className="p-10 text-center text-[12px]" style={{color:"var(--ink-3)"}}>Loading…</div>
          :leads.length===0?<div className="p-10 text-center"><Users size={36} style={{color:"var(--ink-4)",opacity:0.3,margin:"0 auto 12px"}}/><p className="text-[13px] font-medium" style={{color:"var(--ink-3)"}}>{view==="hot"?"No hot leads yet.":"No leads match your filters."}</p></div>
          :<table className="min-w-full"><thead style={{borderBottom:"1px solid var(--line)"}}><tr>{["Name","Title","Company","LinkedIn","Score"].map(h=><th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{color:"var(--ink-4)"}}>{h}</th>)}</tr></thead>
            <tbody>{leads.map((l,i)=>(<motion.tr key={l.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.01}} style={{borderBottom:"1px solid var(--line)"}} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(237,234,226,0.02)"} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}><td className="px-5 py-2.5 text-[12px] font-medium" style={{color:"var(--ink)"}}>{l.name||"—"}</td><td className="px-5 py-2.5 text-[12px]" style={{color:"var(--ink-3)"}}>{l.title||"—"}</td><td className="px-5 py-2.5 text-[12px]" style={{color:"var(--ink-3)"}}>{l.company||"—"}</td><td className="px-5 py-2.5">{l.linkedin_url?<a href={l.linkedin_url} target="_blank" rel="noopener" className="text-[11px] font-medium no-underline" style={{color:"var(--accent-blue)"}}>View <ExternalLink size={9}/></a>:<span className="text-[12px]" style={{color:"var(--ink-3)"}}>—</span>}</td><td className="px-5 py-2.5"><span className="px-2 py-0.5 text-[10px] font-bold rounded-md" style={{background:l.score>=8?"rgba(107,203,119,0.10)":l.score>=6?"rgba(232,168,64,0.10)":"rgba(255,255,255,0.04)",color:l.score>=8?"var(--positive)":l.score>=6?"var(--accent)":"var(--ink-4)",border:`1px solid ${l.score>=8?"rgba(107,203,119,0.18)":l.score>=6?"rgba(232,168,64,0.18)":"rgba(255,255,255,0.06)"}`}}>{l.score}</span></td></motion.tr>))}</tbody></table>}
        </div>

        {totalPages>1&&<div className="flex items-center justify-center gap-1.5"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{color:"var(--ink-3)",border:"1px solid var(--line)"}}><ChevronLeft size={13}/></button>{Array.from({length:totalPages},(_,i)=><motion.button key={i} onClick={()=>setPage(i+1)} whileHover={{scale:1.05}} whileTap={{scale:0.95}} className="w-7 h-7 rounded-lg text-[11px] font-semibold" style={{background:page===i+1?"#E84A0A":"transparent",color:page===i+1?"#fff":"var(--ink-3)",border:page===i+1?"none":"1px solid var(--line)"}}>{i+1}</motion.button>)}<button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{color:"var(--ink-3)",border:"1px solid var(--line)"}}><ChevronRight size={13}/></button></div>}
      </div>
    </PlanGate>
  );
}
