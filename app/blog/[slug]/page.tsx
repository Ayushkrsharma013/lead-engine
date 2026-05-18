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
    .replace(/^### (.+)$/gm, '<h3 style="font-family:var(--font-heading);font-size:20px;font-weight:700;color:var(--text-primary);margin:32px 0 12px;letter-spacing:-0.01em;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-family:var(--font-heading);font-size:24px;font-weight:800;color:var(--text-primary);margin:40px 0 14px;letter-spacing:-0.015em;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-family:var(--font-heading);font-size:28px;font-weight:900;color:var(--text-primary);margin:48px 0 16px;letter-spacing:-0.02em;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary);font-weight:600;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:var(--text-secondary);">$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent);text-decoration:underline;text-underline-offset:3px;">$1</a>')
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<ol')) return block;
      return `<p style="font-family:var(--font-body);font-size:15px;line-height:1.75;color:var(--text-primary);margin:0 0 20px;">${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  return (
    <div className="landing-page" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Navbar — matches landing page exactly */}
      <nav className="navbar" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.15)' }}>
        <div className="container">
          <Link href="/" className="nav-logo" style={{ textDecoration: 'none' }}>
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" width={28} height={28} style={{ borderRadius: 8 }} />
            Prospecting <span className="accent">OS</span>
          </Link>
          <ul className="nav-links" style={{ listStyle: 'none' }}>
            <li><Link href="/#how-it-works">How It Works</Link></li>
            <li><Link href="/#pricing">Pricing</Link></li>
            <li><Link href="/blog" style={{ color: 'var(--accent)', fontWeight: 600 }}>Blog</Link></li>
          </ul>
          <Link href="/book" className="nav-cta desktop-only" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Book a Free Strategy Call
          </Link>
        </div>
      </nav>

      <article className="container" style={{ maxWidth: 760, paddingTop: 100, paddingBottom: 80 }}>
        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 14px', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600,
            background: 'var(--badge-bg)', color: 'var(--badge-text)',
            border: '1px solid rgba(232,66,10,0.12)',
          }}>
            {post.category}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-tertiary)' }}>{post.read_time} min read</span>
          {post.published_at && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
          color: 'var(--text-primary)', margin: '0 0 12px', lineHeight: 1.15, letterSpacing: '-0.025em',
        }}>
          {post.title}
        </h1>
        {post.subtitle && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--text-secondary)',
            margin: '0 0 40px', lineHeight: 1.5, borderBottom: '1px solid var(--divider)',
            paddingBottom: 32,
          }}>
            {post.subtitle}
          </p>
        )}

        {/* Content */}
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          style={{ maxWidth: '100%', overflow: 'hidden' }}
        />

        {/* Bottom CTA */}
        <div style={{
          marginTop: 56, padding: '40px 32px', borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', textAlign: 'center',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20,
            color: 'var(--text-primary)', margin: '0 0 10px', letterSpacing: '-0.02em',
          }}>
            Ready to fill your pipeline?
          </h3>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-secondary)',
            margin: '0 0 22px',
          }}>
            Get 5 free AI-scored leads sent to your inbox — no credit card, no setup.
          </p>
          <Link href="/#sample" style={{
            display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-full)',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
            textDecoration: 'none', transition: 'all var(--transition-fast)',
          }}>
            Get Free Leads
          </Link>
        </div>

        {/* Footer links */}
        <div style={{
          marginTop: 36, display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <Link href="/blog" style={{
            fontFamily: 'var(--font-body)', color: 'var(--accent)', fontSize: 14,
            fontWeight: 500, textDecoration: 'none',
          }}>
            ← All Posts
          </Link>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link href="/tools/icebreaker-generator" style={{
              fontFamily: 'var(--font-body)', color: 'var(--text-tertiary)',
              fontSize: 13, textDecoration: 'none',
            }}>
              Icebreaker Generator
            </Link>
            <Link href="/tools/free-audit" style={{
              fontFamily: 'var(--font-body)', color: 'var(--text-tertiary)',
              fontSize: 13, textDecoration: 'none',
            }}>
              Pipeline Audit
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
