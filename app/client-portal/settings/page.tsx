"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Lock } from "lucide-react";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import type { UserProfile } from "@/lib/types";

const INDUSTRY_OPTIONS=["Technology","Healthcare","Finance","Manufacturing","Retail","Real Estate","Education","Energy","Transportation","Other"];

export default function ClientSettingsPage() {
  const [profile,setProfile]=useState<UserProfile|null>(null);const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);const [toast,setToast]=useState("");const [icpLocked,setIcpLocked]=useState(false);
  const [industries,setIndustries]=useState<string[]>([]);const [locations,setLocations]=useState("");const [minScore,setMinScore]=useState(50);

  useEffect(()=>{ (async()=>{ const [meRes,stRes]=await Promise.all([fetch("/prospecting-os/api/client-portal/me"),fetch("/prospecting-os/api/client-portal/settings")]); if(meRes.ok) setProfile((await meRes.json()).profile); if(stRes.ok){ const d=await stRes.json(); setIcpLocked(!!d.icp_locked); const icp=(d.icp_config||{})as Record<string,unknown>; setIndustries((icp.industries as string[])||[]); setLocations((icp.locations as string)||""); setMinScore((icp.minScore as number)||50); } setLoading(false); })(); },[]);

  const toggle=(ind:string)=>{if(icpLocked)return; setIndustries(p=>p.includes(ind)?p.filter(i=>i!==ind):[...p,ind]);};
  const save=async()=>{if(icpLocked){setToast("ICP locked — contact support");setTimeout(()=>setToast(""),3000);return;} setSaving(true); const r=await fetch("/prospecting-os/api/client-portal/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({industries,locations,minScore})}); setSaving(false); const d=await r.json().catch(()=>({})); setToast(r.ok?"Saved":(d as {error?:string}).error||"Failed"); setTimeout(()=>setToast(""),2500);};

  usePortalHeader({ title:"Settings", description:icpLocked?"ICP locked — contact support to make changes":"Configure your ICP preferences" });

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-lg">
      {icpLocked&&<motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold" style={{background:"rgba(232,74,10,0.10)",color:"#E84A0A",border:"1px solid rgba(232,74,10,0.20)"}}><Lock size={10}/>ICP Locked</motion.div>}

      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--line)"}}>
        <h3 className="text-[13px] font-semibold mb-3" style={{color:"var(--ink)"}}>Target Industries</h3>
        <div className="flex flex-wrap gap-2">{INDUSTRY_OPTIONS.map(ind=>(<motion.button key={ind} whileHover={icpLocked?{}:{scale:1.05}} whileTap={icpLocked?{}:{scale:0.95}} onClick={()=>toggle(ind)} className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all" style={{background:industries.includes(ind)?"rgba(232,74,10,0.10)":"transparent",color:industries.includes(ind)?"#E84A0A":"var(--ink-3)",border:`1px solid ${industries.includes(ind)?"rgba(232,74,10,0.25)":"var(--line)"}`,cursor:icpLocked?"not-allowed":"pointer",opacity:icpLocked?0.6:1}}>{ind}</motion.button>))}</div>
      </motion.div>

      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--line)"}}>
        <h3 className="text-[13px] font-semibold mb-4" style={{color:"var(--ink)"}}>Minimum Lead Score: <span style={{color:"#E84A0A"}}>{minScore}</span></h3>
        <input type="range" min={0} max={100} value={minScore} onChange={e=>setMinScore(Number(e.target.value))} disabled={icpLocked} className="w-full" style={{accentColor:"#E84A0A",opacity:icpLocked?0.5:1}}/>
        <div className="flex justify-between text-[10px] mt-1" style={{color:"var(--ink-4)"}}><span>0</span><span>50</span><span>100</span></div>
      </motion.div>

      <motion.button onClick={save} disabled={saving||icpLocked} whileHover={saving||icpLocked?{}:{scale:1.03}} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold disabled:opacity-40" style={{background:"#E84A0A",color:"#fff",border:"none",cursor:icpLocked?"not-allowed":"pointer"}}>{icpLocked?<Lock size={14}/>:<Save size={14}/>}{icpLocked?"ICP Locked":"Save Preferences"}</motion.button>

      <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium" style={{background:"var(--surface-elev)",border:"1px solid var(--line)",color:"var(--ink)",boxShadow:"var(--shadow-md)"}}>{toast}</motion.div>}</AnimatePresence>
    </div>
  );
}
