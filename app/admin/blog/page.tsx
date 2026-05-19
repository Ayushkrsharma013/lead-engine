"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Sparkles, Loader2, Trash2,
  Eye, Mic, X, Save, BarChart3, TrendingUp,
  Clock, Tag, BookOpen, Send, Bot,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import type { BlogPost, VoiceProfile, BlogCategory, BlogPostStatus } from "@/lib/types";

interface BlogAnalytics {
  total: number;
  published: number;
  drafts: number;
  byCategory: Record<string, number>;
  byCategoryPublished: Record<string, number>;
  avgReadTime: number;
  postsThisMonth: number;
  keywordCount: number;
  latestPublishedAt: string | null;
  latestTitle: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  'lead-gen': 'Lead Gen',
  'outbound': 'Outbound',
  'ai-sales': 'AI & Sales',
  'agency': 'Agency',
};

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [analytics, setAnalytics] = useState<BlogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");

  // Preview/edit panel state
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [editValues, setEditValues] = useState<Partial<BlogPost>>({});
  const [saving, setSaving] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [postsRes, voiceRes, analyticsRes] = await Promise.all([
        fetch("/prospecting-os/api/blog?limit=50"),
        fetch("/prospecting-os/api/blog/voice"),
        fetch("/prospecting-os/api/blog/analytics"),
      ]);
      const postsData = await postsRes.json();
      const voiceData = await voiceRes.json();
      const analyticsData = await analyticsRes.json();
      setPosts(postsData.posts || []);
      setProfiles(voiceData.profiles || []);
      if (!analyticsData.error) setAnalytics(analyticsData);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/prospecting-os/api/blog/generate", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToast(`Generated: ${data.post.title}`);
      setTimeout(() => setToast(""), 4000);
      await fetchData();
    } catch (e) {
      setToast(`Error: ${String(e)}`);
      setTimeout(() => setToast(""), 4000);
    }
    setGenerating(false);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm("Delete this post?")) return;
    await fetch(`/prospecting-os/api/blog/${slug}`, { method: "DELETE" });
    setPosts(prev => prev.filter(p => p.slug !== slug));
    if (selectedPost?.slug === slug) setSelectedPost(null);
  };

  // Open preview/edit panel
  const openPreview = (post: BlogPost) => {
    setSelectedPost(post);
    setEditValues({
      title: post.title,
      subtitle: post.subtitle,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      keywords: post.keywords,
      status: post.status,
    });
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedPost) return;
    setSaving(true);
    try {
      const res = await fetch(`/prospecting-os/api/blog/${selectedPost.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      if (!res.ok) throw new Error("Save failed");
      setToast("Post updated");
      setTimeout(() => setToast(""), 3000);
      await fetchData();
      const updated = posts.find(p => p.slug === selectedPost.slug);
      if (updated) {
        setSelectedPost({ ...updated, ...editValues });
      }
    } catch (e) {
      setToast(`Error: ${String(e)}`);
      setTimeout(() => setToast(""), 4000);
    }
    setSaving(false);
  };

  // AI suggest improvements
  const handleAiSuggest = async () => {
    if (!editValues.content) return;
    setAiSuggesting(true);
    try {
      const res = await fetch("/prospecting-os/api/chat/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `You are an expert B2B content editor. Review this blog post and suggest 3-5 specific improvements. Be concise. Here is the post:\n\nTitle: ${editValues.title}\nSubtitle: ${editValues.subtitle || ''}\nCategory: ${editValues.category}\n\nContent:\n${editValues.content}\n\nProvide your suggestions as bullet points. Focus on: hook strength, structure, data/evidence, clarity, and CTA effectiveness.`,
            },
          ],
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.text || data.message || "No suggestions returned.";
      setToast(reply);
      setTimeout(() => setToast(""), 12000);
    } catch {
      setToast("AI suggestion failed");
      setTimeout(() => setToast(""), 4000);
    }
    setAiSuggesting(false);
  };

  const activeProfile = profiles.find(p => p.is_active);
  const publishedCount = posts.filter(p => p.status === 'published').length;

  return (
    <>
      <TopBar title="Blog Dashboard" subtitle="Autonomous blog engine management" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ position: "relative" }}>
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="px-4 py-2.5 rounded-lg text-[12px] font-medium max-w-2xl"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════ Live Analytics Card ══════ */}
        {analytics && (
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} style={{ color: "var(--accent)" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Live Analytics</h3>
              <span className="text-[10px]" style={{ color: "var(--muted)" }}>— auto-refreshes on load</span>
            </div>

            {/* Top row: stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total Posts", value: analytics.total, icon: FileText, color: "var(--accent)" },
                { label: "Published", value: analytics.published, icon: BookOpen, color: "var(--accent-green)" },
                { label: "This Month", value: analytics.postsThisMonth, icon: TrendingUp, color: "var(--accent-purple)" },
                { label: "Avg Read", value: `${analytics.avgReadTime}m`, icon: Clock, color: "var(--info)" },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-3 flex items-center gap-3"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <s.icon size={16} style={{ color: s.color, flexShrink: 0 }} />
                  <div>
                    <div className="text-[18px] font-bold tabular-nums" style={{ color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom row: category bars + keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category distribution */}
              <div className="rounded-lg p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                  Posts by Category
                </div>
                <div className="space-y-1.5">
                  {Object.entries(analytics.byCategory).map(([cat, count]) => {
                    const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="text-[10px] w-16 font-medium" style={{ color: "var(--text-secondary)" }}>
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-toggle)" }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: "var(--accent)", opacity: 0.2 + (pct / 200) }} />
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums w-6 text-right" style={{ color: "var(--text)" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick stats */}
              <div className="rounded-lg p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                  Content Health
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "Unique Keywords", value: analytics.keywordCount, icon: Tag },
                    { label: "Avg Read Time", value: `${analytics.avgReadTime} min`, icon: Clock },
                    { label: "Latest Published", value: analytics.latestTitle || "—", icon: BookOpen, truncate: true },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 text-[11px]">
                      <s.icon size={11} style={{ color: "var(--muted)", flexShrink: 0 }} />
                      <span style={{ color: "var(--muted)" }}>{s.label}:</span>
                      <span className={s.truncate ? "truncate" : ""} style={{ color: "var(--text)", fontWeight: 500 }}>
                        {typeof s.value === 'string' && s.value.length > 40 ? s.value.slice(0, 40) + "..." : s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Voice Profile Card ══════ */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mic size={14} style={{ color: "var(--accent-purple)" }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Voice Profile</h3>
            </div>
            <Link href="/admin/blog/voice" className="text-[11px] font-medium transition-colors" style={{ color: "var(--accent)" }}>
              Manage Voice →
            </Link>
          </div>
          {activeProfile ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.20)" }}>
                <Mic size={13} style={{ color: "var(--accent-purple)" }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{activeProfile.name}</div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                  Extracted {activeProfile.extracted_at ? new Date(activeProfile.extracted_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[12px]" style={{ color: "var(--accent-orange)" }}>No voice profile configured.</span>
              <Link href="/admin/blog/voice" className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>Set up now →</Link>
            </div>
          )}
        </div>

        {/* ══════ Stats + Generate ══════ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Total Posts</span>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{posts.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Published</span>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{publishedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Drafts</span>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{posts.length - publishedCount}</span>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-medium transition-all"
            style={{ background: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.18)" }}>
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generating ? "Generating..." : "Generate New Post"}
          </button>
        </div>

        {/* ══════ Posts Table ══════ */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "var(--muted)" }}>
            All Posts
            <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: "var(--muted)" }}>
              — click a row to preview & edit
            </span>
          </h3>
          {loading ? (
            <div className="flex justify-center py-8"><span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" /></div>
          ) : posts.length === 0 ? (
            <p className="text-center py-8 text-[12px]" style={{ color: "var(--muted)" }}>No posts yet. Generate your first one.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Title</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Category</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Status</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Keywords</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider pb-2" style={{ color: "var(--muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} className="border-b transition-colors cursor-pointer"
                    style={{
                      borderColor: "var(--border)",
                      background: selectedPost?.id === post.id ? "rgba(232,168,64,0.04)" : "transparent",
                    }}
                    onClick={() => openPreview(post)}
                    onMouseEnter={e => { if (selectedPost?.id !== post.id) (e.currentTarget.style.background = "rgba(237,234,226,0.02)"); }}
                    onMouseLeave={e => { if (selectedPost?.id !== post.id) (e.currentTarget.style.background = "transparent"); }}>
                    <td className="py-2.5 pr-4 text-[12px] font-medium truncate max-w-[300px]" style={{ color: "var(--text)" }}>{post.title}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: "var(--accent)", background: "rgba(232,168,64,0.08)", border: "1px solid rgba(232,168,64,0.12)" }}>
                        {CATEGORY_LABELS[post.category] || post.category}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={
                        post.status === 'published'
                          ? { color: "var(--accent-green)", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" }
                          : { color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--border)" }
                      }>
                        {post.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-[11px] truncate max-w-[200px]" style={{ color: "var(--muted)" }}>
                      {post.keywords?.join(", ")}
                    </td>
                    <td className="py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link href={`/blog/${post.slug}`} target="_blank"
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                          style={{ color: "var(--muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                          <Eye size={12} />
                        </Link>
                        <button onClick={() => handleDelete(post.slug)}
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                          style={{ color: "var(--muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ff4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ══════ Preview / Edit Slide-Over Panel ══════ */}
        <AnimatePresence>
          {selectedPost && (
            <motion.div
              initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed top-0 right-0 h-full w-[520px] max-w-[100vw] z-50 flex flex-col overflow-y-auto"
              style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
            >
              {/* Panel header */}
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <FileText size={14} style={{ color: "var(--accent)" }} />
                  <h3 className="text-[12px] font-bold" style={{ color: "var(--text)" }}>Edit Post</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleAiSuggest} disabled={aiSuggesting}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg text-[11px] font-medium transition-all"
                    style={{ background: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.18)" }}>
                    <Bot size={12} className={aiSuggesting ? "animate-pulse" : ""} />
                    {aiSuggesting ? "Thinking..." : "AI Suggest"}
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg text-[11px] font-medium transition-all"
                    style={{ background: "var(--accent)", color: "#fff" }}>
                    <Save size={12} />
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setSelectedPost(null)}
                    className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                    style={{ color: "var(--muted)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 p-5 space-y-4">
                {/* Slug (read-only) */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>Slug</label>
                  <input value={selectedPost.slug} readOnly
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)" }} />
                </div>

                {/* Title */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>Title</label>
                  <input value={editValues.title || ""} onChange={e => setEditValues(v => ({ ...v, title: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg text-[13px] font-medium outline-none transition-colors focus:border-[var(--accent)]"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>

                {/* Subtitle */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>Subtitle</label>
                  <input value={editValues.subtitle || ""} onChange={e => setEditValues(v => ({ ...v, subtitle: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none transition-colors"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>

                {/* Excerpt */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>Excerpt</label>
                  <textarea value={editValues.excerpt || ""} onChange={e => setEditValues(v => ({ ...v, excerpt: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none transition-colors"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>

                {/* Category + Status row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>Category</label>
                    <select value={editValues.category || ""} onChange={e => setEditValues(v => ({ ...v, category: e.target.value as BlogCategory }))}
                      className="w-full h-9 px-3 rounded-lg text-[12px] outline-none"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>Status</label>
                    <select value={editValues.status || ""} onChange={e => setEditValues(v => ({ ...v, status: e.target.value as BlogPostStatus }))}
                      className="w-full h-9 px-3 rounded-lg text-[12px] outline-none"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>Keywords (comma-separated)</label>
                  <input
                    value={Array.isArray(editValues.keywords) ? editValues.keywords.join(", ") : ""}
                    onChange={e => setEditValues(v => ({ ...v, keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) }))}
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>

                {/* Content */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted)" }}>
                    Content (Markdown)
                  </label>
                  <textarea value={editValues.content || ""} onChange={e => setEditValues(v => ({ ...v, content: e.target.value }))}
                    rows={16}
                    className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none font-mono transition-colors"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", lineHeight: 1.6 }} />
                </div>

                {/* Preview toggle section */}
                <details className="rounded-lg p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <summary className="text-[10px] font-semibold uppercase tracking-wider cursor-pointer" style={{ color: "var(--muted)" }}>
                    <Eye size={11} className="inline mr-1" style={{ color: "var(--accent)" }} />
                    Live Preview
                  </summary>
                  <div className="mt-3 text-[12px] leading-relaxed space-y-2" style={{ color: "var(--text)", fontFamily: "var(--font-body)", maxHeight: 400, overflowY: "auto" }}>
                    <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: 18, color: "var(--text)", margin: "0 0 4px" }}>
                      {editValues.title || "(no title)"}
                    </h2>
                    {editValues.subtitle && (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px", borderBottom: "1px solid var(--divider)", paddingBottom: 12 }}>
                        {editValues.subtitle}
                      </p>
                    )}
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7 }}>
                      {(editValues.content || "").slice(0, 800)}{(editValues.content || "").length > 800 ? "..." : ""}
                    </div>
                  </div>
                </details>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay when panel open */}
        <AnimatePresence>
          {selectedPost && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}
              onClick={() => setSelectedPost(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
