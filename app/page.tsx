"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Globe, Filter, FileText, PenLine, Bell, ArrowRight,
  ArrowDown, Menu, X, Send, Sparkles, Calendar, CheckCircle2,
} from "lucide-react";
import EmailCaptureModal from "@/components/EmailCaptureModal";
import { EmailCaptureForm } from "@/components/landing/EmailCaptureForm";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { ScrollProgressBar } from "@/components/landing/ScrollProgressBar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { softwareAppSchema, faqSchema } from "@/lib/seo/schema";
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

const FAQ_ITEMS: { q: string; a: string; cat: "setup" | "results" }[] = [
  {
    q: "Do I need an Apify lead scraping subscription?",
    a: "Yes — Apify lead scraping is the core data engine for Prospecting OS. A basic individual plan (currently $99/month) is sufficient. During onboarding, the Prospecting OS team helps you configure your ICP search filters to maximize lead quality and volume.",
    cat: "setup",
  },
  {
    q: "How long does it take to go live?",
    a: "Founder's Pilot: 4–6 hours from payment to live pipeline. Growth: 2–3 business days (includes icebreaker setup, enrichment, and Slack/Telegram integration). Scale: 1–2 weeks, which includes cold email infrastructure setup, domain warm-up, and HubSpot CRM integration.",
    cat: "setup",
  },
  {
    q: "What industries does AI B2B lead generation work for?",
    a: "Prospecting OS works for any B2B business whose ideal clients are active on LinkedIn. It has been deployed for SaaS companies, digital agencies, management consultancies, professional services firms, and recruitment agencies in the US, UK, Australia, Singapore, Canada, and India. If your target buyer has a LinkedIn profile, the system works.",
    cat: "results",
  },
  {
    q: "Will automated LinkedIn prospecting get my domain blacklisted?",
    a: "No. Prospecting OS uses human-like rate limiting, proper email warm-up sequences, and compliant scraping patterns. The Growth plan uses a dedicated secondary sending domain for all cold outreach, keeping your primary domain reputation fully protected.",
    cat: "results",
  },
  {
    q: "What is the performance guarantee?",
    a: "On the Growth plan: if you don't receive at least 50 qualified, AI-scored leads in your first calendar month, your second month is completely free. The team also performs a full ICP refinement session at no additional cost. No questions asked.",
    cat: "setup",
  },
  {
    q: "Can I upgrade from Founder's Pilot to Growth later?",
    a: "Yes. Upgrades are seamless — no migration, no rebuild. The Growth features are activated on your existing Prospecting OS setup. You only pay the difference in plan cost from the upgrade date.",
    cat: "setup",
  },
  {
    q: "What is an AI SDR and how is it different from hiring a human SDR?",
    a: "An AI SDR (Sales Development Representative) automates the research, scoring, enrichment, and outreach tasks traditionally performed by a human SDR. A human SDR costs $4,000–$6,000/month and typically delivers 40–60 leads. Prospecting OS delivers 500+ scored, enriched leads on the Growth plan at $999/month — running 24/7, with no sick days, no training ramp, and no turnover.",
    cat: "results",
  },
  {
    q: "Does Prospecting OS integrate with HubSpot or other CRMs?",
    a: "Yes, on the Growth plan. HubSpot CRM sync is included, with AI reply detection that automatically updates contact records based on email responses. Custom CRM integrations (Salesforce, Pipedrive, Close) are available on request.",
    cat: "results",
  },
  {
    q: "Does this work for clients outside the US and UK?",
    a: "Yes — Apify scrapers is global. We've run pipelines targeting APAC, EMEA, and LATAM. The ICP scoring and icebreaker generation work regardless of geography. The only constraint is that your target clients need a LinkedIn presence.",
    cat: "results",
  },
  {
    q: "Who owns the lead data?",
    a: "You do. All leads are delivered to your own dashboard — we never store, sell, or access your lead data outside of the active pipeline run. For Growth and Scale plans, your data lives in your workspace, not ours.",
    cat: "results",
  },
  {
    q: "Can I see a sample output before buying?",
    a: "Yes — book a demo call and we'll walk you through a live run on 50 contacts from your ICP. You'll see the scoring logic, a real icebreaker output, and the Slack delivery format before you commit.",
    cat: "results",
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
  const [heroMounted, setHeroMounted] = useState(false);

  useEffect(() => {
    setHeroMounted(true);
    let i = 0;
    const timer = setInterval(() => {
      if (i < FULL_TEXT.length) {
        setTypewriterText(FULL_TEXT.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 60 + Math.random() * 45);
    return () => clearInterval(timer);
  }, []);

  /* ─── Static pipeline stat ──────────────────────────────────────────────── */
  const [counter, setCounter] = useState(0);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    setCounter(47);
  }, []);

  /* ─── Mobile menu ──────────────────────────────────────────────────────── */
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ─── FAQ ──────────────────────────────────────────────────────────────── */
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqFilter, setFaqFilter] = useState<"all" | "setup" | "results">("all");

  /* ─── ROI Calculator sliders ────────────────────────────────────────────── */
  const [roiHours, setRoiHours] = useState(15);
  const [roiRate, setRoiRate] = useState(75);
  const [roiMeetings, setRoiMeetings] = useState(5);
  const [roiDeal, setRoiDeal] = useState(8000);

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
      quickReplies: ["How does the AI scoring work?", "What plans are available?", "Book a Free Strategy Call", "How fast can I go live?"],
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

  const handleUserMessage = useCallback(async (text: string) => {
    addUserMessage(text);
    setTyping(true);

    // Build conversation history for AI context (last 8 messages)
    const history = chatMessages.concat([{ text, type: "user" as const }]).slice(-8).map(m => ({
      role: m.type === "bot" ? "model" : "user",
      text: m.text.replace(/<[^>]*>/g, ""), // strip HTML tags
    }));

    try {
      const res = await fetch("/prospecting-os/api/chat/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      const reply = data.text || "I'm having trouble thinking right now. Try again?";

      // Check if bot suggests booking
      const isBookingSuggestion = /book.*call|free.*demo|strategy.*call|BOOK_DEMO/i.test(reply);
      const quickReplies = isBookingSuggestion
        ? ["Book a Free Strategy Call", "Tell me about pricing", "How does scoring work?"]
        : undefined;

      setTyping(false);
      addBotMessage({ text: reply, quickReplies }, false);
    } catch {
      setTyping(false);
      addBotMessage({ text: "I'm having trouble connecting. Try again in a moment.", quickReplies: ["How does it work?", "What are the plans?", "Book a Free Strategy Call"] }, false);
    }
  }, [addUserMessage, addBotMessage, chatMessages]);

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

  /* ─── Navbar scroll animation (mark1-style pill shrink) ───────────────── */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
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

  /* ─── ROI computed values ──────────────────────────────────────────────── */
  const sliderBg = (val: number, min: number, max: number) => {
    const pct = ((val - min) / (max - min)) * 100;
    return `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`;
  };
  const roiMonthlyCost = Math.max(0, Math.round(roiHours * 4.33 * roiRate));
  const roiManualLeads = Math.max(0, Math.round(roiMeetings * 4.33 * 12));
  const roiRevenue = Math.max(0, Math.round(500 * 0.03 * roiDeal - roiMonthlyCost));
  const roiMultiple = Math.max(0, (500 * 0.03 * roiDeal) / 999).toFixed(1);
  const filteredFaqItems = faqFilter === "all" ? FAQ_ITEMS : FAQ_ITEMS.filter(item => item.cat === faqFilter);

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="landing-page" role="main" aria-label="Prospecting OS — AI B2B Lead Generation Landing Page">
      <ScrollProgressBar />
      {/* ASCII Canvas */}
      <canvas id="asciiCanvas" ref={canvasRef} />

      {/* Custom Cursor */}
      <div className="cursor-dot" ref={dotRef} />
      <div className="cursor-ring" ref={ringRef} />

      {/* ══════════ Navbar — mark1-style pill shrink ══════════ */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, padding: "0 8px" }}>
        <div
          style={{
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 32,
            transition: "all 500ms ease-out",
            position: "relative",
            ...(scrolled
              ? {
                  marginTop: 8,
                  maxWidth: 1100,
                  height: 56,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(14,13,10,0.85)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 1px 40px rgba(0,0,0,0.4)",
                  padding: "0 24px",
                }
              : {
                  marginTop: 0,
                  maxWidth: "100%",
                  height: 72,
                  borderRadius: 0,
                  borderColor: "transparent",
                  background: "transparent",
                  backdropFilter: "none",
                  WebkitBackdropFilter: "none",
                  padding: "0 24px",
                }),
          }}
        >
          {/* Top glow line — visible only when scrolled */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: "linear-gradient(to right, transparent, rgba(232,66,10,0.15), transparent)",
              opacity: scrolled ? 1 : 0,
              transition: "opacity 500ms ease-out",
            }}
          />

          {/* Logo */}
          <a
            href="#"
            className="nav-logo"
            onClick={e => smoothScroll(e as never, "#")}
            style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}
          >
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS logo — AI-powered B2B lead generation system by Flow-Forges" width="28" height="28" style={{ borderRadius: 8 }} />
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: "1.25rem", letterSpacing: "-0.02em", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
              Prospecting <span style={{ color: "var(--accent)" }}>OS</span>
            </span>
          </a>

          {/* Desktop nav links — centered */}
          <nav
            className="desktop-only"
            style={{
              display: "flex",
              gap: 28,
              alignItems: "center",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <a href="#how-it-works" className="nav-link-item" onClick={e => smoothScroll(e, "#how-it-works")}>How It Works</a>
            <a href="#pricing" className="nav-link-item" onClick={e => smoothScroll(e, "#pricing")}>Pricing</a>
            <a href="#roi" className="nav-link-item" onClick={e => smoothScroll(e, "#roi")}>ROI Calculator</a>
            <a href="#faq" className="nav-link-item" onClick={e => smoothScroll(e, "#faq")}>FAQ</a>
            <Link href="/blog" className="nav-link-item" style={{ color: "var(--accent)", fontWeight: 600 }}>Blog</Link>
          </nav>

          {/* Right side: theme toggle + CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", flexShrink: 0 }}>
            {/* Theme toggle — hides on scroll */}
            <div
              className="theme-toggle-wrapper"
              style={{
                opacity: scrolled ? 0 : 1,
                transform: scrolled ? "scale(0.8)" : "scale(1)",
                pointerEvents: scrolled ? "none" : "auto",
                transition: "all 400ms ease-out",
              }}
            >
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

            {/* Book CTA */}
            <Link href="/book" className="nav-cta desktop-only" aria-label="Book a free B2B prospecting strategy call with the Prospecting OS team" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Book a Free Strategy Call
            </Link>

            {/* Hamburger */}
            <button className="nav-hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
        <a href="#how-it-works" onClick={e => { smoothScroll(e, "#how-it-works"); setMobileOpen(false); }}>How It Works</a>
        <a href="#pricing" onClick={e => { smoothScroll(e, "#pricing"); setMobileOpen(false); }}>Pricing</a>
        <a href="#roi" onClick={e => { smoothScroll(e, "#roi"); setMobileOpen(false); }}>ROI Calculator</a>
        <a href="#faq" onClick={e => { smoothScroll(e, "#faq"); setMobileOpen(false); }}>FAQ</a>
        <Link href="/blog" onClick={() => setMobileOpen(false)}>Blog</Link>
        <Link href="/book" className="nav-cta" style={{ textDecoration: "none" }} onClick={() => setMobileOpen(false)}>Book a Free Strategy Call</Link>
      </div>

      {/* ══════════ Hero ══════════ */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" width="14" height="14" style={{ borderRadius: 3 }} />
              AI Lead Generation
            </div>
            <h1>
              {heroMounted ? (
                <>
                  <span className="typewriter-text hero-heading-main">
                    {typewriterText.slice(0, HERO_SPLIT_AT)}
                  </span>
                  {typewriterText.length > HERO_SPLIT_AT && (
                    <span className="typewriter-text hero-heading-gradient">
                      {typewriterText.slice(HERO_SPLIT_AT)}
                    </span>
                  )}
                </>
              ) : (
                <span className="typewriter-text hero-heading-main">{FULL_TEXT}</span>
              )}
              <span className="typewriter-cursor">|</span>
            </h1>
            <p className="hero-subtitle">
              Apify lead scraping + Anthropic Claude AI — find, score, enrich, and deliver 500+ qualified B2B leads to your Slack or Telegram every morning. No manual research. Built by{" "}
              <a href="https://flow-forges.com" aria-label="Flow-Forges" style={{ color: "var(--accent)", fontWeight: 500 }}>Flow-Forges</a>.
            </p>
            <div className="hero-ctas">
              <Link href="/tools/icebreaker-generator" className="btn-primary" style={{ textDecoration: "none" }} aria-label="Generate a free AI icebreaker for cold outreach">Generate a Free Icebreaker <ArrowRight size={16} style={{ display: "inline" }} /></Link>
              <a href="#pricing" className="btn-secondary" onClick={e => smoothScroll(e, "#pricing")} aria-label="View Prospecting OS pricing — from $2,500 one-time to fully managed AI SDR">See Pricing Plans <ArrowDown size={16} style={{ display: "inline" }} /></a>
            </div>
            <div className="hero-stats">
              <div><span>500+</span> scored leads/month</div>
              <div><span>97%</span> less manual work</div>
              <div><span>4h</span> to go live</div>
            </div>
          </div>

          {/* Pipeline Visual */}
          <div className="hero-visual" style={{ position: "relative" }}>
            <div className="pipeline-card">
              <div className="pipeline-card-header"><span>HOT LEADS THIS WEEK</span><span style={{ color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem" }} aria-label="Example pipeline output">Example Pipeline</span></div>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span className={`pipeline-live-counter${bump ? " bump" : ""}`}>{counter}</span>
                <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>qualified & scored</div>
              </div>
              <div className="pipeline-steps">
                <div className="pipeline-step"><span className="step-num">1</span>Source leads</div>
                <div className="pipeline-step"><span className="step-num">2</span>Filter decision makers</div>
                <div className="pipeline-step"><span className="step-num">3</span>AI score & qualify</div>
                <div className="pipeline-step"><span className="step-num">4</span>Personalize icebreaker</div>
                <div className="pipeline-step"><span className="step-num">5</span>Alert & deliver</div>
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
            <div className="section-eyebrow">// How It Works</div>
            <h2 className="section-title">From zero to pipeline in 5 steps</h2>
            <p className="section-subtext">Every morning, fresh scored leads land where you work. No manual input. No missed targets.</p>
          </div>
          <div className="how-stepper">

            <div className="how-step reveal" style={{ transitionDelay: "0.05s" }}>
              <div className="how-step-left">
                <div className="how-step-circle">1</div>
                <div className="how-step-line" />
              </div>
              <div className="how-step-body">
                <span className="how-step-badge">APIFY</span>
                <h4 className="how-step-title">Pull your ICP from LinkedIn</h4>
                <p className="how-step-desc">Apify scrapers runs a saved search for your exact ICP every morning — by title, industry, company size, geography. Results export automatically into the pipeline. No CSV uploads, no manual browsing.</p>
                <div className="how-step-sample">
                  <span className="sample-key">Search:</span> &quot;Head of Marketing&quot; · SaaS · 51–200 · US<br />
                  <span className="sample-arrow">→</span> 847 results pulled · 06:00 AM daily
                </div>
              </div>
            </div>

            <div className="how-step reveal" style={{ transitionDelay: "0.15s" }}>
              <div className="how-step-left">
                <div className="how-step-circle">2</div>
                <div className="how-step-line" />
              </div>
              <div className="how-step-body">
                <span className="how-step-badge">AI FILTER</span>
                <h4 className="how-step-title">Strip out the noise — only decision makers pass</h4>
                <p className="how-step-desc">AI cross-checks each profile against your ICP rules. Individual contributors, students, job-seekers, and duplicate contacts are removed automatically. Only founders, VPs, and C-suite in your target segment advance.</p>
                <div className="how-step-sample">
                  <span className="sample-no">&#10007;</span> Filtered out: 612 (IC roles, irrelevant industries)<br />
                  <span className="sample-yes">&#10003;</span> Passed: 235 decision-makers advancing to scoring
                </div>
              </div>
            </div>

            <div className="how-step reveal" style={{ transitionDelay: "0.25s" }}>
              <div className="how-step-left">
                <div className="how-step-circle">3</div>
                <div className="how-step-line" />
              </div>
              <div className="how-step-body">
                <span className="how-step-badge">CLAUDE AI</span>
                <h4 className="how-step-title">Every lead scored 1–10 with reasoning</h4>
                <p className="how-step-desc">Anthropic Claude AI scores each lead against your ICP with a written justification — not just a number. You see exactly why a lead scored 8.5 vs 4.2. Only leads scoring 7+ advance to enrichment. You never touch a cold lead again.</p>
                <div className="how-step-sample">
                  Alex M. · VP Marketing · Acme SaaS · 120 emp<br />
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>Score: 8.5 / 10</span><br />
                  <span className="sample-key">Reason:</span> &quot;Exact ICP match — SaaS, growth stage, US-based, active on LinkedIn, budget signals&quot;
                </div>
              </div>
            </div>

            <div className="how-step reveal" style={{ transitionDelay: "0.35s" }}>
              <div className="how-step-left">
                <div className="how-step-circle">4</div>
                <div className="how-step-line" />
              </div>
              <div className="how-step-body">
                <span className="how-step-badge">AUTO ENRICH</span>
                <h4 className="how-step-title">Company data + a personalized icebreaker</h4>
                <p className="how-step-desc">Each qualified lead is enriched with company news, recent LinkedIn posts, funding events, and tech stack data. Claude then writes a unique, context-specific icebreaker for that lead — not a template. No two icebreakers are the same.</p>
                <div className="how-step-sample">
                  <span className="sample-key">Icebreaker generated:</span><br />
                  &quot;Saw your post about scaling your CS team post-Series B — congrats on the funding. We built a support automation for a similar-stage company that cut ticket volume 70%...&quot;
                </div>
              </div>
            </div>

            <div className="how-step reveal" style={{ transitionDelay: "0.45s" }}>
              <div className="how-step-left">
                <div className="how-step-circle">5</div>
              </div>
              <div className="how-step-body">
                <span className="how-step-badge">AUTO DELIVER</span>
                <h4 className="how-step-title">Hot leads delivered where you work</h4>
                <p className="how-step-desc">Qualified, scored, enriched leads with icebreakers arrive in your Slack channel, Telegram, or directly into HubSpot/Supabase — every morning by 8 AM. Reply directly, copy the icebreaker, close the deal.</p>
                <div className="how-step-sample">
                  <span style={{ color: "var(--success)", fontWeight: 700 }}>NEW HOT LEAD</span> · Score 8.5<br />
                  Alex M. · VP Marketing · Acme SaaS<br />
                  <span className="sample-link">View full profile</span> · <span className="sample-link">Copy icebreaker</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ Pricing ══════════ */}
      <section className="section" id="pricing" aria-label="Prospecting OS pricing plans — Founder's Pilot, Growth, and Scale" style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// Pricing</div>
            <h2 className="section-title">Your AI SDR. A fraction of the cost.</h2>
            <p className="section-subtext" style={{ fontFamily: "var(--font-serif-italic)", fontStyle: "italic" }}>
              An in-house SDR costs $4,000–6,000/month and delivers 50 leads. We deliver 500+ scored leads — already enriched and ready to send.
            </p>
          </div>

          <div className="guarantee-banner reveal">
            <span className="guarantee-dot" />
            Zero-risk guarantee — less than 50 qualified leads in month 1? Month 2 is on us.
          </div>

          <div className="pricing-grid">
            {/* Founder's Pilot */}
            <div className="pricing-card reveal">
              <div className="pricing-plan-badge">FOUNDER-LED</div>
              <h3>Founder's Pilot</h3>
              <div className="price">$1,499</div>
              <span className="price-period">setup + $499/month</span>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "8px 0 16px" }}>I built the engine. I run it for you. 100 ICP-verified leads delivered monthly with personalized outreach sequences.</p>
              <ul className="pricing-features">
                <li>100 ICP-verified leads/month</li>
                <li>3 personalized outreach sequences (Email or LinkedIn)</li>
                <li>Kanban pipeline configured & managed</li>
                <li>Monthly strategy call with founder</li>
                <li>Apify + Anthropic Claude AI scoring</li>
                <li>Supabase-powered dashboard</li>
                <li>Founder-managed delivery</li>
              </ul>
              <Link href="/book" className="btn-primary" style={{ textDecoration: "none" }} aria-label="Apply for the Founder's Pilot">Apply for Pilot</Link>
              <Link href="/tools/free-audit" style={{ display: "block", textAlign: "center", fontSize: "0.78rem", color: "var(--text-tertiary)", marginTop: 10, textDecoration: "none" }}>
                Or try our free pipeline audit first →
              </Link>
            </div>

            {/* Growth */}
            <div className="pricing-card popular reveal">
              <div className="popular-badge">MOST POPULAR</div>
              <h3>Growth</h3>
              <div className="price">$2,499</div>
              <span className="price-period">setup + $999/month</span>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "8px 0 16px" }}>Full multi-channel outbound. Email + LinkedIn sequences, A/B testing, bi-weekly strategy calls, and dedicated Slack access.</p>
              <ul className="pricing-features">
                <li>Everything in Pilot, plus:</li>
                <li>200+ leads/month</li>
                <li>Email + LinkedIn multi-channel sequences</li>
                <li>A/B testing of 2 variants</li>
                <li>Bi-weekly strategy calls</li>
                <li>Dedicated Slack channel</li>
                <li>Reply monitoring & warm handoff within 24 hrs</li>
              </ul>
              <Link href="/book" className="btn-primary" style={{ textDecoration: "none", boxShadow: "0 0 24px var(--accent-glow)" }} aria-label="Book a demo for Growth plan">Book a Demo</Link>
              <Link href="/tools/icebreaker-generator" style={{ display: "block", textAlign: "center", fontSize: "0.78rem", color: "var(--text-tertiary)", marginTop: 10, textDecoration: "none" }}>
                Or generate a free icebreaker →
              </Link>
            </div>

            {/* Scale */}
            <div className="pricing-card reveal">
              <div className="pricing-plan-badge" style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}>ENTERPRISE</div>
              <h3>Scale</h3>
              <div className="price">$4,999</div>
              <span className="price-period">setup + $1,999/month</span>
              <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "8px 0 16px" }}>Full enterprise outbound. 500+ leads, multi-channel, CRM sync, weekly calls, and priority support. For teams that need pipeline at scale.</p>
              <ul className="pricing-features">
                <li>Everything in Growth, plus:</li>
                <li>500+ leads/month</li>
                <li>Email + LinkedIn + GMap multi-channel</li>
                <li>A/B testing of 5 variants</li>
                <li>Weekly strategy calls</li>
                <li>Dedicated Slack + Telegram</li>
                <li>CRM sync (HubSpot/Salesforce)</li>
                <li>Priority support within 4 hrs</li>
              </ul>
              <Link href="/book" className="btn-primary" style={{ textDecoration: "none" }} aria-label="Book a demo for Scale plan">Book a Demo</Link>
              <Link href="/tools/free-audit" style={{ display: "block", textAlign: "center", fontSize: "0.78rem", color: "var(--text-tertiary)", marginTop: 10, textDecoration: "none" }}>
                Or try our free pipeline audit first →
              </Link>
            </div>
          </div>

          {/* Micro-Offer Banner */}
          <div className="micro-offer-banner reveal" style={{
            marginTop: 32,
            background: "linear-gradient(135deg, rgba(232,66,10,0.06) 0%, rgba(232,66,10,0.02) 100%)",
            border: "1px solid rgba(232,66,10,0.2)",
            borderRadius: 16,
            padding: "28px 32px",
            textAlign: "center",
            maxWidth: 480,
            margin: "32px auto 0",
          }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse-dot 2s ease-in-out infinite" }} />
              <span style={{ fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>
                Low-Risk Trial
              </span>
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>Founder's Pilot Micro-Offer</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>50 ICP-verified leads + 5 sequences. One-time. No recurring.</p>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)", marginBottom: 12 }}>$997 <span style={{ fontSize: "0.85rem", color: "var(--text-tertiary)" }}>one-time</span></div>
            <Link href="/book?offer=micro" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 9999, background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
              Grab the Micro-Offer →
            </Link>
          </div>

          <p className="pricing-disclaimer">All plans billed in USD. Setup fees non-refundable. Monthly plans cancel anytime with 14-day notice.</p>
        </div>
      </section>

      {/* ── COMPETITOR COMPARISON ─────────────────────────────────── */}
      <section id="compare" className="section" style={{ background: 'var(--bg-primary)' }}>
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// Why Prospecting OS</div>
            <h2 className="section-title">
              The only option that{' '}
              <em style={{ fontFamily: 'var(--font-serif-italic)', fontStyle: 'italic', fontWeight: 400 }}>thinks</em>{' '}
              before it delivers.
            </h2>
            <p className="section-subtext">
              Other tools give you lists. We give you scored, enriched, icebreaker-ready leads — every morning.
            </p>
          </div>
          <ComparisonTable />
        </div>
      </section>

      {/* ══════════ Results / Social Proof ══════════ */}
      <section className="section" id="social-proof" aria-label="Prospecting OS results — metrics and early access feedback">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// Results</div>
            <h2 className="section-title">What the system delivers</h2>
          </div>

          {/* Live metrics bar */}
          <div className="metrics-bar">
            {[
              { num: "500+", label: "leads scored per active client/month" },
              { num: "8.5", label: "average ICP match score (out of 10)" },
              { num: "~4hrs", label: "average time to go live" },
              { num: "97%", label: "reduction in manual prospecting time" },
            ].map((stat, i) => (
              <div key={i} className="metric-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="metric-number">{stat.num}</div>
                <div className="metric-label">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Early pilot feedback */}
          <div className="beta-feedback-section">
            <div className="beta-feedback-label reveal">EARLY PILOT FEEDBACK</div>
            <div className="testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 24 }}>
              <div className="testimonial-card reveal" style={{ transitionDelay: "0.05s" }}>
                <p className="quote" style={{ fontSize: "0.95rem", lineHeight: 1.7, fontStyle: "italic", color: "var(--text-primary)" }}>
                  &ldquo;The pipeline was live in under 4 hours. First hot lead showed up in Slack the next morning — exactly what we needed.&rdquo;
                </p>
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent) 0%, #ff8c00 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>J</div>
                  <div>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>James R.</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", margin: 0 }}>Founder, B2B SaaS Agency · US</p>
                  </div>
                </div>
              </div>

              <div className="testimonial-card reveal" style={{ transitionDelay: "0.15s" }}>
                <p className="quote" style={{ fontSize: "0.95rem", lineHeight: 1.7, fontStyle: "italic", color: "var(--text-primary)" }}>
                  &ldquo;We were spending 15 hours a week on manual prospecting. Prospecting OS cut that to zero.&rdquo;
                </p>
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>S</div>
                  <div>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Sarah K.</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", margin: 0 }}>Head of Growth, MarTech Startup · UK</p>
                  </div>
                </div>
              </div>

              <div className="testimonial-card reveal" style={{ transitionDelay: "0.25s" }}>
                <p className="quote" style={{ fontSize: "0.95rem", lineHeight: 1.7, fontStyle: "italic", color: "var(--text-primary)" }}>
                  &ldquo;The Claude AI icebreakers are genuinely better than what our SDR wrote. We&apos;re seeing 3x reply rates.&rdquo;
                </p>
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #00d4ff 0%, #0096e0 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>M</div>
                  <div>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Marcus T.</p>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", margin: 0 }}>CEO, Digital Consultancy · AU</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="beta-cta-row reveal">
            <p style={{ color: "var(--text-tertiary)", marginBottom: 16, fontSize: "1rem" }}>Ready to join the pilot?</p>
            <Link href="/book" className="btn-primary" style={{ textDecoration: "none" }}>Apply for the Pilot</Link>
          </div>
        </div>
      </section>

      {/* ── FREE SAMPLE — GET 5 AI-SCORED LEADS ──────────────────── */}
      <section id="sample" className="section" style={{ background: 'var(--bg-primary)' }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="section-header reveal">
            <div className="section-eyebrow">// Free Sample</div>
            <h2 className="section-title">
              See exactly what you{"'"}d receive.{' '}
              <em style={{ fontFamily: 'var(--font-serif-italic)', fontStyle: 'italic', fontWeight: 400 }}>Before you pay.</em>
            </h2>
            <p className="section-subtext">
              Enter your email and industry — we{"'"}ll send you 5 real AI-scored leads with icebreakers for your niche. No card. No demo call required.
            </p>
          </div>
          <EmailCaptureForm />
          <p style={{ color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            No spam. One email. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* ══════════ ROI Calculator ══════════ */}
      <section className="section" id="roi" aria-label="ROI calculator — calculate your AI prospecting return" style={{ background: "var(--bg-secondary)", position: "relative", overflow: "hidden" }}>
        <canvas ref={roiCanvasRef} className="roi-ascii-canvas" />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div className="section-header reveal">
            <div className="section-eyebrow">// ROI Calculator</div>
            <h2 className="section-title">The math doesn&apos;t lie</h2>
            <p className="section-subtext" style={{ fontFamily: "var(--font-serif-italic)", fontStyle: "italic" }}>
              Tell us how your team prospects today. We&apos;ll show you exactly what you&apos;re leaving on the table.
            </p>
          </div>
          <div className="roi-calc-grid">

            {/* Left — sliders */}
            <div className="roi-sliders-col reveal">

              <div className="roi-slider-card">
                <div className="roi-slider-label-row">
                  <label>Hours/week spent on manual prospecting</label>
                  <span>{roiHours} hrs/week</span>
                </div>
                <input type="range" min={2} max={40} step={1} value={roiHours}
                  onChange={e => setRoiHours(Number(e.target.value))}
                  className="roi-slider-input"
                  style={{ background: sliderBg(roiHours, 2, 40) }}
                  aria-label="Hours per week on manual prospecting"
                />
              </div>

              <div className="roi-slider-card">
                <div className="roi-slider-label-row">
                  <label>Your hourly rate (or team cost)</label>
                  <span>${roiRate}/hr</span>
                </div>
                <input type="range" min={25} max={300} step={25} value={roiRate}
                  onChange={e => setRoiRate(Number(e.target.value))}
                  className="roi-slider-input"
                  style={{ background: sliderBg(roiRate, 25, 300) }}
                  aria-label="Hourly rate"
                />
              </div>

              <div className="roi-slider-card">
                <div className="roi-slider-label-row">
                  <label>Meetings booked per week (current)</label>
                  <span>{roiMeetings} meetings/week</span>
                </div>
                <input type="range" min={1} max={30} step={1} value={roiMeetings}
                  onChange={e => setRoiMeetings(Number(e.target.value))}
                  className="roi-slider-input"
                  style={{ background: sliderBg(roiMeetings, 1, 30) }}
                  aria-label="Meetings booked per week"
                />
              </div>

              <div className="roi-slider-card">
                <div className="roi-slider-label-row">
                  <label>Average deal value</label>
                  <span>${roiDeal.toLocaleString()}</span>
                </div>
                <input type="range" min={1000} max={50000} step={1000} value={roiDeal}
                  onChange={e => setRoiDeal(Number(e.target.value))}
                  className="roi-slider-input"
                  style={{ background: sliderBg(roiDeal, 1000, 50000) }}
                  aria-label="Average deal value"
                />
              </div>

            </div>

            {/* Right — live output */}
            <div className="roi-output-card reveal">
              <div className="roi-output-header">YOUR CURRENT STATE</div>

              <div className="roi-output-row">
                <span className="roi-output-label">Monthly cost of manual prospecting</span>
                <span key={roiMonthlyCost} className="roi-output-value roi-value-animated">
                  ${roiMonthlyCost.toLocaleString()} / month
                </span>
                <span className="roi-output-sub">{Math.round(roiHours * 4.33)} hrs/month &times; ${roiRate}/hr</span>
              </div>

              <div className="roi-output-row">
                <span className="roi-output-label">Leads researched manually per month</span>
                <span key={roiManualLeads} className="roi-output-value roi-value-animated">
                  ~{roiManualLeads.toLocaleString()} leads/month
                </span>
                <span className="roi-output-sub">at your current booking rate</span>
              </div>

              <div className="roi-output-divider">
                <span>WITH PROSPECTING OS</span>
              </div>

              <div className="roi-output-row">
                <span className="roi-output-label">AI-scored leads delivered</span>
                <span className="roi-output-value" style={{ color: "var(--accent)" }}>500+ / month</span>
                <span className="roi-output-sub">all 7+ ICP score, enriched, icebreaker included</span>
              </div>

              <div className="roi-output-row">
                <span className="roi-output-label">Additional revenue opportunity/month</span>
                <span key={roiRevenue} className="roi-output-value roi-value-animated" style={{ color: "var(--success)" }}>
                  ${roiRevenue.toLocaleString()} / month
                </span>
                <span className="roi-output-sub">at 3% close rate on 500 scored leads</span>
              </div>

              <div className="roi-output-multiple">
                <span className="roi-output-label">ROI vs Growth plan ($999/mo)</span>
                <span key={roiMultiple} className="roi-multiple-number roi-value-animated">{roiMultiple}x</span>
                <span className="roi-output-sub">return on investment</span>
              </div>

              <Link href="/book" className="btn-primary roi-output-cta" style={{ textDecoration: "none", boxShadow: "0 0 24px var(--accent-glow)", width: "100%", justifyContent: "center" }}>
                Book a Demo — See Your Custom Pipeline
              </Link>

              <p className="roi-output-disclaimer">
                Revenue projections are estimates based on industry-average close rates. Actual results vary by ICP, offer, and outreach quality.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="section" id="faq" aria-label="Frequently asked questions about AI B2B lead generation">
        <div className="container">
          <div className="section-header reveal">
            <div className="section-eyebrow">// FAQ</div>
            <h2 className="section-title">Got questions? We&apos;ve got answers.</h2>
            <p className="section-subtext">Everything you need to know before committing a dollar.</p>
          </div>

          {/* Category filter pills */}
          <div className="faq-filter-pills reveal">
            {(["all", "setup", "results"] as const).map(cat => (
              <button
                key={cat}
                className={`faq-filter-pill${faqFilter === cat ? " active" : ""}`}
                onClick={() => { setFaqFilter(cat); setOpenFaq(null); }}
              >
                {cat === "all" ? "All" : cat === "setup" ? "Setup & Pricing" : "Results & Data"}
              </button>
            ))}
          </div>

          <div className="faq-list reveal">
            {filteredFaqItems.map((item) => {
              const idx = FAQ_ITEMS.indexOf(item);
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className={`faq-item${isOpen ? " open" : ""}`}>
                  <button className="faq-question" onClick={() => setOpenFaq(isOpen ? null : idx)}>
                    {item.q}
                    <span className="faq-icon-circle" aria-hidden="true">{isOpen ? "×" : "+"}</span>
                  </button>
                  <div className={`faq-answer-wrapper${isOpen ? " open" : ""}`}>
                    <p className="faq-answer-text">
                      {item.a}
                      {idx === 4 && (
                        <>{" "}<a href="#pricing" aria-label="Compare Prospecting OS pricing plans" style={{ color: "var(--accent)" }}>Compare all plans →</a></>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ Bottom CTA ══════════ */}
      <section className="bottom-cta-section" id="cta" aria-label="Book a demo — start your AI prospecting pipeline">
        <div className="container">
          <div className="reveal" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

            {/* Live counter pill */}
            <div className="cta-live-pill">
              <span className="cta-live-dot" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--success)" }}>
                Early Access · 3 pilot spots remaining this month
              </span>
            </div>

            {/* Heading */}
            <h2 className="cta-heading">
              <span className="cta-heading-line1">Stop hunting.</span>
              <span className="hero-heading-gradient cta-heading-line2">Start closing.</span>
            </h2>

            {/* Body copy */}
            <p className="cta-body">
              Your ideal clients are on LinkedIn right now — 500+ of them, every week. Our AI finds them, scores them against your ICP, writes their icebreaker, and drops them in your Slack before your morning coffee.
            </p>

            {/* CTA buttons */}
            <div className="cta-group" style={{ marginBottom: 32 }}>
              <Link
                href="/book"
                className="btn-primary"
                style={{ textDecoration: "none", padding: "16px 36px", fontSize: "1rem", boxShadow: "0 0 32px var(--accent-glow)" }}
                aria-label="Book a free demo — see your custom AI prospecting pipeline"
              >
                Book a Free Demo
              </Link>
              <a
                href="#how-it-works"
                className="btn-ghost"
                onClick={e => smoothScroll(e, "#how-it-works")}
                style={{ padding: "16px 28px", fontSize: "1rem" }}
              >
                See how it works
              </a>
            </div>

            {/* Trust signals */}
            <div className="cta-trust-signals">
              <span className="cta-trust-item"><span className="cta-trust-check">&#10003;</span> No contract — cancel anytime</span>
              <span className="cta-trust-item"><span className="cta-trust-check">&#10003;</span> Results in 4 hours or less</span>
              <span className="cta-trust-item"><span className="cta-trust-check">&#10003;</span> 50 leads guaranteed in month 1</span>
            </div>

            {/* Chat nudge */}
            <p className="cta-chat-line">
              Not ready to book?{" "}
              <button className="cta-chat-link" onClick={openChat}>Chat with Pros Bot →</button>
              {" "}— it answers everything.
            </p>

            {/* Free tools strip */}
            <div style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 32, width: "100%", maxWidth: 640 }}>
              <p style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", marginBottom: 16 }}>
                // Try before you buy — free tools
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link
                  href="/tools/free-audit"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "16px 20px", textDecoration: "none",
                    flex: "1 1 220px", maxWidth: 260, transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(232,66,10,0.4)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 6 }}>LM-04</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Free Pipeline Audit</span>
                  <span style={{ fontSize: "0.76rem", color: "var(--text-tertiary)", lineHeight: 1.5 }}>50 leads scored + icebreakers in 24h. No card.</span>
                </Link>
                <Link
                  href="/tools/icebreaker-generator"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "16px 20px", textDecoration: "none",
                    flex: "1 1 220px", maxWidth: 260, transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(232,66,10,0.4)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 6 }}>LM-03</span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>AI Icebreaker Generator</span>
                  <span style={{ fontSize: "0.76rem", color: "var(--text-tertiary)", lineHeight: 1.5 }}>3 free Claude icebreakers. No signup.</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ Footer ══════════ */}
      <LandingFooter />

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
                        onClick={() => { if (qr === "Book a Free Strategy Call") { window.location.href = "/prospecting-os/book"; } else { handleUserMessage(qr); } }}
                      >
                        {qr === "Book a Free Strategy Call" && <Calendar size={11} />}
                        {qr === "How does the AI scoring work?" && <Sparkles size={11} />}
                        {qr === "What plans are available?" && <ArrowRight size={11} />}
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
      {/* Organization + Website schemas live in app/layout.tsx (root) */}
      <script
        type="application/ld+json"
        id="schema-software"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema()) }}
      />
      <script
        type="application/ld+json"
        id="schema-faq"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            faqSchema([
              {
                q: "What is the best AI tool for B2B lead generation?",
                a: "Prospecting OS is an AI-powered B2B lead generation system that combines Apify lead scraping, Anthropic Claude AI scoring, and automated enrichment to deliver 100-500 qualified, scored leads per month. Unlike generic lead scrapers, it filters for decision-makers only and scores each lead 1-10 — only 7+ advance to your inbox.",
              },
              {
                q: "How do I automate LinkedIn prospecting?",
                a: "Prospecting OS automates LinkedIn prospecting in 5 steps: (1) Apify scrapers export your ICP automatically, (2) the system filters for decision-makers only, (3) Anthropic Claude AI scores each lead 1-10, (4) company enrichment and a personalized icebreaker are generated, and (5) hot leads are delivered to Telegram, Slack, or your CRM every morning.",
              },
              {
                q: "What is an AI SDR and is it better than hiring a human SDR?",
                a: "An AI SDR (Sales Development Representative) is an automated system that performs the research, scoring, enrichment, and outreach tasks traditionally done by a human SDR. A human SDR costs $4,000-$6,000/month and delivers ~50 leads. Prospecting OS delivers 100-500 scored leads for a fraction of that cost, running 24/7 with zero manual effort.",
              },
              {
                q: "How many leads can AI generate per month?",
                a: "Prospecting OS delivers 100-500 qualified, AI-scored B2B leads per month depending on plan. Pilot clients receive 100 leads/month, Growth clients 200+ leads/month, Scale clients 500+ leads/month, depending on Apify scraper configuration and ICP specificity.",
              },
              {
                q: "Do I need an Apify lead scraping subscription to use Prospecting OS?",
                a: "Yes. Apify lead scraping is the data engine. A basic plan at $99/month is all you need. The Prospecting OS team helps you configure your ICP search filters during onboarding.",
              },
              {
                q: "How long does it take to go live with Prospecting OS?",
                a: "Pilot: 4 hours (same-day setup). Growth: 2-3 business days. Scale (with multi-channel infrastructure and CRM integration): 1-2 weeks.",
              },
              {
                q: "What industries does AI B2B lead generation work for?",
                a: "Prospecting OS works best for B2B agencies, SaaS companies, consulting firms, and professional services businesses — any company whose ideal clients are active on LinkedIn. It has been used by teams in the US, UK, Australia, Singapore, and India.",
              },
              {
                q: "Is there a money-back guarantee?",
                a: "Yes. Every managed plan (Pilot, Growth, Scale) includes a performance guarantee: if the plan does not deliver at least 50 qualified leads in the first month, month 2 is completely free. The team will also refine your ICP at no additional cost.",
              },
            ])
          ),
        }}
      />
      <script
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
              { "@type": "HowToTool", "name": "Apify lead scraping" },
              { "@type": "HowToTool", "name": "Anthropic Claude AI" },
              { "@type": "HowToTool", "name": "Slack or Telegram" },
            ],
            "step": [
              { "@type": "HowToStep", "name": "Source", "text": "Apify lead scraping automatically exports leads matching your Ideal Customer Profile (ICP) — industry, company size, geography, job title.", "position": 1 },
              { "@type": "HowToStep", "name": "Filter", "text": "The system filters out non-decision-makers. Only founders, C-suite, VPs, and Directors pass through.", "position": 2 },
              { "@type": "HowToStep", "name": "Score", "text": "Anthropic Claude AI scores each lead 1-10 against your ICP criteria. Only leads scoring 7 or above advance to enrichment.", "position": 3 },
              { "@type": "HowToStep", "name": "Enrich", "text": "Company data is enriched automatically. A unique, personalized icebreaker is generated for each lead using AI.", "position": 4 },
              { "@type": "HowToStep", "name": "Deliver", "text": "Hot leads are delivered to your Telegram, Slack, or CRM every morning — scored, enriched, and ready to contact.", "position": 5 },
            ],
          }),
        }}
      />
    </div>
  );
}
