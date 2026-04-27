import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import AdminModalShell from "./ui/AdminModalShell";

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

  const handleCloseModal = () => {
    setCopyFeedback(null);
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopyFeedback("Copied to clipboard.");
    } catch {
      setCopyFeedback("Copy failed. Please copy manually.");
    }
  };

  return (
    <AdminModalShell
      open={open}
      onClose={handleCloseModal}
      title="One-time Password"
      icon={<KeyRound size={18} />}
      maxWidthClass="max-w-lg"
      bodyClassName="p-5 space-y-4"
      footer={(
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-5 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            className="px-5 py-2 rounded-md bg-[#2E415F] text-white font-semibold hover:bg-[#233449] inline-flex items-center justify-center gap-2"
          >
            <Copy size={16} aria-hidden="true" />
            Copy Password
          </button>
        </div>
      )}
    >
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
    </AdminModalShell>
  );
}
