"use client";

import { useState, useEffect } from "react";
import {
  Target, Key, Check, AlertCircle, Loader2, Plus, ChevronDown,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/lib/AppContext";
import { mergeLeadsInDB, computeStatsFromLeads } from "@/lib/db";
import { logActivity } from "@/lib/db";
import type { Lead } from "@/lib/types";

interface Criteria {
  label: string;
  points: number;
  active: boolean;
}

const DEFAULT_CRITERIA: Criteria[] = [
  { label: "Decision maker (C-Suite / VP / Director / Founder)", points: 30, active: true },
  { label: "Company size 10–500 employees", points: 20, active: true },
  { label: "SaaS / Tech / Agency industry", points: 20, active: true },
  { label: "Active on LinkedIn in last 30 days", points: 15, active: true },
  { label: "Located in US / UK / India / EU", points: 15, active: true },
];

interface ScoreResult {
  score: number;
  reasoning: string[];
  recommended_action: "Connect now" | "Add to nurture" | "Skip";
  risk_factors: string[];
}

const cardBg = "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)";
const cardBorder = "1px solid rgba(201,168,124,0.07)";
const brass = "#C9A87C";
const GEMINI_KEY = "proos_gemini_key";

function getScoreColor(score: number): string {
  if (score >= 70) return "#A8C99A";
  if (score >= 40) return "#9AB3C8";
  return "#D49484";
}

function ScoreRing({ score }: { score: number }) {
  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center relative">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="60" fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle
          cx="80" cy="80" r="60" fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 80 80)"
          style={{ transition: "stroke-dashoffset 1.2s ease-out", filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
        {/* Background glow ring */}
        <circle
          cx="80" cy="80" r="60" fill="none"
          stroke={color}
          strokeWidth="1"
          opacity={0.3}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div className="absolute text-center" style={{ marginTop: -104 }}>
        <div className="text-[48px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>{score}</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)" }}>ICP Score</div>
      </div>
    </div>
  );
}

