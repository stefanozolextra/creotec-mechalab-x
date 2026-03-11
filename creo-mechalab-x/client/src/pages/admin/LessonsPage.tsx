import {
  AlertTriangle, CheckCircle2, Loader2, Pencil, RefreshCw,
  Search, Trash2, Upload, X, BookOpen, Layers, FileText,
  Gamepad2, Plus, MousePointerClick
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAdminLessons, removeAdminLessonPdf, updateAdminLessonTitle, uploadAdminLessonPdf } from "../../api/adminLessons";
import { ApiError } from "../../api/http";
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

  // Action States
  const [busyModuleId, setBusyModuleId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<"upload" | "delete" | "title" | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [refreshSeq, setRefreshSeq] = useState(0);

  // Selection State for Master-Detail View (Defaults to null to show the Guide)
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Initial Data Fetch
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

  // Click-Away Event Listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Do not deselect if clicking inside these specific interactive areas
      if (
        target.closest('.lesson-row') ||
        target.closest('.details-pane') ||
        target.closest('.top-bar-actions') ||
        target.closest('.keep-selection')
      ) {
        return;
      }

      // Prevent deselection when clicking/dragging a scrollbar
      const isScrollable = target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth;
      if (isScrollable) {
        const rect = target.getBoundingClientRect();
        const clickedVerticalScrollbar = e.clientX >= rect.right - 20;
        const clickedHorizontalScrollbar = e.clientY >= rect.bottom - 20;
        if (clickedVerticalScrollbar || clickedHorizontalScrollbar) return;
      }

      // Clear selection if clicked on empty space
      setSelectedId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const selectedItem = useMemo(() =>
    items.find(i => i.module_id === selectedId) || null
    , [items, selectedId]);

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
      setNotice({ kind: "success", text: `PDF uploaded successfully.` });
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
      setNotice({ kind: "warning", text: `PDF removed from module.` });
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
      setNotice({ kind: "success", text: `Title updated successfully.` });
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

      {/* Notifications */}
      {error && (
        <div className="keep-selection bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0">
          {error}
        </div>
      )}
      {notice && (
        <div className={`keep-selection rounded-2xl px-6 py-4 text-sm font-semibold shadow-sm shrink-0 border ${notice.kind === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
            notice.kind === "warning" ? "bg-amber-50 border-amber-200 text-amber-700" :
              "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Top Bar Actions */}
      <div className="top-bar-actions flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="relative z-10 w-full sm:w-[320px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons..."
            className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200 text-sm font-bold w-full outline-none focus:ring-2 focus:ring-[#3B82F6] shadow-sm transition-all"
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
          <button className="bg-[#3B82F6] hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm transition-all">
            <Plus size={18} strokeWidth={3} /> Add New Module
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 relative">

        {/* LEFT PANE: Master List */}
        <div className="flex-1 bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/50 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 keep-selection">
                <tr className="text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800/50">
                  <th className="px-6 py-5 text-left w-32">Module Code</th>
                  <th className="px-6 py-5 text-left">Module Title</th>
                  <th className="px-6 py-5 text-center w-36">Assets</th>
                  <th className="px-6 py-5 text-left w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-500 font-semibold">
                      <div className="flex justify-center items-center gap-2"><Loader2 size={18} className="animate-spin" /> Loading modules...</div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-500 font-semibold">
                      <div className="flex justify-center items-center gap-2"><AlertTriangle size={18} /> No modules found</div>
                    </td>
                  </tr>
                ) : (
                  rows.map((item) => {
                    const isSelected = selectedId === item.module_id;
                    const hasPdf = item.pdf.has_pdf;
                    const abbrev = item.module_code.substring(0, 2).toUpperCase() || 'M0';

                    return (
                      <tr
                        key={item.module_id}
                        onClick={() => setSelectedId(item.module_id)}
                        className={`lesson-row cursor-pointer transition-all group ${isSelected
                            ? 'bg-blue-50/50 dark:bg-blue-900/10'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                          }`}
                      >
                        <td className="px-6 py-4 relative">
                          {isSelected && <motion.div layoutId="activeIndicator" className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#3B82F6] rounded-r-md" />}

                          <div className="flex items-center gap-4">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-colors ${isSelected ? 'bg-[#3B82F6] text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 dark:group-hover:bg-[#2563EB]/20 dark:group-hover:text-[#3B82F6]'
                              }`}>
                              {abbrev}
                            </div>
                            <span className={`font-extrabold text-[13px] ${isSelected ? 'text-[#0B1B3D] dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                              {item.module_code}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-bold text-[13px] truncate max-w-[240px] ${isSelected ? 'text-[#0B1B3D] dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {item.module_title}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                              <FileText size={14} className={hasPdf ? "text-[#3B82F6]" : "text-slate-400"} /> {hasPdf ? '1' : '0'}
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                              <Gamepad2 size={14} className="text-slate-400" /> 0
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-full max-w-[100px]">
                            <div className="flex justify-between items-center text-[10px] font-black mb-1.5 tracking-wider">
                              <span className="text-slate-400 uppercase">Prog.</span>
                              <span className="text-emerald-500">
                                {hasPdf ? "100%" : "0%"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${hasPdf ? "bg-emerald-500 w-full" : "bg-emerald-500 w-0"}`} />
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

        {/* RIGHT PANE: Animated Details & Actions */}
        <AnimatePresence mode="wait">
          {selectedItem ? (
            <motion.div
              key={`details-${selectedItem.module_id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="details-pane w-full lg:w-[420px] shrink-0 bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800/50 flex flex-col overflow-hidden relative"
            >
              {/* Details Header */}
              <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-2.5">
                  <BookOpen size={18} className="text-[#3B82F6]" />
                  <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[12px]">Details</span>
                  <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-[#3B82F6] px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                    {selectedItem.module_code}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  {!isEditing(selectedItem.module_id) && (
                    <button onClick={() => startTitleEdit(selectedItem)} className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Edit Title">
                      <Pencil size={15} />
                    </button>
                  )}
                  <button className="hover:text-red-500 transition-colors" title="Delete Module">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Details Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">

                {/* Title Editing Logic */}
                {isEditing(selectedItem.module_id) ? (
                  <div className="mb-6">
                    <input
                      type="text"
                      value={titleDraft}
                      maxLength={MODULE_TITLE_MAX_LENGTH}
                      onChange={(e) => { setTitleDraft(e.target.value); setTitleError(null); }}
                      disabled={isBusy(selectedItem.module_id)}
                      className="w-full text-2xl font-black text-[#0B1B3D] dark:text-white bg-slate-50 dark:bg-slate-900 border-2 border-[#3B82F6] rounded-xl px-4 py-3 outline-none"
                      autoFocus
                    />
                    {titleError && <p className="mt-2 text-xs font-bold text-red-500">{titleError}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => void handleSaveTitle(selectedItem.module_id)}
                        disabled={isBusy(selectedItem.module_id) || !titleDraft.trim()}
                        className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                      >
                        {isBusy(selectedItem.module_id) && busyAction === "title" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save
                      </button>
                      <button
                        onClick={cancelTitleEdit}
                        disabled={isBusy(selectedItem.module_id)}
                        className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-2xl font-black text-[#0B1B3D] dark:text-white leading-tight mb-2">
                    {selectedItem.module_title}
                  </h2>
                )}

                <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-6">
                  {selectedItem.description || "Overview of the system and basics."}
                </p>

                {/* Attached Materials Panel */}
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-8 mb-4 flex items-center gap-2">
                  <Layers size={14} /> Attached Materials
                </h3>

                <div className="border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col gap-4 relative">
                  {isBusy(selectedItem.module_id) && busyAction !== "title" && (
                    <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
                      <Loader2 size={24} className="text-[#3B82F6] animate-spin" />
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center ${selectedItem.pdf.has_pdf ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                      <FileText size={20} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-bold text-[13px] text-slate-800 dark:text-slate-200 truncate">
                        {selectedItem.pdf.has_pdf ? "Module Handout PDF" : "No Document Attached"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                          {selectedItem.pdf.has_pdf ? selectedItem.pdf.file_name : "Upload a PDF to link it here."}
                        </p>
                        {selectedItem.pdf.has_pdf && selectedItem.pdf.file_size != null && (
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-md">
                            {formatFileSize(selectedItem.pdf.file_size)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`file-upload-${selectedItem.module_id}`}
                      className="flex-1 flex justify-center items-center gap-2 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                    >
                      <input
                        type="file"
                        id={`file-upload-${selectedItem.module_id}`}
                        accept=".pdf,application/pdf"
                        className="hidden"
                        disabled={isBusy(selectedItem.module_id)}
                        onChange={(event) => {
                          const selected = event.target.files?.[0] ?? null;
                          void handleUpload(selectedItem.module_id, selected);
                          event.currentTarget.value = "";
                        }}
                      />
                      <Upload size={14} /> {selectedItem.pdf.has_pdf ? "Replace" : "Upload"}
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleRemove(selectedItem.module_id)}
                      disabled={!selectedItem.pdf.has_pdf || isBusy(selectedItem.module_id)}
                      className="flex-1 flex justify-center items-center gap-2 py-2 border border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-xs font-bold text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>

                {/* Assigned Simulations Panel */}
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-8 mb-4 flex items-center gap-2">
                  <Gamepad2 size={14} /> Assigned Simulations
                </h3>

                <div className="border border-dashed border-slate-200 dark:border-slate-700/50 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                  <Gamepad2 size={24} />
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
              className="details-pane w-full lg:w-[420px] shrink-0 bg-slate-50/50 dark:bg-[#1E293B]/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-center p-8"
            >
              <div className="w-16 h-16 rounded-full bg-blue-100/50 dark:bg-blue-900/20 flex items-center justify-center text-[#3B82F6] mb-5">
                <MousePointerClick size={28} />
              </div>
              <p className="text-base font-black text-slate-800 dark:text-slate-200">Select a learning module</p>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2 max-w-[250px] leading-relaxed">
                Click on any row in the list to view its details, manage attached materials, and assign simulations.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}