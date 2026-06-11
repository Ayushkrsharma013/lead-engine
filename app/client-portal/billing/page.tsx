"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ArrowRight, CreditCard } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import type { UserProfile, PlanKey } from "@/lib/types";

const PLAN_ORDER: PlanKey[]=["micro","pilot","growth","scale"];
const rank=(p:PlanKey|null|undefined)=>p?PLAN_ORDER.indexOf(p):-1;

export default function ClientBillingPage() {
  const [profile,setProfile]=useState<UserProfile|null>(null);const [loading,setLoading]=useState(true);const [copied,setCopied]=useState(false);
  useEffect(()=>{ (async()=>{const r=await fetch("/prospecting-os/api/client-portal/me");if(r.ok) setProfile((await r.json()).profile);setLoading(false);})(); },[]);
  const copy=async()=>{if(!profile?.payment_ref)return;await navigator.clipboard.writeText(profile.payment_ref);setCopied(true);setTimeout(()=>setCopied(false),2500);};

  usePortalHeader({ title:"Billing", description:"Your plan, payment status, and upgrade options" });

  const ck=(profile?.plan as PlanKey)||null;const cp=ck?PLANS[ck]:null;const cr=rank(ck);const up=PLAN_ORDER.filter(k=>rank(k)>cr);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-2xl">
      {/* Current plan */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--line)"}}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-[13px] font-semibold flex items-center gap-2" style={{color:"var(--ink)"}}><CreditCard size={14} style={{color:"#E84A0A"}}/>Current Plan</h3><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{background:profile?.subscription_status==="active"?"rgba(107,203,119,0.08)":"rgba(232,74,10,0.10)",color:profile?.subscription_status==="active"?"var(--positive)":"#E84A0A"}}>{(profile?.subscription_status||"none").replace("_"," ")}</span></div>
        {cp?<><p className="text-[18px] font-bold" style={{color:"var(--ink)"}}>{cp.name}</p><p className="text-[14px] mt-0.5" style={{color:"var(--ink-2)"}}>${cp.setupAmount.toLocaleString()}{cp.monthlyAmount>0?` + $${cp.monthlyAmount.toLocaleString()}/mo`:" one-time"}</p><div className="mt-4 space-y-1.5">{cp.features.map((f,j)=><div key={j} className="text-[11px] flex items-start gap-1.5" style={{color:"var(--ink-3)"}}><Check size={11} className="mt-0.5 shrink-0" style={{color:"var(--positive)"}}/><span>{f}</span></div>)}</div></>:<p className="text-[13px]" style={{color:"var(--ink-3)"}}>No plan assigned.</p>}
      </motion.div>

      {up.length>0&&<div className="space-y-3"><h3 className="text-[12px] font-semibold uppercase tracking-[0.10em]" style={{color:"var(--ink-4)"}}>Upgrade Options</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{up.map((key,i)=>{const p=PLANS[key];const hl=key==="growth";return(<motion.div key={key} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:.1+i*.05}} whileHover={{scale:1.02}} className="rounded-xl p-5 flex flex-col" style={{background:"var(--surface)",border:hl?"1px solid rgba(232,74,10,0.30)":"1px solid var(--line)"}}><div className="flex items-center justify-between mb-2"><p className="text-[14px] font-bold" style={{color:"var(--ink)"}}>{p.name}</p>{hl&&<span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{background:"rgba(232,74,10,0.12)",color:"#E84A0A",border:"1px solid rgba(232,74,10,0.25)"}}>Recommended</span>}</div><p className="text-[13px] mb-3" style={{color:"var(--ink-2)"}}>${p.setupAmount.toLocaleString()}{p.monthlyAmount>0?` + $${p.monthlyAmount.toLocaleString()}/mo`:" one-time"}</p><div className="space-y-1 flex-1 mb-4">{p.features.slice(0,4).map((f,j)=><div key={j} className="text-[11px] flex items-start gap-1.5" style={{color:"var(--ink-3)"}}><Check size={11} className="mt-0.5 shrink-0" style={{color:"var(--positive)"}}/><span>{f}</span></div>)}</div><a href="/book" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold no-underline" style={{background:hl?"#E84A0A":"var(--surface-2)",color:hl?"#fff":"var(--ink)",border:hl?"none":"1px solid var(--line)"}}>Talk to us <ArrowRight size={12}/></a></motion.div>);})}</div></div>}

      {profile?.payment_ref&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--line)"}}><h3 className="text-[13px] font-semibold mb-2" style={{color:"var(--ink)"}}>Payment Reference</h3><div className="flex items-center gap-2"><code className="flex-1 px-3 py-2 rounded-lg text-[13px] font-mono" style={{background:"var(--bg)",border:"1px solid var(--line)",color:"var(--ink-2)"}}>{profile.payment_ref}</code><button onClick={copy} className="p-2 rounded-lg transition-colors hover:bg-white/[0.05]" style={{color:copied?"var(--positive)":"var(--ink-3)",background:"none",border:"none",cursor:"pointer"}}>{copied?<Check size={14}/>:<Copy size={14}/>}</button></div><AnimatePresence>{copied&&<motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-[11px] mt-1.5" style={{color:"var(--positive)"}}>Copied!</motion.p>}</AnimatePresence></motion.div>}
    </div>
  );
}
