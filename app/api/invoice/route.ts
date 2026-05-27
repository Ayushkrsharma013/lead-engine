import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/types";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function notFound(message: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice not found</title></head><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;color:#1a1917"><h1>Invoice not found</h1><p>${escapeHtml(message)}</p></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txnid = searchParams.get("txnid");

  if (!txnid) {
    return NextResponse.json(
      { error: "Missing txnid parameter" },
      { status: 400 },
    );
  }

  // Look up the activated profile via xflow_transaction_id (post-payment).
  // Falls back to pending_transactions if the cleanup hasn't run yet.
  const { data: activated } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, full_name, plan, subscription_activated_at, xflow_transaction_id",
    )
    .eq("xflow_transaction_id", txnid)
    .maybeSingle();

  let userId: string | null = activated?.id ?? null;
  let plan: PlanKey | null = (activated?.plan as PlanKey) ?? null;
  let activatedAt: string | null = activated?.subscription_activated_at ?? null;
  let email: string | null = activated?.email ?? null;
  let fullName: string | null = activated?.full_name ?? null;
  let amount: number | null = null;

  if (!activated) {
    const { data: pending } = await supabaseAdmin
      .from("pending_transactions")
      .select("user_id, plan, amount, created_at")
      .eq("txnid", txnid)
      .maybeSingle();

    if (!pending) return notFound(`No record for transaction ${txnid}`);
    userId = pending.user_id as string | null;
    plan = (pending.plan as PlanKey) ?? null;
    amount = (pending.amount as number) ?? null;
    activatedAt = (pending.created_at as string) ?? null;

    if (userId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle();
      email = prof?.email ?? null;
      fullName = prof?.full_name ?? null;
    }
  }

  if (!plan) return notFound(`Plan not resolved for transaction ${txnid}`);

  const planDef = PLANS[plan];
  const planName = planDef?.name || plan;
  const setupAmount = amount ?? planDef?.setupAmount ?? 0;

  const invoiceNumber = `INV-${txnid.replace(/[^A-Z0-9]/gi, "").slice(-12).toUpperCase()}`;
  const issueDate = fmtDate(activatedAt);
  const description = `${planName} — ${plan === "micro" ? "one-time setup" : "setup payment"}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tax Invoice ${escapeHtml(invoiceNumber)} — Flow-Forges</title>
  <style>
    @media print {
      body { background: #fff !important; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #f4f3f0;
      color: #1a1917;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice {
      max-width: 720px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e5e2dc;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .header {
      padding: 32px 40px;
      border-bottom: 1px solid #e5e2dc;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand h1 {
      margin: 0 0 4px;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .brand .accent { color: #e8420a; }
    .brand .tag {
      margin: 0;
      font-size: 11px;
      color: #6b6b66;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .stamp {
      display: inline-block;
      padding: 8px 18px;
      border: 2px solid #15803d;
      color: #15803d;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      transform: rotate(-6deg);
      border-radius: 6px;
      background: rgba(34,197,94,0.06);
    }
    .meta {
      padding: 32px 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      border-bottom: 1px solid #e5e2dc;
    }
    .meta-block h3 {
      margin: 0 0 8px;
      font-size: 11px;
      color: #6b6b66;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    .meta-block p {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .items {
      padding: 32px 40px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      font-size: 11px;
      color: #6b6b66;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      padding: 10px 0;
      border-bottom: 1px solid #e5e2dc;
      font-weight: 600;
    }
    td {
      padding: 16px 0;
      font-size: 14px;
      border-bottom: 1px solid #f0eee9;
    }
    .right { text-align: right; }
    .totals {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-table {
      width: 280px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .totals-row.grand {
      border-top: 2px solid #1a1917;
      margin-top: 8px;
      padding-top: 14px;
      font-size: 16px;
      font-weight: 700;
    }
    .footer {
      padding: 24px 40px;
      background: #faf9f6;
      border-top: 1px solid #e5e2dc;
      font-size: 12px;
      color: #6b6b66;
      line-height: 1.6;
    }
    .footer p { margin: 0 0 6px; }
    .actions {
      max-width: 720px;
      margin: 16px auto 0;
      text-align: right;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: #e8420a;
      color: #fff;
      text-decoration: none;
      border-radius: 999px;
      font-weight: 600;
      font-size: 13px;
      border: none;
      cursor: pointer;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        <h1>Flow<span class="accent">-Forges</span></h1>
        <p class="tag">Tax Invoice — Prospecting OS</p>
      </div>
      <div class="stamp">Paid in Full</div>
    </div>

    <div class="meta">
      <div class="meta-block">
        <h3>Billed to</h3>
        <p><strong>${escapeHtml(fullName || "Customer")}</strong></p>
        <p>${escapeHtml(email || "")}</p>
      </div>
      <div class="meta-block" style="text-align:right;">
        <h3>Invoice details</h3>
        <p><strong>${escapeHtml(invoiceNumber)}</strong></p>
        <p>Date: ${escapeHtml(issueDate)}</p>
        <p>Reference: <code>${escapeHtml(txnid)}</code></p>
      </div>
    </div>

    <div class="items">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(description)}</td>
            <td class="right">$${setupAmount.toLocaleString("en-US")}.00</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-table">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>$${setupAmount.toLocaleString("en-US")}.00</span>
          </div>
          <div class="totals-row">
            <span>Tax</span>
            <span>$0.00</span>
          </div>
          <div class="totals-row grand">
            <span>Total Paid</span>
            <span>$${setupAmount.toLocaleString("en-US")}.00</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p><strong>Payment method:</strong> Card / Bank Transfer (XflowPay)</p>
      <p><strong>Status:</strong> Paid in full on ${escapeHtml(issueDate)}</p>
      <p style="margin-top:12px;">Flow-Forges &middot; billing@flow-forges.com &middot; flow-forges.com</p>
      <p>This is a system-generated receipt. No GST is applicable on this invoice.</p>
    </div>
  </div>

  <div class="actions no-print">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
