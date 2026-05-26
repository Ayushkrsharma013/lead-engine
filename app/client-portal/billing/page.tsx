"use client";

import { useEffect, useState } from "react";
import { CreditCard, Copy, ExternalLink } from "lucide-react";
import { PLANS } from "@/lib/stripe";
import type { UserProfile, PlanKey } from "@/lib/types";

export default function ClientBillingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/prospecting-os/api/client-portal/me");
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.profile);
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleCopyRef = async () => {
    if (!profile?.payment_ref) return;
    await navigator.clipboard.writeText(profile.payment_ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-5 h-5 border-2 border-white/[0.10] border-t-[#E8A840] rounded-full animate-spin" />
      </div>
    );
  }

  const plan = profile?.plan ? PLANS[profile.plan as keyof typeof PLANS] : null;

  return (
    <div className="max-w-lg space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[16px] font-bold" style={{ color: "var(--ink)" }}>Billing</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>Your plan, payment status, and billing details</p>
      </div>

      {/* Plan card */}
      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Current Plan</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
            style={{
              background: profile?.subscription_status === "active" ? "rgba(107,203,119,0.08)" : "rgba(232,168,64,0.10)",
              color: profile?.subscription_status === "active" ? "var(--positive)" : "var(--accent)",
            }}>
            {(profile?.subscription_status || "none").replace("_", " ")}
          </span>
        </div>

        {plan ? (
          <>
            <p className="text-[18px] font-bold" style={{ color: "var(--ink)" }}>{plan.name}</p>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--ink-2)" }}>
              ${plan.setupAmount.toLocaleString()}{plan.monthlyAmount > 0 ? ` + $${plan.monthlyAmount.toLocaleString()}/mo` : " one-time"}
            </p>
            <ul className="mt-3 space-y-1">
              {plan.features.map((f, i) => (
                <li key={i} className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-3)" }}>
                  <span style={{ color: "var(--positive)" }}>✓</span> {f}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>No plan assigned yet. Contact your account manager.</p>
        )}
      </div>

      {/* Payment reference */}
      {profile?.payment_ref && (
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3 className="text-[13px] font-semibold mb-2" style={{ color: "var(--ink)" }}>Payment Reference</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg text-[13px] font-mono" style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>
              {profile.payment_ref}
            </code>
            <button onClick={handleCopyRef} className="p-2 rounded-lg transition-colors hover:bg-white/[0.05]"
              style={{ color: copied ? "var(--positive)" : "var(--ink-3)" }}>
              <Copy size={14} />
            </button>
          </div>
          {copied && <p className="text-[11px] mt-1.5" style={{ color: "var(--positive)" }}>Copied!</p>}
        </div>
      )}

      {/* Help */}
      <div className="rounded-xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <p className="text-[12px] mb-2" style={{ color: "var(--ink-3)" }}>
          To upgrade or cancel your plan, contact your account manager.
        </p>
        <a href="/book" className="inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: "var(--accent-ink)" }}>
          Book a call <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
