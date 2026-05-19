"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export default function SaveFilterModal({ open, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
    setName("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            className="w-[380px] max-w-[94vw] rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <Save size={15} style={{ color: "var(--accent-blue)" }} />
                <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Save Filter</h3>
              </div>
              <button onClick={onClose} className="p-1 rounded-md transition-colors" style={{ color: "var(--ink-3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5">
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--ink-3)" }}>Filter Name</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="e.g., SaaS Founders US"
                className="w-full h-10 px-3 rounded-lg text-[13px] outline-none transition-colors"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink)" }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
              <button onClick={onClose} className="h-9 px-4 rounded-lg text-[12px] font-medium transition-colors"
                style={{ color: "var(--ink-3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={saving || !name.trim()}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
                style={{ background: "var(--accent-blue)", color: "#fff" }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? "Saving…" : "Save Filter"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
