"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, User, Mail, Lock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    router.push("/prospecting-os/onboarding");
    router.refresh();
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div
        className="w-full max-w-md rounded-2xl p-6 lg:p-8"
        style={{
          background: "var(--bg-card, #1a1917)",
          border: "1px solid var(--border-card, rgba(255,255,255,0.06))",
        }}
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "var(--badge-bg, rgba(232,66,10,0.12))" }}
          >
            <Zap size={22} style={{ color: "var(--accent, #e8420a)" }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-primary, #f5f4f1)" }}>
            Create Your Account
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
            Get started with ProspectingOS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-tertiary, #7a7875)" }}
            >
              <User size={12} /> Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all"
              style={{
                background: "var(--bg-input, #1a1a1a)",
                border: "1px solid var(--border, rgba(255,255,255,0.08))",
                color: "var(--text-primary, #f5f4f1)",
                fontFamily: "inherit",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent, #e8420a)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border, rgba(255,255,255,0.08))";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-tertiary, #7a7875)" }}
            >
              <Mail size={12} /> Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all"
              style={{
                background: "var(--bg-input, #1a1a1a)",
                border: "1px solid var(--border, rgba(255,255,255,0.08))",
                color: "var(--text-primary, #f5f4f1)",
                fontFamily: "inherit",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent, #e8420a)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border, rgba(255,255,255,0.08))";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-tertiary, #7a7875)" }}
            >
              <Lock size={12} /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all"
              style={{
                background: "var(--bg-input, #1a1a1a)",
                border: "1px solid var(--border, rgba(255,255,255,0.08))",
                color: "var(--text-primary, #f5f4f1)",
                fontFamily: "inherit",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent, #e8420a)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border, rgba(255,255,255,0.08))";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {error && (
            <p className="text-xs font-medium" style={{ color: "var(--accent, #e8420a)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--accent, #e8420a)", color: "#fff" }}
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
          Already have an account?{" "}
          <Link
            href="/prospecting-os/login"
            className="font-semibold transition-opacity hover:opacity-80"
            style={{ color: "var(--accent, #e8420a)" }}
          >
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
        background: "#0e0d0a",
        color: "#f5f4f1",
        fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
        "--bg-primary": "#0e0d0a",
        "--bg-secondary": "#141310",
        "--bg-card": "#1a1917",
        "--bg-card-hover": "#1f1e1b",
        "--bg-input": "#1a1a1a",
        "--text-primary": "#f5f4f1",
        "--text-secondary": "#b0aeaa",
        "--text-tertiary": "#7a7875",
        "--border": "rgba(255,255,255,0.08)",
        "--border-card": "rgba(255,255,255,0.06)",
        "--accent": "#e8420a",
        "--accent-hover": "#ff6b35",
        "--accent-glow": "rgba(232,66,10,0.3)",
        "--accent-subtle": "rgba(232,66,10,0.08)",
        "--badge-bg": "rgba(232,66,10,0.12)",
        "--badge-text": "#ff8a5c",
        "--success": "#22c55e",
        "--success-bg": "rgba(34,197,94,0.1)",
      } as React.CSSProperties}
    >
      <nav
        className="flex-shrink-0 z-50"
        style={{
          background: "rgba(14,13,10,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
          <a
            href="/"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight no-underline"
            style={{ color: "var(--text-primary, #f5f4f1)" }}
          >
            <Zap size={18} style={{ color: "var(--accent, #e8420a)" }} />
            Prospecting<span style={{ color: "var(--accent, #e8420a)" }}>OS</span>
          </a>
        </div>
      </nav>

      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        }
      >
        <SignUpForm />
      </Suspense>
    </div>
  );
}
