import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { createAdminBatch } from "../../api/adminImport";
import { ApiError } from "../../api/http";
import type { BatchFilter } from "../../types/adminTrainee";

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

  useEffect(() => {
    if (!open) return;
    setBatchCode("");
    setSaving(false);
    setError(null);
  }, [open]);

  if (!open) return null;

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
      await onCreated(result.item);
    } catch (submitError) {
      setError(toApiMessage(submitError));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-white border border-black/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Create Batch</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            aria-label="Close"
            disabled={saving}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <label className="space-y-1 block">
            <span className="text-sm font-semibold text-slate-700">Batch Code *</span>
            <input
              type="text"
              value={batchCode}
              onChange={(event) => setBatchCode(event.target.value)}
              placeholder="2026-CTT03"
              className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
              disabled={saving}
              required
            />
              <p className="text-xs text-slate-500">Format: YYYY-CTT## or YYYY-IMM##</p>
          </label>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-60"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-md bg-[#2E415F] text-white font-semibold hover:bg-[#233449] disabled:opacity-60 inline-flex items-center gap-2"
              disabled={saving}
            >
              <Plus size={16} aria-hidden="true" />
              {saving ? "Creating..." : "Create Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
