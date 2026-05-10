"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { useApp } from "@/lib/AppContext";

export default function NotificationBell() {
  const { state, dispatch } = useApp();
  const { notifications } = state;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--line-strong)]"
        style={{ color: "var(--ink-3)" }}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
            style={{ background: "var(--negative)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 w-[300px] overflow-hidden animate-scale-in"
          style={{
            background: "var(--surface-elev)",
            border: "1px solid var(--line-strong)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-lg)",
            zIndex: 50,
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
            <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => dispatch({ type: "MARK_ALL_READ" })}
                className="text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                  <BellOff size={15} style={{ color: "var(--ink-3)" }} />
                </div>
                <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 6).map(n => (
                <div
                  key={n.id}
                  className="px-4 py-3 transition-colors"
                  style={{ borderBottom: "1px solid var(--line)", background: !n.read ? "var(--accent-soft)" : "transparent" }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "var(--accent)" }} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium leading-snug" style={{ color: "var(--ink)" }}>{n.text}</p>
                      <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--ink-3)" }}>
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
