"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key, Sparkles, Copy, BookmarkPlus, RefreshCw,
  ChevronDown, Check, AlertCircle, Loader2, FlaskConical,
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

function getScoreTier(score: number): { label: string; color: string; guidance: string } {
  if (score >= 80) return {
    label: "HOT",
    color: "#ff6b35",
    guidance: `This is a HOT lead (score: ${score}/100). They closely match your ICP. Use a confident, direct tone. Reference their specific role and company size. Push for a meeting.`,
  };
  if (score >= 50) return {
    label: "WARM",
    color: "#00d4ff",
    guidance: `This is a WARM lead (score: ${score}/100). Good potential but needs nurturing. Use a value-first, curiosity-driven tone. Lead with a relevant insight before the ask.`,
  };
  return {
    label: "COLD",
    color: "#6b6b80",
    guidance: `This is a COLD lead (score: ${score}/100). Low ICP match. Use a soft, non-pushy tone. Focus on education and relationship building. No hard CTA.`,
  };
}

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

const GEMINI_KEY = "proos_gemini_key";

export default function MessageLabPage() {
  const { state, dispatch } = useApp();
  const { leads } = state;

  const geminiApiKey = typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY) || "" : "";
  const [keyInput, setKeyInput] = useState(geminiApiKey);
  const [connected, setConnected] = useState(!!geminiApiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("linkedin_connection");
  const [tone, setTone] = useState<Tone>("Professional");
  const [offer, setOffer] = useState("");

  const [output, setOutput] = useState("");
  const [subject, setSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [variantOutputs, setVariantOutputs] = useState<string[]>([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);

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

  const getActiveApiKey = () => {
    return typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY) || "" : "";
  };

  const handleConnect = () => {
    if (!keyInput.trim()) return;
    localStorage.setItem(GEMINI_KEY, keyInput.trim());
    setConnected(true);
    setError("");
    setShowKeyInput(false);
  };

  const handleGenerate = async () => {
    const key = getActiveApiKey();
    if (!key) { setError("API key required — add your Gemini key above."); return; }
    if (!selectedLead) { setError("Select a lead first."); return; }
    setError("");
    setGenerating(true);
    setOutput("");
    setSubject("");

    try {
      const scoreTier = getScoreTier(selectedLead.score);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: `You are an expert B2B sales copywriter for LinkedIn + Email outreach specializing in SaaS, Founders, and Agencies.
Never use "I hope this finds you well" or similar clichés.
Always reference something specific about the person or company.
Be direct, human, value-first. No buzzwords.
${scoreTier.guidance}` }],
            },
            contents: [{ parts: [{ text: buildPrompt(selectedLead, messageType, tone, offer) }] }],
            generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 300 },
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err = errData as { error?: { message?: string } };
        if (res.status === 429) throw new Error("Rate limited — please wait a moment");
        throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
      }

      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.find(p => !p.thought)?.text ?? parts[0]?.text ?? "";

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

  const handleGenerateVariants = async () => {
    const key = getActiveApiKey();
    if (!key) { setError("API key required — add your Gemini key above."); return; }
    if (!selectedLead) { setError("Select a lead first."); return; }
    setError("");
    setGeneratingVariants(true);
    setVariantOutputs([]);

    // Generate 2 variants with different tone/approach
    const variantPrompts = [
      { label: "A (Direct + Value-first)", tone: "Direct" as Tone, instruction: "Be direct and value-first. Lead with a specific insight about their company." },
      { label: "B (Consultative + Question-led)", tone: "Consultative" as Tone, instruction: "Be consultative. Ask a thought-provoking question about their industry or role." },
    ];

    try {
      const results: string[] = [];
      for (const vp of variantPrompts) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: `You are an expert B2B sales copywriter. ${vp.instruction} Never use clichés. Be specific. Keep under 500 chars.` }],
              },
              contents: [{ parts: [{ text: buildPrompt(selectedLead, messageType, vp.tone, offer) }] }],
              generationConfig: { maxOutputTokens: 500 },
            }),
          },
        );

        if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        results.push(text);
      }

      setVariantOutputs(results);
      // Save both as messages
      for (const text of results) {
        await addMessage({
          leadId: selectedLead.id,
          subject: messageType.replace(/_/g, " "),
          body: text,
          tone: "Professional",
          messageType: messageType,
        });
      }
      showToast("A/B variants generated and saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
    setGeneratingVariants(false);
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
      <TopBar title="AI Message Lab" subtitle="Generate personalized outreach with Gemini" />

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
                {leads.map(l => {
                  const tier = getScoreTier(l.score);
                  return (
                    <option key={l.id} value={l.id}>
                      [{tier.label}] {l.name} — {l.title} @ {l.company} ({l.score})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Lead Intelligence Card */}
            {selectedLead && (() => {
              const tier = getScoreTier(selectedLead.score);
              return (
                <div
                  className="rounded-lg p-3 flex items-center gap-3"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
                >
                  {/* Score ring */}
                  <div className="shrink-0 relative w-12 h-12">
                    <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" strokeWidth="4" />
                      <circle
                        cx="24" cy="24" r="20" fill="none"
                        stroke={tier.color}
                        strokeWidth="4"
                        strokeDasharray={`${(selectedLead.score / 100) * 125.7} 125.7`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 4px ${tier.color}60)` }}
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums"
                      style={{ color: tier.color }}
                    >
                      {selectedLead.score}
                    </span>
                  </div>

                  {/* Lead info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{selectedLead.name}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--ink-3)" }}>{selectedLead.title} @ {selectedLead.company}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}30` }}
                      >
                        {tier.label}
                      </span>
                      {selectedLead.kanbanColumn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--line)", color: "var(--ink-3)" }}>
                          {selectedLead.kanbanColumn}
                        </span>
                      )}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: selectedLead.emailStatus === "verified"
                            ? "rgba(0,255,136,0.1)" : selectedLead.emailStatus === "risky"
                            ? "rgba(0,212,255,0.1)" : "rgba(107,107,128,0.1)",
                          color: selectedLead.emailStatus === "verified"
                            ? "var(--positive)" : selectedLead.emailStatus === "risky"
                            ? "var(--accent)" : "var(--ink-3)",
                        }}
                      >
                        {selectedLead.emailStatus}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                    placeholder="AIzaSy..."
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
              disabled={generating || !connected || !selectedLead}
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
                <><Sparkles size={14} /> Generate with Gemini</>
              )}
            </button>

            {/* A/B Test Button */}
            <button
              onClick={handleGenerateVariants}
              disabled={generatingVariants || generating || !connected || !selectedLead}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              style={{
                background: generatingVariants
                  ? "rgba(124,58,237,0.08)"
                  : "linear-gradient(90deg, rgba(124,58,237,0.14), rgba(124,58,237,0.06))",
                color: "var(--accent-purple)",
                border: "1px solid rgba(124,58,237,0.22)",
              }}
            >
              {generatingVariants ? (
                <><Loader2 size={14} className="animate-spin" /> Generating A/B variants…</>
              ) : (
                <><FlaskConical size={14} /> Generate A/B Test (2 variants)</>
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

            {/* A/B Variant Outputs */}
            {variantOutputs.length === 2 && (
              <div className="rounded-xl p-5" style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.12)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <FlaskConical size={12} style={{ color: "var(--accent-purple)" }} />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--accent-purple)" }}>
                    A/B Variants — copy these into Sequence Builder variant fields
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {variantOutputs.map((text, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-2 inline-block" style={{ background: "rgba(124,58,237,0.12)", color: "var(--accent-purple)" }}>
                        Variant {String.fromCharCode(65 + i)}
                      </span>
                      <p className="text-[12px] whitespace-pre-wrap mt-1.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>{text}</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(text); showToast(`Variant ${String.fromCharCode(65 + i)} copied`, "success"); }}
                        className="mt-2 text-[10px] px-2 py-1 rounded-md font-medium transition-all"
                        style={{ color: "var(--ink-3)", border: "1px solid var(--line)" }}
                      >
                        <Copy size={10} className="inline mr-1" /> Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
