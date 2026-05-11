"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key, Sparkles, Copy, BookmarkPlus, RefreshCw,
  ChevronDown, Check, AlertCircle, Loader2,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { addMessage, getMessages } from "@/lib/db";
import { logActivity } from "@/lib/db";
import type { Lead, Message } from "@/lib/types";

type MessageType = "linkedin_connection" | "linkedin_dm" | "cold_email";
type Tone = "Professional" | "Friendly" | "Direct" | "Consultative";

const MESSAGE_TYPES: { key: MessageType; label: string; maxChars?: number }[] = [
  { key: "linkedin_connection", label: "Connection", maxChars: 300 },
  { key: "linkedin_dm", label: "LinkedIn DM" },
  { key: "cold_email", label: "Cold Email" },
];
const TONES: Tone[] = ["Professional", "Friendly", "Direct", "Consultative"];

const cardBg = "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)";
const cardBorder = "1px solid rgba(201,168,124,0.07)";
const brass = "#C9A87C";

function buildPrompt(lead: Lead, type: MessageType, tone: Tone, offer: string): string {
  const base = `Write a ${type.replace(/_/g, " ")} with ${tone.toLowerCase()} tone for:
Name: ${lead.name} | Title: ${lead.title}
Company: ${lead.company} | Industry: ${lead.industry}
Offer: ${offer || "Not specified"}`;

  if (type === "linkedin_connection") {
    return base + "\n\nMax 300 characters. No hashtags. Reference something specific about the person or company. Be direct and human.";
  }
  if (type === "cold_email") {
    return base + '\n\nReturn ONLY valid JSON, nothing outside: {"subject":"...","body":"..."}';
  }
  return base + "\n\nBe direct, human, value-first. No buzzwords or clichés like \"I hope this finds you well\".";
}

