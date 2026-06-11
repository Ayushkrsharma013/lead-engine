"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import { GitBranch, Plus, Play, Pause, Trash2, Loader2, X, Layers } from "lucide-react";
import type { PlanKey } from "@/lib/types";

interface Sequence { id: string; name: string; steps: unknown[]; schedule: Record<string,unknown>|null; status: string; created_at: string; }

export default function ClientSequencesPage() {
  const [profile,setProfile]=useState<{plan?:PlanKey;role?:string}|null>(null);const [loading,setLoading]=useState(true);
  const [sequences,setSequences]=useState<Sequence[]>([]);const [showForm,setShowForm]=useState(false);
  const [formName,setFormName]=useState("");const [saving,setSaving]=useState(false);const [toast,setToast]=useState("");

  const fetchSeq=async()=>{const r=await fetch("/prospecting-os/api/client-portal/sequences");if(r.ok) setSequences((await r.json()).sequences||[]);};
  useEffect(()=>{ (async()=>{const r=await fetch("/prospecting-os/api/client-portal/me");if(r.ok) setProfile((await r.json()).profile);await fetchSeq();setLoading(false);})(); },[]);

  const create=async()=>{if(!formName.trim())return;setSaving(true);const r=await fetch("/prospecting-os/api/client-portal/sequences",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:formName,steps:[],schedule:null})});setSaving(false);if(r.ok){setShowForm(false);setFormName("");await fetchSeq();setToast("Sequence created");setTimeout(()=>setToast(""),2500);}};
  const toggle=async(s:Sequence)=>{await fetch(`/prospecting-os/api/client-portal/sequences?id=${s.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:s.status==="active"?"draft":"active"})});await fetchSeq();};
  const del=async(id:string)=>{if(!confirm("Delete?"))return;await fetch(`/prospecting-os/api/client-portal/sequences?id=${id}`,{method:"DELETE"});await fetchSeq();};

  usePortalHeader({
    title: "Sequences",
    description: "Create and manage outreach sequences",
    actions: <motion.button onClick={()=>setShowForm(true)} whileHover={{scale:1.03}} whileTap={{scale:0.97}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{background:"#E84A0A",color:"#fff",border:"none",cursor:"pointer"}}><Plus size={13}/>New</motion.button>,
  });

  return (
    <PlanGate module="sequences" plan={profile?.plan||null} role={profile?.role} requiredPlan="pilot">
      <div className="p-4 lg:p-6 space-y-3">
        <AnimatePresence>{showForm&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}} onClick={e=>{if(e.target===e.currentTarget)setShowForm(false);}}><motion.div initial={{opacity:0,scale:0.95,y:10}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:10}} className="rounded-2xl p-6 w-full max-w-sm" style={{background:"var(--surface-elev)",border:"1px solid var(--line)"}}><div className="flex items-center justify-between mb-4"><h2 className="text-[15px] font-bold" style={{color:"var(--ink)"}}>New Sequence</h2><button onClick={()=>setShowForm(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-3)"}}><X size={16}/></button></div><input type="text" value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Sequence name" autoFocus className="w-full h-10 rounded-xl px-3 text-[13px] mb-4" style={{background:"var(--surface-2)",border:"1px solid var(--line)",color:"var(--ink)",outline:"none"}}/><button onClick={create} disabled={saving||!formName.trim()} className="w-full h-10 rounded-full text-[13px] font-semibold flex items-center justify-center gap-2" style={{background:"#E84A0A",color:"#fff",border:"none",cursor:"pointer",opacity:saving?0.7:1}}>{saving?<Loader2 size={14} className="animate-spin"/>:null}Create</button></motion.div></motion.div>}</AnimatePresence>

        {sequences.length===0?(
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="rounded-xl p-10 text-center" style={{background:"var(--surface)",border:"1px solid var(--line)"}}><Layers size={36} style={{color:"var(--ink-4)",opacity:0.3,margin:"0 auto 14px"}}/><p className="text-[13px] font-medium" style={{color:"var(--ink-2)"}}>No sequences yet</p><p className="text-[11px] mt-1" style={{color:"var(--ink-4)"}}>Create your first outreach sequence.</p></motion.div>
        ):(<div className="space-y-2">{sequences.map((s,i)=>(<motion.div key={s.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*.04}} whileHover={{scale:1.01}} className="rounded-xl p-4 flex items-center justify-between" style={{background:"var(--surface)",border:s.status==="active"?"1px solid rgba(34,197,94,0.2)":"1px solid var(--line)"}}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"rgba(232,74,10,0.08)",border:"1px solid rgba(232,74,10,0.15)"}}><GitBranch size={14} style={{color:"#E84A0A"}}/></div><div><p className="text-[13px] font-semibold" style={{color:"var(--ink)"}}>{s.name}</p><p className="text-[10px]" style={{color:"var(--ink-4)"}}>{(s.steps as unknown[]||[]).length} steps · {new Date(s.created_at).toLocaleDateString()}</p></div></div><div className="flex items-center gap-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{background:s.status==="active"?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.04)",color:s.status==="active"?"#22c55e":"var(--ink-4)"}}>{s.status}</span><motion.button onClick={()=>toggle(s)} whileHover={{scale:1.1}} whileTap={{scale:0.9}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-3)",padding:4}}>{s.status==="active"?<Pause size={14}/>:<Play size={14}/>}</motion.button><motion.button onClick={()=>del(s.id)} whileHover={{scale:1.1}} whileTap={{scale:0.9}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-4)",padding:4}}><Trash2 size={14}/></motion.button></div></motion.div>))}</div>)}

        <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium" style={{background:"var(--surface-elev)",border:"1px solid var(--line)",color:"var(--ink)",boxShadow:"var(--shadow-md)"}}>{toast}</motion.div>}</AnimatePresence>
      </div>
    </PlanGate>
  );
}
