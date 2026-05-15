"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Sparkles, X, Calendar, ArrowRight, CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";
import {
  type BookingStep, type BookingData, type BotMessage,
  initialBookingState, getNextStep, getTimeQuickReplies, getTypeQuickReplies,
} from "@/lib/booking-chat";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface ChatMsg {
  text: string;
  type: "bot" | "user";
  quickReplies?: string[];
  isSuccess?: boolean;
}

function formatMsg(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--accent,#e8420a);font-weight:600">$1</strong>')
    .replace(/\n/g, "<br/>");
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  embedded?: boolean;
  bookedSlots?: Set<string>;
}

export default function ProsBotPanel({ embedded, bookedSlots }: Props) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      text: "Hi! I'm <strong style=\"color:var(--accent,#e8420a);font-weight:600\">Pros Bot</strong>. Let's book your demo! First, what type of meeting are you looking for?",
      type: "bot",
      quickReplies: getTypeQuickReplies(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bookingRef = useRef<{ step: BookingStep; data: Partial<BookingData> }>(initialBookingState());

  const addBot = useCallback((msg: BotMessage, isSuccess = false) => {
    setMessages(prev => [...prev, { text: msg.text, type: "bot", quickReplies: msg.quickReplies, isSuccess }]);
  }, []);

  const addUser = useCallback((text: string) => {
    setMessages(prev => [...prev, { text, type: "user" }]);
  }, []);

  const handle = useCallback((text: string) => {
    addUser(text);
    setTyping(true);

    const clean = text.toLowerCase().trim();
    if (clean === "reset" || clean === "start over") {
      bookingRef.current = initialBookingState();
    }

    const result = getNextStep(bookingRef.current.step, bookingRef.current.data, text);

    // Check for double-booking when transitioning to confirming
    if (
      result.step === "confirming" &&
      result.data.date && result.data.time &&
      result.data.date !== "Flexible" && result.data.time !== "Flexible" &&
      bookedSlots?.has(`${result.data.date}|${result.data.time}`)
    ) {
      bookingRef.current = { step: "collecting_datetime", data: { ...result.data, date: undefined, time: undefined } };
      setTimeout(() => {
        setTyping(false);
        addBot({
          text: `That slot (**${result.data.date} at ${result.data.time}**) is already taken. Please pick a different time.`,
          quickReplies: getTimeQuickReplies(),
        });
      }, 700 + Math.random() * 600);
      return;
    }

    bookingRef.current = { step: result.step, data: result.data };

    // Persist completed bookings
    if (result.step === "done" && result.data.email) {
      fetch("/prospecting-os/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.data.name, email: result.data.email,
          company: result.data.company, date: result.data.date,
          time: result.data.time,
          type: result.data.type || "demo",
          phone: result.data.phone || "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          notes: "Booked via Pros Bot panel",
        }),
      }).catch(() => {});
    }

    setTimeout(() => {
      setTyping(false);
      addBot(result.botMessage, result.step === "done");
    }, 700 + Math.random() * 600);
  }, [addUser, addBot, bookedSlots]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    handle(t);
  }, [input, handle]);

  /* ─── Render ──────────────────────────────────────────────────────────── */
  if (!open && !embedded) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
        style={{ background: "var(--accent, #e8420a)", color: "#fff", boxShadow: "0 8px 24px rgba(232,66,10,0.35)" }}
        aria-label="Open Pros Bot"
      >
        <Sparkles size={22} />
      </button>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-card, #1a1917)", border: "1px solid var(--border-card, rgba(255,255,255,0.06))",
      borderRadius: 16, overflow: "hidden",
      fontFamily: "'Cabinet Grotesk', 'Geist', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        borderBottom: "1px solid var(--divider, rgba(255,255,255,0.06))",
        background: "var(--chat-header-bg, #141310)", flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--accent, #e8420a)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Sparkles size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary, #f5f4f1)", letterSpacing: "-0.01em" }}>
            Pros Bot
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--success, #22c55e)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} /> Online — replies instantly
          </div>
        </div>
        {!embedded && (
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4, lineHeight: 1 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <div style={{
              maxWidth: "88%", padding: "10px 14px", borderRadius: 16,
              fontSize: "0.8rem", lineHeight: 1.5,
              animation: "fade-in-up 0.3s ease",
              wordBreak: "break-word",
              ...(m.type === "bot" ? {
                alignSelf: "flex-start", background: "var(--chat-bubble-bot, #262522)",
                color: "var(--text-primary, #f5f4f1)",
                borderBottomLeftRadius: 6,
                border: "1px solid var(--border-card, rgba(255,255,255,0.06))",
                ...(m.isSuccess ? { borderColor: "rgba(34,197,94,0.3)" } : {}),
              } : {
                alignSelf: "flex-end", background: "var(--accent, #e8420a)",
                color: "#fff", borderBottomRightRadius: 6,
                boxShadow: "0 2px 8px rgba(232,66,10,0.3)",
              }),
            }}>
              <span dangerouslySetInnerHTML={{ __html: formatMsg(m.text) }} />
              {m.quickReplies && m.quickReplies.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--divider, rgba(255,255,255,0.06))" }}>
                  {m.quickReplies.map((qr, j) => (
                    <button
                      key={j}
                      onClick={() => handle(qr)}
                      style={{
                        fontFamily: "inherit", fontSize: "0.65rem", fontWeight: 600,
                        padding: "5px 10px", borderRadius: 999,
                        border: "1px solid var(--border, rgba(255,255,255,0.08))",
                        background: m.type === "bot" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.2)",
                        color: m.type === "bot" ? "var(--text-primary, #f5f4f1)" : "#fff",
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3,
                        transition: "all 0.2s",
                      }}
                    >
                      {qr === "Book a Demo" && <Calendar size={10} />}
                      {qr === "How it works" && <Sparkles size={10} />}
                      {qr}
                    </button>
                  ))}
                </div>
              )}
              {m.isSuccess && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  marginTop: 6, fontSize: "0.62rem", fontWeight: 600,
                  color: "var(--success, #22c55e)", background: "var(--success-bg, rgba(34,197,94,0.1))",
                  padding: "3px 8px", borderRadius: 999,
                }}>
                  <CheckCircle2 size={12} /> Booking confirmed
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{
            alignSelf: "flex-start", padding: "11px 16px", borderRadius: 16,
            borderBottomLeftRadius: 6, background: "var(--chat-bubble-bot, #262522)",
            border: "1px solid var(--border-card, rgba(255,255,255,0.06))",
          }}>
            <div style={{ display: "flex", gap: 3 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: `bounce-dot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 14px 14px",
        borderTop: "1px solid var(--divider, rgba(255,255,255,0.06))",
        flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Type your message..."
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 999,
            border: "1px solid var(--border, rgba(255,255,255,0.08))",
            background: "var(--chat-input-bg, #141310)",
            color: "var(--text-primary, #f5f4f1)",
            fontFamily: "inherit", fontSize: "0.8rem", outline: "none",
          }}
        />
        <button
          onClick={send}
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "var(--accent, #e8420a)", border: "none",
            color: "#fff", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "transform 0.2s",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
