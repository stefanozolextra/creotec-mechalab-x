import { useEffect, useState } from "react";
import { Copy, KeyRound, X } from "lucide-react";

type GeneratedPasswordModalProps = {
  open: boolean;
  email: string;
  password: string;
  onClose: () => void;
};

export default function GeneratedPasswordModal({
  open,
  email,
  password,
  onClose,
}: GeneratedPasswordModalProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopyFeedback(null);
  }, [open, email, password]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopyFeedback("Copied to clipboard.");
    } catch {
      setCopyFeedback("Copy failed. Please copy manually.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-white border border-black/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 inline-flex items-center gap-2">
            <KeyRound size={18} aria-hidden="true" />
            One-time Password
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
            <p>
              <span className="font-semibold text-slate-700">Email:</span> {email}
            </p>
            <p className="break-all">
              <span className="font-semibold text-slate-700">Generated Password:</span>{" "}
              <code className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-900">{password}</code>
            </p>
          </div>

          <p className="text-sm font-semibold text-amber-700">Copy now; it won&apos;t be shown again.</p>

          {copyFeedback ? <p className="text-sm font-semibold text-slate-700">{copyFeedback}</p> : null}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="px-5 py-2 rounded-md bg-[#2E415F] text-white font-semibold hover:bg-[#233449] inline-flex items-center gap-2"
            >
              <Copy size={16} aria-hidden="true" />
              Copy Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
