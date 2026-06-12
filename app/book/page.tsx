"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar, Clock, User, Mail, Building2, MessageSquare,
  ArrowLeft, ArrowRight, CheckCircle, Zap, ChevronLeft, ChevronRight,
  Sparkles, Search, Monitor, Code, Compass, Phone,
} from "lucide-react";
import ProsBotPanel from "@/components/ProsBotPanel";
import { MEETING_TYPES, type MeetingType, type PlanKey } from "@/lib/types";
import { PLANS } from "@/lib/stripe";
import { trackBooking } from "@/lib/analytics";

/* ─── Constants ──────────────────────────────────────────────────────────── */

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "13:00", "13:30", "14:00", "14:30", "15:00",
  "15:30", "16:00", "16:30", "17:00",
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CONFETTI_COLORS = ["#e8420a", "#ff6b35", "#ffd700", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316"];

const MEETING_ICONS: Record<MeetingType, typeof Search> = {
  discovery: Search,
  demo: Monitor,
  technical: Code,
  strategy: Compass,
};

const MEETING_ACCENT_COLORS: Record<MeetingType, string> = {
  discovery: "#3b82f6",
  demo: "#e8420a",
  technical: "#a855f7",
  strategy: "#22c55e",
};

// Deterministic distribution via golden ratio — no hydration mismatch
const φ = 1.6180339887;
const CONFETTI_PIECES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: (i * φ * 100) % 100,
  delay: (i * 0.0416) % 2.5,
  duration: 2.5 + (i * 0.0333) % 2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  width: 6 + (i % 8),
  height: 8 + (i % 7),
}));

