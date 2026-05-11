"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePortalAuth } from "@/lib/portal-auth";
import { Lock, Building2, Zap, Loader2 } from "lucide-react";

export default function PortalLoginPage() {
  const { login, state } = usePortalAuth();
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (state.client) {
    router.push("/portal");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !password.trim()) return;
    setSubmitting(true);
    const ok = await login(company.trim(), password.trim());
    setSubmitting(false);
    if (ok) router.push("/portal");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bg">
      <div className="w-[380px] max-w-[95vw]">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: "rgba(201,168,124,0.08)", border: "1px solid rgba(201,168,124,0.18)" }}>
            <Zap size={22} style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>Client Portal</h1>
          <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>Sign in to your ProOS command center</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-6 space-y-4"
          style={{ background: "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))", border: "1px solid rgba(201,168,124,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
        >
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.14em] block mb-1.5" style={{ color: "var(--ink-4)", opacity: 0.5 }}>Company Name</label>
            <div className="relative">
              <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-3)" }} />
              <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                placeholder="Enter your company name" autoFocus
                className="w-full h-10 rounded-lg pl-9 pr-3 text-[13px] outline-none transition-all duration-200"
                style={{ color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
                onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.14em] block mb-1.5" style={{ color: "var(--ink-4)", opacity: 0.5 }}>Portal Password</label>
            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-3)" }} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your portal password"
                className="w-full h-10 rounded-lg pl-9 pr-3 text-[13px] outline-none transition-all duration-200"
                style={{ color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
                onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"} />
            </div>
          </div>

          {state.error && (
            <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "rgba(212,148,132,0.08)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.15)" }}>
              {state.error}
            </div>
          )}

          <button type="submit" disabled={submitting || !company.trim() || !password.trim()}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40"
            style={{ background: "linear-gradient(90deg, rgba(201,168,124,0.16), rgba(201,168,124,0.10))", color: "var(--accent-ink)", border: "1px solid rgba(201,168,124,0.25)", boxShadow: "0 0 16px rgba(201,168,124,0.10)" }}>
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Signing in…</> : "Sign In"}
          </button>
        </form>

        <p className="text-[10px] text-center mt-4" style={{ color: "var(--ink-4)", opacity: 0.4 }}>Powered by LinkedIn ProOS</p>
      </div>
    </div>
  );
}
