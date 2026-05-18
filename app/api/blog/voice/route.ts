import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { extractVoiceProfile } from '@/lib/blog/voice-extractor';
import { captureError } from '@/lib/error-tracking';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('voice_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  return NextResponse.json({ profiles: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { samples, name } = await req.json();
    if (!samples || !Array.isArray(samples) || samples.length < 2) {
      return NextResponse.json({ error: 'At least 2 writing samples required' }, { status: 400 });
    }

    const guide = await extractVoiceProfile(samples, name || 'Default');

    await supabaseAdmin
      .from('voice_profiles')
      .update({ is_active: false })
      .eq('is_active', true);

    const { data, error } = await supabaseAdmin
      .from('voice_profiles')
      .insert({
        name: name || 'Default',
        extracted_guide: guide,
        sample_texts: samples,
        is_active: true,
        extracted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Voice extraction failed' }, { status: 500 });
  }
}
