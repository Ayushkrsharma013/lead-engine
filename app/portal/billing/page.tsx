"use client";

import { useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";
import { CreditCard, DollarSign, FileText, Calendar, Download, CheckCircle2, Clock } from "lucide-react";

const cardBg = "linear-gradient(180deg, var(--surface), rgba(12,13,11,0.6))";
const cardBorder = "1px solid rgba(201,168,124,0.07)";

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  status: string;
}

export default function PortalBillingPage() {
  const { state } = usePortalAuth();
  const { client } = state;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  if (!client) return null;

  useEffect(() => {
    async function fetchPayments() {
      try {
        const { data: logs } = await supabase
          .from("finance_agent_log")
          .select("id, event_type, payload, status, created_at")
          .eq("event_type", "payment_received")
          .order("created_at", { ascending: false });

        if (logs && logs.length > 0) {
          setPayments(
            logs.map((l: Record<string, unknown>) => ({
              id: String(l.id).substring(0, 8),
              date: String(l.created_at || ""),
              amount: Number(
                ((l.payload as Record<string, unknown>)?.amount as number) || 0
              ),
              status: String(l.status || "paid"),
            }))
          );
        }
      } catch {
        // RLS or network error — fall back to empty
      }
      setPaymentsLoading(false);
    }
    fetchPayments();
  }, []);

  const retainer = client.monthlyRetainer || 0;
  const nextPayment = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Billing & Subscription</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Manage your plan, payment methods, and invoices</p>
      </div>

      {/* Current Plan */}
      <div className="rounded-xl p-5" style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,168,124,0.08)", border: "1px solid rgba(201,168,124,0.15)" }}>
            <CreditCard size={17} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Current Plan</span>
            <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>Your active subscription details</p>
          </div>
          <div className="flex-1" />
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-[0.08em]"
            style={{ background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.18)" }}>Active</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>Monthly Retainer</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[28px] font-bold" style={{ color: "var(--ink)" }}>${retainer.toLocaleString()}</span>
              <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>/month</span>
            </div>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>Next Payment</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar size={16} style={{ color: "var(--accent)" }} />
              <span className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>{nextPayment.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
            </div>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ink-4)" }}>Billing Period</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock size={16} style={{ color: "var(--info)" }} />
              <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Monthly</span>
            </div>
          </div>
        </div>

        <button onClick={() => setShowUpgrade(!showUpgrade)} className="mt-4 text-[11px] font-medium transition-colors duration-200" style={{ color: "var(--accent)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--accent-ink)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--accent)"}>
          {showUpgrade ? "Hide upgrade options" : "Request plan change →"}
        </button>
        {showUpgrade && (
          <div className="mt-3 p-4 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
            <p className="text-[12px]" style={{ color: "var(--ink-2)" }}>
              To upgrade or modify your plan, contact your account manager at <span style={{ color: "var(--accent)" }}>ayush@proos.ai</span>. Plan changes take effect on the next billing cycle.
            </p>
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div className="rounded-xl p-5" style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(154,179,200,0.08)", border: "1px solid rgba(154,179,200,0.15)" }}>
            <DollarSign size={17} style={{ color: "var(--info)" }} />
          </div>
          <div>
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Payment Method</span>
            <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>Managed by your account administrator</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          <CheckCircle2 size={14} style={{ color: "var(--positive)" }} />
          <span className="text-[12px]" style={{ color: "var(--ink-2)" }}>Invoiced monthly — payments handled by ProOS</span>
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: cardBorder, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--ink-4)", opacity: 0.5 }}>Invoice History</h3>
          <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>{payments.length} invoice{payments.length !== 1 ? "s" : ""}</span>
        </div>
        {paymentsLoading ? (
          <div className="flex items-center justify-center py-10">
            <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>No payment history</p>
          </div>
        ) : (
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              {["Invoice", "Date", "Amount", "Status", ""].map(h => (
                <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--ink-4)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map(inv => (
              <tr key={inv.id} className="transition-colors duration-150" style={{ borderBottom: "1px solid var(--line)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <td className="px-5 py-3 text-[12px] font-medium" style={{ color: "var(--ink)" }}>
                  <FileText size={12} className="inline mr-1.5" style={{ color: "var(--ink-4)" }} />{inv.id}
                </td>
                <td className="px-5 py-3 text-[12px]" style={{ color: "var(--ink-3)" }}>{new Date(inv.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
                <td className="px-5 py-3 text-[12px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>${inv.amount.toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full font-medium text-[10px]"
                    style={{ background: "rgba(168,201,154,0.10)", color: "var(--positive)", border: "1px solid rgba(168,201,154,0.18)" }}>{inv.status}</span>
                </td>
                <td className="px-5 py-3">
                  <button className="flex items-center gap-1 text-[11px] font-medium transition-all duration-200 rounded px-2 py-1" style={{ color: "var(--ink-3)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.04)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <Download size={11} /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
