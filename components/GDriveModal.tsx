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
      <div className="w-[520px] max-w-[95vw] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-line">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/15 border border-accent-blue/25">
            <HardDrive size={16} className="text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Export to Google Drive</p>
            <p className="text-xs text-ink-3">{leadCount.toLocaleString()} leads → {fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Client ID input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Key size={11} />
                Google OAuth Client ID
              </label>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-[11px] text-accent hover:text-accent/80 transition-colors"
              >
                {showInstructions ? "Hide" : "How to get this →"}
              </button>
            </div>

            {showInstructions && (
              <div className="mb-3 p-3 rounded-lg bg-white/[0.03] border border-line text-[11px] text-ink-3 space-y-1.5">
                <p className="font-medium text-ink">One-time setup (5 minutes):</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>
                    Go to{" "}
                    <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80 underline">
                      Google Cloud Console
                    </a>
                    {" "}→ Create or select a project
                  </li>
                  <li>Enable <strong className="text-ink">Google Drive API</strong></li>
                  <li>Go to Credentials → Create → OAuth 2.0 Client ID → Web application</li>
                  <li>
                    Add your domain to <strong className="text-ink">Authorized JavaScript origins</strong>
                    <br />
                    <span className="text-ink-3/70 font-mono">https://your-app.vercel.app</span>
                    {" "}and{" "}
                    <span className="text-ink-3/70 font-mono">http://localhost:3000</span>
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
                className="flex-1 h-9 bg-white/[0.05] border border-line rounded-lg px-3 text-xs text-ink placeholder:text-ink-3/70 focus:outline-none focus:border-accent-blue/40 transition-colors font-mono"
              />
              <button
                onClick={handleSaveClientId}
                disabled={!clientId.trim()}
                className="h-9 px-3 rounded-lg text-xs font-medium bg-white/[0.06] border border-line text-ink-3 hover:text-ink hover:bg-white/[0.09] disabled:opacity-40 transition-all"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-ink-3/70 mt-1.5">
              Stored locally in your browser — never sent to our servers.
            </p>
          </div>

          {/* Status */}
          {(status !== "idle" || message) && (
            <div className={cn(
              "flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs",
              status === "success" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : status === "error" ? "bg-red-500/10 border-red-500/25 text-red-400"
                : status === "uploading" ? "bg-accent/10 border-accent-blue/25 text-accent"
                : "bg-white/[0.04] border-line text-ink-3"
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
              className="flex items-center gap-2 text-xs text-accent hover:text-accent/80 transition-colors"
            >
              <ExternalLink size={12} />
              Open file in Google Drive
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm text-ink-3 hover:text-ink hover:bg-white/[0.05] transition-all"
          >
            {status === "success" ? "Done" : "Cancel"}
          </button>
          {status !== "success" && (
            <button
              onClick={handleUpload}
              disabled={status === "uploading" || !clientId.trim()}
              className="h-9 px-5 rounded-lg text-sm font-semibold bg-accent/20 text-accent border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
