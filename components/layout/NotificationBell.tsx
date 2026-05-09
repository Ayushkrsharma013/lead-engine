"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
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
        className="relative w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-text hover:bg-white/[0.06] transition-colors"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center animate-pulse">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[300px] bg-surface2 border border-border rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-up">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-text">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => dispatch({ type: "MARK_ALL_READ" })}
                className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[250px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No notifications yet</p>
            ) : (
              notifications.slice(0, 5).map(n => (
                <div key={n.id} className={`px-4 py-2.5 border-b border-border last:border-0 ${!n.read ? "bg-white/[0.02]" : ""}`}>
                  <p className="text-[11px] text-text">{n.text}</p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
