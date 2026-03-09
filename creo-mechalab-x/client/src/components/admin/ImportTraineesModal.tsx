import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Upload } from "lucide-react";
import { getAdminBatches, importTraineesCsv } from "../../api/adminImport";
import { ApiError } from "../../api/http";
import type { BatchFilter } from "../../types/adminTrainee";
import AdminModalShell from "./ui/AdminModalShell";

type ImportResult = Awaited<ReturnType<typeof importTraineesCsv>>;

type ImportTraineesModalProps = {
  open: boolean;
  batches: BatchFilter[];
  initialBatchCode?: string;
  onClose: () => void;
  onImported: (batchCode: string, refreshedBatches: BatchFilter[]) => void;
};

const toApiMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "CSV import failed.";
};

export default function ImportTraineesModal({
  open,
  batches,
  initialBatchCode = "",
  onClose,
  onImported,
}: ImportTraineesModalProps) {
  const [batchCode, setBatchCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replaceOldBatches, setReplaceOldBatches] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const expectedConfirm = useMemo(() => `PURGE ${batchCode.trim()}`, [batchCode]);

  useEffect(() => {
    if (!open) return;
    const fallbackBatch = initialBatchCode || batches[0]?.batch_code || "";
    setBatchCode(fallbackBatch);
    setFile(null);
    setReplaceOldBatches(false);
    setConfirmText("");
    setSubmitting(false);
    setError(null);
    setResult(null);
  }, [open, initialBatchCode, batches]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedBatchCode = batchCode.trim();
    if (!trimmedBatchCode) {
      setError("Batch code is required.");
      return;
    }

    if (!file) {
      setError("CSV file is required.");
      return;
    }

    if (replaceOldBatches && confirmText.trim() !== `PURGE ${trimmedBatchCode}`) {
      setError(`Type "PURGE ${trimmedBatchCode}" to confirm replace mode.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await importTraineesCsv({
        batch_code: trimmedBatchCode,
        file,
        mode: replaceOldBatches ? "replace_old_batches" : "append",
        confirm: replaceOldBatches ? confirmText.trim() : undefined,
      });

      setResult(response);
      const batchesResponse = await getAdminBatches();
      onImported(response.batch.batch_code, batchesResponse.items);
    } catch (submitError) {
      setError(toApiMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminModalShell
      open={open}
      onClose={onClose}
      title="Import Trainees CSV"
      maxWidthClass="max-w-2xl"
      closeDisabled={submitting}
      closeOnBackdrop={!submitting}
      bodyClassName="p-5"
      footer={(
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-60"
            disabled={submitting}
          >
            Close
          </button>
          <button
            type="submit"
            form="import-trainees-form"
            className="px-5 py-2 rounded-md bg-[#2E415F] text-white font-semibold hover:bg-[#233449] disabled:opacity-60 inline-flex items-center justify-center gap-2"
            disabled={submitting}
          >
            <Upload size={16} aria-hidden="true" />
            {submitting ? "Uploading..." : "Import CSV"}
          </button>
        </div>
      )}
    >
      <form id="import-trainees-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="space-y-1 block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Batch Code *</span>
          <input
            list="admin-batch-codes"
            type="text"
            value={batchCode}
            onChange={(event) => setBatchCode(event.target.value)}
            placeholder="e.g. 2026-IMM03"
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200 outline-none focus:ring-2 focus:ring-slate-300"
            disabled={submitting}
            required
          />
          <datalist id="admin-batch-codes">
            {batches.map((batch) => (
              <option key={batch.batch_id} value={batch.batch_code} />
            ))}
          </datalist>
        </label>

        <label className="space-y-1 block">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">CSV File *</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200 outline-none focus:ring-2 focus:ring-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-200 file:font-semibold file:text-slate-700"
            disabled={submitting}
            required
          />
        </label>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replaceOldBatches}
            onChange={(event) => setReplaceOldBatches(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
            disabled={submitting}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Keep only this batch (delete all trainees from other batches).
          </span>
        </label>
        <p className="text-xs font-semibold text-amber-700">Export before purge to avoid data loss.</p>

        {replaceOldBatches ? (
          <label className="space-y-1 block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Confirmation *</span>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={expectedConfirm}
              className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200 outline-none focus:ring-2 focus:ring-slate-300"
              disabled={submitting}
              required
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Type exactly: {expectedConfirm}</p>
          </label>
        ) : null}

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        {result ? (
          <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20 p-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Import Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div>Processed: {result.summary.processed}</div>
              <div>Created: {result.summary.created}</div>
              <div>Updated: {result.summary.updated}</div>
              <div>Skipped: {result.summary.skipped}</div>
              <div>Errors: {result.summary.errors}</div>
            </div>

            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Imported Batch: <span className="text-slate-900 dark:text-slate-100">{result.batch.batch_code}</span>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Row Errors</h4>
              <div className="max-h-48 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A]">
                {result.row_errors.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">No row errors.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {result.row_errors.map((rowError) => (
                      <li key={`${rowError.row}-${rowError.email}-${rowError.error}`} className="px-3 py-2 text-xs dark:text-slate-300">
                        Row {rowError.row} ({rowError.email || "n/a"}): {rowError.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </AdminModalShell>
  );
}
