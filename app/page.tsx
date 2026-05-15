"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Globe, Filter, FileText, PenLine, Bell, ArrowRight,
  ArrowDown, Menu, X, Send, Sparkles, Calendar, CheckCircle2,
} from "lucide-react";
import EmailCaptureModal from "@/components/EmailCaptureModal";
import {
  type BookingStep,
  type BookingData,
  initialBookingState,
  getNextStep,
  isBookingQuery,
  type BotMessage,
} from "@/lib/booking-chat";

/* ═══════════════════════════════════════════════════════════════════════════
   Prospecting OS — Landing Page
   ═══════════════════════════════════════════════════════════════════════════ */

const FULL_TEXT = "Your Pipeline on Autopilot.";
const ASCII_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789+-*/=<>{}[]()&|!?@#$%^&*;:,.~`".split("");

const FAQ_ITEMS = [
  { q: "Do I need a LinkedIn Sales Navigator subscription?", a: "Yes — Sales Navigator is the engine. A basic plan ($99/mo) is all you need. We'll help configure your search filters during onboarding." },
  { q: "How long does it take to go live?", a: "Basic: 4–6 hours. Pro: 2–3 days. Advanced: 1–2 weeks for email infra and CRM integration." },
  { q: "What industries does this work for?", a: "SaaS, consulting, agencies, professional services — worldwide. If your clients are on LinkedIn, our system works." },
  { q: "Will this get my domain blacklisted?", a: "No. Proper warm-up, rate limiting, and human-like patterns. Advanced plans use a secondary domain for outreach." },
  { q: "What if I'm not happy in month 1?", a: "Less than 50 qualified leads on Pro? Month 2 is free. We'll refine your ICP at no extra cost." },
  { q: "Can I upgrade later?", a: "Absolutely. Upgrades are seamless — we activate additional features on your existing workflow." },
];

/* ─── ASCII particle ──────────────────────────────────────────────────────── */

interface Particle {
  x: number; y: number; char: string; fontSize: number;
  speedY: number; speedX: number; opacity: number;
}

/* ─── Chat message type ──────────────────────────────────────────────────── */

interface ChatMessage {
  text: string;
  type: "bot" | "user";
  quickReplies?: string[];
  isSuccess?: boolean;
}

