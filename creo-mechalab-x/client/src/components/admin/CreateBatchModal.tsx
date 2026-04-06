import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Layers } from "lucide-react";
import { createAdminBatch } from "../../api/adminImport";
import { ApiError } from "../../api/http";
import type { BatchFilter } from "../../types/adminTrainee";
import AdminModalShell from "./ui/AdminModalShell";
import { useToast } from "../../contexts/ToastContext";

type CreateBatchModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (item: BatchFilter) => Promise<void> | void;
};

const BATCH_CODE_REGEX = /^\d{4}-(CTT|IMM)\d{2}$/;

const toApiMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to create batch.";
};

export default function CreateBatchModal({ open, onClose, onCreated }: CreateBatchModalProps) {
  const [batchCode, setBatchCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const resetModalState = () => {
    setBatchCode("");
    setSaving(false);
    setError(null);
  };

  const handleCloseModal = () => {
    if (saving) return;
    resetModalState();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const normalized = batchCode.trim().toUpperCase();
    if (!normalized) {
      setError("Batch code is required.");
      return;
    }
    if (!BATCH_CODE_REGEX.test(normalized)) {
      setError("Batch code must match YYYY-CTT## or YYYY-IMM## (example: 2026-CTT03 or 2026-IMM03).");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await createAdminBatch(normalized);
      toast.success(`Batch ${result.item.batch_code} created successfully`);
      await onCreated(result.item);
      resetModalState();
    } catch (submitError) {
      setError(toApiMessage(submitError));
      setSaving(false);
    }
  };

  return (
    <AdminModalShell
      open={open}
      onClose={handleCloseModal}
      title="Create Batch"
      description="Initialize a new training cohort."
      icon={<Layers size={20} />}
      maxWidthClass="max-w-md"
      closeDisabled={saving}
      closeOnBackdrop={!saving}
      bodyClassName="p-6"
      footer={(
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500 disabled:opacity-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-batch-form"
            className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={saving}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} aria-hidden="true" />}
            {saving ? "Creating..." : "Create Batch"}
          </button>
        </div>
      )}
    >
      <form id="create-batch-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="space-y-1.5 block">
          <span className="text-sm font-bold text-[#0B1B3D] dark:text-slate-200">Batch Code *</span>
          <input
            type="text"
            value={batchCode}
            onChange={(event) => setBatchCode(event.target.value)}
            placeholder="2026-IMM01"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300 uppercase placeholder:normal-case placeholder:text-slate-400"
            disabled={saving}
            required
            autoFocus
          />
          <p className="text-xs text-slate-500 font-medium mt-1.5">
            Format: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">YYYY-CTT##</span> or{" "}
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">YYYY-IMM##</span>
          </p>
        </label>

        {error ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
      </form>
    </AdminModalShell>
  );
}
