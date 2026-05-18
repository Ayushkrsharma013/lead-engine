import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { captureError } from '@/lib/error-tracking';
import { estimateReadTime } from '@/lib/blog/content-writer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    let query = supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ posts: data });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const slug = body.slug || body.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const read_time = body.read_time || estimateReadTime(body.content || '');

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug,
        title: body.title,
        subtitle: body.subtitle || null,
        excerpt: body.excerpt || null,
        content: body.content,
        category: body.category || 'lead-gen',
        keywords: body.keywords || [],
        read_time,
        status: body.status || 'draft',
        published_at: body.status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
