import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateBlogPost } from '@/lib/blog/content-writer';
import { pickBestKeyword } from '@/lib/blog/keyword-gap';
import { captureError } from '@/lib/error-tracking';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const keyword = body.keyword || (await pickBestKeyword());

    if (!keyword) {
      return NextResponse.json(
        { error: 'No keywords available. Run keyword gap analysis first.' },
        { status: 400 }
      );
    }

    const post = await generateBlogPost(
      typeof keyword === 'string' ? keyword : keyword.keyword,
      body.category || (typeof keyword === 'object' ? keyword.category : 'lead-gen')
    );

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug: post.slug,
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        keywords: post.keywords,
        read_time: post.read_time,
        status: body.draft ? 'draft' : 'published',
        published_at: body.draft ? null : new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const kw = typeof keyword === 'string' ? keyword : keyword.keyword;
    const { data: kwData } = await supabaseAdmin.from('blog_keywords').select('posts_count').eq('keyword', kw).single();
    await supabaseAdmin
      .from('blog_keywords')
      .update({ posts_count: (kwData?.posts_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq('keyword', kw);

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
