import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, X, Layers, Loader2 } from "lucide-react";
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
  // --- Data & Form States ---
  const [batchCode, setBatchCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Animation States ---
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handles Mount/Unmount Animation & Resetting values cleanly
  useEffect(() => {
    let showTimer: number;
    let unmountTimer: number;

    if (open) {
      setShouldRender(true);
      // Tiny delay allows React to mount the DOM node before triggering CSS transition
      showTimer = window.setTimeout(() => setIsVisible(true), 10);

      // Reset states when opening
      setBatchCode("");
      setSaving(false);
      setError(null);
    } else {
      setIsVisible(false);
      // Wait for the fade-out animation to finish before unmounting
      unmountTimer = window.setTimeout(() => setShouldRender(false), 300);
    }

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [open]);

  if (!shouldRender) return null;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Animated Backdrop */}
      <div
        className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={!saving ? onClose : undefined}
      />

      {/* Animated Modal Container */}
      <div className={`relative w-full max-w-md rounded-3xl bg-white dark:bg-[#1E293B] shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300 ease-out ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-[#3B82F6]/20 text-[#3B82F6] rounded-xl">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#0B1B3D] dark:text-slate-100">Create Batch</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Initialize a new training cohort.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50"
              aria-label="Close"
              disabled={saving}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-4">
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
                Format: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">YYYY-CTT##</span> or <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">YYYY-IMM##</span>
              </p>
            </label>

            {error ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
                {error}
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500 disabled:opacity-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} aria-hidden="true" />}
              {saving ? "Creating..." : "Create Batch"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}