export default function ScorerPage() {
  const { state, dispatch } = useApp();

  const geminiApiKey = typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY) || "" : "";
  const [keyInput, setKeyInput] = useState(geminiApiKey);
  const [connected, setConnected] = useState(!!geminiApiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [leadText, setLeadText] = useState("");
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);

  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addCompany, setAddCompany] = useState("");

  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  const getActiveApiKey = () => {
    return typeof window !== "undefined" ? localStorage.getItem(GEMINI_KEY) || "" : "";
  };

  const handleConnect = () => {
    if (!keyInput.trim()) return;
    localStorage.setItem(GEMINI_KEY, keyInput.trim());
    setConnected(true);
    setShowKeyInput(false);
  };

  const toggleCriteria = (idx: number) => {
    setCriteria(prev => prev.map((c, i) => i === idx ? { ...c, active: !c.active } : c));
  };

  const maxPoints = criteria.filter(c => c.active).reduce((s, c) => s + c.points, 0);

  const handleScore = async () => {
    const key = getActiveApiKey();
    if (!key) { setError("API key required — add your Gemini key above."); return; }
    if (!leadText.trim()) { setError("Paste lead information to score."); return; }
    setError("");
    setScoring(true);
    setResult(null);

    const activeCriteria = criteria.filter(c => c.active);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: "You are an expert B2B sales qualification analyst. Score leads objectively based on the criteria provided. Return ONLY valid JSON, nothing outside the JSON object." }],
            },
            contents: [{
              parts: [{
                text: `Analyze this lead and score them 0-100 as an ICP match.

Lead info:
${leadText}

Active criteria:
${activeCriteria.map(c => `- ${c.label}: ${c.points}pts`).join("\n")}

Return ONLY valid JSON, nothing outside the JSON:
{
  "score": <0-100>,
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "recommended_action": "Connect now" | "Add to nurture" | "Skip",
  "risk_factors": ["risk 1", "risk 2"]
}`,
              }],
            }],
            generationConfig: { maxOutputTokens: 1000 },
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err = errData as { error?: { message?: string } };
        if (res.status === 429) throw new Error("Rate limited — please wait a moment");
        throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
      }

      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = JSON.parse(text) as ScoreResult;
      setResult(parsed);

      if (parsed.score >= 80) {
        await logActivity({ type: "scored_hot", text: `Lead scored ${parsed.score} — Hot lead!` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      showToast(msg, "error");
    }
    setScoring(false);
  };

  const handleAddToPipeline = async () => {
    if (!addName.trim()) return;
    const now = new Date().toISOString();
    const newLead: Lead = {
      id: `scored-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: addName, title: addTitle, company: addCompany,
      industry: "", location: "", email: "", emailStatus: "not_found",
      linkedin: "", website: "", companySize: "",
      score: result?.score ?? 0, source: "linkedin", savedAt: now, fetchedAt: now,
    };

    try {
      const { stored } = await mergeLeadsInDB([newLead]);
      dispatch({ type: "SET_LEADS", payload: stored });
      const stats = await computeStatsFromLeads(stored);
      dispatch({ type: "SET_STATS", payload: stats });
      await logActivity({ type: "lead_added", text: `Lead added: ${addName}` });
      showToast(`Added ${addName} to pipeline`);
      setShowAddModal(false);
      setAddName(""); setAddTitle(""); setAddCompany("");
    } catch { showToast("Failed to add lead", "error"); }
  };

  return (
    <>
      <TopBar title="Lead Scorer" subtitle="AI-powered ICP scoring with Gemini" />

      <div className="flex-1 overflow-hidden flex">
        {/* ── LEFT — Input (42%) ── */}
        <div className="w-[42%] min-w-[360px] flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--sidebar-border)" }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Lead Info */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                Lead Information
              </label>
              <textarea
                value={leadText}
                onChange={e => setLeadText(e.target.value)}
                placeholder="Paste LinkedIn bio, job title, company info, or any raw text…"
                rows={10}
                className="w-full rounded-lg mt-1.5 px-3 py-2.5 text-[13px] outline-none transition-all duration-200 resize-y"
                style={{
                  color: "var(--ink)", background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                }}
                onFocus={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--accent)"}
                onBlur={e => (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--line)"}
              />
            </div>

            {/* ICP Criteria */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                ICP Criteria
              </label>
              <div className="space-y-1 mt-1.5">
                {criteria.map((c, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 transition-all duration-200"
                    style={{ background: "transparent" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <input
                      type="checkbox"
                      checked={c.active}
                      onChange={() => toggleCriteria(i)}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: brass }}
                    />
                    <span className="text-[12px] flex-1" style={{ color: c.active ? "var(--ink-2)" : "var(--ink-4)" }}>
                      {c.label}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
                      style={c.active
                        ? { background: "rgba(201,168,124,0.08)", color: "var(--accent)", border: "1px solid rgba(201,168,124,0.15)" }
                        : { background: "transparent", color: "var(--ink-4)", border: "1px solid var(--line)" }
                      }
                    >
                      {c.points} pts
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] mt-2" style={{ color: "var(--ink-4)" }}>
                Max possible: <span className="font-bold" style={{ color: "var(--accent)" }}>{maxPoints} pts</span> with selected criteria
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-[12px]" style={{ background: "rgba(212,148,132,0.08)", border: "1px solid rgba(212,148,132,0.20)", color: "var(--negative)" }}>
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* API Key (inline) */}
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
                  <Key size={11} /> Add API key to score
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

            {/* Score Button */}
            <button
              onClick={handleScore}
              disabled={scoring || !connected || !leadText.trim()}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: scoring
                  ? "rgba(212,148,132,0.08)"
                  : "linear-gradient(90deg, rgba(212,148,132,0.16), rgba(212,148,132,0.10))",
                color: "#E8B4A8",
                border: "1px solid rgba(212,148,132,0.25)",
                boxShadow: scoring ? "none" : "0 0 16px rgba(212,148,132,0.10)",
              }}
              onMouseEnter={e => {
                if (!scoring) {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(212,148,132,0.20)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,148,132,0.40)";
                }
              }}
              onMouseLeave={e => {
                if (!scoring) {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(212,148,132,0.10)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,148,132,0.25)";
                }
              }}
            >
              {scoring ? (
                <><Loader2 size={14} className="animate-spin" /> Analyzing lead…</>
              ) : (
                <><Target size={14} /> Score with Gemini</>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT — Output (58%) ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5 flex flex-col items-center">
            {result ? (
              <>
                {/* Score Ring */}
                <div className="pt-2">
                  <ScoreRing score={result.score} />
                </div>

                {/* Reasoning */}
                <div
                  className="w-full max-w-md rounded-xl p-5"
                  style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
                >
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3 select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                    Why this score
                  </h4>
                  <ul className="space-y-2">
                    {result.reasoning.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--ink-2)" }}>
                        <span className="mt-0.5 shrink-0" style={{ color: brass }}>•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Action */}
                <div className="w-full max-w-md">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
                    Recommended Action
                  </span>
                  <div
                    className="mt-1.5 inline-flex items-center px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                    style={result.recommended_action === "Connect now"
                      ? { background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.20)" }
                      : result.recommended_action === "Add to nurture"
                        ? { background: "rgba(212,148,132,0.08)", color: "var(--negative)", border: "1px solid rgba(212,148,132,0.18)" }
                        : { background: "rgba(212,148,132,0.06)", color: "#D49484", border: "1px solid rgba(212,148,132,0.15)" }
                    }
                  >
                    {result.recommended_action}
                  </div>
                </div>

                {/* Risk Factors */}
                {result.risk_factors.length > 0 && (
                  <div className="w-full max-w-md">
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer transition-colors duration-200 select-none" style={{ color: "var(--ink-3)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"}
                      >
                        <ChevronDown size={12} style={{ transform: "rotate(-90deg)", transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)" }}
                          className="group-open:rotate-0"
                        />
                        Risk Factors ({result.risk_factors.length})
                      </summary>
                      <ul className="mt-2 space-y-1.5 pl-5">
                        {result.risk_factors.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--negative)" }}>
                            <span className="mt-0.5">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}

                {/* Add to Pipeline */}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-medium transition-all duration-200"
                  style={{
                    background: "linear-gradient(90deg, rgba(168,201,154,0.12), rgba(168,201,154,0.08))",
                    color: "var(--positive)",
                    border: "1px solid rgba(168,201,154,0.20)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(168,201,154,0.15)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,201,154,0.35)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,201,154,0.20)";
                  }}
                >
                  <Plus size={14} /> Add to Pipeline
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[13px] text-center" style={{ color: "var(--ink-3)", opacity: 0.5 }}>
                  {scoring ? "Analyzing lead profile…" : "Score results will appear here"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add to Pipeline Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div
            className="w-[400px] max-w-[95vw] rounded-xl p-6 space-y-4 animate-fade-up"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>Add to Pipeline</h3>
            <div className="space-y-3">
              {([
                { ph: "Name *", val: addName, set: setAddName },
                { ph: "Title", val: addTitle, set: setAddTitle },
                { ph: "Company", val: addCompany, set: setAddCompany },
              ]).map(f => (
                <input
                  key={f.ph}
                  type="text" placeholder={f.ph}
                  value={f.val} onChange={e => f.set(e.target.value)}
                  className="w-full h-9 rounded-lg px-3 text-[13px] outline-none transition-all duration-200"
                  style={{ color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--line)" }}
                  onFocus={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent)"}
                  onBlur={e => (e.currentTarget as HTMLInputElement).style.borderColor = "var(--line)"}
                />
              ))}
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>Score:</span>
                <span className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>{result?.score ?? 0}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddToPipeline} disabled={!addName.trim()}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-all duration-200 disabled:opacity-40"
                style={{ background: "rgba(168,201,154,0.12)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.20)" }}
              >
                Save Lead
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-all duration-200"
                style={{ background: "transparent", color: "var(--ink-3)", border: "1px solid var(--line)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
