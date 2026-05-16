"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/prospecting-os/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setSubmitting(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
      <div className="w-full max-w-md rounded-2xl p-8 glass-card">
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/prospecting-os/assets/Logo_Icon.png"
            alt="Prospecting OS"
            className="w-14 h-14 rounded-xl mb-4"
          />
          <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#f5f4f1" }}>
            Welcome Back
          </h1>
          <p className="text-sm" style={{ color: "#b0aeaa" }}>
            Sign in to your ProspectingOS account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7a7875" }}>
              <Mail size={12} /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-11 rounded-xl px-4 text-sm glass-input"
              style={{ fontFamily: "inherit" }}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7a7875" }}>
              <Lock size={12} /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-11 rounded-xl px-4 text-sm glass-input"
              style={{ fontFamily: "inherit" }}
            />
          </div>

          {error && (
            <p className="text-xs font-medium" style={{ color: "#e8420a" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #e8420a, #ff6b35)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(232,66,10,0.3)",
            }}
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "#b0aeaa" }}>
          Don&apos;t have an account?{" "}
          <Link href="/prospecting-os/signup" className="font-semibold transition-opacity hover:opacity-80" style={{ color: "#e8420a" }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col galaxy-bg"
      style={{
        background: "#08080c",
        color: "#f5f4f1",
        fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        className="flex-shrink-0 relative z-20"
        style={{ background: "rgba(8,8,12,0.7)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
          <Link href="/prospecting-os" className="flex items-center gap-2.5 no-underline">
            <img
              src="/prospecting-os/assets/Logo_Icon.png"
              alt="Prospecting OS"
              className="w-7 h-7 rounded-lg"
            />
            <span className="font-extrabold text-lg tracking-tight" style={{ color: "#f5f4f1" }}>
              Prospecting<span style={{ color: "#e8420a" }}>OS</span>
            </span>
          </Link>
        </div>
      </nav>

      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center relative z-10">
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
