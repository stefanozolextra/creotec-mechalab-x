import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  FileText,
  Layers3,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Document, Page, pdfjs } from "react-pdf";
import {
  createAdminLesson,
  createAdminModuleLesson,
  deleteAdminModuleLesson,
  getAdminLessons,
  removeAdminModuleLessonPdf,
  updateAdminLessonTitle,
  updateAdminModuleLesson,
  uploadAdminModuleLessonPdf,
} from "../../api/adminLessons";
import { API_BASE_URL, ApiError } from "../../api/http";
import AdminModalShell from "../../components/admin/ui/AdminModalShell";
import type { AdminLessonItem, AdminLessonResource } from "../../types/adminLesson";
import { getAuthToken } from "../../utils/auth";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type NoticeState =
  | { kind: "success"; text: string }
  | { kind: "warning"; text: string }
  | { kind: "error"; text: string }
  | null;

const MODULE_TITLE_MAX_LENGTH = 150;
const LESSON_TITLE_MAX_LENGTH = 150;

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const toAbsoluteUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const formatFileSize = (value: number | null): string => {
  if (value == null || !Number.isFinite(value) || value <= 0) return "n/a";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const sortAdminLessonItems = (items: AdminLessonItem[]): AdminLessonItem[] => {
  return [...items].sort((a, b) => {
    if (a.order_no !== b.order_no) return a.order_no - b.order_no;
    return a.module_id - b.module_id;
  });
};

const sortLessons = (lessons: AdminLessonResource[]): AdminLessonResource[] => {
  return [...lessons].sort((a, b) => {
    if (a.order_no !== b.order_no) return a.order_no - b.order_no;
    return a.resource_id - b.resource_id;
  });
};

const normalizeModuleItem = (item: AdminLessonItem): AdminLessonItem => ({
  ...item,
  lessons: sortLessons(item.lessons ?? []),
});

export default function LessonsPage() {
  const [items, setItems] = useState<AdminLessonItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [busyModuleId, setBusyModuleId] = useState<number | null>(null);
  const [busyLessonId, setBusyLessonId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<
    "module-title" | "create-lesson" | "lesson-title" | "lesson-order" | "upload" | "remove-pdf" | "delete-lesson" | null
  >(null);

  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addTitleDraft, setAddTitleDraft] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  const [addLessonDraft, setAddLessonDraft] = useState("");
  const [addLessonError, setAddLessonError] = useState<string | null>(null);

  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [lessonTitleDraft, setLessonTitleDraft] = useState("");
  const [lessonTitleError, setLessonTitleError] = useState<string | null>(null);

  const [refreshSeq, setRefreshSeq] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(300);

  const authToken = getAuthToken();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getAdminLessons();
        if (!active) return;
        const normalized = sortAdminLessonItems((response.items ?? []).map(normalizeModuleItem));
        setItems(normalized);
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(".lesson-row") ||
        target.closest(".details-pane") ||
        target.closest(".top-bar-actions") ||
        target.closest(".keep-selection")
      ) {
        return;
      }
      setSelectedModuleId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setPreviewWidth(Math.max(width - 120, 220));
        return;
      }
      setPreviewWidth(300);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) => {
      const moduleMatch =
        item.module_code.toLowerCase().includes(needle) ||
        item.module_title.toLowerCase().includes(needle);
      if (moduleMatch) return true;

      return item.lessons.some((lesson) => {
        const titleMatch = lesson.title.toLowerCase().includes(needle);
        const fileName = lesson.file_name?.toLowerCase() ?? "";
        return titleMatch || fileName.includes(needle);
      });
    });
  }, [items, query]);

  const selectedModule = useMemo(() => {
    if (selectedModuleId === null) return null;
    return items.find((item) => item.module_id === selectedModuleId) ?? null;
  }, [items, selectedModuleId]);

  const selectedModuleLessons = useMemo(() => {
    return selectedModule ? sortLessons(selectedModule.lessons ?? []) : [];
  }, [selectedModule]);

  useEffect(() => {
    if (!selectedModule) {
      setSelectedLessonId(null);
      return;
    }

    if (selectedModuleLessons.length === 0) {
      setSelectedLessonId(null);
      return;
    }

    const hasSelection =
      selectedLessonId !== null &&
      selectedModuleLessons.some((lesson) => lesson.resource_id === selectedLessonId);
    if (!hasSelection) {
      setSelectedLessonId(selectedModuleLessons[0].resource_id);
    }
  }, [selectedLessonId, selectedModule, selectedModuleLessons]);

  const selectedLesson = useMemo(() => {
    if (!selectedModule || selectedLessonId === null) return null;
    return selectedModule.lessons.find((lesson) => lesson.resource_id === selectedLessonId) ?? null;
  }, [selectedLessonId, selectedModule]);

  const selectedLessonUrl =
    selectedLesson && (selectedLesson.resolved_url?.trim() || selectedLesson.url?.trim())
      ? (selectedLesson.resolved_url?.trim() || selectedLesson.url?.trim())
      : "";

  const previewFile = useMemo(() => {
    if (!selectedLessonUrl) return null;
    const absoluteUrl = toAbsoluteUrl(selectedLessonUrl);
    if (!absoluteUrl) return null;

    const shouldAttachAuthHeader =
      selectedLessonUrl.startsWith("/") || absoluteUrl.startsWith(API_BASE_URL);

    return {
      url: absoluteUrl,
      ...(shouldAttachAuthHeader && authToken
        ? {
            httpHeaders: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        : {}),
    };
  }, [authToken, selectedLessonUrl]);

  useEffect(() => {
    setPreviewError(null);
  }, [selectedLesson?.resource_id, selectedLessonUrl]);

  const applyItemPatch = (patched: AdminLessonItem | null, fallbackModuleId: number): void => {
    if (!patched) {
      setRefreshSeq((value) => value + 1);
      return;
    }

    const normalized = normalizeModuleItem(patched);
    setItems((previous) => {
      let found = false;
      const next = previous.map((entry) => {
        if (entry.module_id !== fallbackModuleId) return entry;
        found = true;
        return normalized;
      });
      if (!found) next.push(normalized);
      return sortAdminLessonItems(next);
    });
  };

  const isModuleBusy = (moduleId: number): boolean => busyModuleId === moduleId && busyLessonId === null;
  const isLessonBusy = (resourceId: number): boolean => busyLessonId === resourceId;

  const openAddModal = () => {
    if (addSaving) return;
    setAddError(null);
    setAddTitleDraft("");
    setAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (addSaving) return;
    setAddModalOpen(false);
    setAddTitleDraft("");
    setAddError(null);
  };

  const handleCreateModule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addSaving) return;

    const trimmedTitle = addTitleDraft.trim();
    if (!trimmedTitle) {
      setAddError("Title cannot be empty.");
      return;
    }
    if (trimmedTitle.length > MODULE_TITLE_MAX_LENGTH) {
      setAddError(`Title must be at most ${MODULE_TITLE_MAX_LENGTH} characters.`);
      return;
    }

    setAddSaving(true);
    setAddError(null);
    setNotice(null);
    setError(null);

    try {
      const response = await createAdminLesson(trimmedTitle);
      const createdItem = response.item;
      if (createdItem) {
        const normalized = normalizeModuleItem(createdItem);
        setItems((previous) => sortAdminLessonItems([...previous, normalized]));
        setSelectedModuleId(normalized.module_id);
      } else {
        setRefreshSeq((value) => value + 1);
      }
      setAddModalOpen(false);
      setAddTitleDraft("");
      setAddError(null);
      setNotice({ kind: "success", text: "Module created successfully." });
    } catch (createError) {
      setAddError(toErrorMessage(createError, "Failed to create module."));
    } finally {
      setAddSaving(false);
    }
  };

  const startModuleTitleEdit = (item: AdminLessonItem) => {
    if (busyModuleId !== null || busyLessonId !== null) return;
    setNotice(null);
    setError(null);
    setTitleError(null);
    setEditingModuleId(item.module_id);
    setTitleDraft(item.module_title);
  };

  const cancelModuleTitleEdit = () => {
    if (busyAction === "module-title") return;
    setEditingModuleId(null);
    setTitleDraft("");
    setTitleError(null);
  };

  const handleSaveModuleTitle = async (moduleId: number) => {
    if (busyModuleId !== null || busyLessonId !== null) return;

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
    setBusyLessonId(null);
    setBusyAction("module-title");
    setTitleError(null);
    setNotice(null);
    setError(null);

    try {
      const response = await updateAdminLessonTitle(moduleId, trimmedTitle);
      applyItemPatch(response.item, moduleId);
      setEditingModuleId(null);
      setTitleDraft("");
      setNotice({ kind: "success", text: "Module title updated successfully." });
    } catch (updateError) {
      setTitleError(toErrorMessage(updateError, "Failed to update module title."));
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
    }
  };

  const handleCreateLesson = async (moduleId: number) => {
    if (busyModuleId !== null || busyLessonId !== null) return;

    const trimmedTitle = addLessonDraft.trim();
    if (!trimmedTitle) {
      setAddLessonError("Lesson title cannot be empty.");
      return;
    }
    if (trimmedTitle.length > LESSON_TITLE_MAX_LENGTH) {
      setAddLessonError(`Lesson title must be at most ${LESSON_TITLE_MAX_LENGTH} characters.`);
      return;
    }

    setBusyModuleId(moduleId);
    setBusyLessonId(null);
    setBusyAction("create-lesson");
    setAddLessonError(null);
    setNotice(null);
    setError(null);

    try {
      const response = await createAdminModuleLesson(moduleId, trimmedTitle);
      applyItemPatch(response.item, moduleId);
      setAddLessonDraft("");
      if (response.lesson) setSelectedLessonId(response.lesson.resource_id);
      setNotice({ kind: "success", text: "Lesson created." });
    } catch (createError) {
      setAddLessonError(toErrorMessage(createError, "Failed to create lesson."));
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
    }
  };

  const startLessonTitleEdit = (lesson: AdminLessonResource) => {
    if (!selectedModule || busyModuleId !== null || busyLessonId !== null) return;
    setEditingLessonId(lesson.resource_id);
    setLessonTitleDraft(lesson.title);
    setLessonTitleError(null);
    setNotice(null);
    setError(null);
  };

  const cancelLessonTitleEdit = () => {
    if (busyAction === "lesson-title") return;
    setEditingLessonId(null);
    setLessonTitleDraft("");
    setLessonTitleError(null);
  };

  const handleSaveLessonTitle = async (moduleId: number, resourceId: number) => {
    if (busyModuleId !== null || busyLessonId !== null) return;

    const trimmedTitle = lessonTitleDraft.trim();
    if (!trimmedTitle) {
      setLessonTitleError("Lesson title cannot be empty.");
      return;
    }
    if (trimmedTitle.length > LESSON_TITLE_MAX_LENGTH) {
      setLessonTitleError(`Lesson title must be at most ${LESSON_TITLE_MAX_LENGTH} characters.`);
      return;
    }

    setBusyModuleId(moduleId);
    setBusyLessonId(resourceId);
    setBusyAction("lesson-title");
    setLessonTitleError(null);
    setNotice(null);
    setError(null);

    try {
      const response = await updateAdminModuleLesson(moduleId, resourceId, { title: trimmedTitle });
      applyItemPatch(response.item, moduleId);
      setEditingLessonId(null);
      setLessonTitleDraft("");
      setNotice({ kind: "success", text: "Lesson title updated." });
    } catch (updateError) {
      setLessonTitleError(toErrorMessage(updateError, "Failed to update lesson title."));
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
      setBusyLessonId(null);
    }
  };

  const handleMoveLesson = async (moduleId: number, resourceId: number, offset: -1 | 1) => {
    if (busyModuleId !== null || busyLessonId !== null) return;

    const lessons = selectedModuleLessons;
    const currentIndex = lessons.findIndex((lesson) => lesson.resource_id === resourceId);
    if (currentIndex < 0) return;

    const targetIndex = currentIndex + offset;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    setBusyModuleId(moduleId);
    setBusyLessonId(resourceId);
    setBusyAction("lesson-order");
    setNotice(null);
    setError(null);

    try {
      const response = await updateAdminModuleLesson(moduleId, resourceId, { order_no: targetIndex + 1 });
      applyItemPatch(response.item, moduleId);
      setNotice({ kind: "success", text: "Lesson order updated." });
    } catch (moveError) {
      setNotice({ kind: "error", text: toErrorMessage(moveError, "Failed to reorder lesson.") });
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
      setBusyLessonId(null);
    }
  };

  const handleDeleteLesson = async (moduleId: number, resourceId: number) => {
    if (busyModuleId !== null || busyLessonId !== null) return;

    setBusyModuleId(moduleId);
    setBusyLessonId(resourceId);
    setBusyAction("delete-lesson");
    setNotice(null);
    setError(null);

    try {
      const response = await deleteAdminModuleLesson(moduleId, resourceId);
      applyItemPatch(response.item, moduleId);
      setNotice({ kind: "warning", text: "Lesson deleted." });
    } catch (deleteError) {
      setNotice({ kind: "error", text: toErrorMessage(deleteError, "Failed to delete lesson.") });
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
      setBusyLessonId(null);
    }
  };

  const handleUploadLessonPdf = async (moduleId: number, resourceId: number, file: File | null) => {
    if (!file) return;
    if (busyModuleId !== null || busyLessonId !== null) return;

    setBusyModuleId(moduleId);
    setBusyLessonId(resourceId);
    setBusyAction("upload");
    setNotice(null);
    setError(null);

    try {
      const response = await uploadAdminModuleLessonPdf(moduleId, resourceId, file);
      applyItemPatch(response.item, moduleId);
      setNotice({ kind: "success", text: "Lesson PDF uploaded successfully." });
    } catch (uploadError) {
      setNotice({ kind: "error", text: toErrorMessage(uploadError, "Failed to upload lesson PDF.") });
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
      setBusyLessonId(null);
    }
  };

  const handleRemoveLessonPdf = async (moduleId: number, resourceId: number) => {
    if (busyModuleId !== null || busyLessonId !== null) return;

    setBusyModuleId(moduleId);
    setBusyLessonId(resourceId);
    setBusyAction("remove-pdf");
    setNotice(null);
    setError(null);

    try {
      const response = await removeAdminModuleLessonPdf(moduleId, resourceId);
      applyItemPatch(response.item, moduleId);
      setNotice({ kind: "warning", text: response.removed ? "Lesson PDF removed." : "Lesson has no PDF to remove." });
    } catch (removeError) {
      setNotice({ kind: "error", text: toErrorMessage(removeError, "Failed to remove lesson PDF.") });
    } finally {
      setBusyAction(null);
      setBusyModuleId(null);
      setBusyLessonId(null);
    }
  };

  const trimmedAddTitle = addTitleDraft.trim();
  const disableCreateModule =
    addSaving || trimmedAddTitle.length === 0 || trimmedAddTitle.length > MODULE_TITLE_MAX_LENGTH;

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 relative">
      {error && (
        <div className="keep-selection bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0">
          {error}
        </div>
      )}

      {notice ? (
        <div
          className={`keep-selection rounded-2xl px-6 py-4 text-sm font-semibold shadow-sm shrink-0 border ${
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAddModal}
              className="bg-[#3B82F6] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 shadow-sm hover:brightness-110 disabled:opacity-70"
              disabled={loading || addSaving}
            >
              <Plus size={16} aria-hidden="true" /> Add Module
            </button>
            <button
              type="button"
              onClick={() => setRefreshSeq((value) => value + 1)}
              className="bg-[#1E293B] dark:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 shadow-sm hover:brightness-110 disabled:opacity-70"
              disabled={loading || addSaving}
            >
              <RefreshCw size={16} aria-hidden="true" className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="top-bar-actions flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="relative z-10 w-full sm:w-[320px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules or lessons..."
              className="pl-4 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200 text-sm font-bold w-full outline-none focus:ring-2 focus:ring-[#3B82F6] shadow-sm transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setRefreshSeq((value) => value + 1)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 transition-colors disabled:opacity-50"
              disabled={loading}
              title="Refresh List"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 relative">
          <div className="flex-1 bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/50 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 keep-selection">
                  <tr className="text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800/50">
                    <th className="px-6 py-5 text-left w-32">Module Code</th>
                    <th className="px-6 py-5 text-left">Module Title</th>
                    <th className="px-6 py-5 text-center w-36">Lessons</th>
                    <th className="px-6 py-5 text-left w-32">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-slate-500 font-semibold">
                        <div className="flex justify-center items-center gap-2">
                          <Loader2 size={18} className="animate-spin" /> Loading modules...
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-slate-500 font-semibold">
                        <div className="flex justify-center items-center gap-2">
                          <AlertTriangle size={18} /> No modules found
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((item) => {
                      const isSelected = selectedModuleId === item.module_id;
                      const abbrev = item.module_code.substring(0, 2).toUpperCase() || "M0";
                      const lessonCount = item.lessons.length;
                      const readyLessonCount = item.lessons.filter((lesson) => {
                        const url = (lesson.resolved_url || lesson.url || "").trim();
                        return url.length > 0;
                      }).length;
                      const percent = lessonCount > 0 ? Math.round((readyLessonCount / lessonCount) * 100) : 0;

                      return (
                        <tr
                          key={item.module_id}
                          onClick={() => setSelectedModuleId(item.module_id)}
                          className={`lesson-row cursor-pointer transition-all group ${
                            isSelected
                              ? "bg-blue-50/50 dark:bg-blue-900/10"
                              : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                          }`}
                        >
                          <td className="px-6 py-4 relative">
                            {isSelected && (
                              <motion.div
                                layoutId="activeIndicator"
                                className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#3B82F6] rounded-r-md"
                              />
                            )}

                            <div className="flex items-center gap-4">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/20"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {abbrev}
                              </div>
                              <span
                                className={`font-extrabold text-[13px] ${
                                  isSelected ? "text-[#0B1B3D] dark:text-white" : "text-slate-600 dark:text-slate-300"
                                }`}
                              >
                                {item.module_code}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p
                              className={`font-bold text-[13px] truncate max-w-[240px] ${
                                isSelected ? "text-[#0B1B3D] dark:text-white" : "text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {item.module_title}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                                <FileText size={14} className={lessonCount > 0 ? "text-[#3B82F6]" : "text-slate-400"} /> {lessonCount}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-full max-w-[100px]">
                              <div className="flex justify-between items-center text-[10px] font-black mb-1.5 tracking-wider">
                                <span className="text-slate-400 uppercase">Ready</span>
                                <span className="text-emerald-500">{percent}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500 bg-emerald-500" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedModule ? (
              <motion.div
                key={`details-${selectedModule.module_id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="details-pane w-full lg:w-[440px] shrink-0 bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/50 flex flex-col overflow-hidden relative"
              >
                <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-2.5">
                    <BookOpen size={18} className="text-[#3B82F6]" />
                    <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[12px]">
                      Details
                    </span>
                    <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-[#3B82F6] px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                      {selectedModule.module_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    {!editingModuleId && (
                      <button
                        type="button"
                        onClick={() => startModuleTitleEdit(selectedModule)}
                        className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Edit module title"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                  {editingModuleId === selectedModule.module_id ? (
                    <div className="mb-6">
                      <input
                        type="text"
                        value={titleDraft}
                        maxLength={MODULE_TITLE_MAX_LENGTH}
                        onChange={(e) => {
                          setTitleDraft(e.target.value);
                          setTitleError(null);
                        }}
                        disabled={isModuleBusy(selectedModule.module_id)}
                        className="w-full text-2xl font-black text-[#0B1B3D] dark:text-white bg-slate-50 dark:bg-slate-900 border-2 border-[#3B82F6] rounded-xl px-4 py-3 outline-none"
                        autoFocus
                      />
                      {titleError && <p className="mt-2 text-xs font-bold text-red-500">{titleError}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => void handleSaveModuleTitle(selectedModule.module_id)}
                          disabled={isModuleBusy(selectedModule.module_id) || !titleDraft.trim()}
                          className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                        >
                          {isModuleBusy(selectedModule.module_id) && busyAction === "module-title" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Save
                        </button>
                        <button
                          onClick={cancelModuleTitleEdit}
                          disabled={isModuleBusy(selectedModule.module_id)}
                          className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5"
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-2xl font-black text-[#0B1B3D] dark:text-white leading-tight mb-2">
                      {selectedModule.module_title}
                    </h2>
                  )}

                  <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-6">
                    {selectedModule.description || "Module container for grouped lesson PDFs."}
                  </p>

                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-8 mb-4 flex items-center gap-2">
                    <Layers3 size={14} /> Lessons
                  </h3>

                  <div className="space-y-3 mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addLessonDraft}
                        maxLength={LESSON_TITLE_MAX_LENGTH}
                        onChange={(event) => {
                          setAddLessonDraft(event.target.value);
                          if (addLessonError) setAddLessonError(null);
                        }}
                        placeholder="Add lesson title"
                        disabled={busyModuleId !== null || busyLessonId !== null}
                        className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateLesson(selectedModule.module_id)}
                        disabled={
                          busyModuleId !== null ||
                          busyLessonId !== null ||
                          !addLessonDraft.trim() ||
                          addLessonDraft.trim().length > LESSON_TITLE_MAX_LENGTH
                        }
                        className="px-4 py-2.5 rounded-xl bg-[#3B82F6] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {busyAction === "create-lesson" && busyModuleId === selectedModule.module_id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        Add
                      </button>
                    </div>
                    {addLessonError ? <p className="text-xs font-semibold text-red-500">{addLessonError}</p> : null}
                  </div>

                  {selectedModuleLessons.length === 0 ? (
                    <div className="border border-dashed border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 text-center text-sm font-semibold text-slate-500">
                      No lessons yet. Add your first lesson item for this module.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedModuleLessons.map((lesson, index) => {
                        const isSelected = selectedLessonId === lesson.resource_id;
                        const isEditing = editingLessonId === lesson.resource_id;
                        const lessonBusy = isLessonBusy(lesson.resource_id);
                        const lessonUrl = (lesson.resolved_url || lesson.url || "").trim();
                        const canMoveUp = index > 0;
                        const canMoveDown = index < selectedModuleLessons.length - 1;

                        return (
                          <div
                            key={lesson.resource_id}
                            onClick={() => setSelectedLessonId(lesson.resource_id)}
                            className={`rounded-xl border px-3 py-3 cursor-pointer transition-colors ${
                              isSelected
                                ? "border-blue-300 bg-blue-50/50 dark:bg-blue-900/10"
                                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                {index + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <>
                                    <input
                                      type="text"
                                      value={lessonTitleDraft}
                                      maxLength={LESSON_TITLE_MAX_LENGTH}
                                      onChange={(event) => {
                                        setLessonTitleDraft(event.target.value);
                                        if (lessonTitleError) setLessonTitleError(null);
                                      }}
                                      disabled={lessonBusy}
                                      className="w-full px-3 py-2 rounded-lg border border-[#3B82F6] bg-white dark:bg-slate-900 text-sm font-semibold outline-none"
                                      autoFocus
                                    />
                                    {lessonTitleError ? (
                                      <p className="mt-1 text-xs font-semibold text-red-500">{lessonTitleError}</p>
                                    ) : null}
                                  </>
                                ) : (
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{lesson.title}</p>
                                )}

                                <p className="text-xs font-semibold text-slate-500 mt-1 truncate">
                                  {lesson.has_uploaded_file
                                    ? lesson.file_name || "PDF uploaded"
                                    : lessonUrl
                                      ? "PDF link available"
                                      : "No PDF uploaded yet"}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleSaveLessonTitle(selectedModule.module_id, lesson.resource_id);
                                      }}
                                      disabled={lessonBusy || !lessonTitleDraft.trim()}
                                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                                      title="Save lesson title"
                                    >
                                      {lessonBusy && busyAction === "lesson-title" ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <CheckCircle2 size={14} />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        cancelLessonTitleEdit();
                                      }}
                                      disabled={lessonBusy}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                                      title="Cancel"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleMoveLesson(selectedModule.module_id, lesson.resource_id, -1);
                                      }}
                                      disabled={!canMoveUp || lessonBusy || busyModuleId !== null || busyLessonId !== null}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                      title="Move up"
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleMoveLesson(selectedModule.module_id, lesson.resource_id, 1);
                                      }}
                                      disabled={!canMoveDown || lessonBusy || busyModuleId !== null || busyLessonId !== null}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                      title="Move down"
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        startLessonTitleEdit(lesson);
                                      }}
                                      disabled={lessonBusy || busyModuleId !== null || busyLessonId !== null}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                      title="Rename lesson"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleDeleteLesson(selectedModule.module_id, lesson.resource_id);
                                      }}
                                      disabled={lessonBusy || busyModuleId !== null || busyLessonId !== null}
                                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"
                                      title="Delete lesson"
                                    >
                                      {lessonBusy && busyAction === "delete-lesson" ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={14} />
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-8 mb-4 flex items-center gap-2">
                    <FileText size={14} /> Selected Lesson Asset
                  </h3>

                  {selectedLesson ? (
                    <div className="border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col gap-4 relative">
                      {isLessonBusy(selectedLesson.resource_id) && (
                        <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
                          <Loader2 size={24} className="text-[#3B82F6] animate-spin" />
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center ${
                            (selectedLesson.resolved_url || selectedLesson.url || "").trim().length > 0
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                          }`}
                        >
                          <FileText size={20} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className="font-bold text-[13px] text-slate-800 dark:text-slate-200 truncate">{selectedLesson.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                              {selectedLesson.file_name || "No PDF file uploaded"}
                            </p>
                            {selectedLesson.file_size != null && (
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-md">
                                {formatFileSize(selectedLesson.file_size)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label
                          htmlFor={`lesson-file-upload-${selectedLesson.resource_id}`}
                          className="flex-1 flex justify-center items-center gap-2 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                        >
                          <input
                            type="file"
                            id={`lesson-file-upload-${selectedLesson.resource_id}`}
                            accept=".pdf,application/pdf"
                            className="hidden"
                            disabled={isLessonBusy(selectedLesson.resource_id) || busyModuleId !== null || busyLessonId !== null}
                            onChange={(event) => {
                              const selected = event.target.files?.[0] ?? null;
                              void handleUploadLessonPdf(selectedModule.module_id, selectedLesson.resource_id, selected);
                              event.currentTarget.value = "";
                            }}
                          />
                          <Upload size={14} />
                          {(selectedLesson.resolved_url || selectedLesson.url || "").trim().length > 0 ? "Replace PDF" : "Upload PDF"}
                        </label>

                        <button
                          type="button"
                          onClick={() => void handleRemoveLessonPdf(selectedModule.module_id, selectedLesson.resource_id)}
                          disabled={isLessonBusy(selectedLesson.resource_id) || busyModuleId !== null || busyLessonId !== null}
                          className="flex-1 flex justify-center items-center gap-2 py-2 border border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-xs font-bold text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 size={14} /> Remove PDF
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 text-center text-sm font-semibold text-slate-500">
                      Select a lesson to manage its PDF.
                    </div>
                  )}

                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-8 mb-4 flex items-center gap-2">
                    <FileText size={14} /> PDF Preview
                  </h3>

                  <div className="border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 min-h-[220px] flex items-center justify-center bg-slate-50/40 dark:bg-slate-900/20 overflow-auto">
                    {!selectedLesson ? (
                      <p className="text-xs font-semibold text-slate-500">Select a lesson to preview its first page.</p>
                    ) : !previewFile ? (
                      <p className="text-xs font-semibold text-slate-500">No PDF uploaded for this lesson yet.</p>
                    ) : previewError ? (
                      <div className="text-center text-red-500 text-xs font-semibold">
                        <AlertTriangle size={18} className="mx-auto mb-2" />
                        {previewError}
                      </div>
                    ) : (
                      <Document
                        file={previewFile}
                        onLoadError={(loadError) => {
                          setPreviewError(toErrorMessage(loadError, "Failed to load PDF preview."));
                        }}
                        loading={
                          <div className="text-slate-500 text-xs font-semibold flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin" /> Loading preview...
                          </div>
                        }
                      >
                        <Page pageNumber={1} width={previewWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                      </Document>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty-state-guide"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="details-pane w-full lg:w-[440px] shrink-0 bg-slate-50/50 dark:bg-[#1E293B]/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-center p-8"
              >
                <div className="w-16 h-16 rounded-full bg-blue-100/50 dark:bg-blue-900/20 flex items-center justify-center text-[#3B82F6] mb-5">
                  <MousePointerClick size={28} />
                </div>
                <p className="text-base font-black text-slate-800 dark:text-slate-200">Select a module</p>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2 max-w-[250px] leading-relaxed">
                  View module details, then create and manage multiple lesson PDFs.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AdminModalShell
          open={addModalOpen}
          onClose={closeAddModal}
          title="Add Module"
          description="Create a new lesson module container."
          icon={<Plus size={20} />}
          maxWidthClass="max-w-md"
          closeDisabled={addSaving}
          closeOnBackdrop={!addSaving}
          bodyClassName="p-6"
          footer={(
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={closeAddModal}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500 disabled:opacity-50"
                disabled={addSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-module-form"
                className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={disableCreateModule}
              >
                {addSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} aria-hidden="true" />}
                {addSaving ? "Creating..." : "Create Module"}
              </button>
            </div>
          )}
        >
          <form id="add-module-form" onSubmit={handleCreateModule} className="space-y-4">
            <label className="space-y-1.5 block">
              <span className="text-sm font-bold text-[#0B1B3D] dark:text-slate-200">Module Title *</span>
              <input
                type="text"
                value={addTitleDraft}
                onChange={(event) => {
                  setAddTitleDraft(event.target.value);
                  if (addError) setAddError(null);
                }}
                placeholder="Enter module title"
                maxLength={MODULE_TITLE_MAX_LENGTH}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
                disabled={addSaving}
                required
                autoFocus
              />
              <p className="text-xs text-slate-500 font-medium mt-1.5">
                {trimmedAddTitle.length}/{MODULE_TITLE_MAX_LENGTH}
              </p>
            </label>

            {addError ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400">
                {addError}
              </div>
            ) : null}
          </form>
        </AdminModalShell>
      </div>
    </div>
  );
}
