import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { saveInvoice } from '@/lib/invoice-agent';
import { captureError } from '@/lib/error-tracking';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { data, error } = await supabaseAdmin
    .from('invoices').select('*').eq('id', params.id).eq('user_id', userId).single();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ invoice: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  try {
    const body = await req.json();
    const invoice = await saveInvoice(userId, body, params.id);
    return NextResponse.json({ invoice });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { error } = await supabaseAdmin
    .from('invoices').delete().eq('id', params.id).eq('user_id', userId);
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ success: true });
}