function classNames(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Confetti overlay ───────────────────────────────────────────────────── */

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {CONFETTI_PIECES.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: 2,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday-first
}

function isPastDay(year: number, month: number, day: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(year, month, day);
  check.setHours(0, 0, 0, 0);
  return check < today;
}

function isWeekend(year: number, month: number, day: number) {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */

function BookPageInner() {
  const searchParams = useSearchParams();
  const gmapsRef = searchParams.get("ref");
  const gmapsLid = searchParams.get("lid");
  const planParam = searchParams.get("plan");

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [meetingType, setMeetingType] = useState<MeetingType>("demo");
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [countdown, setCountdown] = useState(3);

  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const refreshBookedSlots = useCallback(() => {
    setSlotsLoading(true);
    fetch("/prospecting-os/api/appointments")
      .then(r => r.json())
      .then((data: Array<{ date: string; time: string }>) => {
        setBookedSlots(new Set(data.map(a => `${a.date}|${a.time}`)));
      })
      .catch(() => { })
      .finally(() => setSlotsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/prospecting-os/api/auth/google-calendar/status")
      .then(r => r.json())
      .then(d => setCalendarConnected(d.connected))
      .catch(() => setCalendarConnected(false));
    refreshBookedSlots();
  }, [refreshBookedSlots]);

  // Inject Turnstile script
  useEffect(() => {
    if (!turnstileSiteKey) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => {
      const existing = document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (existing) document.head.removeChild(existing);
    };
  }, [turnstileSiteKey]);

  // Auto-redirect from confirmation after 3 seconds + countdown
  useEffect(() => {
    if (step !== 5) return;
    setCountdown(3);
    const interval = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    const timeout = setTimeout(() => {
      refreshBookedSlots();
      setStep(1);
      setMeetingType("demo");
      setSelectedDate(null);
      setSelectedTime(null);
      setName(""); setEmail(""); setCompany(""); setNotes(""); setPhone(""); setError("");
    }, 3000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [step, refreshBookedSlots]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const canGoNext = useMemo(() => {
    const now = new Date();
    const nextMonth = new Date(viewYear, viewMonth + 1, 0);
    return nextMonth > now;
  }, [viewYear, viewMonth]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }, [viewMonth, canGoNext]);

  const selectDate = useCallback((year: number, month: number, day: number) => {
    if (isPastDay(year, month, day) || isWeekend(year, month, day)) return;
    setSelectedDate(formatDate(year, month, day));
    setSelectedTime(null);
  }, []);

  const confirmDateTime = useCallback(() => {
    if (selectedDate && selectedTime) setStep(4);
  }, [selectedDate, selectedTime]);

  const submit = useCallback(async () => {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email."); return; }
    setError("");
    setSubmitting(true);
    const turnstileToken = typeof window !== "undefined" && (window as any).turnstile?.getResponse?.() || "";
    try {
      const res = await fetch("/prospecting-os/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate, time: selectedTime, name: name.trim(),
          email: email.trim(), company: company.trim(),
          notes: gmapsRef === "gmaps" && gmapsLid
            ? (notes.trim() ? `${notes.trim()}  |  ref=gmaps&lid=${gmapsLid}` : `ref=gmaps&lid=${gmapsLid}`)
            : notes.trim(),
          phone: phone.trim(),
          type: meetingType,
          duration: MEETING_TYPES[meetingType].duration,
          timezone: userTimezone,
          plan: planParam || undefined,
          turnstileToken,
        }),
      });
      if (res.status === 409) {
        const body = await res.json();
        setError(body.error || "This time slot is already booked. Please choose another.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error("Failed");
      if (selectedDate && selectedTime) {
        setBookedSlots(prev => { const next = new Set(prev); next.add(`${selectedDate}|${selectedTime}`); return next; });
      }
      // Fire conversion event (email is hashed inside trackBooking via Web Crypto)
      trackBooking({ type: meetingType, email: email.trim() }).catch(() => { /* never block UX */ });
      setStep(5);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }, [name, email, company, notes, phone, selectedDate, selectedTime, meetingType, userTimezone]);

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{
      background: "#0e0d0a", color: "#f5f4f1",
      fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
      "--bg-primary": "#0e0d0a", "--bg-secondary": "#141310",
      "--bg-card": "#1a1917", "--bg-card-hover": "#1f1e1b",
      "--bg-input": "#1a1a1a", "--text-primary": "#f5f4f1",
      "--text-secondary": "#b0aeaa", "--text-tertiary": "#7a7875",
      "--border": "rgba(255,255,255,0.08)", "--border-card": "rgba(255,255,255,0.06)",
      "--accent": "#e8420a", "--accent-hover": "#ff6b35",
      "--accent-glow": "rgba(232,66,10,0.3)", "--accent-subtle": "rgba(232,66,10,0.08)",
      "--badge-bg": "rgba(232,66,10,0.12)", "--badge-text": "#ff8a5c",
      "--success": "#22c55e", "--success-bg": "rgba(34,197,94,0.1)",
    } as React.CSSProperties}>

      <Confetti active={step === 5} />

      {/* ══════ Nav ══════ */}
      <nav className="flex-shrink-0 z-50" style={{ background: "rgba(14,13,10,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <img
              src="/prospecting-os/assets/Logo_Icon.png"
              alt="Prospecting OS"
              className="w-7 h-7 rounded-lg object-contain"
            />
            <span className="text-[15px] font-semibold tracking-tight">
              <span className="text-white">Prospecting</span>
              <span className="text-[#E8420a]">OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-medium" style={{ color: "var(--text-tertiary, #7a7875)" }}>

            {/* Calendar status indicator */}
            {calendarConnected === true ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "#22c55e" }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#22c55e" }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#22c55e" }} />
                </span>
                <span className="hidden sm:inline">Calendar Connected</span>
              </span>
            ) : calendarConnected === false ? (
              <Link
                href="/api/auth/google-calendar"
                title="Connect Google Calendar to get notifications for new bookings"
                className="flex items-center gap-1.5 text-[11px] font-medium transition-opacity hover:opacity-80 no-underline"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Calendar size={13} />
                <span className="hidden sm:inline">Connect Calendar</span>
              </Link>
            ) : null}

            <span style={{ color: "var(--border)" }}>|</span>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: step >= 1 ? "var(--accent, #e8420a)" : "var(--bg-input, #1a1a1a)", color: step >= 1 ? "#fff" : "var(--text-tertiary)" }}>1</span>
            <span style={{ color: step >= 1 ? "var(--text-primary)" : undefined }}>Type</span>
            <span style={{ color: "var(--text-tertiary)" }}>→</span>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: step >= 2 ? "var(--accent, #e8420a)" : "var(--bg-input, #1a1a1a)", color: step >= 2 ? "#fff" : "var(--text-tertiary)" }}>2</span>
            <span style={{ color: step >= 2 ? "var(--text-primary)" : undefined }}>Date</span>
            <span style={{ color: "var(--text-tertiary)" }}>→</span>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: step >= 3 ? "var(--accent, #e8420a)" : "var(--bg-input, #1a1a1a)", color: step >= 3 ? "#fff" : "var(--text-tertiary)" }}>3</span>
            <span style={{ color: step >= 3 ? "var(--text-primary)" : undefined }}>Time</span>
            <span style={{ color: "var(--text-tertiary)" }}>→</span>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: step >= 4 ? "var(--accent, #e8420a)" : "var(--bg-input, #1a1a1a)", color: step >= 4 ? "#fff" : "var(--text-tertiary)" }}>4</span>
            <span style={{ color: step >= 4 ? "var(--text-primary)" : undefined }}>Details</span>
          </div>
        </div>
      </nav>

      {/* ══════ Main ══════ */}
      <div className="max-w-6xl mx-auto px-6 py-3 lg:py-4 flex-1 min-h-0 overflow-hidden w-full">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-5 h-full">
          <div className="flex-1 min-w-0 overflow-y-auto">

            {step === 5 ? (
              /* ══════════════════════ STEP 5 — Confirmation ════════════════ */
              <div className="text-center py-12 animate-scale-in">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <CheckCircle size={40} style={{ color: "var(--success, #22c55e)" }} />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight mb-3">You&apos;re Booked!</h1>
                <p className="text-base mb-8" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                  A confirmation has been sent to <strong style={{ color: "var(--text-primary, #f5f4f1)" }}>{email}</strong>.
                </p>
                <div className="inline-flex flex-col gap-3 p-6 rounded-xl mb-6 text-left" style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}>
                  <div className="flex items-center gap-3">
                    <Calendar size={18} style={{ color: "var(--accent, #e8420a)" }} />
                    <span className="font-semibold">{selectedDate}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock size={18} style={{ color: "var(--accent, #e8420a)" }} />
                    <span className="font-semibold">{selectedTime}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Zap size={18} style={{ color: "var(--accent, #e8420a)" }} />
                    <span className="font-semibold">
                      {MEETING_TYPES[meetingType].label} &mdash; {MEETING_TYPES[meetingType].duration} min
                    </span>
                  </div>
                </div>

                {/* Countdown + progress bar */}
                <p className="text-sm mb-3" style={{ color: "var(--text-tertiary)" }}>
                  Returning to booking page in{" "}
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>{countdown}</span>s&hellip;
                </p>
                <div style={{ width: 160, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 999, margin: "0 auto 28px" }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    background: "var(--accent, #e8420a)",
                    width: `${((3 - countdown) / 3) * 100}%`,
                    transition: "width 1s linear",
                  }} />
                </div>

                <a href="/" className="inline-flex items-center gap-2 font-semibold text-sm px-6 py-3 rounded-full transition-all no-underline" style={{ background: "var(--accent, #e8420a)", color: "#fff" }}>
                  Back to Home <ArrowRight size={14} />
                </a>
              </div>
            ) : (
              <>
                {/* ══════ Header ══════ */}
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1.5 rounded-full" style={{ background: "var(--badge-bg, rgba(232,66,10,0.12))", color: "var(--badge-text, #ff8a5c)" }}>
                    Book a Demo
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight mb-1">Schedule Your Demo</h1>
                  <p className="text-base max-w-md mx-auto" style={{ color: "var(--text-secondary, #b0aeaa)" }}>
                    See how Prospecting OS finds 500+ qualified leads every month — in a 20-minute walkthrough.
                  </p>
                  {planParam && PLANS[planParam as PlanKey] && (
                    <div className="inline-flex items-center gap-3 mt-4 px-5 py-3 rounded-xl" style={{ background: "rgba(232,66,10,0.06)", border: "1px solid rgba(232,66,10,0.15)" }}>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {PLANS[planParam as PlanKey].name}
                      </span>
                      <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                        {PLANS[planParam as PlanKey].displaySetup}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {PLANS[planParam as PlanKey].displayMonthly}
                      </span>
                    </div>
                  )}
                </div>

                {/* ══════════════════════ STEP 1 — Meeting Type ════════════ */}
                {step === 1 && (
                  <div className="animate-fade-up">
                    <div className="rounded-2xl p-4 lg:p-5" style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}>
                      <h2 className="text-base font-extrabold tracking-tight mb-1">Choose Your Meeting Type</h2>
                      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Select the type of session that best fits your needs.</p>

                      <div className="grid grid-cols-2 gap-3">
                        {(Object.keys(MEETING_TYPES) as MeetingType[]).map(type => {
                          const Icon = MEETING_ICONS[type];
                          const isSelected = meetingType === type;
                          const accentColor = MEETING_ACCENT_COLORS[type];
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setMeetingType(type)}
                              className="rounded-xl p-4 text-left transition-all cursor-pointer"
                              style={{
                                background: isSelected ? "rgba(232,66,10,0.06)" : "rgba(255,255,255,0.02)",
                                border: `1px solid ${isSelected ? accentColor : "var(--border-card, rgba(255,255,255,0.06))"}`,
                                outline: "none",
                              }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                                  style={{
                                    background: isSelected ? `${accentColor}22` : "rgba(255,255,255,0.04)",
                                    color: isSelected ? accentColor : "var(--text-secondary)",
                                  }}
                                >
                                  <Icon size={16} />
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-tertiary)" }}>
                                  {MEETING_TYPES[type].duration} min
                                </span>
                              </div>
                              <h3 className="text-sm font-bold tracking-tight mb-0.5" style={{ color: "var(--text-primary)" }}>
                                {MEETING_TYPES[type].label}
                              </h3>
                              <p className="text-[11px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                                {MEETING_TYPES[type].description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => setStep(2)}
                      className="w-full mt-3 h-11 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ background: "var(--accent, #e8420a)", color: "#fff" }}
                    >
                      Continue with {MEETING_TYPES[meetingType].label}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* ══════════════════════ STEP 2 — Date Picker ══════════════ */}
                {step === 2 && (
                  <div className="animate-fade-up">
                    <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm font-medium mb-3 transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
                      <ArrowLeft size={14} /> Back to meeting type
                    </button>

                    <div className="rounded-2xl p-4 lg:p-5" style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}>
                      {/* Month nav */}
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={prevMonth} className="p-2 rounded-lg transition-colors hover:bg-white/5" aria-label="Previous month">
                          <ChevronLeft size={18} style={{ color: "var(--text-secondary)" }} />
                        </button>
                        <h2 className="text-lg font-extrabold tracking-tight">
                          {MONTHS[viewMonth]} {viewYear}
                        </h2>
                        <button onClick={nextMonth} className={classNames("p-2 rounded-lg transition-colors", canGoNext && "hover:bg-white/5 cursor-pointer", !canGoNext && "opacity-30 cursor-not-allowed")} aria-label="Next month" disabled={!canGoNext}>
                          <ChevronRight size={18} style={{ color: "var(--text-secondary)" }} />
                        </button>
                      </div>

                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-1">
                        {DAYS.map(d => (
                          <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider py-1" style={{ color: "var(--text-tertiary, #7a7875)" }}>
                            {d}
                          </div>
                        ))}
                      </div>

                      {/* Day grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: firstDay }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const past = isPastDay(viewYear, viewMonth, day);
                          const weekend = isWeekend(viewYear, viewMonth, day);
                          const disabled = past || weekend;
                          const dateStr = formatDate(viewYear, viewMonth, day);
                          const isSelected = selectedDate === dateStr;
                          return (
                            <button
                              key={day}
                              disabled={disabled}
                              onClick={() => selectDate(viewYear, viewMonth, day)}
                              className={classNames(
                                "h-10 rounded-xl text-sm font-semibold transition-all",
                                disabled && "cursor-not-allowed",
                                !disabled && !isSelected && "hover:bg-white/5 cursor-pointer",
                                isSelected && "text-white cursor-pointer",
                              )}
                              style={{
                                ...(isSelected ? { background: "var(--accent, #e8420a)" } : { color: "var(--text-primary, #f5f4f1)" }),
                                ...(disabled ? { opacity: weekend ? 0.15 : 0.2 } : {}),
                              }}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      disabled={!selectedDate}
                      onClick={() => setStep(3)}
                      className="w-full mt-3 h-11 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: selectedDate ? "var(--accent, #e8420a)" : "var(--bg-input, #1a1a1a)", color: selectedDate ? "#fff" : "var(--text-tertiary)" }}
                    >
                      {selectedDate ? `Continue — ${selectedDate}` : "Select a date to continue"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* ══════════════════════ STEP 3 — Time Slots ══════════════ */}
                {step === 3 && (
                  <div className="animate-fade-up">
                    <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm font-medium mb-3 transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
                      <ArrowLeft size={14} /> {selectedDate}
                    </button>

                    {/* Timezone display */}
                    <div className="flex items-center gap-1.5 mb-3" style={{ color: "var(--text-tertiary)" }}>
                      <Clock size={12} />
                      <span className="text-xs">Times shown in {userTimezone}</span>
                    </div>

                    <div className="rounded-2xl p-4 lg:p-5" style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}>
                      {slotsLoading ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-2.5">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-sm font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>Morning</h3>
                          <div className="grid grid-cols-3 gap-2.5 mb-4">
                            {TIME_SLOTS.filter(t => parseInt(t) < 12).map(t => {
                              const isSel = selectedTime === t;
                              const isBooked = selectedDate ? bookedSlots.has(`${selectedDate}|${t}`) : false;
                              return (
                                <button
                                  key={t}
                                  disabled={isBooked}
                                  onClick={() => !isBooked && setSelectedTime(t)}
                                  className="h-10 rounded-xl text-sm font-semibold transition-all border"
                                  style={{
                                    background: isSel ? "var(--accent, #e8420a)" : isBooked ? "rgba(255,255,255,0.02)" : "transparent",
                                    color: isBooked ? "var(--text-tertiary, #7a7875)" : isSel ? "#fff" : "var(--text-primary, #f5f4f1)",
                                    borderColor: isSel ? "var(--accent, #e8420a)" : isBooked ? "rgba(255,255,255,0.04)" : "var(--border, rgba(255,255,255,0.08))",
                                    cursor: isBooked ? "not-allowed" : "pointer",
                                    opacity: isBooked ? 0.4 : 1,
                                    textDecoration: isBooked ? "line-through" : "none",
                                  }}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>

                          <h3 className="text-sm font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>Afternoon</h3>
                          <div className="grid grid-cols-3 gap-2.5">
                            {TIME_SLOTS.filter(t => parseInt(t) >= 12).map(t => {
                              const isSel = selectedTime === t;
                              const isBooked = selectedDate ? bookedSlots.has(`${selectedDate}|${t}`) : false;
                              return (
                                <button
                                  key={t}
                                  disabled={isBooked}
                                  onClick={() => !isBooked && setSelectedTime(t)}
                                  className="h-10 rounded-xl text-sm font-semibold transition-all border"
                                  style={{
                                    background: isSel ? "var(--accent, #e8420a)" : isBooked ? "rgba(255,255,255,0.02)" : "transparent",
                                    color: isBooked ? "var(--text-tertiary, #7a7875)" : isSel ? "#fff" : "var(--text-primary, #f5f4f1)",
                                    borderColor: isSel ? "var(--accent, #e8420a)" : isBooked ? "rgba(255,255,255,0.04)" : "var(--border, rgba(255,255,255,0.08))",
                                    cursor: isBooked ? "not-allowed" : "pointer",
                                    opacity: isBooked ? 0.4 : 1,
                                    textDecoration: isBooked ? "line-through" : "none",
                                  }}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      disabled={!selectedTime}
                      onClick={confirmDateTime}
                      className="w-full mt-3 h-11 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: selectedTime ? "var(--accent, #e8420a)" : "var(--bg-input, #1a1a1a)", color: selectedTime ? "#fff" : "var(--text-tertiary)" }}
                    >
                      {selectedTime ? `Confirm — ${selectedDate} at ${selectedTime}` : "Pick a time slot"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* ══════════════════════ STEP 4 — Booking Form ════════════ */}
                {step === 4 && (
                  <div className="animate-fade-up">
                    <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-sm font-medium mb-3 transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
                      <ArrowLeft size={14} /> {selectedDate} at {selectedTime}
                    </button>

                    <div className="rounded-2xl p-4 lg:p-5 space-y-4" style={{ background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))" }}>
                      {/* Name */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                          <User size={12} /> Full Name *
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all bg-[var(--bg-input,#1a1a1a)] border border-[var(--border,rgba(255,255,255,0.08))] text-[var(--text-primary)] font-[inherit] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(232,66,10,0.08)]"
                        />
                      </div>
                      {/* Email */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                          <Mail size={12} /> Work Email *
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all bg-[var(--bg-input,#1a1a1a)] border border-[var(--border,rgba(255,255,255,0.08))] text-[var(--text-primary)] font-[inherit] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(232,66,10,0.08)]"
                        />
                      </div>
                      {/* Phone */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                          <Phone size={12} /> Phone
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+1 (555) 123-4567"
                          className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all bg-[var(--bg-input,#1a1a1a)] border border-[var(--border,rgba(255,255,255,0.08))] text-[var(--text-primary)] font-[inherit] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(232,66,10,0.08)]"
                        />
                      </div>
                      {/* Company */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                          <Building2 size={12} /> Company
                        </label>
                        <input
                          type="text"
                          value={company}
                          onChange={e => setCompany(e.target.value)}
                          placeholder="Acme Inc."
                          className="w-full h-11 rounded-xl px-4 text-sm outline-none transition-all bg-[var(--bg-input,#1a1a1a)] border border-[var(--border,rgba(255,255,255,0.08))] text-[var(--text-primary)] font-[inherit] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(232,66,10,0.08)]"
                        />
                      </div>
                      {/* Notes */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                          <MessageSquare size={12} /> Notes
                        </label>
                        <textarea
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="Anything we should know before the call?"
                          rows={3}
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none bg-[var(--bg-input,#1a1a1a)] border border-[var(--border,rgba(255,255,255,0.08))] text-[var(--text-primary)] font-[inherit] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(232,66,10,0.08)]"
                        />
                      </div>

                      {/* Turnstile CAPTCHA */}
                      {turnstileSiteKey && (
                        <div className="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
                      )}

                      {error && (
                        <p className="text-xs font-medium" style={{ color: "var(--accent, #e8420a)" }}>{error}</p>
                      )}
                    </div>

                    <button
                      onClick={submit}
                      disabled={submitting || !name.trim() || !email.trim()}
                      className="w-full mt-3 h-11 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: "var(--accent, #e8420a)", color: "#fff" }}
                    >
                      {submitting ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>Confirm Booking <ArrowRight size={14} /></>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right — Pros Bot Conversational Agent */}
          <div className="hidden lg:flex lg:flex-col w-80 xl:w-96 flex-shrink-0 h-full min-h-0">
            <div className="mb-2 flex items-center gap-2 px-1 flex-shrink-0">
              <Sparkles size={16} style={{ color: "var(--accent, #e8420a)" }} />
              <span className="text-sm font-bold tracking-tight">Book via Chat</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--badge-bg)", color: "var(--badge-text)" }}>AI</span>
            </div>
            <div className="flex-1 min-h-0">
              <ProsBotPanel embedded bookedSlots={bookedSlots} />
            </div>
          </div>

          {/* Mobile — slide-up chat toggle */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
            <ProsBotPanel embedded bookedSlots={bookedSlots} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookPageInner />
    </Suspense>
  );
}
