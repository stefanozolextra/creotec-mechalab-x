import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Download, Loader2, RotateCcw, X } from "lucide-react";
import { API_BASE_URL, ApiError, requestJson } from "../../api/http";
import type { BatchFilter } from "../../types/adminTrainee";
import { getAuthToken } from "../../utils/auth";

type ResetResponse = {
  ok: boolean;
  batch_code: string;
  deleted: {
    progress_rows: number;
    trainee_accounts: number;
    trainees: number;
    batches: number;
  };
  preserved_admins: number;
  export_gate: {
    required: boolean;
    last_export_at: string | null;
    forced: boolean;
  };
  reset_at: string;
};

type FinalizeBatchWizardModalProps = {
  open: boolean;
  batches: BatchFilter[];
  initialBatchCode?: string;
  onClose: () => void;
  onResetCompleted: () => void;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 412) {
      return error.message ? `Export required within 24h. ${error.message}` : "Export required within 24h.";
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Failed to finalize batch.";
};

const parseFilenameFromHeader = (contentDisposition: string | null, fallback: string): string => {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (!match || !match[1]) return fallback;
  return match[1];
};

export default function FinalizeBatchWizardModal({
  open,
  batches,
  initialBatchCode = "",
  onClose,
  onResetCompleted,
}: FinalizeBatchWizardModalProps) {
  const [batchCode, setBatchCode] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResponse | null>(null);

  const expectedConfirmText = useMemo(() => `RESET ${batchCode}`, [batchCode]);
  const canReset = Boolean(exportedAt) && confirmText === expectedConfirmText && !resetting;

  useEffect(() => {
    if (!open) return;
    const fallbackBatch = initialBatchCode || batches[0]?.batch_code || "";
    setBatchCode(fallbackBatch);
    setConfirmText("");
    setExportedAt(null);
    setExporting(false);
    setResetting(false);
    setError(null);
    setResult(null);
  }, [open, initialBatchCode, batches]);

  if (!open) return null;

  const handleBatchCodeChange = (value: string) => {
    setBatchCode(value);
    setConfirmText("");
    setExportedAt(null);
    setError(null);
    setResult(null);
  };

  const handleExport = async () => {
    if (exporting || resetting) return;
    if (!batchCode) {
      setError("Batch code is required.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("Unauthorized");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const query = new URLSearchParams({ batch_code: batchCode }).toString();
      const response = await fetch(`${API_BASE_URL}/api/admin/trainees/export-csv?${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const data = (await response.json()) as { error?: string };
          if (typeof data?.error === "string" && data.error.trim()) message = data.error;
        } catch {
          // no-op
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const fallbackName = `trainees-${batchCode}.csv`;
      const fileName = parseFilenameFromHeader(response.headers.get("content-disposition"), fallbackName);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      setExportedAt(new Date().toISOString());
    } catch (exportError) {
      setError(toErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canReset || !batchCode) return;

    setResetting(true);
    setError(null);

    try {
      const resetResult = await requestJson<ResetResponse>("/api/admin/system/reset", {
        method: "POST",
        body: {
          batch_code: batchCode,
          confirm_text: confirmText,
          wipe_batch_record: true,
          force: false,
        },
      });

      setResult(resetResult);
      onResetCompleted();
    } catch (resetError) {
      setError(toErrorMessage(resetError));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-white border border-black/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Finalize Batch</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            aria-label="Close"
            disabled={exporting || resetting}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleReset} className="p-5 space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
            <p className="font-semibold text-slate-800">Step 1: Select batch</p>
            <p className="font-semibold text-slate-800">Step 2: Export CSV</p>
            <p className="font-semibold text-slate-800">Step 3: Type confirmation phrase and reset</p>
          </div>

          <label className="space-y-1 block">
            <span className="text-sm font-semibold text-slate-700">Batch Code *</span>
            <select
              value={batchCode}
              onChange={(event) => handleBatchCodeChange(event.target.value)}
              className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
              disabled={exporting || resetting || Boolean(result)}
              required
            >
              <option value="" disabled>
                Select batch
              </option>
              {batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_code}>
                  {batch.batch_code}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleExport();
              }}
              disabled={!batchCode || exporting || resetting || Boolean(result)}
              className="px-5 py-2 rounded-md bg-[#2E415F] text-white font-semibold hover:bg-[#233449] disabled:opacity-60 inline-flex items-center gap-2"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} aria-hidden="true" />}
              {exporting ? "Exporting..." : "Export Batch CSV"}
            </button>
            {exportedAt ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={14} />
                Exported
              </span>
            ) : null}
          </div>

          <label className="space-y-1 block">
            <span className="text-sm font-semibold text-slate-700">Confirmation Phrase *</span>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={expectedConfirmText}
              className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
              disabled={!exportedAt || resetting || Boolean(result)}
              required
            />
            <p className="text-xs text-slate-500">Type exactly: {expectedConfirmText}</p>
          </label>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          {result ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm text-slate-800">
              <h3 className="font-bold">Reset Summary</h3>
              <p>Batch: {result.batch_code}</p>
              <p>Deleted Progress Rows: {result.deleted.progress_rows}</p>
              <p>Deleted Trainee Accounts: {result.deleted.trainee_accounts}</p>
              <p>Deleted Trainees: {result.deleted.trainees}</p>
              <p>Deleted Batch Records: {result.deleted.batches}</p>
              <p>Preserved Admins: {result.preserved_admins}</p>
              <p>Export Gate Last Export: {result.export_gate.last_export_at ?? "n/a"}</p>
              <p>Reset At: {result.reset_at}</p>
            </div>
          ) : null}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-60"
              disabled={exporting || resetting}
            >
              {result ? "Close" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-md bg-[#8B1E2D] text-white font-semibold hover:bg-[#721826] disabled:opacity-60 inline-flex items-center gap-2"
              disabled={!canReset || Boolean(result)}
            >
              {resetting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} aria-hidden="true" />}
              {resetting ? "Resetting..." : "Reset Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
