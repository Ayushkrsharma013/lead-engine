"use client";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { PaginationState } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [25, 50, 100];

interface PaginationProps {
  pagination: PaginationState;
  total: number;                             // total filtered records
  onChange: (p: PaginationState) => void;
  accent?: string;
}

export default function Pagination({ pagination, total, onChange, accent = "var(--accent)" }: PaginationProps) {
  const { page, pageSize } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const setPage = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    if (clamped !== page) onChange({ ...pagination, page: clamped });
  };

  const setPageSize = (size: number) => {
    onChange({ page: 1, pageSize: size });
  };

  // Build visible page numbers (window of 5 around current)
  const pageNumbers: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    const left  = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    pageNumbers.push(1);
    if (left > 2)           pageNumbers.push("…");
    for (let i = left; i <= right; i++) pageNumbers.push(i);
    if (right < totalPages - 1) pageNumbers.push("…");
    pageNumbers.push(totalPages);
  }

  const navBtn = "h-7 min-w-[28px] px-1.5 rounded-lg text-xs flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 shrink-0"
      style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }}
    >
      {/* Record count */}
      <span className="text-[11px] tabular-nums" style={{ color: "var(--ink-3)" }}>
        {total === 0
          ? "No results"
          : <><span style={{ color: "var(--ink)", fontWeight: 600 }}>{from}–{to}</span> of {total.toLocaleString()} leads</>
        }
      </span>

      {/* Page navigation */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setPage(1)}
          disabled={page <= 1}
          className={navBtn}
          style={{ color: "var(--ink-3)" }}
          onMouseEnter={e => { if (page > 1) { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          title="First page"
        >
          <ChevronsLeft size={13} />
        </button>
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className={navBtn}
          style={{ color: "var(--ink-3)" }}
          onMouseEnter={e => { if (page > 1) { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          title="Previous page"
        >
          <ChevronLeft size={13} />
        </button>

        {pageNumbers.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="text-xs px-1" style={{ color: "var(--ink-3)", opacity: 0.5 }}>…</span>
          ) : (
            <button
              key={n}
              onClick={() => setPage(n as number)}
              className={cn(navBtn, "font-medium tabular-nums min-w-[28px]")}
              style={n === page ? {
                background: `${accent}20`,
                color: accent,
                border: `1px solid ${accent}35`,
              } : {
                color: "var(--ink-3)",
              }}
              onMouseEnter={e => { if (n !== page) { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } }}
              onMouseLeave={e => { if (n !== page) { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
            >
              {n}
            </button>
          )
        )}

        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className={navBtn}
          style={{ color: "var(--ink-3)" }}
          onMouseEnter={e => { if (page < totalPages) { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          title="Next page"
        >
          <ChevronRight size={13} />
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
          className={navBtn}
          style={{ color: "var(--ink-3)" }}
          onMouseEnter={e => { if (page < totalPages) { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          title="Last page"
        >
          <ChevronsRight size={13} />
        </button>
      </div>

      {/* Page size */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--ink-3)" }}>Rows</span>
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          {PAGE_SIZES.map(size => (
            <button
              key={size}
              onClick={() => setPageSize(size)}
              className="h-5 px-2 rounded-md text-[11px] font-medium transition-all"
              style={pageSize === size ? {
                background: `${accent}20`,
                color: accent,
              } : {
                color: "var(--ink-3)",
              }}
              onMouseEnter={e => { if (pageSize !== size) (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
              onMouseLeave={e => { if (pageSize !== size) (e.currentTarget as HTMLElement).style.color = "var(--ink-3)"; }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
