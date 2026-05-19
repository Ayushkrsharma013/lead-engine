import Link from 'next/link';
import type { BlogPost } from '@/lib/types';
import BlogNavbar from '@/components/blog/BlogNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

export const revalidate = 60;

const BASE = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.flow-forges.com');

async function fetchPosts(category?: string): Promise<BlogPost[]> {
  try {
    const url = category && category !== 'all'
      ? `${BASE}/prospecting-os/api/blog?category=${category}&limit=20`
      : `${BASE}/prospecting-os/api/blog?limit=20`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts || [];
  } catch {
    return [];
  }
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'lead-gen', label: 'Lead Gen' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'ai-sales', label: 'AI & Sales' },
  { key: 'agency', label: 'Agency' },
] as const;

export default async function BlogPage({ searchParams }: { searchParams: { category?: string } }) {
  const activeCategory = searchParams.category || 'all';
  const posts = await fetchPosts(activeCategory);

  return (
    <div className="landing-page" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <BlogNavbar />

      <main className="container" style={{ paddingTop: 100, paddingBottom: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 'clamp(2rem, 3.5vw, 2.6rem)', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            B2B Lead Generation Insights
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-secondary)', marginTop: 12, maxWidth: 520, margin: '12px auto 0' }}>
            Strategies, tools, and real-world tactics for AI-powered prospecting — from pipeline math to agency scaling.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 48, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => {
            const active = activeCategory === c.key;
            return (
              <Link
                key={c.key}
                href={c.key === 'all' ? '/blog' : `/blog?category=${c.key}`}
                style={{
                  padding: '7px 18px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? '#fff' : 'var(--text-secondary)',
                  background: active ? 'var(--accent)' : 'var(--bg-toggle)',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  textDecoration: 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-tertiary)' }}>No posts yet. Check back soon.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                <article
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: 28,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast)',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'rgba(232,66,10,0.25)';
                    el.style.boxShadow = 'var(--card-shadow-hover)';
                    el.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'var(--border-card)';
                    el.style.boxShadow = 'none';
                    el.style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 'var(--radius-full)',
                    width: 'fit-content', marginBottom: 16,
                    background: 'var(--badge-bg)', color: 'var(--badge-text)',
                    border: '1px solid rgba(232,66,10,0.12)',
                  }}>
                    {CATEGORIES.find(c => c.key === post.category)?.label || post.category}
                  </span>
                  <h2 style={{
                    fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18,
                    color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                  }}>
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)',
                      lineHeight: 1.55, flex: 1, margin: 0,
                    }}>
                      {post.excerpt}
                    </p>
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14, marginTop: 20,
                    fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)',
                    borderTop: '1px solid var(--divider)', paddingTop: 14,
                  }}>
                    <span>{post.read_time} min read</span>
                    {post.published_at && (
                      <span>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        <div style={{
          textAlign: 'center', marginTop: 72, padding: '48px 32px',
          borderRadius: 'var(--radius-xl)', background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22,
            color: 'var(--text-primary)', margin: '0 0 12px', letterSpacing: '-0.02em',
          }}>
            Get 5 free AI-scored leads
          </h3>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-secondary)',
            margin: '0 auto 24px', maxWidth: 440,
          }}>
            Enter your email and industry and we will send you a sample report — real leads, real scores.
          </p>
          <Link href="/#sample" style={{
            display: 'inline-block', padding: '12px 32px', borderRadius: 'var(--radius-full)',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
            textDecoration: 'none', transition: 'all var(--transition-fast)',
          }}>
            Get Free Leads
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
