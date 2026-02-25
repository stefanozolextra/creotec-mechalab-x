import { Search, Plus, Upload, Pencil, Power, Download, Layers, RotateCcw, Trash2, ChevronDown, SearchX, X, Check, Minus } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { deleteAdminTrainee, listAdminTrainees, setAdminTraineeStatus } from "../../api/adminTrainees";
import { getAdminBatches } from "../../api/adminImport";
import { API_BASE_URL, ApiError } from "../../api/http";
import CreateBatchModal from "../../components/admin/CreateBatchModal";
import FinalizeBatchWizardModal from "../../components/admin/FinalizeBatchWizardModal";
import GeneratedPasswordModal from "../../components/admin/GeneratedPasswordModal";
import ImportTraineesModal from "../../components/admin/ImportTraineesModal";
import TraineeFormModal, { type TraineeFormSaveResult } from "../../components/admin/TraineeFormModal";
import type { AdminTraineeItem, BatchFilter } from "../../types/adminTrainee";
import { getAuthToken } from "../../utils/auth";

type StatusFilter = "all" | "active" | "inactive";
type PillStatus = "Passed" | "Active" | "Inactive";

const statusPillClass = (status: PillStatus): string => {
  if (status === "Passed") return "bg-[#22C55E] text-white";
  if (status === "Active") return "bg-[#3B82F6] text-white";
  return "bg-[#64748B] text-white";
};

const toDisplayName = (item: AdminTraineeItem): string => {
  const middle = item.middle_name ? ` ${item.middle_name}` : "";
  return `${item.first_name}${middle} ${item.last_name}`.replace(/\s+/g, " ").trim();
};

const toInitials = (name: string): string => {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load trainee list.";
};

const ENABLE_CSV_IMPORT = String(import.meta.env.VITE_ENABLE_CSV_IMPORT ?? "false").toLowerCase() === "true";

