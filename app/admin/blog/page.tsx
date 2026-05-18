"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText, Sparkles, Loader2, Trash2,
  Eye, Mic,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import type { BlogPost, VoiceProfile } from "@/lib/types";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [postsRes, voiceRes] = await Promise.all([
        fetch("/prospecting-os/api/blog?limit=50"),
        fetch("/prospecting-os/api/blog/voice"),
      ]);
      const postsData = await postsRes.json();
      const voiceData = await voiceRes.json();
      setPosts(postsData.posts || []);
      setProfiles(voiceData.profiles || []);
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
  };

  const activeProfile = profiles.find(p => p.is_active);
  const publishedCount = posts.filter(p => p.status === 'published').length;

  return (
    <>
      <TopBar title="Blog Dashboard" subtitle="Autonomous blog engine management" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2.5 rounded-lg text-[12px] font-medium"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {toast}
          </motion.div>
        )}

        {/* Voice Profile Card */}
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

        {/* Stats + Generate */}
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

        {/* Posts Table */}
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "var(--muted)" }}>All Posts</h3>
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
                  <tr key={post.id} className="border-b transition-colors" style={{ borderColor: "var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(237,234,226,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td className="py-2.5 pr-4 text-[12px] font-medium truncate max-w-[300px]" style={{ color: "var(--text)" }}>{post.title}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: "var(--accent)", background: "rgba(232,168,64,0.08)", border: "1px solid rgba(232,168,64,0.12)" }}>
                        {post.category}
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
                    <td className="py-2.5">
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
      </div>
    </>
  );
}
