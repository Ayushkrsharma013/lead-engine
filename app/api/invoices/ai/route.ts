import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runInvoiceAgent } from '@/lib/invoice-agent';
import { captureError } from '@/lib/error-tracking';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { message, currentState, history } = await req.json();
    const result = await runInvoiceAgent(message, currentState, history ?? []);
    return NextResponse.json(result);
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'AI agent error' }, { status: 500 });
  }
}
