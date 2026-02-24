import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { createAdminTrainee, updateAdminTrainee } from "../../api/adminTrainees";
import { ApiError } from "../../api/http";
import type { AdminTraineeItem, BatchFilter } from "../../types/adminTrainee";

type FormMode = "create" | "edit";

type FormState = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  batch_code: string;
};

export type TraineeFormSaveResult = {
  mode: FormMode;
  item: AdminTraineeItem;
  generated_password?: string;
  password_delivery?: "manual";
};

type TraineeFormModalProps = {
  open: boolean;
  mode: FormMode;
  initial?: AdminTraineeItem | null;
  batches: BatchFilter[];
  onClose: () => void;
  onSaved: (result: TraineeFormSaveResult) => void;
};

const buildInitialFormState = (
  mode: FormMode,
  initial: AdminTraineeItem | null | undefined,
  batches: BatchFilter[]
): FormState => {
  if (mode === "edit" && initial) {
    return {
      first_name: initial.first_name,
      middle_name: initial.middle_name ?? "",
      last_name: initial.last_name,
      email: initial.email,
      contact_number: initial.contact_number ?? "",
      batch_code: initial.batch.batch_code,
    };
  }

  return {
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    batch_code: batches[0]?.batch_code ?? "",
  };
};

const toApiMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to save trainee.";
};

export default function TraineeFormModal({
  open,
  mode,
  initial = null,
  batches,
  onClose,
  onSaved,
}: TraineeFormModalProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialFormState(mode, initial, batches));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (mode === "create" ? "Add Trainee" : "Edit Trainee"), [mode]);

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialFormState(mode, initial, batches));
    setSaving(false);
    setError(null);
  }, [open, mode, initial, batches]);

  if (!open) return null;

  const onChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const payload = {
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      contact_number: form.contact_number.trim(),
      batch_code: form.batch_code,
    };

    if (!payload.first_name || !payload.last_name || !payload.email || !payload.batch_code) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === "create") {
        const result = await createAdminTrainee(payload);
        onSaved({
          mode: "create",
          item: result.item,
          generated_password: result.generated_password,
          password_delivery: result.password_delivery,
        });
      } else if (initial) {
        const result = await updateAdminTrainee(String(initial.trainee_id), payload);
        onSaved({ mode: "edit", item: result.item });
      }
    } catch (submitError) {
      setError(toApiMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-white border border-black/10 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">First Name *</span>
              <input
                type="text"
                value={form.first_name}
                onChange={(event) => onChange("first_name", event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">Middle Name</span>
              <input
                type="text"
                value={form.middle_name}
                onChange={(event) => onChange("middle_name", event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">Last Name *</span>
              <input
                type="text"
                value={form.last_name}
                onChange={(event) => onChange("last_name", event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">Email *</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange("email", event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">Contact Number</span>
              <input
                type="text"
                value={form.contact_number}
                onChange={(event) => onChange("contact_number", event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">Batch *</span>
              <select
                value={form.batch_code}
                onChange={(event) => onChange("batch_code", event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 outline-none focus:ring-2 focus:ring-slate-300"
                disabled={saving}
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
          </div>

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
              className="px-5 py-2 rounded-md bg-[#2E415F] text-white font-semibold hover:bg-[#233449] disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving..." : mode === "create" ? "Create Trainee" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
