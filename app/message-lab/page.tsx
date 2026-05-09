"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Key, Sparkles, Copy, BookmarkPlus, RefreshCw,
  ChevronDown, Check, AlertCircle, Loader2, Send,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { addMessage, getMessages } from "@/lib/db";
import { logActivity } from "@/lib/db";
import type { Lead, Message } from "@/lib/types";

type MessageType = "linkedin_connection" | "linkedin_dm" | "cold_email";
type Tone = "Professional" | "Friendly" | "Direct" | "Consultative";

const MESSAGE_TYPES: { key: MessageType; label: string; maxChars?: number }[] = [
  { key: "linkedin_connection", label: "LinkedIn Connection", maxChars: 300 },
  { key: "linkedin_dm", label: "LinkedIn DM" },
  { key: "cold_email", label: "Cold Email" },
];
const TONES: Tone[] = ["Professional", "Friendly", "Direct", "Consultative"];

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

  // API key
  const [keyInput, setKeyInput] = useState(apiKey);
  const [connected, setConnected] = useState(!!apiKey);

  // Form
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("linkedin_connection");
  const [tone, setTone] = useState<Tone>("Professional");
  const [offer, setOffer] = useState("");

  // Output
  const [output, setOutput] = useState("");
  const [subject, setSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [charCount, setCharCount] = useState(0);

  // Message history
  const [history, setHistory] = useState<Message[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Toast
  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Load history
  useEffect(() => {
    if (selectedLeadId) {
      getMessages(selectedLeadId).then(setHistory).catch(() => {});
    }
  }, [selectedLeadId]);

  // Sync API key from context
  useEffect(() => {
    if (apiKey) { setKeyInput(apiKey); setConnected(true); }
  }, [apiKey]);

  const handleConnect = () => {
    if (!keyInput.trim()) return;
    dispatch({ type: "SET_API_KEY", payload: keyInput.trim() });
    setConnected(true);
    setError("");
  };

  const handleGenerate = async () => {
    if (!apiKey) { setError("Please connect your Anthropic API key first."); return; }
    if (!selectedLead) { setError("Please select a lead."); return; }
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
        } catch {
          typewriterText(text);
        }
      } else {
        typewriterText(text);
        setCharCount(text.length);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      showToast(msg, "error");
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
    const fullText = subject ? `Subject: ${subject}\n\n${output}` : output;
    navigator.clipboard.writeText(fullText);
    showToast("Copied to clipboard");
  };

  const handleSave = async () => {
    if (!selectedLead) return;
    try {
      const msg = await addMessage({
        leadId: selectedLead.id,
        subject,
        body: output,
        tone,
        messageType,
      });
      dispatch({ type: "ADD_MESSAGE", payload: msg });
      await logActivity({ type: "message_sent", text: `Message sent to ${selectedLead.name}` });
      setHistory(prev => [msg, ...prev].slice(0, 5));
      showToast("Saved to lead");
    } catch {
      showToast("Failed to save message", "error");
    }
  };

  const isOverLimit = messageType === "linkedin_connection" && output.length > 300;

  return (
    <>
      <TopBar title="AI Message Lab" subtitle="Generate personalized outreach with Claude" />

      <div className="flex-1 overflow-y-auto">
        {/* API Key Bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface2">
          <Key size={14} className="text-muted shrink-0" />
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="flex-1 h-8 rounded-md bg-white/5 border border-border px-3 text-xs text-text placeholder:text-muted focus:outline-none focus:border-accent-purple/40 font-mono"
          />
          <button
            onClick={handleConnect}
            disabled={!keyInput.trim()}
            className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-accent-purple/20 text-accent-purple text-xs font-medium hover:bg-accent-purple/30 disabled:opacity-40 transition-colors"
          >
            {connected ? <><Check size={12} /> Connected</> : "Connect"}
          </button>
          {connected && <span className="w-2 h-2 rounded-full bg-accent-green shrink-0" title="Connected" />}
        </div>

        <div className="flex h-[calc(100vh-160px)]">
          {/* LEFT — Input (40%) */}
          <div className="w-[40%] min-w-[320px] border-r border-border p-5 space-y-5 overflow-y-auto">
            {/* Lead Selector */}
            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Select Lead</label>
              <select
                value={selectedLeadId}
                onChange={e => setSelectedLeadId(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-border px-3 text-sm text-text mt-1.5 focus:outline-none focus:border-accent-purple/40 appearance-none cursor-pointer"
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
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Message Type</label>
              <div className="flex gap-1 mt-1.5">
                {MESSAGE_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setMessageType(t.key); setOutput(""); setSubject(""); }}
                    className={`flex-1 text-[11px] px-2 py-1.5 rounded-md font-medium transition-colors ${
                      messageType === t.key
                        ? "bg-accent-purple/20 text-accent-purple"
                        : "text-muted hover:text-text hover:bg-white/[0.04]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Tone</label>
              <div className="flex gap-1.5 mt-1.5">
                {TONES.map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all ${
                      tone === t
                        ? "bg-accent-purple border-accent-purple/40 text-white"
                        : "border-border text-muted hover:text-text hover:border-white/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Offer */}
            <div>
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">Your Offer</label>
              <textarea
                value={offer}
                onChange={e => setOffer(e.target.value)}
                placeholder="e.g. We help SaaS companies reduce churn by 40%..."
                rows={4}
                className="w-full rounded-md bg-white/5 border border-border px-3 py-2 text-sm text-text placeholder:text-muted/70 focus:outline-none focus:border-accent-purple/40 resize-y mt-1.5"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={generating || !apiKey || !selectedLead}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-accent-purple text-white text-sm font-semibold hover:bg-accent-purple/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <><Loader2 size={14} className="animate-spin" /> Generating…</>
              ) : (
                <><Sparkles size={14} /> Generate with Claude</>
              )}
            </button>
            {!apiKey && <p className="text-[10px] text-muted text-center">Connect your Anthropic API key above to generate messages</p>}
          </div>

          {/* RIGHT — Output (60%) */}
          <div className="flex-1 p-5 space-y-4 overflow-y-auto">
            {/* Output Box */}
            <div className="bg-surface2 border border-border rounded-lg p-4 min-h-[200px] relative">
              {output ? (
                <div className="space-y-2">
                  {subject && (
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider">Subject</span>
                      <p className="text-sm text-text font-medium mt-0.5">{subject}</p>
                      <hr className="border-border my-3" />
                    </div>
                  )}
                  <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{output}</p>
                  {generating && <span className="inline-block w-1.5 h-4 bg-accent-blue animate-pulse ml-0.5 align-middle" />}
                  {output && (
                    <span className={`absolute bottom-3 right-3 text-[10px] font-medium tabular-nums px-2 py-0.5 rounded ${
                      isOverLimit ? "bg-red-500/15 text-red-400" : "bg-white/5 text-muted"
                    }`}>
                      {output.length}{messageType === "linkedin_connection" ? "/300" : ""}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted/50 text-center pt-16">
                  {generating ? "Generating…" : "Generated message will appear here"}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {output && (
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs text-muted hover:text-text hover:bg-white/[0.04] border border-border transition-colors">
                  <Copy size={12} /> Copy
                </button>
                <button onClick={handleSave} className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs text-muted hover:text-text hover:bg-white/[0.04] border border-border transition-colors">
                  <BookmarkPlus size={12} /> Save to Lead
                </button>
                <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs text-muted hover:text-text hover:bg-white/[0.04] border border-border transition-colors">
                  <RefreshCw size={12} /> Regenerate
                </button>
              </div>
            )}

            {/* Message History */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted hover:text-text hover:bg-white/[0.02] transition-colors"
              >
                <span>Message History ({history.length})</span>
                <ChevronDown size={14} className={`transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>
              {historyOpen && (
                <div className="border-t border-border">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted text-center py-6">No messages yet for this lead</p>
                  ) : (
                    history.map(m => (
                      <div key={m.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.01] transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            m.messageType === "cold_email" ? "bg-accent-blue/15 text-accent-blue"
                              : m.messageType === "linkedin_dm" ? "bg-accent-purple/15 text-accent-purple"
                              : "bg-accent-green/15 text-accent-green"
                          }`}>
                            {m.messageType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-muted">{m.tone}</span>
                          <span className="flex-1" />
                          <button onClick={() => navigator.clipboard.writeText(m.body)} className="text-muted hover:text-text">
                            <Copy size={10} />
                          </button>
                        </div>
                        <p className="text-xs text-text line-clamp-2">{m.body.slice(0, 80)}</p>
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
