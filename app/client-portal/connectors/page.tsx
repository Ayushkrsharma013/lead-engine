"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlanGate } from "@/components/client-portal/PlanGate";
import { usePortalHeader } from "@/lib/PortalHeaderContext";
import { Slack, MessageCircle, Globe, Webhook, Check, X, Loader2, Trash2 } from "lucide-react";
import type { PlanKey } from "@/lib/types";

interface CC { type:string; label:string; icon:typeof Slack; fields:{key:string;label:string;placeholder:string}[] }
const CONNECTORS:CC[]=[{type:"slack",label:"Slack",icon:Slack,fields:[{key:"webhook_url",label:"Webhook URL",placeholder:"https://hooks.slack.com/services/..."}]},{type:"telegram",label:"Telegram",icon:MessageCircle,fields:[{key:"bot_token",label:"Bot Token",placeholder:"123456:ABC-DEF..."},{key:"chat_id",label:"Chat ID",placeholder:"-100123456"}]},{type:"discord",label:"Discord",icon:Globe,fields:[{key:"webhook_url",label:"Webhook URL",placeholder:"https://discord.com/api/webhooks/..."}]},{type:"webhook",label:"Webhook",icon:Webhook,fields:[{key:"url",label:"URL",placeholder:"https://your-app.com/webhook"},{key:"secret",label:"Secret (optional)",placeholder:"shared-secret"}]}];

export default function ConnectorsPage() {
  const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [plan,setPlan]=useState<PlanKey|null>(null);const [role,setRole]=useState("");
  const [cfg,setCfg]=useState<Record<string,unknown>>({});const [modal,setModal]=useState<string|null>(null);
  const [fv,setFv]=useState<Record<string,string>>({});const [toast,setToast]=useState("");

  useEffect(()=>{ (async()=>{const me=await fetch("/prospecting-os/api/client-portal/me");if(!me.ok){setLoading(false);return}const d=await me.json();setPlan(d.profile?.plan||null);setRole(d.profile?.role||"");const c=await fetch("/prospecting-os/api/client-portal/connectors");if(c.ok)setCfg((await c.json()).connectorConfig||{});setLoading(false);})(); },[]);

  const open=(t:string)=>{setModal(t);setFv((cfg[t]as Record<string,string>)||{});};
  const save=async()=>{if(!modal)return;setSaving(true);const r=await fetch("/prospecting-os/api/client-portal/connectors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:modal,config:fv})});setSaving(false);if(r.ok){const d=await r.json();setCfg(d.connectorConfig||{});setModal(null);setToast(`${modal} connected!`);setTimeout(()=>setToast(""),2500);}else{const d=await r.json();setToast(d.error||"Failed");setTimeout(()=>setToast(""),3000);}};
  const disc=async(t:string)=>{if(!confirm(`Disconnect ${t}?`))return;await fetch(`/prospecting-os/api/client-portal/connectors?type=${t}`,{method:"DELETE"});const r=await fetch("/prospecting-os/api/client-portal/connectors");if(r.ok)setCfg((await r.json()).connectorConfig||{});setToast(`${t} disconnected`);setTimeout(()=>setToast(""),2500);};

  usePortalHeader({title:"Connector Marketplace",description:"Connect notifications to external services"});

  return (
    <PlanGate module="connector-marketplace" plan={plan} role={role}>
      <div className="p-4 lg:p-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONNECTORS.map((c,i)=>{const ok=!!cfg[c.type];const Icon=c.icon;return(<motion.div key={c.type} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*.05}} whileHover={{scale:1.02}} className="rounded-xl p-5" style={{background:"var(--surface)",border:ok?"2px solid rgba(34,197,94,0.2)":"1px solid var(--line)"}}><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2.5"><Icon size={18} style={{color:ok?"#22c55e":"var(--ink-2)"}}/><span className="text-[13px] font-semibold" style={{color:"var(--ink)"}}>{c.label}</span></div>{ok?<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{background:"rgba(34,197,94,0.1)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.2)"}}><Check size={10}/>Connected</span>:<span className="text-[10px]" style={{color:"var(--ink-4)"}}>Not connected</span>}</div><div className="flex gap-2"><motion.button onClick={()=>open(c.type)} whileHover={{scale:1.02}} className="flex-1 px-3 py-2 rounded-full text-[11px] font-semibold" style={{background:"#E84A0A",color:"#fff",border:"none",cursor:"pointer"}}>{ok?"Edit":"Configure"}</motion.button>{ok&&<motion.button onClick={()=>disc(c.type)} whileHover={{scale:1.05}} className="px-3 py-2 rounded-full text-[11px] font-semibold" style={{background:"transparent",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)",cursor:"pointer"}}><Trash2 size={12}/></motion.button>}</div></motion.div>);})}
      </div></div>

      <AnimatePresence>{modal&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}><motion.div initial={{opacity:0,scale:0.95,y:10}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:10}} className="rounded-2xl p-6 w-full max-w-md" style={{background:"var(--surface-elev)",border:"1px solid var(--line)"}}><div className="flex items-center justify-between mb-4"><h2 className="text-[15px] font-bold" style={{color:"var(--ink)"}}>Configure {CONNECTORS.find(c=>c.type===modal)?.label}</h2><button onClick={()=>setModal(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-3)"}}><X size={16}/></button></div><div className="space-y-3">{CONNECTORS.find(c=>c.type===modal)?.fields.map(f=><div key={f.key}><label className="block text-[11px] font-semibold mb-1.5" style={{color:"var(--ink-3)"}}>{f.label}</label><input type="text" value={fv[f.key]||""} onChange={e=>setFv({...fv,[f.key]:e.target.value})} placeholder={f.placeholder} className="w-full h-10 rounded-xl px-3 text-[13px]" style={{background:"var(--surface-2)",border:"1px solid var(--line)",color:"var(--ink)",outline:"none"}}/></div>)}</div><button onClick={save} disabled={saving} className="w-full h-10 mt-5 rounded-full text-[13px] font-semibold flex items-center justify-center" style={{background:"#E84A0A",color:"#fff",border:"none",cursor:"pointer",opacity:saving?0.7:1}}>{saving?<Loader2 size={14} className="animate-spin"/>:null}Save Configuration</button></motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>{toast&&<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full text-[13px] font-medium" style={{background:"var(--surface-elev)",border:"1px solid var(--line)",color:"var(--ink)",boxShadow:"var(--shadow-md)"}}>{toast}</motion.div>}</AnimatePresence>
    </PlanGate>
  );
}