export default function UsersPage() {
  const { search: locationSearch } = useLocation();
  const [items, setItems] = useState<AdminTraineeItem[]>([]);
  const [batches, setBatches] = useState<BatchFilter[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedItem, setSelectedItem] = useState<AdminTraineeItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [generatedPasswordState, setGeneratedPasswordState] = useState<{ email: string; password: string; } | null>(null);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Selection & Delete States
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Custom UI Dropdown States
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const batchDropdownRef = useRef<HTMLDivElement>(null);

  // Close custom dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) setIsStatusOpen(false);
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target as Node)) setIsBatchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const batchFromQuery = (params.get("batch") ?? "").trim();
    setSelectedBatch((previous) => (previous === batchFromQuery ? previous : batchFromQuery));
  }, [locationSearch]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await listAdminTrainees({
          search: debouncedSearch || undefined,
          batch: selectedBatch || undefined,
          status: statusFilter,
          limit: 25,
          offset: 0,
        });
        if (!active) return;
        setItems(response.items);
        setBatches(response.filters.batches);
      } catch (loadError) {
        if (!active) return;
        setItems([]);
        setError(toErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [debouncedSearch, selectedBatch, statusFilter, refreshKey]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const displayStatus: PillStatus = item.progress.percent === 100 ? "Passed" : item.status === "active" ? "Active" : "Inactive";
      const fullName = toDisplayName(item);
      return {
        id: String(item.trainee_id),
        numericId: Number(item.trainee_id),
        raw: item,
        displayStatus,
        fullName,
        initials: toInitials(fullName),
      };
    });
  }, [items]);

  const listedIds = useMemo(() => rows.map((row) => row.numericId).filter((value) => Number.isInteger(value) && value > 0), [rows]);
  const allListedSelected = listedIds.length > 0 && listedIds.every((id) => selectedIds.has(id));
  const someListedSelected = listedIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds((previous) => {
      if (previous.size === 0) return previous;
      const listedIdSet = new Set(listedIds);
      let changed = false;
      const next = new Set<number>();
      previous.forEach((id) => {
        if (listedIdSet.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : previous;
    });
  }, [listedIds]);

  const openCreateModal = () => { setSelectedItem(null); setModalMode("create"); setModalOpen(true); };
  const openEditModal = (item: AdminTraineeItem) => { setSelectedItem(item); setModalMode("edit"); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const refreshBatchFilters = async (): Promise<BatchFilter[]> => {
    const response = await getAdminBatches();
    setBatches(response.items);
    return response.items;
  };

  const openCreateBatchModal = () => setCreateBatchModalOpen(true);
  const closeCreateBatchModal = () => setCreateBatchModalOpen(false);

  const ensureBatchSelected = (actionLabel: string): boolean => {
    if (selectedBatch) return true;
    setError(`Select a batch first to ${actionLabel}.`);
    return false;
  };

  const openFinalizeModal = () => { if (!ensureBatchSelected("finalize this cohort cycle")) return; setFinalizeModalOpen(true); };
  const closeFinalizeModal = () => setFinalizeModalOpen(false);

  const openImportModal = () => { if (!ensureBatchSelected("import trainees")) return; setImportModalOpen(true); };
  const closeImportModal = () => setImportModalOpen(false);

  const handleSaved = (result: TraineeFormSaveResult) => {
    setModalOpen(false);
    setSelectedItem(null);
    setRefreshKey((prev) => prev + 1);
    if (result.mode === "create" && result.generated_password) {
      setGeneratedPasswordState({ email: result.item.email, password: result.generated_password });
    }
  };

  const closeGeneratedPasswordModal = () => setGeneratedPasswordState(null);

  const handleBatchCreated = async (batch: BatchFilter) => {
    setCreateBatchModalOpen(false);
    setSelectedBatch(batch.batch_code);
    setRefreshKey((prev) => prev + 1);
    try {
      await refreshBatchFilters();
      setSelectedBatch(batch.batch_code);
    } catch (refreshError) {
      setError(toErrorMessage(refreshError));
      setBatches((prev) => {
        if (prev.some((item) => item.batch_code === batch.batch_code)) return prev;
        return [...prev, batch].sort((a, b) => a.batch_code.localeCompare(b.batch_code));
      });
    }
  };

  const handleResetCompleted = async () => {
    setRefreshKey((prev) => prev + 1);
    try { await refreshBatchFilters(); setSelectedBatch(""); } catch (refreshError) { setError(toErrorMessage(refreshError)); }
  };

  const handleImported = (batchCode: string, refreshedBatches: BatchFilter[]) => {
    setBatches(refreshedBatches); setSelectedBatch(batchCode); setRefreshKey((prev) => prev + 1);
  };

  const handleToggleStatus = async (item: AdminTraineeItem) => {
    const traineeId = String(item.trainee_id);
    const nextStatus = item.status === "active" ? "inactive" : "active";
    setStatusActionId(traineeId);
    setError(null);
    try {
      const result = await setAdminTraineeStatus(traineeId, nextStatus);
      const updatedId = String(result.item.trainee_id);
      setItems((prev) => prev.map((current) => (String(current.trainee_id) === updatedId ? result.item : current)));
    } catch (statusError) {
      setError(toErrorMessage(statusError));
    } finally {
      setStatusActionId(null);
    }
  };

  const handleToggleSelectAll = () => {
    if (loading || rows.length === 0 || deleting) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allListedSelected) listedIds.forEach((id) => next.delete(id));
      else listedIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleToggleSelectOne = (traineeId: number) => {
    if (deleting) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(traineeId)) next.delete(traineeId);
      else next.add(traineeId);
      return next;
    });
  };

  const openDeleteModal = (traineeIds: number[]) => {
    const uniqueIds = Array.from(new Set(traineeIds.filter((value) => Number.isInteger(value) && value > 0)));
    if (uniqueIds.length === 0 || deleting) return;
    setDeleteTargetIds(uniqueIds);
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteTargetIds([]);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (deleting || deleteTargetIds.length === 0) return;
    setDeleting(true);
    setDeleteError(null);
    setError(null);
    try {
      for (const traineeId of deleteTargetIds) await deleteAdminTrainee(traineeId);
      setSelectedIds(new Set());
      setDeleteModalOpen(false);
      setDeleteTargetIds([]);
      setRefreshKey((previous) => previous + 1);
    } catch (deleteActionError) {
      const message = toErrorMessage(deleteActionError);
      setDeleteError(message);
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    if (exporting) return;
    const token = getAuthToken();
    if (!token) { setError("Unauthorized"); return; }
    setExporting(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (selectedBatch) searchParams.set("batch_code", selectedBatch);
      const url = `${API_BASE_URL}/api/admin/trainees/export-csv${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `trainees-${selectedBatch || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      setError(toErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 relative">

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0">
          {error}
        </div>
      )}

      {/* SECTION: TOOLBAR */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0 z-20">

        {/* Left Side: Search & Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-500" size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trainees..."
              className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-[220px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm"
            />
          </div>

          <div className="relative" ref={batchDropdownRef}>
            <button
              onClick={() => setIsBatchOpen(!isBatchOpen)}
              className="bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 text-sm font-bold py-2.5 pl-5 pr-10 rounded-full flex items-center justify-between shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 w-[140px]"
            >
              <span className="truncate">{selectedBatch || 'All Batches'}</span>
              <ChevronDown size={16} className={`absolute right-4 text-slate-400 transition-transform duration-300 ${isBatchOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-[calc(100%+8px)] left-0 w-48 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-xl transform origin-top transition-all duration-200 ease-out ${isBatchOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'}`}>
              <div className="py-2">
                <button onClick={() => { setSelectedBatch(""); setIsBatchOpen(false); }} className={`w-full text-left px-5 py-2.5 text-sm font-bold transition-colors ${selectedBatch === "" ? 'bg-blue-50 text-[#3B82F6] dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                  All Batches
                </button>
                {batches.map((batch) => (
                  <button key={batch.batch_id} onClick={() => { setSelectedBatch(batch.batch_code); setIsBatchOpen(false); }} className={`w-full text-left px-5 py-2.5 text-sm font-bold transition-colors ${selectedBatch === batch.batch_code ? 'bg-blue-50 text-[#3B82F6] dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    {batch.batch_code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative" ref={statusDropdownRef}>
            <button
              onClick={() => setIsStatusOpen(!isStatusOpen)}
              className="bg-[#3B82F6] text-white text-sm font-bold py-2.5 pl-5 pr-10 rounded-full flex items-center justify-between shadow-sm hover:brightness-110 transition-all duration-300 w-[130px]"
            >
              {statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              <ChevronDown size={16} className={`absolute right-4 transition-transform duration-300 ${isStatusOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-[calc(100%+8px)] left-0 w-40 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-hidden transform origin-top transition-all duration-200 ease-out ${isStatusOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'}`}>
              <div className="py-2">
                {(['all', 'active', 'inactive'] as StatusFilter[]).map((opt) => (
                  <button key={opt} onClick={() => { setStatusFilter(opt); setIsStatusOpen(false); }} className={`w-full text-left px-5 py-2.5 text-sm font-bold transition-colors ${statusFilter === opt ? 'bg-blue-50 text-[#3B82F6] dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    {opt === 'all' ? 'All Statuses' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Primary Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">

          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300 mr-2">
              <button
                onClick={() => openDeleteModal(Array.from(selectedIds))}
                disabled={deleting}
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-sm disabled:opacity-50"
              >
                <Trash2 size={16} /> {deleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
              </button>
            </div>
          ) : (
            <>
              <button onClick={openCreateBatchModal} className="bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm">
                <Layers size={16} /> <span className="hidden 2xl:inline">Create Batch</span>
              </button>
              <button onClick={openFinalizeModal} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm">
                <RotateCcw size={16} /> <span className="hidden 2xl:inline">Finalize Batch</span>
              </button>
              {ENABLE_CSV_IMPORT && (
                <button onClick={openImportModal} className="bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm">
                  <Upload size={16} /> <span className="hidden 2xl:inline">Import CSV</span>
                </button>
              )}
              <button onClick={handleExportCsv} disabled={exporting} className="bg-[#1E293B] dark:bg-slate-700 text-white px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50">
                <Download size={16} /> <span className="hidden 2xl:inline">{exporting ? "..." : "Export"}</span>
              </button>
            </>
          )}

          <button onClick={openCreateModal} className="bg-[#3B82F6] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-sm">
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* SECTION: DATA TABLE */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 relative z-0 border border-slate-100 dark:border-slate-800/50">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[13px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="px-6 py-6 text-left w-12">
                  {/* NEW: Custom "Select All" Checkbox */}
                  <div
                    onClick={handleToggleSelectAll}
                    className={`w-[22px] h-[22px] rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${allListedSelected
                        ? "bg-[#3B82F6] border-[#3B82F6]"
                        : someListedSelected
                          ? "bg-[#3B82F6] border-[#3B82F6]"
                          : "bg-white dark:bg-[#0F172A] border-slate-300 dark:border-slate-600 hover:border-[#3B82F6] dark:hover:border-[#3B82F6]"
                      } ${(loading || rows.length === 0 || deleting) ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {allListedSelected && <Check size={14} className="text-white" strokeWidth={3.5} />}
                    {!allListedSelected && someListedSelected && <Minus size={14} className="text-white" strokeWidth={3.5} />}
                  </div>
                </th>
                <th className="px-2 py-6 text-left">Name</th>
                <th className="px-6 py-6 text-center">Student ID</th>
                <th className="px-6 py-6 text-center">Batch</th>
                <th className="px-6 py-6 text-center">Email Address</th>
                <th className="px-6 py-6 text-center">Progress</th>
                <th className="px-6 py-6 text-center">Status</th>
                <th className="px-6 py-6 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {rows.map((row) => {
                const actionLabel = row.raw.status === "active" ? "Deactivate" : "Reactivate";
                const isToggling = statusActionId === row.id;
                const isSelected = selectedIds.has(row.numericId);

                return (
                  <tr
                    key={row.id}
                    onClick={() => handleToggleSelectOne(row.numericId)}
                    className={`group cursor-pointer select-none transition-all duration-300 border-y border-transparent ${isSelected ? 'bg-blue-50/80 dark:bg-[#3B82F6]/10 !border-blue-200 dark:!border-blue-900/50 relative z-10'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:border-slate-200 dark:hover:border-slate-700/50'
                      }`}
                  >
                    <td className="px-6 py-5">
                      {/* NEW: Custom Row Checkbox */}
                      <div
                        onClick={(e) => { e.stopPropagation(); handleToggleSelectOne(row.numericId); }}
                        className={`w-[22px] h-[22px] rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${isSelected
                            ? "bg-[#3B82F6] border-[#3B82F6] shadow-md shadow-blue-500/20"
                            : "bg-white dark:bg-[#0F172A] border-slate-300 dark:border-slate-600 group-hover:border-[#3B82F6]/50 dark:group-hover:border-[#3B82F6]/50"
                          } ${deleting ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <Check size={14} className={`text-white transition-transform duration-300 ${isSelected ? "scale-100" : "scale-0"}`} strokeWidth={3.5} />
                      </div>
                    </td>
                    <td className="px-2 py-5 text-left font-bold text-[#0B1B3D] dark:text-slate-200 transition-colors duration-500">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors duration-500">
                          {row.initials}
                        </div>
                        {row.fullName}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{row.raw.trainee_code}</td>
                    <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{row.raw.batch.batch_code}</td>
                    <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{row.raw.email}</td>
                    <td className="px-6 py-5">
                      <div className="w-[140px] mx-auto group-hover:scale-105 transition-transform duration-300">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">
                          <span>{row.raw.progress.label}</span>
                          <span>{row.raw.progress.percent}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden transition-colors duration-500">
                          <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-500" style={{ width: `${row.raw.progress.percent}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center justify-center w-[90px] py-1.5 rounded-full text-[11px] font-black tracking-wide uppercase ${statusPillClass(row.displayStatus)} transition-colors duration-500`}>
                        {row.displayStatus}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditModal(row.raw); }}
                          disabled={deleting}
                          className="bg-[#1E293B] dark:bg-slate-700 text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm disabled:opacity-50"
                        >
                          <Pencil size={14} aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleToggleStatus(row.raw); }}
                          disabled={isToggling || deleting}
                          className={`${row.raw.status === "active" ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#22C55E] hover:bg-[#16A34A]"} text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm disabled:opacity-50`}
                        >
                          <Power size={14} aria-hidden="true" />
                          {isToggling ? "..." : actionLabel}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openDeleteModal([row.numericId]); }}
                          disabled={deleting}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center text-slate-500 dark:text-slate-400 transition-colors duration-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <SearchX size={40} className="text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-lg text-[#0B1B3D] dark:text-slate-200">No trainees found.</p>
                      <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION: SLEEK DELETE MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E293B] shadow-2xl overflow-hidden transform transition-all duration-300 scale-100 opacity-100 animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 rounded-xl">
                    <Trash2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100">Confirm Delete</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">This action is permanent.</p>
                  </div>
                </div>
                <button onClick={closeDeleteModal} disabled={deleting} className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-8">
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                {deleteTargetIds.length === 1
                  ? "Are you sure you want to delete this trainee permanently? This action cannot be undone."
                  : `Are you sure you want to delete ${deleteTargetIds.length} selected trainees permanently? This action cannot be undone.`}
              </p>

              {deleteError && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm font-semibold text-red-600 dark:text-red-400">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                className="px-8 py-2.5 rounded-full text-sm font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] shadow-lg shadow-red-500/20 transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KEEPING YOUR REAL BACKEND MODALS */}
      <TraineeFormModal open={modalOpen} mode={modalMode} initial={selectedItem} batches={batches} onClose={closeModal} onSaved={handleSaved} />

      <CreateBatchModal open={createBatchModalOpen} onClose={closeCreateBatchModal} onCreated={handleBatchCreated} />

      <FinalizeBatchWizardModal open={finalizeModalOpen} batches={batches} initialBatchCode={selectedBatch} onClose={closeFinalizeModal} onResetCompleted={handleResetCompleted} />

      <GeneratedPasswordModal open={Boolean(generatedPasswordState)} email={generatedPasswordState?.email ?? ""} password={generatedPasswordState?.password ?? ""} onClose={closeGeneratedPasswordModal} />

      {ENABLE_CSV_IMPORT && (
        <ImportTraineesModal open={importModalOpen} batches={batches} initialBatchCode={selectedBatch} onClose={closeImportModal} onImported={handleImported} />
      )}

    </div>
  );
}