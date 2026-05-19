import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BlogPost } from '@/lib/types';
import type { Metadata } from 'next';
import BlogNavbar from '@/components/blog/BlogNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

export const revalidate = 60;

const BASE = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.flow-forges.com');

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
      <BlogNavbar />

      <article className="container" style={{ maxWidth: 760, paddingTop: 100, paddingBottom: 80 }}>
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

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          style={{ maxWidth: '100%', overflow: 'hidden' }}
        />

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
      <LandingFooter />
    </div>
  );
}
