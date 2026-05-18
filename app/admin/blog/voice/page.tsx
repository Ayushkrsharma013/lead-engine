"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import type { VoiceProfile } from "@/lib/types";

export default function VoiceProfilePage() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [samples, setSamples] = useState(["", "", ""]);
  const [profileName, setProfileName] = useState("Default");
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<"extract" | "view">("extract");
  const [toast, setToast] = useState("");

  const fetchProfiles = useCallback(async () => {
    const res = await fetch("/prospecting-os/api/blog/voice");
    const data = await res.json();
    setProfiles(data.profiles || []);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const activeProfile = profiles.find(p => p.is_active);

  const handleExtract = async () => {
    const filledSamples = samples.filter(s => s.trim());
    if (filledSamples.length < 2) {
      setToast("Please provide at least 2 writing samples");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/prospecting-os/api/blog/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: filledSamples, name: profileName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToast(`Voice profile "${profileName}" extracted!`);
      setTimeout(() => setToast(""), 4000);
      await fetchProfiles();
      setActiveTab("view");
    } catch (e) {
      setToast(`Error: ${String(e)}`);
      setTimeout(() => setToast(""), 4000);
    }
    setExtracting(false);
  };

  return (
    <>
      <TopBar title="Voice Profile Manager" subtitle="Extract and manage your writing voice" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="px-4 py-2.5 rounded-lg text-[12px] font-medium"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <Link href="/admin/blog" className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--muted)" }}>
            <ArrowLeft size={12} /> Back to Blog
          </Link>
          <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            {(["extract", "view"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-3 py-1 rounded-md text-[11px] font-medium capitalize transition-all"
                style={{
                  color: activeTab === tab ? "var(--accent)" : "var(--muted)",
                  background: activeTab === tab ? "rgba(232,168,64,0.10)" : "transparent",
                }}>
                {tab === "extract" ? "Extract" : "Current Profile"}
              </button>
            ))}
          </div>
        </div>

        {/* Extract Tab */}
        {activeTab === "extract" && (
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Mic size={14} style={{ color: "var(--accent-purple)" }} />
              <h3 className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>Extract Voice Profile</h3>
            </div>

            <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>
              Paste 2-4 writing samples below. These can be LinkedIn posts, client emails, or previous articles you have written. Gemini will analyze them and extract your unique writing voice.
            </p>

            <div className="mb-4">
              <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--muted)" }}>Profile Name</label>
              <input value={profileName} onChange={e => setProfileName(e.target.value)}
                className="w-full h-9 rounded-lg px-3 text-[12px] outline-none"
                style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }} />
            </div>

            {samples.map((sample, idx) => (
              <div key={idx} className="mb-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--muted)" }}>
                  Sample {idx + 1} {idx < 2 ? "(required)" : "(optional)"}
                </label>
                <textarea
                  value={sample}
                  onChange={e => {
                    const next = [...samples];
                    next[idx] = e.target.value;
                    setSamples(next);
                  }}
                  rows={5}
                  placeholder={`Paste article, LinkedIn post, or email #${idx + 1} here...`}
                  className="w-full rounded-lg px-3 py-2 text-[12px] outline-none resize-y"
                  style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)", minHeight: 80 }}
                />
              </div>
            ))}

            <button onClick={handleExtract} disabled={extracting}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-medium transition-all"
              style={{ background: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.18)" }}>
              {extracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {extracting ? "Analyzing..." : "Extract Voice Profile"}
            </button>
          </div>
        )}

        {/* View Tab */}
        {activeTab === "view" && (
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="text-[12px] font-semibold mb-4" style={{ color: "var(--text)" }}>Current Active Profile</h3>

            {activeProfile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.20)" }}>
                    <Mic size={13} style={{ color: "var(--accent-purple)" }} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{activeProfile.name}</div>
                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                      Extracted {activeProfile.extracted_at ? new Date(activeProfile.extracted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg p-4 overflow-auto" style={{ background: "var(--surface2)", border: "1px solid var(--border)", maxHeight: 400 }}>
                  <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                    {JSON.stringify(activeProfile.extracted_guide, null, 2)}
                  </pre>
                </div>

                {activeProfile.sample_texts && activeProfile.sample_texts.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>Samples Used ({activeProfile.sample_texts.length})</h4>
                    {activeProfile.sample_texts.map((text, idx) => (
                      <div key={idx} className="rounded-lg p-3 mb-2 text-[11px] whitespace-pre-wrap" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", maxHeight: 120, overflow: 'hidden' }}>
                        {text.slice(0, 300)}{text.length > 300 ? '...' : ''}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <CheckCircle size={12} style={{ color: "var(--accent-green)" }} />
                  <span className="text-[11px]" style={{ color: "var(--accent-green)" }}>This profile is active — all generated posts will use it.</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-8 justify-center">
                <AlertCircle size={14} style={{ color: "var(--accent-orange)" }} />
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>No voice profile yet. Extract one to get started.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
