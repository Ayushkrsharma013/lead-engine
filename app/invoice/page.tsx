"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Send, Plus, Trash2, Bot, Sparkles,
  CheckCircle, AlertCircle, Clock, DollarSign, ArrowLeft,
  Eye, Mail, CreditCard, Loader2,
} from "lucide-react";
import type { Invoice, InvoiceDraft, InvoiceItem, InvoiceAIMessage } from "@/lib/types";
import TopBar from "@/components/layout/TopBar";

const formatIDR = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

function computeTotals(items: InvoiceItem[], discount: number) {
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  const taxable = subtotal - (discount || 0);
  const tax = Math.round(taxable * 0.11);
  return { subtotal, tax, total: taxable + tax };
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft:     { color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--border)" },
  sent:      { color: "var(--accent-blue)", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" },
  paid:      { color: "var(--accent-green)", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" },
  overdue:   { color: "var(--accent-orange)", background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.15)" },
  cancelled: { color: "#ff4444", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.15)" },
};

const PAYMENT_TERMS = ["Net 7", "Net 14", "Net 30", "Net 60", "Due on Receipt"];
const UNITS = ["page", "hour", "unit", "item", "month"];

export default function InvoicePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [view, setView] = useState<"list" | "editor">("list");
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft>({});
  const [chatHistory, setChatHistory] = useState<InvoiceAIMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/prospecting-os/api/invoices");
      const data = await res.json();
      if (data.invoices) setInvoices(data.invoices);
    } catch {}
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const totals = computeTotals(draft.items || [], draft.discount || 0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ─── New invoice ──────────────────────────────────────────────────────────

  const handleNew = () => {
    setActiveInvoice(null);
    setDraft({
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      payment_terms: "Net 14",
      items: [],
      discount: 0,
    });
    setChatHistory([{
      role: "assistant",
      content: "Hi! I'm your Invoice AI. Describe the invoice — client, services, amounts, terms — and I'll fill it in. Or edit fields directly below.",
    }]);
    setView("editor");
  };

  const handleEdit = (inv: Invoice) => {
    setActiveInvoice(inv);
    setDraft({
      client_name: inv.client_name,
      client_email: inv.client_email || undefined,
      client_billing_address: inv.client_billing_address || undefined,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      payment_terms: inv.payment_terms,
      items: inv.items,
      discount: inv.discount,
      notes: inv.notes || undefined,
      currency: inv.currency,
    });
    setChatHistory([]);
    setView("editor");
  };

  // ─── Items ────────────────────────────────────────────────────────────────

  const addItem = () => {
    const items = [...(draft.items || []), { name: "", qty: 1, unit: "hour", cost: 0, amount: 0 }];
    setDraft({ ...draft, items });
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const items = [...(draft.items || [])];
    const item = { ...items[idx], [field]: value };
    if (field === "qty" || field === "cost") {
      item.amount = item.qty * item.cost;
    }
    items[idx] = item;
    setDraft({ ...draft, items });
  };

  const removeItem = (idx: number) => {
    setDraft({ ...draft, items: (draft.items || []).filter((_, i) => i !== idx) });
  };

  // ─── AI Chat ──────────────────────────────────────────────────────────────

  const handleAISend = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const msg = aiInput.trim();
    setAiInput("");
    const history = [...chatHistory, { role: "user" as const, content: msg }];
    setChatHistory(history);
    setAiLoading(true);

    try {
      const currentState = { ...draft, items: draft.items || [] };
      const res = await fetch("/prospecting-os/api/invoices/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, currentState, history }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setChatHistory([...history, { role: "assistant", content: data.reply || "Done!" }]);

      if (data.patch) {
        setDraft(prev => {
          const next = { ...prev };
          if (data.patch.client_name !== undefined) next.client_name = data.patch.client_name;
          if (data.patch.client_email !== undefined) next.client_email = data.patch.client_email;
          if (data.patch.client_billing_address !== undefined) next.client_billing_address = data.patch.client_billing_address;
          if (data.patch.issue_date !== undefined) next.issue_date = data.patch.issue_date;
          if (data.patch.due_date !== undefined) next.due_date = data.patch.due_date;
          if (data.patch.payment_terms !== undefined) next.payment_terms = data.patch.payment_terms;
          if (data.patch.items !== undefined) next.items = data.patch.items;
          if (data.patch.discount !== undefined) next.discount = data.patch.discount;
          if (data.patch.notes !== undefined) next.notes = data.patch.notes;
          if (data.patch.currency !== undefined) next.currency = data.patch.currency;
          return next;
        });
      }
    } catch (e) {
      setError(String(e));
      setChatHistory([...history, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    }
    setAiLoading(false);
  };

  // ─── Save / Send / Mark Paid ──────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        activeInvoice
          ? `/prospecting-os/api/invoices/${activeInvoice.id}`
          : "/prospecting-os/api/invoices",
        {
          method: activeInvoice ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast(activeInvoice ? "Invoice updated" : "Invoice created");
      await fetchInvoices();
      if (data.invoice) {
        setActiveInvoice(data.invoice);
        setDraft({
          client_name: data.invoice.client_name,
          client_email: data.invoice.client_email || undefined,
          client_billing_address: data.invoice.client_billing_address || undefined,
          issue_date: data.invoice.issue_date,
          due_date: data.invoice.due_date,
          payment_terms: data.invoice.payment_terms,
          items: data.invoice.items,
          discount: data.invoice.discount,
          notes: data.invoice.notes || undefined,
          currency: data.invoice.currency,
        });
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  const handleSend = async () => {
    if (!activeInvoice) return;
    setSending(true);
    try {
      const res = await fetch("/prospecting-os/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: activeInvoice.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Invoice sent!");
      await fetchInvoices();
    } catch (e) {
      setError(String(e));
    }
    setSending(false);
  };

  const handleMarkPaid = async () => {
    if (!activeInvoice) return;
    try {
      const res = await fetch(`/prospecting-os/api/invoices/${activeInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast("Marked as paid");
      await fetchInvoices();
      if (data.invoice) setActiveInvoice(data.invoice);
    } catch (e) {
      setError(String(e));
    }
  };

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = {
    total: invoices.length,
    sent: invoices.filter(i => i.status === "sent" || i.status === "paid").length,
    paid: invoices.filter(i => i.status === "paid").length,
    revenue: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
    pending: invoices.filter(i => i.status === "sent").reduce((s, i) => s + i.total, 0),
    overdue: invoices.filter(i => i.status === "overdue").length,
  };

  return (
    <>
      <TopBar title="Invoice Agent" subtitle="AI-powered invoice creation and management" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-lg text-[13px] font-medium"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── List View ─── */}
        {view === "list" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-5 gap-3">
              <StatCard icon={FileText} label="Total" value={stats.total} color="var(--text)" />
              <StatCard icon={Send} label="Sent" value={stats.sent} color="var(--accent-blue)" />
              <StatCard icon={CheckCircle} label="Paid" value={stats.paid} color="var(--accent-green)" />
              <StatCard icon={AlertCircle} label="Overdue" value={stats.overdue} color="var(--accent-orange)" />
              <StatCard icon={DollarSign} label="Revenue" value={`IDR ${formatIDR(stats.revenue)}`} color="var(--accent-green)" />
            </div>

            {/* Invoice list */}
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  All Invoices
                </h3>
                <button
                  onClick={handleNew}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all duration-200"
                  style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.18)" }}
                >
                  <Plus size={13} /> New Invoice
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FileText size={32} style={{ color: "var(--muted)", opacity: 0.3 }} />
                  <p className="text-[13px]" style={{ color: "var(--muted)" }}>No invoices yet.</p>
                  <button onClick={handleNew} className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-medium"
                    style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.18)" }}>
                    <Plus size={13} /> Create your first invoice
                  </button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Invoice</th>
                      <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Client</th>
                      <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Status</th>
                      <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Total</th>
                      <th className="text-[10px] font-semibold uppercase tracking-wider pb-2 pr-4" style={{ color: "var(--muted)" }}>Due</th>
                      <th className="text-[10px] font-semibold uppercase tracking-wider pb-2" style={{ color: "var(--muted)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b transition-colors duration-150 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => handleEdit(inv)}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.02)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <td className="py-2.5 pr-4 text-[13px] font-medium font-mono" style={{ color: "var(--text)" }}>{inv.invoice_number}</td>
                        <td className="py-2.5 pr-4 text-[13px]" style={{ color: "var(--text)" }}>{inv.client_name}</td>
                        <td className="py-2.5 pr-4">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={STATUS_STYLE[inv.status]}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-[13px] font-medium tabular-nums" style={{ color: "var(--text)" }}>IDR {formatIDR(inv.total)}</td>
                        <td className="py-2.5 pr-4 text-[12px] tabular-nums" style={{ color: "var(--muted)" }}>{inv.due_date}</td>
                        <td className="py-2.5">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(inv); }}
                            className="text-[11px] font-medium px-2 py-1 rounded-lg transition-all duration-200"
                            style={{ color: "var(--accent)" }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(232,168,64,0.08)"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── Editor View ─── */}
        {view === "editor" && (
          <div className="grid grid-cols-[1fr_520px] gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* AI Chat Panel */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.15)" }}>
                    <Bot size={13} style={{ color: "var(--accent-purple)" }} />
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>Invoice AI Agent</span>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "rgba(124,58,237,0.08)", color: "var(--accent-purple)" }}>
                    Gemini 2.5 Flash
                  </span>
                </div>

                <div className="space-y-2 mb-3 max-h-[160px] overflow-y-auto pr-1">
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed"
                        style={m.role === "user"
                          ? { background: "rgba(0,212,255,0.08)", color: "var(--accent-blue)", border: "1px solid rgba(0,212,255,0.12)" }
                          : { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }
                        }
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-lg px-3 py-2 flex items-center gap-1.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-purple)" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-purple)", animationDelay: "0.15s" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-purple)", animationDelay: "0.3s" }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAISend()}
                    placeholder='Describe the invoice... e.g. "Website redesign for Tokopedia, 3 pages at 2.5M each, 1 month SEO at 5M"'
                    className="flex-1 h-9 rounded-lg px-3 text-[12px] outline-none transition-colors duration-200"
                    style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}
                  />
                  <button
                    onClick={handleAISend}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-medium transition-all duration-200"
                    style={{ background: "rgba(124,58,237,0.10)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.15)" }}
                  >
                    {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Send
                  </button>
                </div>
              </div>

              {/* Form */}
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                    Invoice Details
                  </h3>
                  <button onClick={() => setView("list")}
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors duration-200"
                    style={{ color: "var(--muted)" }}
                  >
                    <ArrowLeft size={12} /> Back
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Client Name" value={draft.client_name || ""} onChange={v => setDraft({ ...draft, client_name: v })} />
                  <InputField label="Client Email" type="email" value={draft.client_email || ""} onChange={v => setDraft({ ...draft, client_email: v })} />
                </div>
                <InputField label="Billing Address" value={draft.client_billing_address || ""} onChange={v => setDraft({ ...draft, client_billing_address: v })} />

                <div className="grid grid-cols-3 gap-3">
                  <InputField label="Issue Date" type="date" value={draft.issue_date || ""} onChange={v => setDraft({ ...draft, issue_date: v })} />
                  <InputField label="Due Date" type="date" value={draft.due_date || ""} onChange={v => setDraft({ ...draft, due_date: v })} />
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Terms</label>
                    <select
                      value={draft.payment_terms || "Net 14"}
                      onChange={e => setDraft({ ...draft, payment_terms: e.target.value })}
                      className="w-full h-9 rounded-lg px-3 text-[12px] outline-none transition-colors duration-200"
                      style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}
                    >
                      {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Line Items</span>
                    <button onClick={addItem}
                      className="flex items-center gap-1 text-[11px] font-medium transition-colors duration-200"
                      style={{ color: "var(--accent)" }}
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {(draft.items || []).length === 0 ? (
                    <div className="py-4 text-center text-[11px]" style={{ color: "var(--muted)" }}>
                      No items yet. Add one or describe it to the AI agent above.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {(draft.items || []).map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_60px_80px_80px_80px_28px] gap-1.5 items-center">
                          <input type="text" placeholder="Service name" value={item.name}
                            onChange={e => updateItem(idx, "name", e.target.value)}
                            className="h-8 rounded-md px-2.5 text-[11px] outline-none"
                            style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}
                          />
                          <input type="number" placeholder="Qty" value={item.qty || ""}
                            onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                            className="h-8 rounded-md px-2.5 text-[11px] outline-none text-center"
                            style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}
                          />
                          <select value={item.unit}
                            onChange={e => updateItem(idx, "unit", e.target.value)}
                            className="h-8 rounded-md px-1.5 text-[11px] outline-none"
                            style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}
                          >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <input type="number" placeholder="Cost" value={item.cost || ""}
                            onChange={e => updateItem(idx, "cost", Number(e.target.value))}
                            className="h-8 rounded-md px-2.5 text-[11px] outline-none text-right"
                            style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}
                          />
                          <div className="h-8 flex items-center justify-end px-2.5 text-[11px] font-medium tabular-nums" style={{ color: "var(--text)" }}>
                            {formatIDR(item.amount)}
                          </div>
                          <button onClick={() => removeItem(idx)}
                            className="flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-150"
                            style={{ color: "var(--muted)" }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ff4444"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--muted)"}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Discount (IDR)" type="number" value={String(draft.discount || 0)} onChange={v => setDraft({ ...draft, discount: Number(v) || 0 })} />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <ReadOnlyField label="Subtotal" value={`IDR ${formatIDR(totals.subtotal)}`} />
                  <ReadOnlyField label="Tax (PPN 11%)" value={`IDR ${formatIDR(totals.tax)}`} />
                  <ReadOnlyField label="Total" value={`IDR ${formatIDR(totals.total)}`} color="var(--accent)" />
                </div>

                <InputField label="Notes" value={draft.notes || ""} onChange={v => setDraft({ ...draft, notes: v })} />

                {/* Action bar */}
                <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-medium transition-all duration-200"
                    style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.18)" }}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    {activeInvoice ? "Save Changes" : "Save Draft"}
                  </button>
                  {activeInvoice && draft.client_email && activeInvoice.status !== "paid" && (
                    <button onClick={handleSend} disabled={sending}
                      className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-medium transition-all duration-200"
                      style={{ background: "rgba(0,212,255,0.10)", color: "var(--accent-blue)", border: "1px solid rgba(0,212,255,0.18)" }}
                    >
                      {sending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                      Send Invoice
                    </button>
                  )}
                  {activeInvoice && (activeInvoice.status === "sent" || activeInvoice.status === "overdue") && (
                    <button onClick={handleMarkPaid}
                      className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-medium transition-all duration-200"
                      style={{ background: "rgba(0,255,136,0.08)", color: "var(--accent-green)", border: "1px solid rgba(0,255,136,0.15)" }}
                    >
                      <CreditCard size={12} /> Mark as Paid
                    </button>
                  )}
                </div>

                {error && (
                  <div className="text-[11px] px-3 py-2 rounded-lg" style={{ color: "#ff4444", background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.12)" }}>
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column — Live Preview */}
            <div>
              <div
                className="rounded-xl p-5 sticky top-6"
                style={{ background: "#fff", border: "1px solid #e2e0db", color: "#1a1917" }}
              >
                {/* Brand block */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#1a1917" }}>
                    <span className="text-[11px] font-bold" style={{ color: "#E8A840" }}>SA</span>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold">Studio Arsa Digital</div>
                    <div className="text-[10px]" style={{ color: "#9e9b96" }}>prospecting-os@flow-forges.com</div>
                  </div>
                </div>

                {/* Invoice header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[20px] font-bold tracking-tight">
                      {activeInvoice ? activeInvoice.invoice_number : "INV-XXXX"}
                    </h2>
                    <div className="text-[11px] capitalize" style={{ color: "#9e9b96" }}>
                      {activeInvoice ? activeInvoice.status : "draft"}
                    </div>
                  </div>
                  {activeInvoice && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
                      color: (STATUS_STYLE[activeInvoice.status]?.color as string) || "#9e9b96",
                      background: (STATUS_STYLE[activeInvoice.status]?.background as string) || "var(--surface2)",
                      border: (STATUS_STYLE[activeInvoice.status]?.border as string) || "1px solid var(--border)",
                    }}>
                      {activeInvoice.status}
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="grid grid-cols-3 gap-3 mb-5 p-3 rounded-lg" style={{ background: "#f5f4f1" }}>
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#9e9b96" }}>Issue Date</div>
                    <div className="text-[12px] font-medium mt-0.5">{draft.issue_date || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#9e9b96" }}>Due Date</div>
                    <div className="text-[12px] font-medium mt-0.5">{draft.due_date || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#9e9b96" }}>Terms</div>
                    <div className="text-[12px] font-medium mt-0.5">{draft.payment_terms || "Net 14"}</div>
                  </div>
                </div>

                {/* Billed to */}
                {(draft.client_name || draft.client_email) && (
                  <div className="mb-4">
                    <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#9e9b96" }}>Billed To</div>
                    <div className="text-[13px] font-medium">{draft.client_name || "—"}</div>
                    {draft.client_email && <div className="text-[11px]" style={{ color: "#6b6862" }}>{draft.client_email}</div>}
                    {draft.client_billing_address && <div className="text-[11px]" style={{ color: "#6b6862" }}>{draft.client_billing_address}</div>}
                  </div>
                )}

                {/* Items table */}
                {(draft.items || []).length > 0 && (
                  <table className="w-full mb-4" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f5f4f1" }}>
                        <th className="text-left py-2 px-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#9e9b96" }}>Item</th>
                        <th className="text-center py-2 px-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#9e9b96" }}>QTY</th>
                        <th className="text-right py-2 px-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#9e9b96" }}>Cost</th>
                        <th className="text-right py-2 px-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#9e9b96" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.items || []).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e0db" }}>
                          <td className="py-2 px-2 text-[12px]">{item.name || "—"}</td>
                          <td className="py-2 px-2 text-[12px] text-center" style={{ color: "#6b6862" }}>{item.qty} {item.unit}</td>
                          <td className="py-2 px-2 text-[12px] text-right" style={{ color: "#6b6862" }}>IDR {formatIDR(item.cost)}</td>
                          <td className="py-2 px-2 text-[12px] text-right font-medium">IDR {formatIDR(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Totals */}
                <div className="text-right pt-3" style={{ borderTop: "1px solid #e2e0db" }}>
                  <div className="text-[11px] mb-1" style={{ color: "#6b6862" }}>Subtotal: IDR {formatIDR(totals.subtotal)}</div>
                  {(draft.discount || 0) > 0 && (
                    <div className="text-[11px] mb-1" style={{ color: "#6b6862" }}>Discount: IDR {formatIDR(draft.discount || 0)}</div>
                  )}
                  <div className="text-[11px] mb-1" style={{ color: "#6b6862" }}>Tax (11%): IDR {formatIDR(totals.tax)}</div>
                  <div className="text-[16px] font-bold mt-1">Total: IDR {formatIDR(totals.total)}</div>
                </div>

                {/* Bank details */}
                <div className="mt-4 p-3 rounded-lg" style={{ background: "#f5f4f1" }}>
                  <div className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#9e9b96" }}>Bank Details</div>
                  <div className="text-[11px]">Bank: Bank Central Asia (BCA)</div>
                  <div className="text-[11px]">Account Name: Studio Arsa Digital</div>
                  <div className="text-[11px]" style={{ fontFamily: "monospace" }}>Account: 123 456 7890</div>
                </div>

                {draft.notes && (
                  <div className="mt-3 text-[10px] whitespace-pre-line" style={{ color: "#6b6862" }}>{draft.notes}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties; className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
        <div className="text-[16px] font-bold tabular-nums" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

function InputField({ label, type = "text", value, onChange }: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 rounded-lg px-3 text-[12px] outline-none transition-colors duration-200"
        style={{ color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}
      />
    </div>
  );
}

function ReadOnlyField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</label>
      <div className="h-9 flex items-center px-3 rounded-lg text-[13px] font-semibold tabular-nums"
        style={{ color: color || "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)" }}>
        {value}
      </div>
    </div>
  );
}
