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
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all"
        style={{ color: "var(--muted)" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = "var(--text)";
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = "var(--muted)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              boxShadow: "0 0 8px rgba(239,68,68,0.5)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 w-[300px] overflow-hidden animate-scale-in"
          style={{
            background: "rgba(13,13,18,0.96)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border-bright)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-xl)",
            zIndex: 50,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => dispatch({ type: "MARK_ALL_READ" })}
                className="text-[11px] font-medium transition-colors"
                style={{ color: "var(--accent-blue)" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[260px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <BellOff size={15} style={{ color: "var(--muted)" }} />
                </div>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 6).map(n => (
                <div
                  key={n.id}
                  className="px-4 py-3 transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: !n.read ? "rgba(0,212,255,0.03)" : "transparent",
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                        style={{ background: "var(--accent-blue)" }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium leading-snug" style={{ color: "var(--text)" }}>
                        {n.text}
                      </p>
                      <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--muted)" }}>
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
