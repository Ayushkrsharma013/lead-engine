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

export default function Pagination({ pagination, total, onChange, accent = "#818cf8" }: PaginationProps) {
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

  const btnBase = "h-7 min-w-[28px] px-1.5 rounded text-xs flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06] bg-[#080b10] shrink-0">
      {/* Record count */}
      <span className="text-[11px] text-slate-500 tabular-nums">
        {total === 0 ? "No results" : `${from}–${to} of ${total.toLocaleString()} leads`}
      </span>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => setPage(1)}
          disabled={page <= 1}
          className={cn(btnBase, "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]")}
          title="First page"
        >
          <ChevronsLeft size={13} />
        </button>
        {/* Prev */}
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className={cn(btnBase, "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]")}
          title="Previous page"
        >
          <ChevronLeft size={13} />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="text-slate-600 text-xs px-1">…</span>
          ) : (
            <button
              key={n}
              onClick={() => setPage(n as number)}
              className={cn(btnBase, "font-medium tabular-nums")}
              style={
                n === page
                  ? { background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }
                  : undefined
              }
              data-inactive={n !== page || undefined}
            >
              <span className={n !== page ? "text-slate-500 hover:text-slate-300" : ""}>{n}</span>
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className={cn(btnBase, "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]")}
          title="Next page"
        >
          <ChevronRight size={13} />
        </button>
        {/* Last */}
        <button
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
          className={cn(btnBase, "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]")}
          title="Last page"
        >
          <ChevronsRight size={13} />
        </button>
      </div>

      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-600">Rows</span>
        <div className="flex gap-0.5">
          {PAGE_SIZES.map(size => (
            <button
              key={size}
              onClick={() => setPageSize(size)}
              className={cn(
                "h-6 px-2 rounded text-[11px] font-medium transition-all",
                pageSize === size
                  ? "text-white"
                  : "text-slate-600 hover:text-slate-400 hover:bg-white/[0.04]"
              )}
              style={pageSize === size ? { background: `${accent}20`, color: accent } : {}}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
