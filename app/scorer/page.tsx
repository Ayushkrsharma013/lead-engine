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

function getScoreColor(score: number): string {
  if (score >= 70) return "var(--positive)";
  if (score >= 40) return "var(--info)";
  return "var(--negative)";
}

function ScoreRing({ score }: { score: number }) {
  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="60" fill="none" stroke="var(--line)" strokeWidth="12" />
        <circle
          cx="80" cy="80" r="60" fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 80 80)"
          style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
        />
      </svg>
      <div className="absolute text-center" style={{ marginTop: -100 }}>
        <div className="text-[48px] font-bold text-ink tabular-nums">{score}</div>
        <div className="text-xs text-ink-3">ICP Score</div>
      </div>
    </div>
  );
}

export default function ScorerPage() {
  const { state, dispatch } = useApp();
  const { apiKey } = state;

  // API key
  const [keyInput, setKeyInput] = useState(apiKey);
  const [connected, setConnected] = useState(!!apiKey);

  // Form
  const [leadText, setLeadText] = useState("");
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);

  // Scoring
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");

  // Add to pipeline modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addCompany, setAddCompany] = useState("");

  // Toast helper
  const showToast = (msg: string, type: "success" | "warn" | "error" = "success") => {
    dispatch({ type: "SET_TOAST", payload: { msg, type } });
    setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4000);
  };

  // Sync API key
  useEffect(() => {
    if (apiKey) { setKeyInput(apiKey); setConnected(true); }
  }, [apiKey]);

  const handleConnect = () => {
    if (!keyInput.trim()) return;
    dispatch({ type: "SET_API_KEY", payload: keyInput.trim() });
    setConnected(true);
  };

  const toggleCriteria = (idx: number) => {
    setCriteria(prev => prev.map((c, i) => i === idx ? { ...c, active: !c.active } : c));
  };

  const maxPoints = criteria.filter(c => c.active).reduce((s, c) => s + c.points, 0);

  const handleScore = async () => {
    if (!apiKey) { setError("Please connect your Anthropic API key first."); return; }
    if (!leadText.trim()) { setError("Please paste lead information to score."); return; }
    setError("");
    setScoring(true);
    setResult(null);

    const activeCriteria = criteria.filter(c => c.active);

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
          system: "You are an expert B2B sales qualification analyst. Score leads objectively based on the criteria provided. Return ONLY valid JSON, nothing outside the JSON object.",
          messages: [{
            role: "user",
            content: `Analyze this lead and score them 0-100 as an ICP match.

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
      name: addName,
      title: addTitle,
      company: addCompany,
      industry: "",
      location: "",
      email: "",
      emailStatus: "not_found",
      linkedin: "",
      website: "",
      companySize: "",
      score: result?.score ?? 0,
      source: "linkedin",
      savedAt: now,
      fetchedAt: now,
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
    } catch {
      showToast("Failed to add lead", "error");
    }
  };

  return (
    <>
      <TopBar title="Lead Scorer" subtitle="AI-powered ICP scoring" />

      <div className="flex-1 overflow-y-auto">
        {/* API Key Bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-line bg-surface2">
          <Key size={14} className="text-ink-3 shrink-0" />
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="flex-1 h-8 rounded-md bg-white/5 border border-line px-3 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-orange/40 font-mono"
          />
          <button
            onClick={handleConnect}
            disabled={!keyInput.trim()}
            className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-negative/20 text-negative text-xs font-medium hover:bg-negative/30 disabled:opacity-40 transition-colors"
          >
            {connected ? <><Check size={12} /> Connected</> : "Connect"}
          </button>
          {connected && <span className="w-2 h-2 rounded-full bg-positive shrink-0" />}
        </div>

        <div className="flex h-[calc(100vh-160px)]">
          {/* LEFT — Input (45%) */}
          <div className="w-[45%] min-w-[340px] border-r border-line p-5 space-y-5 overflow-y-auto">
            {/* Lead Info */}
            <div>
              <label className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Lead Information</label>
              <textarea
                value={leadText}
                onChange={e => setLeadText(e.target.value)}
                placeholder="Paste LinkedIn bio, job title, company info, or any raw text…"
                rows={10}
                className="w-full rounded-md bg-white/5 border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-3/70 focus:outline-none focus:border-accent-orange/40 resize-y mt-1.5"
              />
            </div>

            {/* ICP Criteria */}
            <div>
              <label className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">ICP Criteria</label>
              <div className="space-y-2 mt-1.5">
                {criteria.map((c, i) => (
                  <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={c.active}
                      onChange={() => toggleCriteria(i)}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-accent-orange cursor-pointer"
                    />
                    <span className="text-xs text-ink flex-1">{c.label}</span>
                    <span className="text-[10px] font-bold text-ink-3 bg-white/5 px-1.5 py-0.5 rounded tabular-nums">{c.points} pts</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-ink-3 mt-2">Max possible: {maxPoints} pts (with selected criteria)</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Score Button */}
            <button
              onClick={handleScore}
              disabled={scoring || !apiKey || !leadText.trim()}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-negative text-white text-sm font-semibold hover:bg-negative/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {scoring ? (
                <><Loader2 size={14} className="animate-spin" /> Analyzing lead…</>
              ) : (
                <><Target size={14} /> Score with Claude</>
              )}
            </button>
          </div>

          {/* RIGHT — Output (55%) */}
          <div className="flex-1 p-5 space-y-5 overflow-y-auto flex flex-col items-center">
            {result ? (
              <>
                {/* Score Ring */}
                <div className="relative pt-4">
                  <ScoreRing score={result.score} />
                </div>

                {/* Reasoning */}
                <div className="w-full max-w-md bg-surface border border-line rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-ink mb-2">Why this score</h4>
                  <ul className="space-y-1.5">
                    {result.reasoning.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-ink-3">
                        <span className="text-accent mt-0.5">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Action */}
                <div className="w-full max-w-md">
                  <span className="text-[10px] text-ink-3 uppercase tracking-wider">Recommended Action</span>
                  <div className={`mt-1 inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold ${
                    result.recommended_action === "Connect now"
                      ? "bg-positive/10 text-positive border border-accent-green/25"
                      : result.recommended_action === "Add to nurture"
                      ? "bg-negative/10 text-negative border border-accent-orange/25"
                      : "bg-red-500/10 text-red-400 border border-red-500/25"
                  }`}>
                    {result.recommended_action}
                  </div>
                </div>

                {/* Risk Factors */}
                {result.risk_factors.length > 0 && (
                  <div className="w-full max-w-md">
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-xs font-semibold text-ink-3 cursor-pointer hover:text-ink transition-colors">
                        <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                        Risk Factors ({result.risk_factors.length})
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {result.risk_factors.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-red-400">
                            <span>•</span>
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
                  className="flex items-center gap-2 h-10 px-4 rounded-lg bg-positive/10 text-positive border border-accent-green/25 text-sm font-medium hover:bg-positive/20 transition-colors"
                >
                  <Plus size={14} /> Add to Pipeline
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-ink-3/50 text-center">
                  {scoring ? "Analyzing lead profile…" : "Score results will appear here"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add to Pipeline Mini Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="w-[400px] max-w-[95vw] bg-surface border border-line rounded-xl shadow-2xl p-6 space-y-4 animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-ink">Add to Pipeline</h3>
            <div className="space-y-3">
              <input
                type="text" placeholder="Name *"
                value={addName} onChange={e => setAddName(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-line px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-green/40"
              />
              <input
                type="text" placeholder="Title"
                value={addTitle} onChange={e => setAddTitle(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-line px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-green/40"
              />
              <input
                type="text" placeholder="Company"
                value={addCompany} onChange={e => setAddCompany(e.target.value)}
                className="w-full h-9 rounded-md bg-white/5 border border-line px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-green/40"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-3">Score:</span>
                <span className="text-sm font-bold text-ink">{result?.score ?? 0}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleAddToPipeline} disabled={!addName.trim()} className="flex-1 h-9 rounded-md bg-positive/20 text-positive text-sm font-medium hover:bg-positive/30 disabled:opacity-40 transition-colors">
                Save Lead
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 h-9 rounded-md bg-white/5 text-ink-3 text-sm hover:bg-white/[0.08] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
