import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Download, Loader2, RotateCcw, X, AlertTriangle } from "lucide-react";
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
  // --- Data & Form States ---
  const [batchCode, setBatchCode] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResponse | null>(null);

  // --- Animation States ---
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const expectedConfirmText = useMemo(() => `RESET ${batchCode}`, [batchCode]);
  const canReset = Boolean(exportedAt) && confirmText === expectedConfirmText && !resetting;

  // Handles Mount/Unmount Animation & Resetting values when opened
  useEffect(() => {
    let showTimer: number;
    let unmountTimer: number;

    if (open) {
      setShouldRender(true);
      showTimer = window.setTimeout(() => setIsVisible(true), 10);

      const fallbackBatch = initialBatchCode || batches[0]?.batch_code || "";
      setBatchCode(fallbackBatch);
      setConfirmText("");
      setExportedAt(null);
      setExporting(false);
      setResetting(false);
      setError(null);
      setResult(null);
    } else {
      setIsVisible(false);
      unmountTimer = window.setTimeout(() => setShouldRender(false), 300);
    }

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [open, initialBatchCode, batches]);

  if (!shouldRender) return null;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Animated Backdrop */}
      <div
        className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={(!exporting && !resetting) ? onClose : undefined}
      />

      {/* Animated Modal Container with Compact Max Height */}
      <div className={`relative w-full max-w-2xl rounded-3xl bg-white dark:bg-[#1E293B] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all duration-300 ease-out ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>

        {/* Header - Compact Height */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl">
                <RotateCcw size={20} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#0B1B3D] dark:text-slate-100">Finalize Batch</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Export records and permanently reset the cohort.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50"
              aria-label="Close"
              disabled={exporting || resetting}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content & Footer wrapped in Form */}
        <form onSubmit={handleReset} className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* Scrollable Middle Section - Compact Paddings */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 space-y-4">

            <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-1.5 text-sm">
              <p className="font-bold text-[#0B1B3D] dark:text-slate-200 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Finalization Steps
              </p>
              <ul className="list-decimal list-inside text-slate-600 dark:text-slate-400 space-y-1 ml-1 font-medium text-xs">
                <li>Select the batch to finalize.</li>
                <li>Export the batch CSV (Mandatory step).</li>
                <li>Type the confirmation phrase to permanently wipe active data.</li>
              </ul>
            </div>

            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">Select Batch *</span>
              <select
                value={batchCode}
                onChange={(event) => handleBatchCodeChange(event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
                disabled={exporting || resetting || Boolean(result)}
                required
              >
                <option value="" disabled>Select batch</option>
                {batches.map((batch) => (
                  <option key={batch.batch_id} value={batch.batch_code}>{batch.batch_code}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { void handleExport(); }}
                disabled={!batchCode || exporting || resetting || Boolean(result)}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 inline-flex items-center gap-2"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} aria-hidden="true" />}
                {exporting ? "Exporting..." : "Export Batch CSV"}
              </button>
              {exportedAt ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 animate-in zoom-in">
                  <CheckCircle2 size={14} /> Exported
                </span>
              ) : null}
            </div>

            <div className={`transition-all duration-500 ${exportedAt ? "opacity-100" : "opacity-40 grayscale pointer-events-none"}`}>
              <label className="space-y-1.5 block">
                <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">Confirmation Phrase *</span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={expectedConfirmText}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-300"
                  disabled={!exportedAt || resetting || Boolean(result)}
                  required
                />
                <p className="text-xs text-slate-500 font-medium mt-1.5">
                  Type exactly: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-red-500">{expectedConfirmText}</span>
                </p>
              </label>
            </div>

            {error ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
                {error}
              </div>
            ) : null}

            {result ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 space-y-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in slide-in-from-bottom-4">
                <h3 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Reset Successful
                </h3>
                <div className="grid grid-cols-2 gap-1.5 font-medium">
                  <p>Batch:</p> <p className="text-right">{result.batch_code}</p>
                  <p>Deleted Progress:</p> <p className="text-right">{result.deleted.progress_rows}</p>
                  <p>Deleted Accounts:</p> <p className="text-right">{result.deleted.trainee_accounts}</p>
                  <p>Deleted Trainees:</p> <p className="text-right">{result.deleted.trainees}</p>
                  <p>Deleted Batches:</p> <p className="text-right">{result.deleted.batches}</p>
                </div>
                <div className="pt-2 mt-2 border-t border-emerald-200/50 dark:border-emerald-500/20 opacity-80">
                  Reset at: {new Date(result.reset_at).toLocaleString()}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer Actions - Compact Padding */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full text-xs font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500 disabled:opacity-50"
              disabled={exporting || resetting}
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                type="submit"
                disabled={!canReset || Boolean(result)}
                className="px-6 py-2 rounded-full text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] shadow-lg shadow-red-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
              >
                {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} aria-hidden="true" />}
                {resetting ? "Resetting..." : "Reset Batch"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}