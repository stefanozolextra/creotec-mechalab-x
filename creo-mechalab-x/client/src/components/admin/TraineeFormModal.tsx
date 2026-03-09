import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { UserPlus, Pencil, Loader2 } from "lucide-react";
import { createAdminTrainee, updateAdminTrainee } from "../../api/adminTrainees";
import { ApiError } from "../../api/http";
import type { AdminTraineeItem, BatchFilter } from "../../types/adminTrainee";
import AdminModalShell from "./ui/AdminModalShell";

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
  email_sent?: boolean;
  generated_password?: string;
  password_delivery?: "email" | "failed" | "manual";
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
  const isEditing = mode === "edit";

  useEffect(() => {
    if (!open) return;
    setForm(buildInitialFormState(mode, initial, batches));
    setSaving(false);
    setError(null);
  }, [open, mode, initial, batches]);

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
          email_sent: result.email_sent,
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
    <AdminModalShell
      open={open}
      onClose={onClose}
      title={title}
      description={isEditing ? "Update trainee details below." : "Register a new trainee manually."}
      icon={isEditing ? <Pencil size={20} /> : <UserPlus size={20} />}
      maxWidthClass="max-w-2xl"
      closeDisabled={saving}
      closeOnBackdrop={!saving}
      bodyClassName="p-6"
      footer={(
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
            form="trainee-form-modal"
            className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : isEditing ? <Pencil size={14} /> : <UserPlus size={14} />}
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Trainee"}
          </button>
        </div>
      )}
    >
      <form id="trainee-form-modal" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="space-y-1.5 block">
            <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">First Name *</span>
            <input
              type="text"
              value={form.first_name}
              onChange={(event) => onChange("first_name", event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
              disabled={saving}
              required
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">Last Name *</span>
            <input
              type="text"
              value={form.last_name}
              onChange={(event) => onChange("last_name", event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
              disabled={saving}
              required
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">Middle Name</span>
            <input
              type="text"
              value={form.middle_name}
              onChange={(event) => onChange("middle_name", event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
              disabled={saving}
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">Contact Number</span>
            <input
              type="text"
              value={form.contact_number}
              onChange={(event) => onChange("contact_number", event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
              disabled={saving}
            />
          </label>

          <label className="space-y-1.5 block md:col-span-2">
            <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">Email Address *</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange("email", event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
              disabled={saving}
              required
            />
          </label>

          <label className="space-y-1.5 block md:col-span-2">
            <span className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200">Batch Assignment *</span>
            <select
              value={form.batch_code}
              onChange={(event) => onChange("batch_code", event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
              disabled={saving}
              required
            >
              <option value="" disabled>Select batch</option>
              {batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_code}>
                  {batch.batch_code}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
      </form>
    </AdminModalShell>
  );
}
