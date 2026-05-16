"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, X, Mail, ArrowRight, CheckCircle } from "lucide-react";

const STORAGE_KEY = "prospectingos_email_capture";
const ENTRY_DELAY_MS = 12000; // 12s after page load
const EXIT_REMEMBER_MS = 1000 * 60 * 60 * 24; // don't re-trigger exit for 24h

function getStored(): { submitted: boolean; dismissedAt: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStored(data: { submitted?: boolean; dismissedAt?: number }) {
  const current = getStored() || { submitted: false, dismissedAt: 0 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...data }));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

interface Props {
  openDelayMs?: number;
}

export default function EmailCaptureModal({ openDelayMs = ENTRY_DELAY_MS }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState("");
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFiredRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ─── Open modal ─────────────────────────────────────────────────────── */
  const openModal = useCallback(() => {
    if (hasFiredRef.current) return;
    const stored = getStored();
    if (stored?.submitted) return;
    hasFiredRef.current = true;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  /* ─── Entry intent — show after delay ────────────────────────────────── */
  useEffect(() => {
    const stored = getStored();
    if (stored?.submitted) return;
    delayRef.current = setTimeout(openModal, openDelayMs);
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [openDelayMs, openModal]);

  /* ─── Exit intent — show on mouseleave to top ───────────────────────── */
  useEffect(() => {
    const stored = getStored();
    if (stored?.submitted) return;

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasFiredRef.current) {
        // Respect cooldown for exit re-trigger
        if (stored?.dismissedAt && Date.now() - stored.dismissedAt < EXIT_REMEMBER_MS) return;
        openModal();
      }
    };

    document.addEventListener("mouseleave", onMouseLeave, { passive: true });
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, [openModal]);

  /* ─── Dismiss ────────────────────────────────────────────────────────── */
  const dismiss = useCallback(() => {
    setOpen(false);
    setStored({ dismissedAt: Date.now() });
  }, []);

  /* ─── Submit ─────────────────────────────────────────────────────────── */
  const submit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setStatus("submitting");

    // Persist locally
    setStored({ submitted: true });

    // Try sending to the API
    try {
      await fetch("/prospecting-os/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
    } catch {
      // Non-critical — email is saved client-side either way
    }

    setStatus("done");
  }, [email]);

  /* ─── Keyboard ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "Enter" && status === "idle") submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss, submit, status]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      onClick={dismiss}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl p-8 animate-scale-in"
        style={{
          background: "var(--bg-card, #1a1917)",
          border: "1px solid var(--border-card, rgba(255,255,255,0.06))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full transition-colors"
          style={{ color: "var(--text-tertiary, #7a7875)" }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {status === "done" ? (
          /* ─── Success state ──────────────────────────────────────────── */
          <div className="text-center py-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <CheckCircle size={32} style={{ color: "var(--success, #22c55e)" }} />
            </div>
            <h3
              className="text-xl font-extrabold mb-2 tracking-tight"
              style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif", color: "var(--text-primary, #f5f4f1)" }}
            >
              You&apos;re on the list
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
              We&apos;ll reach out soon. In the meantime, explore the platform.
            </p>
            <button
              onClick={dismiss}
              className="mt-5 text-sm font-semibold px-6 py-2 rounded-full transition-all"
              style={{
                background: "var(--accent, #e8420a)",
                color: "#fff",
              }}
            >
              Explore the Platform
            </button>
          </div>
        ) : (
          /* ─── Email form ──────────────────────────────────────────────── */
          <>
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
              style={{ background: "rgba(232,66,10,0.1)", border: "1px solid rgba(232,66,10,0.15)" }}
            >
              <Zap size={22} style={{ color: "var(--accent, #e8420a)" }} />
            </div>

            {/* Heading */}
            <h3
              className="text-xl font-extrabold mb-2 tracking-tight"
              style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif", color: "var(--text-primary, #f5f4f1)" }}
            >
              Get 500+ leads/month on autopilot
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
              Drop your email for early access to Prospecting OS — AI that finds, scores, and delivers your ideal clients while you sleep.
            </p>

            {/* Input */}
            <div className="flex gap-2.5">
              <div className="flex-1 relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--text-tertiary, #7a7875)" }}
                />
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@company.com"
                  className="w-full h-11 rounded-full pl-10 pr-4 text-sm outline-none transition-all"
                  style={{
                    background: "var(--bg-input, #1a1a1a)",
                    border: `1.5px solid ${error ? "var(--accent, #e8420a)" : "var(--border, rgba(255,255,255,0.08))"}`,
                    color: "var(--text-primary, #f5f4f1)",
                    fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--accent, #e8420a)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,66,10,0.08)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = error ? "var(--accent, #e8420a)" : "var(--border, rgba(255,255,255,0.08))"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <button
                onClick={submit}
                disabled={status === "submitting"}
                className="h-11 px-5 rounded-full font-semibold text-sm flex items-center gap-1.5 transition-all flex-shrink-0 disabled:opacity-60"
                style={{
                  background: "var(--accent, #e8420a)",
                  color: "#fff",
                  fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
                }}
              >
                {status === "submitting" ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Join <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="text-xs mt-2 ml-1" style={{ color: "var(--accent, #e8420a)" }}>{error}</p>
            )}

            {/* Footer text */}
            <p className="text-xs mt-4 text-center" style={{ color: "var(--text-tertiary, #7a7875)" }}>
              No spam. One email when we launch.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
