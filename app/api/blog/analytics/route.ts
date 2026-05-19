import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('id, title, category, status, read_time, keywords, published_at, created_at');

    if (error) throw error;

    const total = posts.length;
    const published = posts.filter(p => p.status === 'published').length;
    const drafts = total - published;

    const byCategory: Record<string, number> = {};
    posts.forEach(p => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    });

    const byCategoryPublished: Record<string, number> = {};
    posts.filter(p => p.status === 'published').forEach(p => {
      byCategoryPublished[p.category] = (byCategoryPublished[p.category] || 0) + 1;
    });

    const readTimes = posts.filter(p => p.read_time != null).map(p => p.read_time);
    const avgReadTime = readTimes.length > 0
      ? Math.round(readTimes.reduce((a, b) => a + b, 0) / readTimes.length)
      : 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const postsThisMonth = posts.filter(p =>
      p.published_at && p.published_at >= startOfMonth
    ).length;

    const keywords = new Set<string>();
    posts.forEach(p => {
      (p.keywords || []).forEach((k: string) => keywords.add(k.toLowerCase()));
    });

    const latestPublished = posts
      .filter(p => p.published_at)
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())[0];

    return NextResponse.json({
      total,
      published,
      drafts,
      byCategory,
      byCategoryPublished,
      avgReadTime,
      postsThisMonth,
      keywordCount: keywords.size,
      latestPublishedAt: latestPublished?.published_at || null,
      latestTitle: latestPublished?.title || null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