export default function MessageLabPage() {
  const { state, dispatch } = useApp();
  const { leads, apiKey } = state;

  const [keyInput, setKeyInput] = useState(apiKey);
  const [connected, setConnected] = useState(!!apiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("linkedin_connection");
  const [tone, setTone] = useState<Tone>("Professional");
  const [offer, setOffer] = useState("");

  const [output, setOutput] = useState("");
  const [subject, setSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<Message[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  useEffect(() => {
    if (selectedLeadId) { getMessages(selectedLeadId).then(setHistory).catch(() => {}); }
  }, [selectedLeadId]);

  useEffect(() => {
    if (apiKey) { setKeyInput(apiKey); setConnected(true); }
  }, [apiKey]);

  const handleConnect = () => {
    if (!keyInput.trim()) return;
    dispatch({ type: "SET_API_KEY", payload: keyInput.trim() });
    setConnected(true);
    setError("");
    setShowKeyInput(false);
  };

  const handleGenerate = async () => {
    if (!apiKey) { setError("API key required — click the key icon above."); return; }
    if (!selectedLead) { setError("Select a lead first."); return; }
    setError("");
    setGenerating(true);
    setOutput("");
    setSubject("");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an expert B2B sales copywriter for LinkedIn + Email outreach specializing in SaaS, Founders, and Agencies.
Never use "I hope this finds you well" or similar clichés.
Always reference something specific about the person or company.
Be direct, human, value-first. No buzzwords.`,
          messages: [{ role: "user", content: buildPrompt(selectedLead, messageType, tone, offer) }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err = errData as { error?: { message?: string } };
        if (res.status === 429) throw new Error("Rate limited — please wait a moment");
        throw new Error(err.error?.message || `API error: ${res.status}`);
      }

      const data = await res.json() as { content?: Array<{ text?: string }> };
      const text = data.content?.[0]?.text || "";

      if (messageType === "cold_email") {
        try {
          const parsed = JSON.parse(text) as { subject?: string; body?: string };
          setSubject(parsed.subject || "");
          typewriterText(parsed.body || text);
        } catch { typewriterText(text); }
      } else {
        typewriterText(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
    setGenerating(false);
  };

  const typewriterText = (text: string) => {
    setOutput("");
    let i = 0;
    const interval = setInterval(() => {
      setOutput(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 12);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${output}` : output);
    showToast("Copied to clipboard");
  };

  const handleSave = async () => {
    if (!selectedLead) return;
    try {
      const msg = await addMessage({ leadId: selectedLead.id, subject, body: output, tone, messageType });
      dispatch({ type: "ADD_MESSAGE", payload: msg });
      await logActivity({ type: "message_sent", text: `Message sent to ${selectedLead.name}` });
      setHistory(prev => [msg, ...prev].slice(0, 10));
      showToast("Saved to lead");
    } catch { showToast("Failed to save message", "error"); }
  };

  const isOverLimit = messageType === "linkedin_connection" && output.length > 300;

  return (
    <>
      <TopBar title="AI Message Lab" subtitle="Generate personalized outreach with Claude" />

      <div className="flex-1 overflow-hidden flex">
        {/* ── LEFT — Input (42%) ── */}
        <div className="w-[42%] min-w-[360px] flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--sidebar-border)" }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Lead Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                Select Lead
              </label>
              <select
                value={selectedLeadId}
                onChange={e => setSelectedLeadId(e.target.value)}
                className="w-full h-9 rounded-lg mt-1.5 px-3 text-[13px] outline-none transition-all duration-200 appearance-none cursor-pointer"
                style={{
                  color: "var(--ink)", background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                }}
                onFocus={e => (e.currentTarget as HTMLSelectElement).style.borderColor = "var(--accent)"}
                onBlur={e => (e.currentTarget as HTMLSelectElement).style.borderColor = "var(--line)"}
              >
                <option value="">Choose a lead…</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.title} @ {l.company} (Score: {l.score})
                  </option>
                ))}
              </select>
            </div>

            {/* Message Type */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                Message Type
              </label>
              <div className="flex gap-1 mt-1.5 p-0.5 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                {MESSAGE_TYPES.map(t => {
                  const active = messageType === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { setMessageType(t.key); setOutput(""); setSubject(""); }}
                      className="flex-1 text-[11px] py-1.5 rounded-lg font-medium transition-all duration-200"
                      style={active ? {
                        background: "linear-gradient(90deg, rgba(201,168,124,0.12), rgba(201,168,124,0.20))",
                        border: "1px solid rgba(201,168,124,0.20)",
                        color: "var(--accent-ink)",
                        boxShadow: "0 1px 6px rgba(201,168,124,0.06)",
                      } : {
                        background: "transparent",
                        border: "1px solid transparent",
                        color: "var(--ink-3)",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                Tone
              </label>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {TONES.map(t => {
                  const active = tone === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className="text-[11px] px-3 py-1.5 rounded-full font-medium transition-all duration-200"
                      style={active ? {
                        background: "linear-gradient(90deg, rgba(201,168,124,0.12), rgba(201,168,124,0.20))",
                        border: "1px solid rgba(201,168,124,0.20)",
                        color: "var(--accent-ink)",
                      } : {
                        background: "transparent",
                        border: "1px solid var(--line)",
                        color: "var(--ink-3)",
                      }}
                      onMouseEnter={e => {
                        if (!active) (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.25)";
                      }}
                      onMouseLeave={e => {
                        if (!active) (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Offer */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                Your Offer
              </label>
              <textarea
                value={offer}
                onChange={e => setOffer(e.target.value)}
                placeholder="e.g. We help SaaS companies reduce churn by 40%..."
                rows={4}
                className="w-full rounded-lg mt-1.5 px-3 py-2.5 text-[13px] outline-none transition-all duration-200 resize-y"
                style={{
                  color: "var(--ink)", background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                }}
                onFocus={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--accent)"}
                onBlur={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--line)"}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-[12px]" style={{ background: "rgba(212,148,132,0.08)", border: "1px solid rgba(212,148,132,0.20)", color: "var(--negative)" }}>
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* API Key (inline, compact) */}
            <div>
              {!connected && !showKeyInput ? (
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="flex items-center gap-2 text-[11px] font-medium transition-all duration-200 rounded-lg px-3 py-2"
                  style={{ color: "var(--ink-4)", border: "1px dashed var(--line)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = "var(--ink-2)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = "var(--ink-4)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
                  }}
                >
                  <Key size={11} /> Add API key to generate
                </button>
              ) : showKeyInput && !connected ? (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="flex-1 h-8 rounded-lg px-3 text-xs font-mono outline-none transition-all duration-200"
                    style={{ color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
                    onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                    onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"}
                    onKeyDown={e => { if (e.key === "Enter") handleConnect(); }}
                  />
                  <button
                    onClick={handleConnect}
                    disabled={!keyInput.trim()}
                    className="h-8 px-3 rounded-lg text-[11px] font-medium transition-all duration-200 disabled:opacity-40"
                    style={{ background: "rgba(201,168,124,0.12)", color: "var(--accent)", border: "1px solid rgba(201,168,124,0.20)" }}
                  >
                    Connect
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
                  <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>API connected</span>
                </div>
              )}
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={generating || !apiKey || !selectedLead}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: generating
                  ? "rgba(201,168,124,0.08)"
                  : "linear-gradient(90deg, rgba(201,168,124,0.16), rgba(201,168,124,0.10))",
                color: "var(--accent-ink)",
                border: "1px solid rgba(201,168,124,0.25)",
                boxShadow: generating ? "none" : "0 0 16px rgba(201,168,124,0.10)",
              }}
              onMouseEnter={e => {
                if (!generating) {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(201,168,124,0.20)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.40)";
                }
              }}
              onMouseLeave={e => {
                if (!generating) {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(201,168,124,0.10)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.25)";
                }
              }}
            >
              {generating ? (
                <><Loader2 size={14} className="animate-spin" /> Generating…</>
              ) : (
                <><Sparkles size={14} /> Generate with Claude</>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT — Output (58%) ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Output Box */}
            <div
              className="rounded-xl p-5 min-h-[220px] relative"
              style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
            >
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3 select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                Generated Message
              </h3>
              {output ? (
                <div>
                  {subject && (
                    <div className="mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>Subject</span>
                      <p className="text-[14px] mt-1 font-medium" style={{ color: "var(--ink)" }}>{subject}</p>
                      <hr className="my-3" style={{ borderColor: "var(--line)" }} />
                    </div>
                  )}
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>{output}</p>
                  {generating && (
                    <span className="inline-block w-1.5 h-4 animate-pulse ml-0.5 align-middle rounded-sm" style={{ background: brass }} />
                  )}
                  {output && (
                    <span
                      className="absolute bottom-4 right-4 text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-md"
                      style={isOverLimit
                        ? { background: "rgba(212,148,132,0.12)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.20)" }
                        : { background: "rgba(237,234,226,0.04)", color: "var(--ink-4)", border: "1px solid var(--line)" }
                      }
                    >
                      {output.length}{messageType === "linkedin_connection" ? "/300" : ""}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-center pt-16" style={{ color: "var(--ink-3)", opacity: 0.5 }}>
                  {generating ? "Generating…" : "Generated message will appear here"}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {output && (
              <div className="flex items-center gap-2">
                {([
                  { icon: Copy, label: "Copy", onClick: handleCopy },
                  { icon: BookmarkPlus, label: "Save to Lead", onClick: handleSave },
                  { icon: RefreshCw, label: "Regenerate", onClick: handleGenerate, disabled: generating },
                ] as const).map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    disabled={"disabled" in btn && btn.disabled}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--line)",
                      color: "var(--ink-3)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(201,168,124,0.06)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,124,0.20)";
                      (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
                      (e.currentTarget as HTMLElement).style.color = "var(--ink-3)";
                    }}
                  >
                    <btn.icon size={12} /> {btn.label}
                  </button>
                ))}
              </div>
            )}

            {/* History */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
            >
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between px-5 py-3 transition-colors duration-200"
                style={{ color: "var(--ink-3)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Message History ({history.length})</span>
                <ChevronDown size={14} style={{ transform: historyOpen ? "rotate(180deg)" : "", transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)" }} />
              </button>
              {historyOpen && (
                <div style={{ borderTop: "1px solid var(--line)" }}>
                  {history.length === 0 ? (
                    <p className="text-[12px] text-center py-8" style={{ color: "var(--ink-3)" }}>No messages yet for this lead</p>
                  ) : (
                    history.map(m => (
                      <div key={m.id} className="px-5 py-3 transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={m.messageType === "cold_email"
                              ? { background: "rgba(201,168,124,0.08)", color: "var(--accent)", border: "1px solid rgba(201,168,124,0.15)" }
                              : m.messageType === "linkedin_dm"
                                ? { background: "rgba(154,179,200,0.08)", color: "var(--info)", border: "1px solid rgba(154,179,200,0.15)" }
                                : { background: "rgba(168,201,154,0.08)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.15)" }
                            }
                          >
                            {m.messageType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>{m.tone}</span>
                          <div className="flex-1" />
                          <button
                            onClick={() => navigator.clipboard.writeText(m.body)}
                            className="transition-colors duration-150"
                            style={{ color: "var(--ink-3)" }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink)"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                        <p className="text-[12px] line-clamp-2" style={{ color: "var(--ink-2)" }}>{m.body.slice(0, 100)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
