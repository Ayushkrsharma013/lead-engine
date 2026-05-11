"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronRight, Sparkles, Send, Loader2, X,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { usePathname } from "next/navigation";
import type { AgentMessage } from "@/lib/types";

const EXPANDED_W = 360;
const GEMINI_KEY = "proos_gemini_key";
const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";

/* ─── Context builder ────────────────────────────────────────────────────── */

function buildContext(state: ReturnType<typeof useApp>["state"], pathname: string): string {
  const { leads, messages, stats, activityLog } = state;
  const hot = leads.filter(l => l.score > 80).length;
  const verified = leads.filter(l => l.emailStatus === "verified").length;
  const contacted = leads.filter(l => l.status && l.status !== "new").length;
  const meetings = leads.filter(l => l.status === "meeting" || l.status === "won").length;

  const pageMap: Record<string, string> = {
    "/": "Lead Intelligence — viewing and filtering leads",
    "/dashboard": "Command Center — dashboard overview",
    "/message-lab": "AI Message Lab — generating outreach messages",
    "/scorer": "Lead Scorer — ICP scoring leads",
    "/sequences": "Sequence Builder — building outreach sequences",
    "/kanban": "Kanban Pipeline — managing pipeline stages",
    "/analytics": "Analytics — viewing charts and reports",
    "/clients": "Client Manager — managing clients",
    "/settings": "Settings — configuring ProOS",
  };

  const recent = (activityLog as { text: string }[]).slice(0, 3).map(a => a.text).join("; ");

  return `ProOS live context:
- Leads: ${leads.length} total (${hot} hot, ${verified} verified email)
- Pipeline: ${contacted} contacted, ${meetings} meetings/won
- Avg ICP score: ${stats.avgScore}/100 | Top industry: ${stats.topIndustry}
- Messages: ${messages.length} | Current page: ${pageMap[pathname] || pathname}
- Recent: ${recent || "none"}

You have full control over ProOS. You can analyze leads, suggest actions, run the agent, check pipeline health, generate messages, score leads, and manage sequences. Be proactive, concise, and helpful.`;
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function AgentPanel() {
  const { state, dispatch } = useApp();
  const pathname = usePathname();
  const open = !state.agentCollapsed;

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [greeted, setGreeted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = state.agentMessages;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 350);
  }, [open]);

  // Proactive greeting
  useEffect(() => {
    if (open && !greeted && messages.length === 0) {
      setGreeted(true);
      const { leads, messages: msgs } = state;
      const hot = leads.filter(l => l.score > 80).length;
      const meetings = leads.filter(l => l.status === "meeting" || l.status === "won").length;
      dispatch({
        type: "ADD_AGENT_MESSAGE",
        payload: {
          id: `a-${Date.now()}`, role: "agent",
          text: `Hey! I'm ProOS Agent — I live here 24/7 with full access to your pipeline.

You have **${leads.length}** leads (${hot} hot, ${meetings} meetings booked). I can also be reached on Telegram.

Try: "analyze my pipeline", "find my best leads", or /help`,
          ts: new Date().toISOString(),
        },
      });
    }
  }, [open, greeted, messages.length]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        dispatch({ type: "TOGGLE_AGENT" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);

  // Poll for Telegram messages
  useEffect(() => {
    if (!TELEGRAM_BOT_TOKEN) return;
    let lastUpdateId = 0;
    const poll = async () => {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`,
        );
        const data = await res.json() as { ok?: boolean; result?: Array<{ update_id: number; message?: { chat?: { id: number }; text?: string; from?: { first_name?: string } } }> };
        if (data.ok && data.result) {
          for (const update of data.result) {
            lastUpdateId = update.update_id;
            const msg = update.message;
            if (msg?.text) {
              const from = msg.from?.first_name || "Telegram";
              dispatch({
                type: "ADD_AGENT_MESSAGE",
                payload: {
                  id: `tg-${update.update_id}`, role: "user",
                  text: msg.text,
                  ts: new Date().toISOString(),
                },
              });
              // Auto-reply via Gemini
              handleTelegramReply(msg.text, msg.chat?.id);
            }
          }
        }
      } catch { /* ignore polling errors */ }
    };
    const interval = setInterval(poll, 3000);
    poll();
    return () => clearInterval(interval);
  }, [dispatch]);

  const handleTelegramReply = async (text: string, chatId?: number) => {
    if (!chatId) return;
    const key = typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY) || "" : "";
    if (!key) return;

    try {
      const systemCtx = buildContext(state, pathname);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: `You are the ProOS Agent in a B2B prospecting platform. Reply via Telegram — be concise, helpful, and direct.

${systemCtx}`,
              }],
            },
            contents: [{ parts: [{ text }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          }),
        },
      );

      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Got it.";

      dispatch({
        type: "ADD_AGENT_MESSAGE",
        payload: { id: `tg-r-${Date.now()}`, role: "agent", text: reply, ts: new Date().toISOString() },
      });

      // Send reply back via Telegram
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: reply }),
      });
    } catch { /* silent */ }
  };

  const addMsg = (role: "user" | "agent", text: string) => {
    dispatch({
      type: "ADD_AGENT_MESSAGE",
      payload: { id: `m-${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text, ts: new Date().toISOString() },
    });
  };

  const runAgent = async (userText: string) => {
    setThinking(true);
    try {
      const key = typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY) || "" : "";
      if (!key) {
        addMsg("agent", "I need a Gemini API key. Add one in Settings → API Keys → Google Gemini.");
        setThinking(false);
        return;
      }

      const history = [...messages.slice(-10), { id: "cur", role: "user" as const, text: userText, ts: "" }]
        .map(m => `${m.role === "agent" ? "Agent" : "User"}: ${m.text}`).join("\n\n");

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: `You are the ProOS Agent — an AI living inside LinkedIn ProOS, a full-stack B2B prospecting platform. You have full access and control over the platform. You can: analyze leads, check pipeline health, suggest actions, run the lead agent, generate messages, score leads, manage sequences, and more. You can be reached via Telegram too.

${buildContext(state, pathname)}

Telegram integration is active — the user can chat with you from Telegram and you'll respond there too. Keep responses concise for Telegram.`,
              }],
            },
            contents: [{ parts: [{ text: history }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
          }),
        },
      );

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I didn't get a response. Try again?";
      addMsg("agent", reply);
    } catch (err) {
      addMsg("agent", err instanceof Error ? err.message : "Something went wrong. Try again?");
    }
    setThinking(false);
  };

  const handleSlashCommand = (text: string): string | null => {
    const { leads, messages: msgs, sequences, campaigns, clients, stats } = state;
    switch (text.trim().toLowerCase()) {
      case "/leads":
        return `**Leads:** ${leads.length} total · ${leads.filter(l => l.score > 80).length} hot · ${leads.filter(l => l.emailStatus === "verified").length} verified · Avg score ${stats.avgScore}/100 · Top: ${stats.topIndustry}`;
      case "/pipeline": {
        const parts = ["new","contacted","replied","hot","meeting","won","lost"].map(s =>
          `${s}: ${leads.filter(l => (l.status||"new")===s).length}`
        );
        return `**Pipeline:** ${parts.join(" · ")}`;
      }
      case "/stats":
        return `**ProOS:** ${leads.length} leads · ${msgs.length} messages · ${sequences.length} sequences · ${campaigns.length} campaigns · ${clients.length} clients · Avg score ${stats.avgScore}`;
      case "/help":
        return "**Commands:** /leads · /pipeline · /stats · /help\n\nI can analyze leads, check pipeline, suggest actions, score leads, generate messages — just ask. Also reachable on Telegram.";
      default:
        return null;
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");

    const cmd = handleSlashCommand(text);
    if (cmd) {
      addMsg("user", text);
      addMsg("agent", cmd);
      return;
    }
    addMsg("user", text);
    runAgent(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-10"
          style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}
          onClick={() => dispatch({ type: "TOGGLE_AGENT" })}
        />
      )}

      {/* Panel */}
      <aside
        className="h-screen shrink-0 flex flex-col fixed right-0 top-0 z-20 overflow-hidden"
        style={{
          width: open ? EXPANDED_W : 0,
          background: "var(--sidebar-bg)",
          borderLeft: open ? "1px solid var(--sidebar-border)" : "none",
          transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.4)" : "none",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{ height: 56, borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(201,168,124,0.08)", border: "1px solid rgba(201,168,124,0.18)" }}
            >
              <Sparkles size={13} style={{ color: "var(--accent)" }} />
            </div>
            <span className="text-[13px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              ProOS Agent
            </span>
            <span className="w-2 h-2 rounded-full animate-pulse-live" style={{ background: "var(--positive)", boxShadow: "0 0 4px var(--positive)" }} />
            {TELEGRAM_BOT_TOKEN && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(154,179,200,0.10)", color: "var(--info)", border: "1px solid rgba(154,179,200,0.18)" }}>
                TG
              </span>
            )}
          </div>
          <button
            onClick={() => dispatch({ type: "TOGGLE_AGENT" })}
            className="flex items-center justify-center rounded-lg transition-all duration-200"
            style={{ width: 28, height: 28, color: "var(--ink-3)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)";
              (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !thinking && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px] text-center" style={{ color: "var(--ink-3)", opacity: 0.5 }}>
                Ask me anything about your pipeline, leads, or what to do next.
              </p>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[88%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed"
                style={m.role === "user" ? {
                  background: "linear-gradient(135deg, rgba(201,168,124,0.16), rgba(201,168,124,0.10))",
                  border: "1px solid rgba(201,168,124,0.18)",
                  color: "var(--ink)",
                } : {
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-2)",
                }}
              >
                <span className="whitespace-pre-wrap">{m.text}</span>
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-1" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={thinking ? "Thinking..." : "Ask anything... (/help)"}
              disabled={thinking}
              className="flex-1 h-9 rounded-lg px-3 text-[12px] outline-none transition-all duration-200 disabled:opacity-50"
              style={{ color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
              onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
              onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || thinking}
              className="flex items-center justify-center rounded-lg transition-all duration-200 shrink-0 disabled:opacity-30"
              style={{
                width: 36, height: 36,
                background: input.trim() ? "rgba(201,168,124,0.12)" : "transparent",
                border: input.trim() ? "1px solid rgba(201,168,124,0.20)" : "1px solid transparent",
                color: input.trim() ? "var(--accent)" : "var(--ink-3)",
              }}
            >
              {thinking ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[9px] select-none" style={{ color: "var(--ink-4)", opacity: 0.35 }}>
              Cmd+J to toggle · Gemini-powered
            </p>
            {TELEGRAM_BOT_TOKEN && (
              <p className="text-[9px] select-none" style={{ color: "var(--info)", opacity: 0.5 }}>
                Connected to Telegram
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
