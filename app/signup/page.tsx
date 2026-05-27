"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trackSignup } from "@/lib/analytics";

function SignUpForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setSubmitting(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() } },
    });

    if (authError) { setError(authError.message); setSubmitting(false); return; }

    // Fire signup conversion (email hashed inside trackSignup via Web Crypto)
    trackSignup({ email: email.trim() }).catch(() => { /* never block UX */ });

    router.push("/onboarding");
    router.refresh();
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-3xl p-8 glass-card">
        <div className="flex flex-col items-center text-center mb-8">
          <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" className="w-14 h-14 rounded-xl mb-5" />
          <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>Create Your Account</h1>
          <p className="text-[13px] mt-1.5" style={{ color: "var(--ink-3)" }}>Get started with Prospecting OS</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--ink-4)" }}>
              <User size={11} /> Full Name
            </label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full h-11 rounded-xl px-4 text-[13px] glass-input"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--ink-4)" }}>
              <Mail size={11} /> Work Email
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-11 rounded-xl px-4 text-[13px] glass-input"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--ink-4)" }}>
              <Lock size={11} /> Password
            </label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full h-11 rounded-xl px-4 text-[13px] glass-input"
            />
          </div>

          {error && <p className="text-[12px] font-medium" style={{ color: "var(--negative)" }}>{error}</p>}

          <button
            type="submit" disabled={submitting}
            className="w-full h-11 rounded-full font-semibold text-[13px] flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#000", fontFamily: "inherit" }}
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>Create Account <ArrowRight size={14} /></>
            )}
          </button>
        </form>

        <p className="text-center text-[13px] mt-6" style={{ color: "var(--ink-3)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold transition-opacity hover:opacity-80" style={{ color: "var(--accent-ink)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
      }}
    >
      {/* Subtle brass glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(232,168,64,0.04) 0%, transparent 70%)",
        }}
      />

      <nav
        className="flex-shrink-0 relative z-10"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-[15px] tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
              Prospecting<span style={{ color: "var(--accent)" }}>OS</span>
            </span>
          </Link>
        </div>
      </nav>

      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
          </div>
        }
      >
        <SignUpForm />
      </Suspense>
    </div>
  );
}
