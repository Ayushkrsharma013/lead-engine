import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { notifyInvoiceEvent } from '@/lib/notify';
import { captureError } from '@/lib/error-tracking';
import { Invoice } from '@/lib/types';
import { checkMinuteLimit } from '@/lib/rate-limit';

function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

function buildInvoiceHTML(inv: Invoice): string {
  const itemsRows = inv.items.map(i =>
    `<tr><td style="padding:8px;text-align:left;border-bottom:1px solid #e2e0db;font-size:13px;color:#1a1917;">${i.name}</td><td style="padding:8px;text-align:center;border-bottom:1px solid #e2e0db;font-size:13px;color:#6b6862;">${i.qty} ${i.unit}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #e2e0db;font-size:13px;color:#6b6862;">IDR ${formatIDR(i.cost)}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #e2e0db;font-size:13px;font-weight:500;color:#1a1917;">IDR ${formatIDR(i.amount)}</td></tr>`
  ).join('');

  return `
<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;padding:32px;color:#1a1917;">
<div style="background:#1a1917;padding:8px 12px;border-radius:6px;display:inline-block;margin-bottom:24px;">
  <span style="color:#fff;font-weight:600;font-size:14px;">Studio Arsa Digital</span>
</div>
<h2 style="font-size:22px;font-weight:600;margin-bottom:4px;">Invoice ${inv.invoice_number}</h2>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;background:#f5f4f1;padding:14px;border-radius:8px;">
  <div><div style="font-size:10px;color:#9e9b96;text-transform:uppercase;">Issue Date</div><div style="font-weight:500;font-size:13px;">${inv.issue_date}</div></div>
  <div><div style="font-size:10px;color:#9e9b96;text-transform:uppercase;">Due Date</div><div style="font-weight:500;font-size:13px;">${inv.due_date}</div></div>
  <div><div style="font-size:10px;color:#9e9b96;text-transform:uppercase;">Terms</div><div style="font-weight:500;font-size:13px;">${inv.payment_terms}</div></div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
  <thead><tr style="background:#f5f4f1;"><th style="text-align:left;padding:8px;font-size:11px;color:#9e9b96;text-transform:uppercase;">Item</th><th style="text-align:center;padding:8px;font-size:11px;color:#9e9b96;text-transform:uppercase;">QTY</th><th style="text-align:right;padding:8px;font-size:11px;color:#9e9b96;text-transform:uppercase;">Cost</th><th style="text-align:right;padding:8px;font-size:11px;color:#9e9b96;text-transform:uppercase;">Amount</th></tr></thead>
  <tbody>${itemsRows}</tbody>
</table>
<div style="text-align:right;border-top:1px solid #e2e0db;padding-top:12px;">
  <div style="margin-bottom:4px;font-size:13px;color:#6b6862;">Subtotal: IDR ${formatIDR(inv.subtotal)}</div>
  <div style="margin-bottom:4px;font-size:13px;color:#6b6862;">Discount: IDR ${formatIDR(inv.discount)}</div>
  <div style="margin-bottom:4px;font-size:13px;color:#6b6862;">Tax (11%): IDR ${formatIDR(inv.tax)}</div>
  <div style="font-size:16px;font-weight:600;">Total: IDR ${formatIDR(inv.total)}</div>
</div>
<div style="margin-top:20px;background:#f5f4f1;padding:14px;border-radius:8px;">
  <div style="font-size:11px;color:#9e9b96;text-transform:uppercase;margin-bottom:6px;">Bank Details</div>
  <div style="font-size:13px;">Bank: ${inv.bank_name}</div>
  <div style="font-size:13px;">Account Name: ${inv.bank_account_name}</div>
  <div style="font-size:13px;font-family:monospace;">Account: ${inv.bank_account_number}</div>
</div>
${inv.notes ? `<div style="margin-top:16px;font-size:12px;color:#6b6862;white-space:pre-line;">${inv.notes}</div>` : ''}
</body></html>`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const rl = checkMinuteLimit('invoice-send', userId, 20);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }

  try {
    const { invoiceId } = await req.json();
    const { data: inv, error } = await supabaseAdmin
      .from('invoices').select('*').eq('id', invoiceId).eq('user_id', userId).single();
    if (error || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (!inv.client_email) return NextResponse.json({ error: 'No client email set' }, { status: 400 });

    const html = buildInvoiceHTML(inv as Invoice);
    const emailResult = await sendEmail({
      to: inv.client_email,
      subject: `Invoice ${inv.invoice_number} from Studio Arsa Digital`,
      html,
    });

    await supabaseAdmin.from('invoices').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      resend_email_id: emailResult?.resendId ?? null,
    }).eq('id', invoiceId);

    await supabaseAdmin.from('finance_agent_log').insert({
      event_type: 'invoice_sent',
      profile_id: userId,
      payload: { invoice_number: inv.invoice_number, client: inv.client_name, total: inv.total },
      status: 'sent',
    });

    await notifyInvoiceEvent('sent', inv as Invoice);
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError({ message: String(e), source: 'api' });
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