function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="chat-strong">$1</strong>')
    .replace(/\n/g, "<br/>");
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  /* ─── Theme ────────────────────────────────────────────────────────────── */
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("prospectingos-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("prospectingos-theme", next);
  }, [theme]);

  /* ─── Typewriter ───────────────────────────────────────────────────────── */
  const [typewriterText, setTypewriterText] = useState("");

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < FULL_TEXT.length) {
        setTypewriterText(FULL_TEXT.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 60 + Math.random() * 45);
    const timeout = setTimeout(() => clearInterval(timer), FULL_TEXT.length * 120 + 1000);
    return () => { clearInterval(timer); clearTimeout(timeout); };
  }, []);

  /* ─── Live counter ─────────────────────────────────────────────────────── */
  const [counter, setCounter] = useState(47);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(c => {
        const next = c + Math.floor(Math.random() * 5) + 1;
        return next;
      });
      setBump(true);
      setTimeout(() => setBump(false), 350);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  /* ─── Mobile menu ──────────────────────────────────────────────────────── */
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ─── FAQ ──────────────────────────────────────────────────────────────── */
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  /* ─── Booking state machine ───────────────────────────────────────────── */
  const [bookingStep, setBookingStep] = useState<BookingStep>("idle");
  const [bookingData, setBookingData] = useState<Partial<BookingData>>({});
  const bookingRef = useRef({ step: "idle" as BookingStep, data: {} as Partial<BookingData> });

  /* ─── Chat widget ──────────────────────────────────────────────────────── */
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      text: "Hi! I'm <strong class=\"chat-strong\">Pros Bot</strong> — your AI assistant. Ask me about how it works, pricing, timelines, or say <strong class=\"chat-strong\">\"Book a Demo\"</strong> and I'll get you scheduled!",
      type: "bot",
      quickReplies: ["How it works", "Pricing", "Book a Demo", "Go-live time"],
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const addBotMessage = useCallback((msg: BotMessage, isSuccess = false) => {
    setChatMessages(prev => [...prev, { text: msg.text, type: "bot", quickReplies: msg.quickReplies, isSuccess }]);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    setChatMessages(prev => [...prev, { text, type: "user" }]);
  }, []);

  const handleUserMessage = useCallback((text: string) => {
    addUserMessage(text);
    setTyping(true);

    // Reset to idle if user types "reset" or starts over
    const clean = text.toLowerCase().trim();
    if (clean === "reset" || clean === "start over") {
      bookingRef.current = { step: "idle", data: {} };
      setBookingStep("idle");
      setBookingData({});
    }

    const current = bookingRef.current;
    const result = getNextStep(current.step, current.data, text);

    // Update ref + state
    bookingRef.current = { step: result.step, data: result.data };
    setBookingStep(result.step);
    setBookingData(result.data);

    // If booking completed, try to persist
    if (result.step === "done" && result.data.email) {
      try {
        fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: result.data.name,
            email: result.data.email,
            company: result.data.company,
            date: result.data.date,
            time: result.data.time,
            notes: "Booked via Pros Bot chat",
          }),
        });
      } catch { /* non-critical */ }
    }

    setTimeout(() => {
      setTyping(false);
      addBotMessage(result.botMessage, result.step === "done");
    }, 700 + Math.random() * 600);
  }, [addUserMessage, addBotMessage]);

  useEffect(() => {
    chatMessagesRef.current?.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const openChat = useCallback(() => {
    setChatOpen(true);
    setTimeout(() => chatInputRef.current?.focus(), 400);
  }, []);

  const sendChat = useCallback(() => {
    const t = chatInput.trim();
    if (!t) return;
    setChatInput("");
    handleUserMessage(t);
  }, [chatInput, handleUserMessage]);

  /* ─── Navbar shadow on scroll ──────────────────────────────────────────── */
  const [navShadow, setNavShadow] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ─── Scroll reveal ────────────────────────────────────────────────────── */
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -50px 0px", threshold: 0.1 }
    );
    document.querySelectorAll(".landing-page .reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* ─── Smooth scroll for anchor links ───────────────────────────────────── */
  const smoothScroll = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href === "#") return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 80, behavior: "smooth" });
    }
  }, []);

  /* ─── ASCII canvas ─────────────────────────────────────────────────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  /* ─── ROI money canvas ─────────────────────────────────────────────────── */
  const roiCanvasRef = useRef<HTMLCanvasElement>(null);
  const roiParticlesRef = useRef<
    { x: number; y: number; char: string; fontSize: number; speedY: number; speedX: number; opacity: number; life: number }[]
  >([]);
  const roiStarsRef = useRef<{ x: number; y: number; trail: { x: number; y: number; char: string }[]; phase: number }[]>([]);
  const roiPopupsRef = useRef<{ x: number; y: number; particles: { x: number; y: number; vx: number; vy: number; char: string; life: number }[] }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const count = 45;
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          char: ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)],
          fontSize: 14 + Math.random() * 18,
          speedY: 0.2 + Math.random() * 0.5, speedX: (Math.random() - 0.5) * 0.3,
          opacity: 0.1 + Math.random() * 0.2,
        });
      }
    }

    let raf: number;
    const animate = () => {
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      if (!isDark) { ctx.clearRect(0, 0, canvas.width, canvas.height); raf = requestAnimationFrame(animate); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      for (const p of particlesRef.current) {
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
        ctx.fillText(p.char, p.x, p.y);
        p.y -= p.speedY;
        p.x += p.speedX;
        if (p.y < -20) { p.y = canvas.height + 20; p.x = Math.random() * canvas.width; p.char = ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)]; }
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  /* ─── ROI money canvas animation ───────────────────────────────────────── */
  const MONEY_CHARS = "$ € ¥ ₹ ¢ £ ₿ ₩ ₽ ◈ ◆ ◇ ● ○ ◎ ⬡ ⬢ ⬟ ⬠ ▓ ░ ▒ ▀ ∑ ∏ ∫".split(" ");
  const roiMouseRef = useRef({ x: -999, y: -999, onCanvas: false });
  useEffect(() => {
    const canvas = roiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const section = document.getElementById("roi");
    if (!section) return;

    const resize = () => {
      const r = section.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      canvas.style.left = r.left + "px";
      canvas.style.top = "0px";
    };

    const ro = new ResizeObserver(resize);
    ro.observe(section);
    window.addEventListener("scroll", resize, { passive: true });
    resize();

    // Track mouse relative to canvas
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      roiMouseRef.current = {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        onCanvas: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom,
      };
    };
    const onLeave = () => { roiMouseRef.current.onCanvas = false; };
    section.addEventListener("mousemove", onMove, { passive: true });
    section.addEventListener("mouseleave", onLeave);

    // Init floating money particles
    if (roiParticlesRef.current.length === 0) {
      for (let i = 0; i < 30; i++) {
        roiParticlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          char: MONEY_CHARS[Math.floor(Math.random() * MONEY_CHARS.length)],
          fontSize: 12 + Math.random() * 16,
          speedY: 0.15 + Math.random() * 0.45,
          speedX: (Math.random() - 0.5) * 0.3,
          opacity: 0.08 + Math.random() * 0.18,
          life: 1,
        });
      }
    }

    // Init shooting stars
    if (roiStarsRef.current.length === 0) {
      for (let i = 0; i < 3; i++) {
        roiStarsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.5,
          trail: [],
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    let raf: number;
    let lastPopup = 0;
    let mouseTrail: { x: number; y: number; t: number }[] = [];
    const animate = (ts: number) => {
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!isDark) { raf = requestAnimationFrame(animate); return; }

      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.textAlign = "center";

      const w = canvas.width;
      const h = canvas.height;
      const mx = roiMouseRef.current.x;
      const my = roiMouseRef.current.y;
      const mouseOn = roiMouseRef.current.onCanvas;

      // Mouse trail
      if (mouseOn) {
        mouseTrail.push({ x: mx, y: my, t: ts });
        if (mouseTrail.length > 12) mouseTrail.shift();
      }
      // Decay trail
      mouseTrail = mouseTrail.filter(p => ts - p.t < 600);

      // Floating money particles — attracted to mouse
      for (const p of roiParticlesRef.current) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Attraction force toward cursor
        let ax = 0, ay = 0;
        if (mouseOn && dist < 200 && dist > 5) {
          const force = (200 - dist) / 200 * 0.06;
          ax = (dx / dist) * force;
          ay = (dy / dist) * force;
        }
        p.y -= p.speedY + ay;
        p.x += p.speedX + ax + Math.sin(p.y * 0.01) * 0.2;
        // Boost opacity when near cursor
        const cursorGlow = mouseOn && dist < 150 ? (1 - dist / 150) * 0.35 : 0;
        ctx.fillStyle = `rgba(0, 212, 255, ${Math.min(1, p.opacity + cursorGlow)})`;
        ctx.font = `${p.fontSize}px "JetBrains Mono", monospace`;
        ctx.fillText(p.char, p.x, p.y);
        if (p.y < -30) { p.y = h + 30; p.x = Math.random() * w; p.char = MONEY_CHARS[Math.floor(Math.random() * MONEY_CHARS.length)]; }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
      }

      // Shooting stars — curved toward cursor
      for (const star of roiStarsRef.current) {
        star.phase += 0.008;
        // Gravitate toward mouse if on canvas
        if (mouseOn) {
          const sx = mx - star.x;
          const sy = my - star.y;
          const sd = Math.sqrt(sx * sx + sy * sy);
          if (sd > 1) { star.x += (sx / sd) * 1.2; star.y += (sy / sd) * 0.7; }
        }
        star.x += 2.5;
        star.y += 1.2;
        if (star.x > w + 60 || star.y > h + 60 || star.x < -60) {
          star.x = -60;
          star.y = Math.random() * h * 0.5;
          star.trail = [];
        }
        star.trail.push({ x: star.x, y: star.y, char: MONEY_CHARS[Math.floor(Math.random() * MONEY_CHARS.length)] });
        if (star.trail.length > 18) star.trail.shift();
        for (let i = 0; i < star.trail.length; i++) {
          const t = star.trail[i];
          const alpha = (i / star.trail.length) * 0.55;
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
          ctx.font = `${10 + (i / star.trail.length) * 10}px "JetBrains Mono", monospace`;
          ctx.fillText(t.char, t.x, t.y);
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = '18px "JetBrains Mono", monospace';
        ctx.fillText("✦", star.x, star.y);
      }

      // Popup bursts — spawn near mouse if on canvas, random otherwise
      const popInterval = mouseOn ? 1400 : 2800;
      if (ts - lastPopup > popInterval + Math.random() * 2000) {
        lastPopup = ts;
        const px = mouseOn ? mx + (Math.random() - 0.5) * 120 : w * 0.3 + Math.random() * w * 0.4;
        const py = mouseOn ? my + (Math.random() - 0.5) * 80 : h * 0.2 + Math.random() * h * 0.5;
        const burst: { x: number; y: number; vx: number; vy: number; char: string; life: number }[] = [];
        for (let i = 0; i < 14; i++) {
          const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
          const speed = 1.5 + Math.random() * 3;
          burst.push({
            x: px, y: py,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            char: MONEY_CHARS[Math.floor(Math.random() * MONEY_CHARS.length)],
            life: 1,
          });
        }
        roiPopupsRef.current.push({ x: px, y: py, particles: burst });
      }

      // Animate popups
      for (const pop of roiPopupsRef.current) {
        for (const p of pop.particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.04;
          p.life -= 0.015;
          if (p.life > 0) {
            ctx.fillStyle = `rgba(255, 200, 50, ${p.life * 0.75})`;
            ctx.font = `${12 + p.life * 12}px "JetBrains Mono", monospace`;
            ctx.fillText(p.char, p.x, p.y);
          }
        }
      }
      roiPopupsRef.current = roiPopupsRef.current.filter(pop => pop.particles.some(p => p.life > 0));

      // Mouse cursor glow
      if (mouseOn) {
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
        glow.addColorStop(0, "rgba(0, 212, 255, 0.08)");
        glow.addColorStop(0.5, "rgba(0, 212, 255, 0.03)");
        glow.addColorStop(1, "rgba(0, 212, 255, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }

      // Glow pulse on ROI card
      const pulse = Math.sin(ts * 0.002) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(0, 212, 255, ${pulse * 0.04})`;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", resize);
      section.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  /* ─── Custom cursor ────────────────────────────────────────────────────── */
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const ringPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth <= 900) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const onMove = (e: MouseEvent) => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; };
    let raf: number;
    const animateRing = () => {
      ringPosRef.current.x += (mouseRef.current.x - ringPosRef.current.x) * 0.12;
      ringPosRef.current.y += (mouseRef.current.y - ringPosRef.current.y) * 0.12;
      ring.style.left = ringPosRef.current.x + "px";
      ring.style.top = ringPosRef.current.y + "px";
      raf = requestAnimationFrame(animateRing);
    };
    raf = requestAnimationFrame(animateRing);
    document.addEventListener("mousemove", onMove, { passive: true });

    const sel = "a, button, input, .faq-question, .quick-reply-btn, .chat-trigger, .theme-toggle, .pricing-card, .how-card";
    const onOver = (e: MouseEvent) => { if ((e.target as Element).closest(sel)) ring.classList.add("hovering"); };
    const onOut = (e: MouseEvent) => { if ((e.target as Element).closest(sel)) ring.classList.remove("hovering"); };
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="landing-page">
      {/* ASCII Canvas */}
      <canvas id="asciiCanvas" ref={canvasRef} />

      {/* Custom Cursor */}
      <div className="cursor-dot" ref={dotRef} />
      <div className="cursor-ring" ref={ringRef} />

      {/* ══════════ Navbar ══════════ */}
      <nav className="navbar" style={{ boxShadow: navShadow ? "0 1px 8px rgba(0,0,0,0.15)" : "none" }}>
        <div className="container">
          <a href="#" className="nav-logo" onClick={e => smoothScroll(e as never, "#")}>
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" width="28" height="28" style={{ borderRadius: 8 }} />
            Prospecting <span className="accent">OS</span>
          </a>
          <ul className="nav-links">
            <li><a href="#how-it-works" onClick={e => smoothScroll(e, "#how-it-works")}>How It Works</a></li>
            <li><a href="#pricing" onClick={e => smoothScroll(e, "#pricing")}>Pricing</a></li>
            <li><a href="#roi" onClick={e => smoothScroll(e, "#roi")}>ROI</a></li>
            <li><a href="#faq" onClick={e => smoothScroll(e, "#faq")}>FAQ</a></li>
          </ul>
          <button className="nav-cta desktop-only" onClick={openChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Talk to Us
          </button>
          <div className="theme-toggle-wrapper">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle light/dark theme">
              <span className="toggle-icon moon">
                <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              </span>
              <span className="toggle-icon sun">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              </span>
              <span className="toggle-thumb" />
            </button>
          </div>
          <button className="nav-hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
        <a href="#how-it-works" onClick={e => { smoothScroll(e, "#how-it-works"); setMobileOpen(false); }}>How It Works</a>
        <a href="#pricing" onClick={e => { smoothScroll(e, "#pricing"); setMobileOpen(false); }}>Pricing</a>
        <a href="#roi" onClick={e => { smoothScroll(e, "#roi"); setMobileOpen(false); }}>ROI</a>
        <a href="#faq" onClick={e => { smoothScroll(e, "#faq"); setMobileOpen(false); }}>FAQ</a>
        <button className="nav-cta" onClick={openChat}>Talk to Us</button>
      </div>

      {/* ══════════ Hero ══════════ */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" width="16" height="16" style={{ borderRadius: 4 }} />
              AI-Powered B2B Prospecting
            </div>
            <h1>
              <span className="typewriter-text">{typewriterText}</span>
              <span className="typewriter-cursor">|</span>
            </h1>
            <p className="hero-subtitle">500+ qualified leads/month. Zero manual research. One AI system that finds, scores, and delivers your ideal clients — while you sleep.</p>
            <div className="hero-ctas">
              <button className="btn-primary" onClick={openChat}>See How It Works <ArrowRight size={16} style={{ display: "inline" }} /></button>
              <a href="#pricing" className="btn-secondary" onClick={e => smoothScroll(e, "#pricing")}>View Pricing <ArrowDown size={16} style={{ display: "inline" }} /></a>
            </div>
            <div className="hero-stats">
              <div><span>500+</span> LEADS/MONTH</div>
              <div><span>97%</span> LESS MANUAL WORK</div>
              <div><span>4h</span> TO GO LIVE</div>
            </div>
          </div>

          {/* Pipeline Visual */}
          <div className="hero-visual" style={{ position: "relative" }}>
            <div className="pipeline-card">
              <div className="pipeline-card-header"><span>HOT LEADS THIS WEEK</span><span style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} /> LIVE</span></div>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span className={`pipeline-live-counter${bump ? " bump" : ""}`}>{counter}</span>
                <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>qualified & scored</div>
              </div>
              <div className="pipeline-steps">
                <div className="pipeline-step"><span className="step-num">1</span><span className="step-label">Source Leads (Sales Navigator)</span><span className="step-badge live">LIVE</span></div>
                <div className="pipeline-step"><span className="step-num">2</span><span className="step-label">Filter Decision Makers</span><span className="step-badge ai">AI</span></div>
                <div className="pipeline-step"><span className="step-num">3</span><span className="step-label">Score & Qualify (1–10)</span><span className="step-badge ai">AI</span></div>
                <div className="pipeline-step"><span className="step-num">4</span><span className="step-label">Personalize Icebreaker</span><span className="step-badge ai">AI</span></div>
                <div className="pipeline-step"><span className="step-num">5</span><span className="step-label">Alert & Deliver</span><span className="step-badge auto">AUTO</span></div>
              </div>
            </div>
            <div className="floating-alert">
              <span className="alert-dot" />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              <span>New lead scored <strong>8.5/10</strong> — TechCorp CEO</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ How It Works ══════════ */}
      <section className="section" id="how-it-works">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// How It Works</div>
            <h2 className="section-title">From Zero to Pipeline in 5 Steps</h2>
            <p className="section-subtext">Every morning, fresh leads land in your inbox — scored, enriched, and ready to close.</p>
          </div>
          <div className="how-grid">
            {[
              { Icon: Globe, title: "Source", desc: "Sales Navigator exports your ICP automatically." },
              { Icon: Filter, title: "Filter", desc: "Only decision-makers pass through." },
              { Icon: FileText, title: "Score", desc: "Gemini AI scores leads 1–10. Only 7+ advance." },
              { Icon: PenLine, title: "Enrich", desc: "Company enrichment + unique icebreaker." },
              { Icon: Bell, title: "Deliver", desc: "Hot leads in Telegram, Slack, or CRM daily." },
            ].map((item, i) => (
              <div key={i} className="how-card reveal">
                <span className="how-icon"><item.Icon size={32} strokeWidth={1.5} /></span>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Pricing ══════════ */}
      <section className="section" id="pricing" style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// Pricing</div>
            <h2 className="section-title">Choose Your Pipeline Power</h2>
            <p className="section-subtext">From self-serve AI scoring to a fully managed AI SDR.</p>
          </div>
          <div className="pricing-grid">
            {/* Basic */}
            <div className="pricing-card reveal">
              <h3>Basic</h3>
              <div className="price">$2,500</div>
              <span className="price-period">ONE-TIME SETUP</span>
              <ul className="pricing-features">
                {["Full n8n workflow", "Sales Navigator integration", "Gemini AI scoring", "Google Sheets dashboard", "Telegram alerts", "1 week support"].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn-secondary" onClick={openChat}>Get Started <ArrowRight size={14} style={{ display: "inline" }} /></button>
            </div>
            {/* Pro (Popular) */}
            <div className="pricing-card popular reveal">
              <div className="popular-badge">MOST POPULAR</div>
              <h3>Pro</h3>
              <div className="price">$3,500</div>
              <span className="price-period">PER MONTH</span>
              <ul className="pricing-features">
                {["Everything in Basic", "AI icebreaker per lead", "Company enrichment", "Daily Slack digest", "Duplicate check", "Monthly ICP refinement", "Dedicated Slack channel"].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <Link href="/book" className="btn-primary" style={{ textDecoration: "none" }}>Book a Demo <ArrowRight size={14} style={{ display: "inline" }} /></Link>
            </div>
            {/* Advanced */}
            <div className="pricing-card reveal">
              <h3>Advanced</h3>
              <div className="price">$10K+</div>
              <span className="price-period">PER MONTH</span>
              <ul className="pricing-features">
                {["Everything in Pro", "Auto cold email sending", "3-touch follow-up", "AI reply detection", "HubSpot CRM sync", "A/B testing", "Weekly reports"].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn-secondary" onClick={openChat}>Talk to Us <ArrowRight size={14} style={{ display: "inline" }} /></button>
            </div>
          </div>
          <div className="guarantee-badge reveal">
            <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
            No 50 qualified leads in month 1? Month 2 is free.
          </div>
        </div>
      </section>

      {/* ══════════ Testimonials ══════════ */}
      <section className="section">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// Social Proof</div>
            <h2 className="section-title">Trusted by B2B Teams</h2>
          </div>
          <div className="testimonials-grid">
            {[
              { quote: "We were spending 15 hours a week on manual prospecting. Now we get 200+ scored leads every Monday morning.", initials: "AK", name: "Alex Kendall", role: "VP Sales, SaaS Co. · Austin, TX" },
              { quote: "The icebreakers are scary good. Our cold email reply rate went from 2% to 11% in the first month.", initials: "MR", name: "Maria Rodriguez", role: "Founder, GrowthLab · London, UK" },
              { quote: "I was skeptical about AI lead gen. But this is different — every lead comes with context.", initials: "JP", name: "James Park", role: "CEO, TechVentures · Singapore" },
            ].map((t, i) => (
              <div key={i} className="testimonial-card reveal">
                <p className="quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{t.initials}</div>
                  <div className="author-info"><strong>{t.name}</strong>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ ROI ══════════ */}
      <section className="section" id="roi" style={{ background: "var(--bg-secondary)", position: "relative", overflow: "hidden" }}>
        <canvas ref={roiCanvasRef} className="roi-ascii-canvas" />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div className="roi-grid">
            <div className="roi-text reveal">
              <div className="section-eyebrow">// ROI Calculator</div>
              <h3>The Math is Simple</h3>
              <p>An in-house SDR costs $4–6K/month and delivers ~50 leads. Our AI delivers <strong>500+ scored leads</strong> for a fraction.</p>
            </div>
            <div className="roi-calc-card reveal">
              <div className="roi-row"><span className="label">Hot leads/month</span><span className="value">200+</span></div>
              <div className="roi-row"><span className="label">Average close rate</span><span className="value">2–5%</span></div>
              <div className="roi-row"><span className="label">New clients/month</span><span className="value">4–10</span></div>
              <div className="roi-row"><span className="label">Avg. project value</span><span className="value">$5K–$15K</span></div>
              <div className="roi-row"><span className="label">Revenue generated</span><span className="value">$20K–$150K</span></div>
              <div className="roi-row"><span className="label">Cost of Pro plan</span><span className="value">$3,500/mo</span></div>
              <div className="roi-highlight"><span>Minimum ROI</span><span>5.7x — 42x</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="section" id="faq">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// FAQ</div>
            <h2 className="section-title">Got Questions?</h2>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={`faq-item reveal${openFaq === i ? " open" : ""}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {item.q}
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer"><p>{item.a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Final CTA ══════════ */}
      <section className="final-cta">
        <div className="container reveal">
          <h2>Stop Hunting. Start Closing.</h2>
          <p>Your ideal clients are on LinkedIn right now. Let AI find them, score them, and deliver them — every single day.</p>
          <div className="cta-group">
            <button className="btn-primary" onClick={openChat}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Chat With Us Now
            </button>
            <a href="#pricing" className="btn-secondary" onClick={e => smoothScroll(e, "#pricing")}>See Pricing <ArrowRight size={14} style={{ display: "inline" }} /></a>
          </div>
        </div>
      </section>

      {/* ══════════ Footer ══════════ */}
      <footer className="footer">
        <div className="container"><p>© 2026 Prospecting OS. AI-powered B2B prospecting.</p></div>
      </footer>

      {/* ══════════ Premium Chat Widget — Pros Bot ══════════ */}
      <div className="chat-widget">
        <button className="chat-trigger" onClick={() => setChatOpen(o => !o)} aria-label="Open chat">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="chat3d-grad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00d4ff" />
                <stop offset="1" stopColor="#0088cc" />
              </linearGradient>
              <linearGradient id="chat3d-shine" x1="6" y1="4" x2="16" y2="12" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <filter id="chat3d-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.4" />
              </filter>
            </defs>
            {/* 3D bottom face (depth) */}
            <path d="M4 13.5C4 12.5 5 11 6.5 10.5L19.5 10.5C21 11 22 12.5 22 13.5V14.5C22 15.5 21 17 19.5 17.5L6.5 17.5C5 17 4 15.5 4 14.5V13.5Z" fill="#005577" />
            {/* Main bubble */}
            <rect x="3" y="2" width="19" height="14" rx="4" fill="url(#chat3d-grad)" filter="url(#chat3d-shadow)" />
            {/* Shine */}
            <rect x="3" y="2" width="19" height="8" rx="4" fill="url(#chat3d-shine)" />
            {/* Bubble tail */}
            <path d="M8 16L5 22L11 16H8Z" fill="url(#chat3d-grad)" />
            {/* 3 dots */}
            <circle cx="9" cy="9" r="1.3" fill="#ffffff" opacity="0.9" />
            <circle cx="12.5" cy="9" r="1.3" fill="#ffffff" opacity="0.9" />
            <circle cx="16" cy="9" r="1.3" fill="#00d4ff" opacity="0.5" />
          </svg>
          <span className="pulse-ring" />
        </button>
        <div className={`chat-window${chatOpen ? " open" : ""}`}>
          <div className="chat-header">
            <div className="chat-header-logo">
              <svg width="22" height="22" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="chat3d-h-grad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff" />
                    <stop offset="1" stopColor="#0088cc" />
                  </linearGradient>
                  <linearGradient id="chat3d-h-shine" x1="6" y1="4" x2="16" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" stopOpacity="0.3" />
                    <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M4 13.5C4 12.5 5 11 6.5 10.5L19.5 10.5C21 11 22 12.5 22 13.5V14.5C22 15.5 21 17 19.5 17.5L6.5 17.5C5 17 4 15.5 4 14.5V13.5Z" fill="#005577" />
                <rect x="3" y="2" width="19" height="14" rx="4" fill="url(#chat3d-h-grad)" />
                <rect x="3" y="2" width="19" height="8" rx="4" fill="url(#chat3d-h-shine)" />
                <path d="M8 16L5 22L11 16H8Z" fill="url(#chat3d-h-grad)" />
                <circle cx="9" cy="9" r="1.3" fill="#ffffff" opacity="0.9" />
                <circle cx="12.5" cy="9" r="1.3" fill="#ffffff" opacity="0.9" />
                <circle cx="16" cy="9" r="1.3" fill="#00d4ff" opacity="0.5" />
              </svg>
            </div>
            <div className="chat-header-info">
              <div className="chat-title">Pros Bot</div>
              <div className="chat-status"><span className="status-dot" /> Online — replies instantly</div>
            </div>
            <button className="chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat"><X size={18} /></button>
          </div>
          <div className="chat-messages" ref={chatMessagesRef}>
            {chatMessages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.type}${m.isSuccess ? " success" : ""}`}>
                <span dangerouslySetInnerHTML={{ __html: formatMessage(m.text) }} />
                {m.quickReplies && m.quickReplies.length > 0 && (
                  <div className="chat-bubble-replies">
                    {m.quickReplies.map((qr, j) => (
                      <button
                        key={j}
                        className="chat-bubble-reply-btn"
                        onClick={() => handleUserMessage(qr)}
                      >
                        {qr === "Book a Demo" && <Calendar size={11} />}
                        {qr === "Explore Platform" && <ArrowRight size={11} />}
                        {qr === "How it works" && <Sparkles size={11} />}
                        {qr}
                      </button>
                    ))}
                  </div>
                )}
                {m.isSuccess && (
                  <div className="chat-success-badge">
                    <CheckCircle2 size={14} /> Booking confirmed
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="chat-bubble bot typing-bubble">
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            )}
          </div>
          <div className="chat-input-row">
            <input
              ref={chatInputRef}
              type="text"
              placeholder="Type your message..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
            />
            <button className="chat-send-btn" onClick={sendChat} aria-label="Send message">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Email Capture Modal — entry intent + exit intent */}
      <EmailCaptureModal />
    </div>
  );
}
