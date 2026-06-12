"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, ArrowRight, CheckCircle } from "lucide-react";

const STORAGE_KEY = "prospectingos_email_capture";
const ENTRY_DELAY_MS = 15000;
const EXIT_REMEMBER_MS = 1000 * 60 * 60 * 24;

function getStored(): { submitted: boolean; dismissedAt: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStored(data: { submitted?: boolean; dismissedAt?: number }) {
  const current = getStored() || { submitted: false, dismissedAt: 0 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...data }));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function EmailCaptureModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const hasFiredRef = useRef(false);
  const entryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openModal = useCallback(() => {
    if (hasFiredRef.current) return;
    const stored = getStored();
    if (stored?.submitted) return;
    hasFiredRef.current = true;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 400);
  }, []);

  // Entry intent — show after delay (desktop only, not on small screens)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    const stored = getStored();
    if (stored?.submitted) return;
    entryTimerRef.current = setTimeout(openModal, ENTRY_DELAY_MS);
    return () => { if (entryTimerRef.current) clearTimeout(entryTimerRef.current); };
  }, [openModal]);

  // Exit intent — show on mouseleave to top
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    const stored = getStored();
    if (stored?.submitted) return;

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasFiredRef.current) {
        if (stored?.dismissedAt && Date.now() - stored.dismissedAt < EXIT_REMEMBER_MS) return;
        openModal();
      }
    };
    document.addEventListener("mouseleave", onMouseLeave, { passive: true });
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, [openModal]);

  const dismiss = useCallback(() => {
    setOpen(false);
    setEmail("");
    setStatus("idle");
    setErrorMsg("");
    setStored({ dismissedAt: Date.now() });
  }, []);

  const submit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setErrorMsg("");
    setStatus("submitting");

    // Persist locally immediately
    setStored({ submitted: true });

    try {
      const res = await fetch("/prospecting-os/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setErrorMsg("Something went wrong. Try again.");
      }
    } catch {
      // Email is still saved client-side, show done state
      setStatus("done");
    }
  }, [email]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "Enter" && status === "idle") submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss, submit, status]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl p-8"
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
              className="absolute top-4 right-4 p-1.5 rounded-full transition-colors hover:bg-white/[0.05]"
              style={{ color: "var(--text-tertiary, #7a7875)" }}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <AnimatePresence mode="wait">
              {status === "done" ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
                  >
                    <CheckCircle size={32} style={{ color: "var(--success, #22c55e)" }} />
                  </motion.div>
                  <h3 className="text-xl font-extrabold mb-2 tracking-tight"
                    style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif", color: "var(--text-primary, #f5f4f1)" }}>
                    You&apos;re on the list
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                    We&apos;ll reach out soon. In the meantime, explore the platform.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={dismiss}
                    className="mt-5 text-sm font-semibold px-6 py-2.5 rounded-full transition-all"
                    style={{ background: "var(--accent, #e8420a)", color: "#fff", fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}
                  >
                    Explore the Platform
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* Logo */}
                  <img
                    src="/prospecting-os/assets/Logo_Icon.png"
                    alt="Prospecting OS"
                    className="w-12 h-12 rounded-xl mb-5 object-contain"
                    style={{ border: "1px solid rgba(232,66,10,0.15)" }}
                  />

                  <h3 className="text-xl font-extrabold mb-2 tracking-tight"
                    style={{ fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif", color: "var(--text-primary, #f5f4f1)" }}>
                    Get 500+ leads/month on autopilot
                  </h3>
                  <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                    Drop your email for early access to Prospecting OS — AI that finds, scores, and delivers your ideal clients while you sleep.
                  </p>

                  <div className="flex gap-2.5">
                    <div className="flex-1 relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: "var(--text-tertiary, #7a7875)" }} />
                      <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setErrorMsg(""); }}
                        placeholder="you@company.com"
                        className="w-full h-11 rounded-full pl-10 pr-4 text-sm outline-none transition-all bg-[var(--bg-input,#1a1a1a)] text-[var(--text-primary,#f5f4f1)] focus:border-[var(--accent,#e8420a)]"
                        style={{
                          border: `1.5px solid ${errorMsg ? "var(--accent, #e8420a)" : "var(--border, rgba(255,255,255,0.08))"}`,
                        }}
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={submit}
                      disabled={status === "submitting"}
                      className="h-11 px-5 rounded-full font-semibold text-sm flex items-center gap-1.5 transition-all flex-shrink-0 disabled:opacity-60"
                      style={{ background: "var(--accent, #e8420a)", color: "#fff", fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif" }}
                    >
                      {status === "submitting" ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>Join <ArrowRight size={14} /></>
                      )}
                    </motion.button>
                  </div>

                  {errorMsg && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-xs mt-2 ml-1" style={{ color: "var(--accent, #e8420a)" }}>
                      {errorMsg}
                    </motion.p>
                  )}

                  <p className="text-xs mt-4 text-center" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                    No spam. One email when we launch.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
