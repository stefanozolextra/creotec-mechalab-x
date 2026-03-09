import { AlertTriangle, CheckCircle2, Loader2, Pencil, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAdminLessons, removeAdminLessonPdf, updateAdminLessonTitle, uploadAdminLessonPdf } from "../../api/adminLessons";
import { ApiError } from "../../api/http";
import AdminTableScroll from "../../components/admin/ui/AdminTableScroll";
import type { AdminLessonItem } from "../../types/adminLesson";

type NoticeState =
  | { kind: "success"; text: string }
  | { kind: "warning"; text: string }
  | { kind: "error"; text: string }
  | null;

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const formatFileSize = (value: number | null): string => {
  if (value == null || !Number.isFinite(value) || value <= 0) return "n/a";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const MODULE_TITLE_MAX_LENGTH = 150;

export default function LessonsPage() {
  const [items, setItems] = useState<AdminLessonItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [busyModuleId, setBusyModuleId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<"upload" | "delete" | "title" | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [refreshSeq, setRefreshSeq] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getAdminLessons();
        if (!active) return;
        setItems(response.items ?? []);
      } catch (loadError) {
        if (!active) return;
        setItems([]);
        setError(toErrorMessage(loadError, "Failed to load lessons."));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [refreshSeq]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) => {
      const pdfName = item.pdf.file_name?.toLowerCase() ?? "";
      return (
        item.module_code.toLowerCase().includes(needle) ||
        item.module_title.toLowerCase().includes(needle) ||
        pdfName.includes(needle)
      );
    });
  }, [items, query]);

  const applyItemPatch = (patched: AdminLessonItem | null, fallbackModuleId: number): void => {
    if (!patched) {
      setRefreshSeq((value) => value + 1);
      return;
    }
    setItems((previous) =>
      previous.map((entry) => (entry.module_id === fallbackModuleId ? patched : entry)),
    );
  };

  const handleUpload = async (moduleId: number, file: File | null) => {
    if (!file) return;
    if (busyModuleId !== null) return;

    setBusyModuleId(moduleId);
    setBusyAction("upload");
    setNotice(null);
    setError(null);

    try {
      const response = await uploadAdminLessonPdf(moduleId, file);
      applyItemPatch(response.item, moduleId);
      setNotice({ kind: "success", text: `PDF uploaded for module #${moduleId}.` });
    } catch (uploadError) {
      setNotice({ kind: "error", text: toErrorMessage(uploadError, "Failed to upload PDF.") });
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
    }
  };

  const handleRemove = async (moduleId: number) => {
    if (busyModuleId !== null) return;

    setBusyModuleId(moduleId);
    setBusyAction("delete");
    setNotice(null);
    setError(null);

    try {
      const response = await removeAdminLessonPdf(moduleId);
      applyItemPatch(response.item, moduleId);
      setNotice({ kind: "warning", text: `PDF removed for module #${moduleId}.` });
    } catch (removeError) {
      setNotice({ kind: "error", text: toErrorMessage(removeError, "Failed to remove PDF.") });
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
    }
  };

  const startTitleEdit = (item: AdminLessonItem) => {
    if (busyModuleId !== null) return;
    setNotice(null);
    setError(null);
    setTitleError(null);
    setEditingModuleId(item.module_id);
    setTitleDraft(item.module_title);
  };

  const cancelTitleEdit = () => {
    if (busyAction === "title") return;
    setEditingModuleId(null);
    setTitleDraft("");
    setTitleError(null);
  };

  const handleSaveTitle = async (moduleId: number) => {
    if (busyModuleId !== null) return;

    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle) {
      setTitleError("Title cannot be empty.");
      return;
    }
    if (trimmedTitle.length > MODULE_TITLE_MAX_LENGTH) {
      setTitleError(`Title must be at most ${MODULE_TITLE_MAX_LENGTH} characters.`);
      return;
    }

    setBusyModuleId(moduleId);
    setBusyAction("title");
    setTitleError(null);
    setNotice(null);
    setError(null);

    try {
      const response = await updateAdminLessonTitle(moduleId, trimmedTitle);
      applyItemPatch(response.item, moduleId);
      setEditingModuleId(null);
      setTitleDraft("");
      setNotice({ kind: "success", text: `Title updated for module #${moduleId}.` });
    } catch (updateError) {
      setTitleError(toErrorMessage(updateError, "Failed to update title."));
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
    }
  };

  const isBusy = (moduleId: number): boolean => busyModuleId === moduleId;
  const isEditing = (moduleId: number): boolean => editingModuleId === moduleId;

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 relative">
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          className={`rounded-2xl px-6 py-4 text-sm font-semibold shadow-sm shrink-0 border ${
            notice.kind === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : notice.kind === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {rows.length} module{rows.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => setRefreshSeq((value) => value + 1)}
            className="bg-[#1E293B] dark:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 shadow-sm hover:brightness-110 disabled:opacity-70"
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="relative z-10 w-full sm:w-[320px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-500" size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search module or PDF..."
            className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-full outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 relative z-0">
        <AdminTableScroll className="flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="min-w-[920px] w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[13px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="px-6 py-6 text-left">Module</th>
                <th className="px-6 py-6 text-left">Title</th>
                <th className="px-6 py-6 text-left">Current PDF</th>
                <th className="px-6 py-6 text-left">Status</th>
                <th className="px-6 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 font-semibold">
                      <Loader2 size={18} className="animate-spin" /> Loading lesson modules...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 font-semibold">
                      <AlertTriangle size={18} /> No modules found.
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((item) => {
                  const rowBusy = isBusy(item.module_id);
                  const rowEditing = isEditing(item.module_id);
                  const hasPdf = item.pdf.has_pdf;
                  const hasUploadedFile = item.pdf.has_uploaded_file;
                  const trimmedDraftTitle = titleDraft.trim();
                  const disableSaveTitle =
                    rowBusy || trimmedDraftTitle.length === 0 || trimmedDraftTitle.length > MODULE_TITLE_MAX_LENGTH;

                  return (
                    <tr
                      key={item.module_id}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-300"
                    >
                      <td className="px-6 py-5 text-left">
                        <p className="font-bold text-[#0B1B3D] dark:text-slate-200">{item.module_code}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">#{item.module_id}</p>
                      </td>
                      <td className="px-6 py-5 text-left">
                        {rowEditing ? (
                          <div className="max-w-[320px]">
                            <input
                              type="text"
                              value={titleDraft}
                              maxLength={MODULE_TITLE_MAX_LENGTH}
                              onChange={(event) => {
                                setTitleDraft(event.target.value);
                                if (titleError) setTitleError(null);
                              }}
                              disabled={rowBusy}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                            {titleError ? (
                              <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">{titleError}</p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {trimmedDraftTitle.length}/{MODULE_TITLE_MAX_LENGTH}
                            </p>
                          </div>
                        ) : (
                          <p className="font-semibold text-slate-700 dark:text-slate-300">{item.module_title}</p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                          {item.description || "No description"}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-left">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.pdf.file_name || "No PDF assigned"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {hasUploadedFile
                            ? `${formatFileSize(item.pdf.file_size)} • Uploaded`
                            : hasPdf
                              ? "Linked PDF resource"
                              : "Missing"}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-left">
                        {hasPdf ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wide bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={14} /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wide bg-amber-100 text-amber-700">
                            <AlertTriangle size={14} /> No PDF
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {rowEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSaveTitle(item.module_id);
                                }}
                                disabled={disableSaveTitle}
                                className="px-4 py-2 rounded-xl text-xs font-black tracking-wide text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                              >
                                {rowBusy && busyAction === "title" ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelTitleEdit}
                                disabled={rowBusy && busyAction === "title"}
                                className="px-4 py-2 rounded-xl text-xs font-black tracking-wide text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                              >
                                <X size={14} />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                startTitleEdit(item);
                              }}
                              disabled={busyModuleId !== null}
                              className="px-4 py-2 rounded-xl text-xs font-black tracking-wide text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                            >
                              <Pencil size={14} />
                              Edit Title
                            </button>
                          )}
                          <input
                            type="file"
                            id={`module-pdf-input-${item.module_id}`}
                            accept=".pdf,application/pdf"
                            className="hidden"
                            disabled={rowBusy}
                            onChange={(event) => {
                              const selected = event.target.files?.[0] ?? null;
                              void handleUpload(item.module_id, selected);
                              event.currentTarget.value = "";
                            }}
                          />
                          <label
                            htmlFor={`module-pdf-input-${item.module_id}`}
                            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide text-white inline-flex items-center gap-2 cursor-pointer ${
                              rowBusy
                                ? "bg-slate-400 cursor-not-allowed"
                                : "bg-[#3B82F6] hover:bg-[#2563EB]"
                            } transition-colors`}
                          >
                            {rowBusy && busyAction === "upload" ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Upload size={14} />
                            )}
                            {hasPdf ? "Replace PDF" : "Upload PDF"}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              void handleRemove(item.module_id);
                            }}
                            disabled={!hasPdf || rowBusy}
                            className="px-4 py-2 rounded-xl text-xs font-black tracking-wide text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                          >
                            {rowBusy && busyAction === "delete" ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </AdminTableScroll>
      </div>
    </div>
  );
}
