import Link from 'next/link';
import type { BlogPost } from '@/lib/types';

export const revalidate = 60;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.flow-forges.com';

async function fetchPosts(category?: string): Promise<BlogPost[]> {
  try {
    const url = category && category !== 'all'
      ? `${BASE}/prospecting-os/api/blog?category=${category}&limit=20`
      : `${BASE}/prospecting-os/api/blog?limit=20`;
    const res = await fetch(url, { next: { revalidate: 60 } });
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

const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'lead-gen':  { color: 'var(--accent-blue)', bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.15)' },
  'outbound':  { color: 'var(--accent-purple)', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.15)' },
  'ai-sales':  { color: 'var(--accent-green)', bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.15)' },
  'agency':    { color: 'var(--accent-orange)', bg: 'rgba(255,107,53,0.08)', border: 'rgba(255,107,53,0.15)' },
};

export default async function BlogPage({ searchParams }: { searchParams: { category?: string } }) {
  const activeCategory = searchParams.category || 'all';
  const posts = await fetchPosts(activeCategory);

  return (
    <div className="min-h-screen bg-bg landing-page">
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(6,6,8,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>
            <img src="/prospecting-os/assets/Logo_Icon.png" alt="Prospecting OS" width={24} height={24} style={{ borderRadius: 6 }} />
            Prospecting <span style={{ color: 'var(--accent)' }}>OS</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/tools/free-audit" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>Free Audit</Link>
            <Link href="/tools/icebreaker-generator" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>Icebreaker</Link>
            <Link href="/book" style={{ padding: '6px 16px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Book a Demo</Link>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            B2B Lead Generation Insights
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, maxWidth: 560, margin: '8px auto 0' }}>
            Strategies, tools, and real-world tactics for AI-powered prospecting — from pipeline math to agency scaling.
          </p>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 40, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <Link
              key={c.key}
              href={c.key === 'all' ? '/blog' : `/blog?category=${c.key}`}
              style={{
                padding: '6px 16px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: activeCategory === c.key ? 600 : 500,
                color: activeCategory === c.key ? 'var(--accent)' : 'var(--muted)',
                background: activeCategory === c.key ? 'rgba(232,168,64,0.10)' : 'transparent',
                border: activeCategory === c.key ? '1px solid rgba(232,168,64,0.20)' : '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'all 150ms ease',
              }}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* Posts grid */}
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <p style={{ fontSize: 14 }}>No posts yet. Check back soon.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                <article
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 24,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,168,64,0.2)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <span style={{
                    ...(CATEGORY_STYLE[post.category] || CATEGORY_STYLE['lead-gen']),
                    fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 9999,
                    width: 'fit-content', marginBottom: 12,
                  }}>
                    {CATEGORIES.find(c => c.key === post.category)?.label || post.category}
                  </span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.3 }}>
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, flex: 1, margin: 0 }}>
                      {post.excerpt}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, fontSize: 11, color: 'var(--muted)' }}>
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

        {/* Email CTA */}
        <div style={{ textAlign: 'center', marginTop: 60, padding: '40px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Get 5 free AI-scored leads</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>Enter your email and industry and we will send you a sample report.</p>
          <Link href="/#sample" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 9999, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Get Free Leads
          </Link>
        </div>
      </main>
    </div>
  );
}
