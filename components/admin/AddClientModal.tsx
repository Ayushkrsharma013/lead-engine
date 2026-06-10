"use client";

import { useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import type { DropdownOption } from "@/components/ui/CustomDropdown";

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PLAN_OPTIONS: DropdownOption[] = [
  { value: "micro", label: "Micro-Offer" },
  { value: "pilot", label: "Founder's Pilot" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
];

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
];

export default function AddClientModal({ open, onClose, onSuccess }: AddClientModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("pilot");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    setError("");

    // Validate
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Invalid email format"); return;
    }

    setLoading(true);
    try {
      const res = await fetch("/prospecting-os/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name.trim(),
          email: email.trim(),
          role: "client",
          plan,
          subscription_status: status,
          send_invite: false,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to create client");
        return;
      }

      // Reset form
      setName(""); setEmail(""); setPlan("pilot"); setStatus("active");
      onSuccess();
      onClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md animate-scale-in"
        style={{
          background: "var(--surface-elev)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.1)" }}
            >
              <UserPlus size={18} style={{ color: "#22c55e" }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>Add New Client</h2>
              <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>Create an account and workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--ink-4)", background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3.5">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-4)" }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Cooper"
              className="w-full h-10 rounded-xl px-3 text-[13px] outline-none transition-colors"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(232,66,10,0.35)")}
              onBlur={e => (e.target.style.borderColor = "var(--line)")}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-4)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full h-10 rounded-xl px-3 text-[13px] outline-none transition-colors"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(232,66,10,0.35)")}
              onBlur={e => (e.target.style.borderColor = "var(--line)")}
            />
          </div>

          {/* Plan + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-4)" }}>
                Plan
              </label>
              <CustomDropdown
                options={PLAN_OPTIONS}
                value={plan}
                onChange={setPlan}
                width={undefined}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-4)" }}>
                Status
              </label>
              <CustomDropdown
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                width={undefined}
                className="w-full"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[12px] font-medium" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-10 rounded-full text-[13px] font-semibold transition-colors"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 h-10 rounded-full text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-opacity"
            style={{
              background: "#22c55e",
              color: "#fff",
              border: "none",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin-smooth" /> : <UserPlus size={14} />}
            {loading ? "Creating..." : "Create Client"}
          </button>
        </div>
      </div>
    </div>
  );
}
