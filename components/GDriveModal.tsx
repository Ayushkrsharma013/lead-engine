"use client";
import { useState, useEffect } from "react";
import { X, HardDrive, ExternalLink, Check, AlertCircle, Loader2, Key } from "lucide-react";
import { getGDriveClientId, setGDriveClientId, uploadCSVToDrive } from "@/lib/google-drive";
import { cn } from "@/lib/utils";

type Status = "idle" | "uploading" | "success" | "error";

interface GDriveModalProps {
  open: boolean;
  onClose: () => void;
  csvContent: string;
  fileName: string;
  leadCount: number;
}

export default function GDriveModal({
  open, onClose, csvContent, fileName, leadCount,
}: GDriveModalProps) {
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(getGDriveClientId());
      setStatus("idle");
      setMessage("");
      setDriveUrl("");
    }
  }, [open]);

  if (!open) return null;

  const handleSaveClientId = () => {
    setGDriveClientId(clientId);
    setMessage("Client ID saved.");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleUpload = async () => {
    const id = clientId.trim();
    if (!id) {
      setStatus("error");
      setMessage("Please enter your Google OAuth Client ID first.");
      return;
    }
    setGDriveClientId(id);
    setStatus("uploading");
    setMessage("");
    try {
      const result = await uploadCSVToDrive(csvContent, fileName, id);
      setStatus("success");
      setDriveUrl(result.viewUrl);
      setMessage(`Uploaded "${result.fileName}" to Google Drive.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] max-w-[95vw] bg-[#0d1117] border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.08]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/15 border border-blue-500/25">
            <HardDrive size={16} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">Export to Google Drive</p>
            <p className="text-xs text-slate-500">{leadCount.toLocaleString()} leads → {fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Client ID input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key size={11} />
                Google OAuth Client ID
              </label>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showInstructions ? "Hide" : "How to get this →"}
              </button>
            </div>

            {showInstructions && (
              <div className="mb-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-400 space-y-1.5">
                <p className="font-medium text-slate-300">One-time setup (5 minutes):</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>
                    Go to{" "}
                    <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline">
                      Google Cloud Console
                    </a>
                    {" "}→ Create or select a project
                  </li>
                  <li>Enable <strong className="text-slate-300">Google Drive API</strong></li>
                  <li>Go to Credentials → Create → OAuth 2.0 Client ID → Web application</li>
                  <li>
                    Add your domain to <strong className="text-slate-300">Authorized JavaScript origins</strong>
                    <br />
                    <span className="text-slate-600 font-mono">https://your-app.vercel.app</span>
                    {" "}and{" "}
                    <span className="text-slate-600 font-mono">http://localhost:3000</span>
                  </li>
                  <li>Copy the Client ID and paste it below</li>
                </ol>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="123456789-abc.apps.googleusercontent.com"
                className="flex-1 h-9 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors font-mono"
              />
              <button
                onClick={handleSaveClientId}
                disabled={!clientId.trim()}
                className="h-9 px-3 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/[0.1] text-slate-400 hover:text-slate-200 hover:bg-white/[0.09] disabled:opacity-40 transition-all"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">
              Stored locally in your browser — never sent to our servers.
            </p>
          </div>

          {/* Status */}
          {(status !== "idle" || message) && (
            <div className={cn(
              "flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs",
              status === "success" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : status === "error" ? "bg-red-500/10 border-red-500/25 text-red-400"
                : status === "uploading" ? "bg-blue-500/10 border-blue-500/25 text-blue-400"
                : "bg-white/[0.04] border-white/[0.08] text-slate-400"
            )}>
              {status === "uploading" && <Loader2 size={13} className="animate-spin shrink-0 mt-0.5" />}
              {status === "success"   && <Check size={13} className="shrink-0 mt-0.5" />}
              {status === "error"     && <AlertCircle size={13} className="shrink-0 mt-0.5" />}
              <span>{message}</span>
            </div>
          )}

          {/* Drive link after success */}
          {status === "success" && driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink size={12} />
              Open file in Google Drive
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
          >
            {status === "success" ? "Done" : "Cancel"}
          </button>
          {status !== "success" && (
            <button
              onClick={handleUpload}
              disabled={status === "uploading" || !clientId.trim()}
              className="h-9 px-5 rounded-lg text-sm font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {status === "uploading" && <Loader2 size={13} className="animate-spin" />}
              <HardDrive size={13} />
              {status === "uploading" ? "Uploading…" : "Upload to Drive"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
