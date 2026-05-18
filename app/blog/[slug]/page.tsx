import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BlogPost } from '@/lib/types';
import type { Metadata } from 'next';

export const revalidate = 60;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.flow-forges.com';

async function fetchPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${BASE}/prospecting-os/api/blog/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.post || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: 'Post Not Found' };
  return {
    title: `${post.title} — Prospecting OS Blog`,
    description: post.excerpt || post.subtitle || '',
    openGraph: {
      title: post.title,
      description: post.excerpt || post.subtitle || '',
      type: 'article',
      publishedTime: post.published_at || undefined,
    },
  };
}

function renderContent(content: string): string {
  return content
    .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:700;color:var(--text);margin:28px 0 10px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:700;color:var(--text);margin:32px 0 12px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:26px;font-weight:800;color:var(--text);margin:36px 0 14px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text);">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent);text-decoration:underline;">$1</a>')
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<ol')) return block;
      return `<p style="font-size:14px;line-height:1.75;color:var(--text);margin:0 0 16px;">${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-bg landing-page">
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(6,6,8,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/blog" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 500 }}>
            ← Back to Blog
          </Link>
          <Link href="/book" style={{ padding: '6px 16px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Book a Demo</Link>
        </div>
      </nav>

      <article style={{ maxWidth: 720, margin: '0 auto', padding: '100px 24px 80px' }}>
        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
            color: 'var(--accent)', background: 'rgba(232,168,64,0.10)', border: '1px solid rgba(232,168,64,0.15)',
          }}>
            {post.category}
          </span>
          <span>{post.read_time} min read</span>
          {post.published_at && (
            <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 }}>
          {post.title}
        </h1>
        {post.subtitle && (
          <p style={{ fontSize: 15, color: 'var(--muted)', margin: '0 0 32px', lineHeight: 1.5 }}>{post.subtitle}</p>
        )}

        {/* Content */}
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          style={{ maxWidth: '100%', overflow: 'hidden' }}
        />

        {/* Bottom CTA */}
        <div style={{ marginTop: 48, padding: '32px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Ready to fill your pipeline?</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>Get 5 free AI-scored leads sent to your inbox.</p>
          <Link href="/#sample" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Get Free Leads
          </Link>
        </div>

        {/* Footer links */}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/blog" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            ← All Posts
          </Link>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/tools/icebreaker-generator" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none' }}>Icebreaker Generator</Link>
            <Link href="/tools/free-audit" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none' }}>Pipeline Audit</Link>
          </div>
        </div>
      </article>
    </div>
  );
}
