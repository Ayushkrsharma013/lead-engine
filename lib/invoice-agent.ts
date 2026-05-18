import { supabaseAdmin } from './supabase';
import { Invoice, InvoiceDraft, InvoiceItem } from './types';

export function computeInvoiceTotals(
  items: InvoiceItem[],
  discount: number,
  taxRate = 0.11
): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  const taxable = subtotal - (discount || 0);
  const tax = Math.round(taxable * taxRate);
  const total = taxable + tax;
  return { subtotal, tax, total };
}

export async function nextInvoiceNumber(userId: string): Promise<string> {
  const { count } = await supabaseAdmin
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const num = (count || 0) + 1001;
  return `INV-${num}`;
}

export async function saveInvoice(
  userId: string,
  draft: InvoiceDraft,
  invoiceId?: string
): Promise<Invoice> {
  const items = draft.items || [];
  const discount = draft.discount || 0;
  const { subtotal, tax, total } = computeInvoiceTotals(items, discount);

  if (invoiceId) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update({ ...draft, items, subtotal, tax, total, discount })
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Invoice;
  } else {
    const invoice_number = await nextInvoiceNumber(userId);
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id: userId,
        invoice_number,
        ...draft,
        items,
        subtotal,
        tax,
        total,
        discount,
        status: 'draft',
      })
      .select()
      .single();
    if (error) throw error;
    return data as Invoice;
  }
}

export async function runInvoiceAgent(
  userMessage: string,
  currentState: Partial<Invoice>,
  history: Array<{ role: string; content: string }>
): Promise<{ reply: string; patch?: Partial<InvoiceDraft> }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const systemPrompt = `You are the Invoice AI Agent for Studio Arsa Digital, a creative agency in Malang, Indonesia.
Your job: extract invoice data from natural language, update invoice fields, and respond helpfully.

Current invoice state:
${JSON.stringify(currentState, null, 2)}

Today's date: ${new Date().toISOString().split('T')[0]}

Rules:
- Currency is IDR (Indonesian Rupiah) unless specified
- Tax is always PPN 11% — auto-calculated from (subtotal - discount) × 0.11 — never ask user for it
- payment_terms must be one of: "Net 7", "Net 14", "Net 30", "Net 60", "Due on Receipt"
- issue_date and due_date are ISO date strings (YYYY-MM-DD)
- items is an array of { name, qty, unit, cost, amount } — amount = qty × cost
- unit is one of: "page", "hour", "unit", "item", "month"
- When user says "add item", append to existing items — do NOT replace them
- Infer due_date from payment_terms + issue_date if not explicitly given

Response format — ALWAYS return valid JSON on line 1, then your friendly reply on line 2+:
{"action":"update","patch":{...only the fields that changed...}}
Your confirmation message here.

If nothing to update (just a question/chat), return:
{"action":"none"}
Your answer here.

Be concise and smart. Infer context. Never ask for fields you can calculate yourself.`;

  const messages = [
    ...history.slice(-6).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  const json = await res.json();
  const candidate = json.candidates?.[0]?.content?.parts;
  const rawText = (candidate?.find((p: any) => !p.thought) ?? candidate?.[0])?.text ?? '';

  const lines = rawText.trim().split('\n');
  let patch: Partial<InvoiceDraft> | undefined;
  let replyLines: string[] = [];
  let foundJson = false;

  for (const line of lines) {
    if (!foundJson && line.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.action === 'update' && parsed.patch) patch = parsed.patch;
      } catch {}
      foundJson = true;
    } else if (foundJson) {
      replyLines.push(line);
    }
  }

  const reply = replyLines.join(' ').trim() || 'Done!';
  return { reply, patch };
}

export async function markOverdueInvoices(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabaseAdmin
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'sent')
    .lt('due_date', today)
    .select('id');
  return data?.length ?? 0;
}

export async function getRemindableInvoices(): Promise<Invoice[]> {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
  const { data } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .in('status', ['sent', 'overdue'])
    .lt('due_date', threeDaysAgo)
    .lt('reminder_count', 3);
  return (data as Invoice[]) ?? [];
}
