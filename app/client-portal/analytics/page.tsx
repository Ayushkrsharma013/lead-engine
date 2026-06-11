"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import { TrendingUp } from "lucide-react";
import type { UserProfile, PlanKey } from "@/lib/types";

interface DashboardData { statusBreakdown?: Array<{status:string;count:number}>; industryBreakdown?: Array<{industry:string;count:number}>; }
const STATUS_LABELS=["new","contacted","replied","hot","meeting","won","lost"];

export default function ClientAnalyticsPage() {
  const [profile,setProfile]=useState<UserProfile|null>(null);const [dash,setDash]=useState<DashboardData>({});const [loading,setLoading]=useState(true);
  useEffect(()=>{ (async()=>{const me=await fetch("/prospecting-os/api/client-portal/me");if(me.ok)setProfile((await me.json()).profile);const d=await fetch("/prospecting-os/api/client-portal/dashboard");if(d.ok)setDash(await d.json());setLoading(false);})(); },[]);
  usePortalHeader({title:"Analytics",description:"Lead volume and score analysis"});

  const sb=dash.statusBreakdown||[];const ib=dash.industryBreakdown||[];const top=ib.slice(0,8);const mx=top.length>0?top[0].count:1;

  return (
    <PlanGate module="analytics" plan={profile?.plan as PlanKey||null} role={profile?.role} requiredPlan="growth">
      <div className="p-4 lg:p-6 space-y-4">
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--line)"}}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{color:"var(--ink-4)"}}>Lead Status Breakdown</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">{STATUS_LABELS.map((s,i)=>{const it=sb.find(x=>x.status===s);const c=it?.count||0;return<motion.div key={s} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:.05+i*.04}} className="text-center"><motion.div className="text-[20px] font-bold tabular-nums" style={{color:"var(--ink)"}} initial={{scale:0.5}} animate={{scale:1}} transition={{delay:.12+i*.05,type:"spring"}}>{c}</motion.div><div className="text-[10px] font-medium capitalize mt-1" style={{color:"var(--ink-4)"}}>{s}</div></motion.div>;})}</div>
        </motion.div>
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--line)"}}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4 flex items-center gap-2" style={{color:"var(--ink-4)"}}><TrendingUp size={12} style={{color:"#E84A0A"}}/>Top Industries</h3>
          {top.length===0?<p className="text-[12px] py-4 text-center" style={{color:"var(--ink-3)"}}>No data yet</p>:<div className="space-y-2.5">{top.map(({industry,count},i)=>(<motion.div key={industry} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:.08+i*.04}} className="flex items-center gap-3"><span className="w-20 text-[11px] truncate text-right" style={{color:"var(--ink-3)"}}>{industry}</span><div className="flex-1 h-5 rounded-full overflow-hidden" style={{background:"var(--bg)"}}><motion.div className="h-full rounded-full" initial={{width:0}} animate={{width:`${Math.max(3,(count/mx)*100)}%`}} transition={{delay:.15+i*.05,duration:.6}} style={{background:"linear-gradient(90deg, rgba(232,74,10,0.20), #E84A0A)"}}/></div><span className="text-[11px] font-medium tabular-nums w-8 text-right" style={{color:"var(--ink-2)"}}>{count}</span></motion.div>))}</div>}
        </motion.div>
      </div>
    </PlanGate>
  );
}
