import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateBlogPost } from '@/lib/blog/content-writer';
import { pickBestKeyword, runKeywordGapAnalysis } from '@/lib/blog/keyword-gap';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { count } = await supabaseAdmin
      .from('blog_keywords')
      .select('*', { count: 'exact', head: true });

    if ((count || 0) === 0) {
      await runKeywordGapAnalysis();
    }

    const { data: profile } = await supabaseAdmin
      .from('voice_profiles')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({
        error: 'No active voice profile. Set one up at /admin/blog/voice',
      }, { status: 400 });
    }

    const kw = await pickBestKeyword();
    if (!kw) {
      return NextResponse.json({ message: 'No uncovered keywords available' });
    }

    const post = await generateBlogPost(kw.keyword, kw.category);

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
        voice_profile_id: profile.id,
        read_time: post.read_time,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const { data: kwData } = await supabaseAdmin.from('blog_keywords').select('posts_count').eq('keyword', kw.keyword).single();
    await supabaseAdmin
      .from('blog_keywords')
      .update({
        posts_count: (kwData?.posts_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('keyword', kw.keyword);

    // Telegram notify
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `<b>New Blog Post Published</b>\n\n<b>Title:</b> ${post.title}\n<b>Keyword:</b> ${kw.keyword}\n<b>URL:</b> /blog/${post.slug}`,
            parse_mode: 'HTML',
          }),
        }
      ).catch(() => {});
    }

    return NextResponse.json({
      published: true,
      title: post.title,
      slug: post.slug,
      keyword: kw.keyword,
    });
  } catch (e) {
    console.error('[blog-writer] Error:', e);
    return NextResponse.json({ error: 'Blog writer failed' }, { status: 500 });
  }
}
