"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Plus, ArrowRight } from "lucide-react";
import type { Invoice } from "@/lib/types";

const formatIDR = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft:     { color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--border)" },
  sent:      { color: "var(--accent-blue)", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)" },
  paid:      { color: "var(--accent-green)", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)" },
  overdue:   { color: "var(--accent-orange)", background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.15)" },
  cancelled: { color: "#ff4444", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.15)" },
};

export default function InvoicePanel() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/prospecting-os/api/invoices")
      .then(r => r.json())
      .then(d => { if (d.invoices) setInvoices(d.invoices); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const recent = invoices.slice(0, 5);
  const totalSent = invoices.filter(i => i.status === "sent" || i.status === "paid").length;
  const pending = invoices.filter(i => i.status === "sent").reduce((s, i) => s + i.total, 0);
  const overdue = invoices.filter(i => i.status === "overdue").length;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "linear-gradient(180deg, var(--surface) 0%, rgba(12,13,11,0.6) 100%)",
        border: "1px solid rgba(201,168,124,0.07)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,168,124,0.06)", border: "1px solid rgba(201,168,124,0.10)" }}>
            <FileText size={13} style={{ color: "var(--accent)" }} />
          </div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] select-none" style={{ color: "var(--ink-4)", opacity: 0.50 }}>
            Invoice Agent
          </h3>
        </div>
        <Link
          href="/admin/invoice"
          className="flex items-center gap-1 text-[11px] font-medium transition-colors duration-200"
          style={{ color: "var(--accent)" }}
        >
          View All <ArrowRight size={11} />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg p-2.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>Sent</div>
          <div className="text-[16px] font-bold tabular-nums" style={{ color: "var(--accent-blue)" }}>{totalSent}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>Pending</div>
          <div className="text-[16px] font-bold tabular-nums" style={{ color: "var(--accent)" }}>IDR {formatIDR(pending)}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>Overdue</div>
          <div className="text-[16px] font-bold tabular-nums" style={{ color: "var(--accent-orange)" }}>{overdue}</div>
        </div>
      </div>

      {/* Recent invoices */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <FileText size={24} style={{ color: "var(--muted)", opacity: 0.3 }} />
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>No invoices yet.</p>
          <Link
            href="/admin/invoice"
            className="flex items-center gap-1 h-8 px-3 rounded-lg text-[11px] font-medium transition-all duration-200"
            style={{ background: "rgba(232,168,64,0.10)", color: "var(--accent)", border: "1px solid rgba(232,168,64,0.18)" }}
          >
            <Plus size={11} /> Create your first invoice
          </Link>
        </div>
      ) : (
        <div className="space-y-0.5">
          {recent.map(inv => (
            <Link
              key={inv.id}
              href="/admin/invoice"
              className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors duration-150"
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(237,234,226,0.03)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <span className="text-[12px] font-medium font-mono w-[72px] shrink-0" style={{ color: "var(--ink-2)" }}>
                {inv.invoice_number}
              </span>
              <span className="text-[12px] flex-1 truncate" style={{ color: "var(--ink)" }}>
                {inv.client_name}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={STATUS_STYLE[inv.status]}>
                {inv.status}
              </span>
              <span className="text-[12px] font-medium tabular-nums w-[100px] text-right shrink-0" style={{ color: "var(--ink-2)" }}>
                IDR {formatIDR(inv.total)}
              </span>
              <span className="text-[10px] tabular-nums w-[80px] text-right shrink-0" style={{ color: "var(--ink-4)" }}>
                {inv.due_date}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
