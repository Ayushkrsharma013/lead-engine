import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { saveInvoice } from '@/lib/invoice-agent';
import { captureError } from '@/lib/error-tracking';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ invoices: data });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  try {
    const body = await req.json();
    const invoice = await saveInvoice(userId, body);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
