import { NextRequest, NextResponse } from 'next/server';
import { markOverdueInvoices, getRemindableInvoices } from '@/lib/invoice-agent';
import { sendEmail } from '@/lib/resend';
import { supabaseAdmin } from '@/lib/supabase';
import { notifyInvoiceEvent } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overdueCount = await markOverdueInvoices();
  const remindable = await getRemindableInvoices();
  let reminded = 0;

  for (const inv of remindable) {
    if (!inv.client_email) continue;
    try {
      await sendEmail({
        to: inv.client_email,
        subject: `Payment Reminder — Invoice ${inv.invoice_number} (Overdue)`,
        html: `<p>Hi ${inv.client_name},</p>
<p>This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> for <strong>IDR ${new Intl.NumberFormat('id-ID').format(inv.total)}</strong> was due on <strong>${inv.due_date}</strong>.</p>
<p>Please arrange payment at your earliest convenience to avoid any delays.</p>
<p>Bank: ${inv.bank_name} | Account: ${inv.bank_account_number} (${inv.bank_account_name})</p>
<p>Thank you,<br/>Studio Arsa Digital</p>`,
      });
      await supabaseAdmin.from('invoices').update({
        reminder_count: inv.reminder_count + 1,
        last_reminder_at: new Date().toISOString(),
      }).eq('id', inv.id);
      await notifyInvoiceEvent('reminder', inv);
      reminded++;
    } catch {}
  }

  return NextResponse.json({ overdueMarked: overdueCount, remindersSent: reminded });
}
