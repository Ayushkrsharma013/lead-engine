"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Script from "next/script";
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

const FULL_TEXT = "AI-Powered B2B Lead Generation. 500+ Scored Leads. Delivered Every Morning.";
const HERO_PREFIX = "AI-Powered B2B Lead Generation. ";
const HERO_HIGHLIGHT = "500+ Scored Leads. Delivered Every Morning.";
const HERO_SPLIT_AT = HERO_PREFIX.length;
const ASCII_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789+-*/=<>{}[]()&|!?@#$%^&*;:,.~`".split("");

const FAQ_ITEMS = [
  {
    q: "Do I need a LinkedIn Sales Navigator subscription?",
    a: "Yes — LinkedIn Sales Navigator is the core data engine for Prospecting OS. A basic individual plan (currently $99/month) is sufficient. During onboarding, the Prospecting OS team helps you configure your ICP search filters to maximize lead quality and volume.",
  },
  {
    q: "How long does it take to go live?",
    a: "Basic plan: 4–6 hours from payment to live pipeline. Pro plan: 2–3 business days (includes icebreaker setup, enrichment, and Slack/Telegram integration). Advanced plan: 1–2 weeks, which includes cold email infrastructure setup, domain warm-up, and HubSpot CRM integration.",
  },
  {
    q: "What industries does AI B2B lead generation work for?",
    a: "Prospecting OS works for any B2B business whose ideal clients are active on LinkedIn. It has been deployed for SaaS companies, digital agencies, management consultancies, professional services firms, and recruitment agencies in the US, UK, Australia, Singapore, Canada, and India. If your target buyer has a LinkedIn profile, the system works.",
  },
  {
    q: "Will automated LinkedIn prospecting get my domain blacklisted?",
    a: "No. Prospecting OS uses human-like rate limiting, proper email warm-up sequences, and compliant scraping patterns. The Advanced plan uses a dedicated secondary sending domain for all cold outreach, keeping your primary domain reputation fully protected.",
  },
  {
    q: "What is the performance guarantee?",
    a: "On the Pro plan: if you don't receive at least 50 qualified, AI-scored leads in your first calendar month, your second month is completely free. The team also performs a full ICP refinement session at no additional cost. No questions asked.",
  },
  {
    q: "Can I upgrade from Basic to Pro later?",
    a: "Yes. Upgrades are seamless — no migration, no rebuild. The Pro and Advanced features are activated on your existing n8n workflow. You only pay the difference in plan cost from the upgrade date.",
  },
  {
    q: "What is an AI SDR and how is it different from hiring a human SDR?",
    a: "An AI SDR (Sales Development Representative) automates the research, scoring, enrichment, and outreach tasks traditionally performed by a human SDR. A human SDR costs $4,000–$6,000/month and typically delivers 40–60 leads. Prospecting OS delivers 500+ scored, enriched leads on the Pro plan at $3,500/month — running 24/7, with no sick days, no training ramp, and no turnover.",
  },
  {
    q: "Does Prospecting OS integrate with HubSpot or other CRMs?",
    a: "Yes, on the Advanced plan. HubSpot CRM sync is included, with AI reply detection that automatically updates contact records based on email responses. Custom CRM integrations (Salesforce, Pipedrive, Close) are available on request.",
  },
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
      text: "Hi! I'm <strong class=\"chat-strong\">Pros Bot</strong> 👋 — the Prospecting OS AI assistant. I can tell you how the AI lead generation pipeline works, explain pricing plans, or book you a free strategy call. What would you like to know?",
      type: "bot",
      quickReplies: ["How does the AI scoring work?", "What does Pro plan include?", "Book a Free Strategy Call", "How fast can I go live?"],
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
    <div className="landing-page" role="main" aria-label="Prospecting OS — AI B2B Lead Generation Landing Page">
      {/* ASCII Canvas */}
      <canvas id="asciiCanvas" ref={canvasRef} />

      {/* Custom Cursor */}
      <div className="cursor-dot" ref={dotRef} />
      <div className="cursor-ring" ref={ringRef} />

      {/* ══════════ Navbar ══════════ */}
      <nav className="navbar" aria-label="Prospecting OS — AI B2B Lead Generation Navigation" style={{ boxShadow: navShadow ? "0 1px 8px rgba(0,0,0,0.15)" : "none" }}>
        <div className="container">
          <a href="#" className="nav-logo" onClick={e => smoothScroll(e as never, "#")}>
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS logo — AI-powered B2B lead generation system by Flow-Forges" width="28" height="28" style={{ borderRadius: 8 }} />
            Prospecting <span className="accent">OS</span>
          </a>
          <ul className="nav-links">
            <li><a href="#how-it-works" onClick={e => smoothScroll(e, "#how-it-works")}>How It Works</a></li>
            <li><a href="#pricing" onClick={e => smoothScroll(e, "#pricing")}>Pricing</a></li>
            <li><a href="#roi" onClick={e => smoothScroll(e, "#roi")}>ROI Calculator</a></li>
            <li><a href="#faq" onClick={e => smoothScroll(e, "#faq")}>FAQ</a></li>
          </ul>
          <Link href="/book" className="nav-cta desktop-only" aria-label="Book a free B2B prospecting strategy call with the Prospecting OS team" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Book a Free Strategy Call
          </Link>
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
        <a href="#roi" onClick={e => { smoothScroll(e, "#roi"); setMobileOpen(false); }}>ROI Calculator</a>
        <a href="#faq" onClick={e => { smoothScroll(e, "#faq"); setMobileOpen(false); }}>FAQ</a>
        <Link href="/book" className="nav-cta" style={{ textDecoration: "none" }} onClick={() => setMobileOpen(false)}>Book a Free Strategy Call</Link>
      </div>

      {/* ══════════ Hero ══════════ */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS logo — AI-powered B2B lead generation system by Flow-Forges" width="16" height="16" style={{ borderRadius: 4 }} />
              AI-Powered B2B Prospecting
            </div>
            <h1>
              <span className="typewriter-text hero-heading-main">
                {typewriterText.length <= HERO_SPLIT_AT
                  ? typewriterText
                  : typewriterText.slice(0, HERO_SPLIT_AT)
                }
              </span>
              {typewriterText.length > HERO_SPLIT_AT && (
                <span className="typewriter-text hero-heading-gradient">
                  {typewriterText.slice(HERO_SPLIT_AT)}
                </span>
              )}
              <span className="typewriter-cursor">|</span>
            </h1>
            <p className="hero-subtitle">
              Prospecting OS is an automated B2B prospecting system built for agencies, SaaS founders, and consultants. It combines LinkedIn Sales Navigator with Gemini AI to find, score, enrich, and deliver your ideal decision-maker leads to Slack or Telegram — every day, without manual research. Built by{" "}
              <a href="https://flow-forges.com" aria-label="Flow-Forges — AI automation agency" style={{ color: "var(--accent)" }}>Flow-Forges</a>.
            </p>
            <div className="hero-ctas">
              <button className="btn-primary" onClick={openChat} aria-label="See how Prospecting OS automates B2B lead generation in 5 steps">See the AI Pipeline in Action <ArrowRight size={16} style={{ display: "inline" }} /></button>
              <a href="#pricing" className="btn-secondary" onClick={e => smoothScroll(e, "#pricing")} aria-label="View Prospecting OS pricing — from $2,500 one-time to fully managed AI SDR">See Pricing Plans <ArrowDown size={16} style={{ display: "inline" }} /></a>
            </div>
            <div className="hero-stats">
              <div><span>500+</span> AI-Scored Leads/Month</div>
              <div><span>97%</span> Less Manual Prospecting</div>
              <div><span>4h</span> Live in 4 Hours (Basic)</div>
            </div>
          </div>

          {/* Pipeline Visual */}
          <div className="hero-visual" style={{ position: "relative" }}>
            <div className="pipeline-card">
              <div className="pipeline-card-header"><span>HOT LEADS THIS WEEK</span><span style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }} aria-label="Example lead scoring output — not live data"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} /> LIVE</span></div>
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
      <section className="section" id="how-it-works" aria-label="How Prospecting OS works — 5-step AI lead generation pipeline">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow" aria-label="How Prospecting OS automates B2B lead generation">HOW IT WORKS</div>
            <h2 className="section-title">How Prospecting OS Finds, Scores &amp; Delivers Your Best B2B Leads</h2>
            <p className="section-subtext">Every morning, fresh decision-maker leads land in your Slack or Telegram — AI-scored, enriched, and ready to contact.</p>
          </div>
          <div className="how-grid">
            {[
              { Icon: Globe, title: "Source", desc: "LinkedIn Sales Navigator pulls your Ideal Customer Profile (ICP) — industry, job title, company size, geography — automatically, every morning." },
              { Icon: Filter, title: "Filter", desc: "The AI filter removes non-decision-makers. Only founders, C-suite, VPs, and Directors advance — no noise, no junior contacts." },
              { Icon: FileText, title: "Score", desc: "Gemini AI scores every lead 1–10 against your ICP. Leads scoring below 7 are discarded. You only see high-intent, qualified prospects." },
              { Icon: PenLine, title: "Enrich", desc: "Each lead is enriched with company context, recent news, and a unique AI-written icebreaker — ready for cold outreach." },
              { Icon: Bell, title: "Deliver", desc: "Scored, enriched leads land in your Telegram, Slack, or CRM every morning. No spreadsheet hunting. No manual research. Just pipeline." },
            ].map((item, i) => (
              <div key={i} className="how-card reveal">
                <span className="how-icon"><item.Icon size={32} strokeWidth={1.5} /></span>
                <h4>{item.title}</h4>
                <p>
                  {item.desc}
                  {i === 2 && (
                    <>{" "}<a href="#pricing" aria-label="See Prospecting OS pricing plans" style={{ color: "var(--accent)", fontSize: "0.85em" }}>See pricing →</a></>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Pricing ══════════ */}
      <section className="section" id="pricing" aria-label="Prospecting OS pricing plans — Basic, Pro, and Advanced" style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">PRICING</div>
            <h2 className="section-title">AI B2B Lead Generation Pricing — From Self-Serve Setup to Full AI SDR</h2>
            <p className="section-subtext">From self-serve AI scoring to a fully managed AI SDR. Every plan includes Gemini AI scoring and Sales Navigator integration.</p>
          </div>
          <div className="pricing-grid">
            {/* Basic */}
            <div className="pricing-card reveal">
              <h3>Basic</h3>
              <div className="price">$2,500</div>
              <span className="price-period">ONE-TIME SETUP</span>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "8px 0 12px" }}>Perfect for founders and solo consultants ready to automate prospecting.</p>
              <ul className="pricing-features">
                {["Full n8n workflow", "Sales Navigator integration", "Gemini AI scoring", "Google Sheets dashboard", "Telegram alerts", "1 week support"].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn-secondary" aria-label="Set up your AI B2B lead generation pipeline for $2,500 one-time" onClick={openChat}>Get Your Pipeline Set Up <ArrowRight size={14} style={{ display: "inline" }} /></button>
            </div>
            {/* Pro (Popular) */}
            <div className="pricing-card popular reveal">
              <div className="popular-badge">MOST POPULAR</div>
              <h3>Pro</h3>
              <div className="price">$3,500</div>
              <span className="price-period">PER MONTH</span>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "8px 0 12px" }}>The most popular choice for B2B agencies running active outbound campaigns.</p>
              <ul className="pricing-features">
                {["Everything in Basic", "AI icebreaker per lead", "Company enrichment", "Daily Slack digest", "Duplicate check", "Monthly ICP refinement", "Dedicated Slack channel"].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <Link href="/book" className="btn-primary" style={{ textDecoration: "none" }} aria-label="Book a free strategy call to start the Pro AI prospecting plan">Book a Free Strategy Call <ArrowRight size={14} style={{ display: "inline" }} /></Link>
            </div>
            {/* Advanced */}
            <div className="pricing-card reveal">
              <h3>Advanced</h3>
              <div className="price">$10K+</div>
              <span className="price-period">PER MONTH</span>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "8px 0 12px" }}>Full-stack AI SDR for scaling sales teams replacing or supplementing human reps.</p>
              <ul className="pricing-features">
                {["Everything in Pro", "Auto cold email sending", "3-touch follow-up", "AI reply detection", "HubSpot CRM sync", "A/B testing", "Weekly reports"].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn-secondary" aria-label="Contact Prospecting OS about the Advanced AI SDR plan" onClick={openChat}>Talk to the Team <ArrowRight size={14} style={{ display: "inline" }} /></button>
            </div>
          </div>
          <div className="guarantee-badge reveal">
            <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
            Performance guarantee: If the Pro plan doesn&apos;t deliver 50+ qualified leads in your first month, month 2 is completely free. We&apos;ll also refine your ICP at no cost.{" "}
            <a href="#pricing" aria-label="View Prospecting OS Pro plan pricing" style={{ color: "var(--accent)" }}>View Pro plan →</a>
          </div>
        </div>
      </section>

      {/* ══════════ Testimonials ══════════ */}
      <section className="section">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">SOCIAL PROOF</div>
            <h2 className="section-title">What B2B Teams Say About Prospecting OS</h2>
          </div>
          <div className="testimonials-grid">
            {[
              { quote: "We were spending 15+ hours per week on manual LinkedIn prospecting. After setting up Prospecting OS, we receive 200+ AI-scored leads every Monday morning — with icebreakers ready to send. Our SDR now focuses only on closing.", initials: "AK", name: "Alex Kendall", role: "VP Sales, SaaS Co. · Austin, TX" },
              { quote: "The AI-generated icebreakers are frighteningly accurate. Our cold email reply rate jumped from 2% to 11% in month one. That's 5x more conversations from the same list size.", initials: "MR", name: "Maria Rodriguez", role: "Founder, GrowthLab · London, UK" },
              { quote: "I was skeptical — AI lead gen tools usually deliver junk. Prospecting OS is different. Every lead arrives with company context, a score, and a ready-to-use opener. We booked 3 discovery calls in the first week.", initials: "JP", name: "James Park", role: "CEO, TechVentures · Singapore" },
            ].map((t, i) => (
              <div key={i} className="testimonial-card reveal" role="img" aria-label={`Testimonial from ${t.name}, ${t.role}`}>
                <p className="quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{t.initials}</div>
                  <div className="author-info"><strong>{t.name}</strong>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="sr-only">
            Client testimonials represent individual results. B2B lead generation outcomes vary based on ICP specificity, industry, and outreach strategy. Prospecting OS guarantees a minimum of 50 qualified leads in month 1 on the Pro plan or month 2 is free.
          </p>
        </div>
      </section>

      {/* ══════════ ROI ══════════ */}
      <section className="section" id="roi" aria-label="ROI calculator — AI prospecting vs human SDR cost comparison" style={{ background: "var(--bg-secondary)", position: "relative", overflow: "hidden" }}>
        <canvas ref={roiCanvasRef} className="roi-ascii-canvas" />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div className="roi-grid">
            <div className="roi-text reveal">
              <div className="section-eyebrow">ROI</div>
              <h3>Calculate Your ROI: AI Prospecting vs. Human SDR</h3>
              <p>
                A human SDR costs $4,000–$6,000/month in salary alone, and typically delivers 40–60 leads per month. Prospecting OS delivers <strong>500+ AI-scored, enriched leads</strong> on the Pro plan at $3,500/month — a 10x output improvement at lower cost, with zero management overhead.{" "}
                <a href="#pricing" aria-label="View Prospecting OS Pro plan pricing" style={{ color: "var(--accent)" }}>View Pro plan →</a>
              </p>
            </div>
            <div className="roi-calc-card reveal">
              <div className="roi-row"><span className="label">AI-scored leads/month</span><span className="value">200+</span></div>
              <div className="roi-row"><span className="label">Average B2B close rate</span><span className="value">2–5%</span></div>
              <div className="roi-row"><span className="label">Estimated new clients/month</span><span className="value">4–10</span></div>
              <div className="roi-row"><span className="label">Average project/contract value</span><span className="value">$5K–$15K</span></div>
              <div className="roi-row"><span className="label">Estimated monthly revenue generated</span><span className="value">$20K–$150K</span></div>
              <div className="roi-row"><span className="label">Prospecting OS Pro plan cost</span><span className="value">$3,500/mo</span></div>
              <div className="roi-highlight"><span>Estimated minimum ROI on Pro plan</span><span>5.7x — 42x</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="section" id="faq" aria-label="Frequently asked questions about AI B2B lead generation">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// FAQ</div>
            <h2 className="section-title">Frequently Asked Questions About AI B2B Lead Generation</h2>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className={`faq-item reveal${openFaq === i ? " open" : ""}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {item.q}
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>
                    {item.a}
                    {i === 4 && (
                      <>{" "}<a href="#pricing" aria-label="See all Prospecting OS pricing tiers" style={{ color: "var(--accent)" }}>Compare all plans →</a></>
                    )}
                  </p>
                </div>
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
      <footer className="footer" role="contentinfo" aria-label="Prospecting OS footer">
        <div className="container">
          <p>
            © 2026{" "}
            <a href="https://flow-forges.com" aria-label="Flow-Forges AI automation agency" style={{ color: "var(--accent)" }}>Flow-Forges</a>
            {" "}· Prospecting OS — AI-Powered B2B Lead Generation System
          </p>
          <nav aria-label="Footer navigation" style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", margin: "12px 0", fontSize: "0.85rem" }}>
            <a href="#how-it-works" onClick={e => smoothScroll(e, "#how-it-works")}>How It Works</a>
            <a href="#pricing" onClick={e => smoothScroll(e, "#pricing")}>Pricing</a>
            <a href="#faq" onClick={e => smoothScroll(e, "#faq")}>FAQ</a>
            <a href="/book" aria-label="Book a free B2B prospecting strategy call">Book a Call</a>
            <a href="https://flow-forges.com" aria-label="Flow-Forges — AI automation agency for B2B businesses">Flow-Forges.com</a>
          </nav>
          <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", maxWidth: 560, margin: "0 auto" }}>
            Prospecting OS is a productized AI system built on n8n, Gemini AI, and LinkedIn Sales Navigator.
            Results vary based on ICP configuration and industry. Pro plan includes a 50-lead/month performance guarantee.
          </p>
        </div>
      </footer>

      {/* ══════════ Premium Chat Widget — Pros Bot ══════════ */}
      <div className="chat-widget">
        <button className="chat-trigger" onClick={() => setChatOpen(o => !o)} aria-label="Open chat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <line x1="8" y1="9" x2="16" y2="9" />
            <line x1="8" y1="13" x2="13" y2="13" />
          </svg>
          <span className="pulse-ring" />
        </button>
        <div className={`chat-window${chatOpen ? " open" : ""}`}>
          <div className="chat-header">
            <div className="chat-header-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="8" y1="9" x2="16" y2="9" />
                <line x1="8" y1="13" x2="13" y2="13" />
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
                        {qr === "Book a Free Strategy Call" && <Calendar size={11} />}
                        {qr === "How does the AI scoring work?" && <Sparkles size={11} />}
                        {qr === "What does Pro plan include?" && <ArrowRight size={11} />}
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

      {/* ══════════ JSON-LD Schema ══════════ */}
      <Script
        id="schema-software"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Prospecting OS",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "url": "https://app.flow-forges.com/prospecting-os",
            "description": "Prospecting OS is an AI-powered B2B lead generation system that uses LinkedIn Sales Navigator and Gemini AI to automatically source, score, enrich, and deliver qualified leads to your Slack, Telegram, or CRM — every morning.",
            "offers": [
              { "@type": "Offer", "name": "Basic — One-Time Setup", "price": "2500", "priceCurrency": "USD", "description": "Full n8n workflow, Sales Navigator integration, Gemini AI scoring, Google Sheets dashboard, Telegram alerts, 1-week support.", "eligibleRegion": "Worldwide" },
              { "@type": "Offer", "name": "Pro — Managed AI Prospecting", "price": "3500", "priceCurrency": "USD", "description": "Everything in Basic + AI icebreakers, company enrichment, daily Slack digest, duplicate check, monthly ICP refinement, dedicated Slack channel.", "eligibleRegion": "Worldwide" },
              { "@type": "Offer", "name": "Advanced — Full AI SDR", "price": "10000", "priceCurrency": "USD", "description": "Everything in Pro + auto cold email sending, 3-touch follow-up, AI reply detection, HubSpot CRM sync, A/B testing, weekly reports.", "eligibleRegion": "Worldwide" },
            ],
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "27", "bestRating": "5", "worstRating": "1" },
            "provider": { "@type": "Organization", "name": "Flow-Forges", "url": "https://flow-forges.com", "logo": "https://app.flow-forges.com/prospecting-os/assets/Logo_Icon.png" },
          }),
        }}
      />
      <Script
        id="schema-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "What is the best AI tool for B2B lead generation?", "acceptedAnswer": { "@type": "Answer", "text": "Prospecting OS is an AI-powered B2B lead generation system that combines LinkedIn Sales Navigator, Gemini AI scoring, and automated enrichment to deliver 500+ qualified, scored leads per month. Unlike generic lead scrapers, it filters for decision-makers only and scores each lead 1–10 — only 7+ advance to your inbox." } },
              { "@type": "Question", "name": "How do I automate LinkedIn prospecting?", "acceptedAnswer": { "@type": "Answer", "text": "Prospecting OS automates LinkedIn prospecting in 5 steps: (1) Sales Navigator exports your ICP automatically, (2) the system filters for decision-makers only, (3) Gemini AI scores each lead 1–10, (4) company enrichment and a personalized icebreaker are generated, and (5) hot leads are delivered to Telegram, Slack, or your CRM every morning." } },
              { "@type": "Question", "name": "What is an AI SDR and is it better than hiring a human SDR?", "acceptedAnswer": { "@type": "Answer", "text": "An AI SDR (Sales Development Representative) is an automated system that performs the research, scoring, enrichment, and outreach tasks traditionally done by a human SDR. A human SDR costs $4,000–$6,000/month and delivers ~50 leads. Prospecting OS delivers 500+ scored leads for a fraction of that cost, running 24/7 with zero manual effort." } },
              { "@type": "Question", "name": "How many leads can AI generate per month?", "acceptedAnswer": { "@type": "Answer", "text": "Prospecting OS delivers 500+ qualified, AI-scored B2B leads per month on the Pro plan. Basic plan clients typically see 100–200 leads/month depending on their Sales Navigator search configuration and ICP specificity." } },
              { "@type": "Question", "name": "Do I need a LinkedIn Sales Navigator subscription to use Prospecting OS?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. LinkedIn Sales Navigator is the data engine. A basic plan at $99/month is all you need. The Prospecting OS team helps you configure your ICP search filters during onboarding." } },
              { "@type": "Question", "name": "How long does it take to go live with Prospecting OS?", "acceptedAnswer": { "@type": "Answer", "text": "Basic plan: 4–6 hours. Pro plan: 2–3 business days. Advanced (with email infrastructure and CRM integration): 1–2 weeks." } },
              { "@type": "Question", "name": "What industries does AI B2B lead generation work for?", "acceptedAnswer": { "@type": "Answer", "text": "Prospecting OS works best for B2B agencies, SaaS companies, consulting firms, and professional services businesses — any company whose ideal clients are active on LinkedIn. It has been used by teams in the US, UK, Australia, Singapore, and India." } },
              { "@type": "Question", "name": "Is there a money-back guarantee?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. If the Pro plan does not deliver at least 50 qualified leads in the first month, month 2 is completely free. The team will also refine your ICP at no additional cost." } },
            ],
          }),
        }}
      />
      <Script
        id="schema-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Flow-Forges",
            "url": "https://flow-forges.com",
            "logo": "https://app.flow-forges.com/prospecting-os/assets/Logo_Icon.png",
            "sameAs": ["https://app.flow-forges.com/prospecting-os"],
            "contactPoint": { "@type": "ContactPoint", "contactType": "sales", "url": "https://app.flow-forges.com/prospecting-os/book", "areaServed": "Worldwide", "availableLanguage": "English" },
          }),
        }}
      />
      <Script
        id="schema-howto"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "How to Get 500 B2B Leads Per Month Using AI",
            "description": "Prospecting OS uses a 5-step AI pipeline to automatically source, score, enrich, and deliver qualified B2B leads every day.",
            "totalTime": "PT4H",
            "estimatedCost": { "@type": "MonetaryAmount", "currency": "USD", "value": "2500" },
            "tool": [
              { "@type": "HowToTool", "name": "LinkedIn Sales Navigator" },
              { "@type": "HowToTool", "name": "Gemini AI" },
              { "@type": "HowToTool", "name": "n8n" },
              { "@type": "HowToTool", "name": "Slack or Telegram" },
            ],
            "step": [
              { "@type": "HowToStep", "name": "Source", "text": "LinkedIn Sales Navigator automatically exports leads matching your Ideal Customer Profile (ICP) — industry, company size, geography, job title.", "position": 1 },
              { "@type": "HowToStep", "name": "Filter", "text": "The system filters out non-decision-makers. Only founders, C-suite, VPs, and Directors pass through.", "position": 2 },
              { "@type": "HowToStep", "name": "Score", "text": "Gemini AI scores each lead 1–10 against your ICP criteria. Only leads scoring 7 or above advance to enrichment.", "position": 3 },
              { "@type": "HowToStep", "name": "Enrich", "text": "Company data is enriched automatically. A unique, personalized icebreaker is generated for each lead using AI.", "position": 4 },
              { "@type": "HowToStep", "name": "Deliver", "text": "Hot leads are delivered to your Telegram, Slack, or CRM every morning — scored, enriched, and ready to contact.", "position": 5 },
            ],
          }),
        }}
      />
    </div>
  );
}
