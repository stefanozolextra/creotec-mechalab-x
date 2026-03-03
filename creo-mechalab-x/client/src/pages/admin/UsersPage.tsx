import { Search, Plus, Upload, Pencil, Power, Download, Layers, CheckCircle, Trash2, Check, Minus, SearchX, X, Mail, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  deleteAdminTrainee,
  listAdminTrainees,
  resendAdminTraineeCredentials,
  setAdminTraineeStatus,
} from "../../api/adminTrainees";
import { getAdminBatches } from "../../api/adminImport";
import { API_BASE_URL, ApiError } from "../../api/http";
import CreateBatchModal from "../../components/admin/CreateBatchModal";
import FinalizeBatchWizardModal from "../../components/admin/FinalizeBatchWizardModal";
import GeneratedPasswordModal from "../../components/admin/GeneratedPasswordModal";
import ImportTraineesModal from "../../components/admin/ImportTraineesModal";
import TraineeReportsPanel from "../../components/admin/TraineeReportsPanel";
import TraineeFormModal, { type TraineeFormSaveResult } from "../../components/admin/TraineeFormModal";
import type { AdminTraineeItem, BatchFilter } from "../../types/adminTrainee";
import { getAuthToken } from "../../utils/auth";

type StatusFilter = "all" | "active" | "inactive";
type PillStatus = "Passed" | "Active" | "Inactive";
type ActiveView = "trainees" | "reports";

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
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load trainee list.";
};

const toRetryAfterSeconds = (error: unknown): number | null => {
  if (!(error instanceof ApiError) || error.status !== 429) return null;
  if (typeof error.data !== "object" || error.data === null) return null;
  if (!("retry_after_seconds" in error.data)) return null;

  const retryAfterSeconds = Number((error.data as { retry_after_seconds?: unknown }).retry_after_seconds);
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) return null;
  return Math.ceil(retryAfterSeconds);
};

const ENABLE_CSV_IMPORT = String(import.meta.env.VITE_ENABLE_CSV_IMPORT ?? "false").toLowerCase() === "true";
const SELECTED_BATCH_STORAGE_KEY = "mechalabx.selectedBatchCode";

const readStoredBatchCode = (): string => {
  try {
    const value = window.localStorage.getItem(SELECTED_BATCH_STORAGE_KEY);
    return value ? value.trim() : "";
  } catch {
    return "";
  }
};

const writeStoredBatchCode = (batchCode: string): void => {
  try {
    if (!batchCode) {
      window.localStorage.removeItem(SELECTED_BATCH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SELECTED_BATCH_STORAGE_KEY, batchCode);
  } catch {
    // no-op
  }
};

const DebouncedSearchInput = memo(({
  initialValue,
  onSearch
}: {
  initialValue: string;
  onSearch: (val: string) => void;
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="relative w-full sm:max-w-[240px]">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search trainees..."
        className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-full outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors shadow-sm"
      />
    </div>
  );
});
DebouncedSearchInput.displayName = "DebouncedSearchInput";

export default function UsersPage() {
  const { search: locationSearch } = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = useState<AdminTraineeItem[]>([]);
  const [batches, setBatches] = useState<BatchFilter[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<{ type: "success" | "warning"; message: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedItem, setSelectedItem] = useState<AdminTraineeItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [generatedPasswordState, setGeneratedPasswordState] = useState<{ email: string; password: string; } | null>(null);

  const [statusActionId, setStatusActionId] = useState<string | null>(null);
  const [resendActionId, setResendActionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const params = new URLSearchParams(locationSearch);
  const activeView: ActiveView = params.get("view") === "reports" ? "reports" : "trainees";

  useEffect(() => {
    const batchFromQuery = (params.get("batch") ?? "").trim();
    if (!batchFromQuery) return;
    setSelectedBatch((previous) => (previous === batchFromQuery ? previous : batchFromQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSearch]);

  useEffect(() => {
    if (batches.length === 0) return;
    if (selectedBatch) {
      const exists = batches.some((batch) => batch.batch_code === selectedBatch);
      if (!exists) setSelectedBatch("");
      return;
    }
    const storedBatchCode = readStoredBatchCode();
    if (!storedBatchCode) return;
    const exists = batches.some((batch) => batch.batch_code === storedBatchCode);
    if (exists) setSelectedBatch(storedBatchCode);
  }, [batches, selectedBatch]);

  useEffect(() => {
    writeStoredBatchCode(selectedBatch);
  }, [selectedBatch]);

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

  const handleSearch = useCallback((val: string) => setDebouncedSearch(val), []);
  const openCreateModal = useCallback(() => { setSelectedItem(null); setModalMode("create"); setModalOpen(true); }, []);
  const openEditModal = useCallback((item: AdminTraineeItem) => { setSelectedItem(item); setModalMode("edit"); setModalOpen(true); }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const openCreateBatchModal = useCallback(() => setCreateBatchModalOpen(true), []);
  const closeCreateBatchModal = useCallback(() => setCreateBatchModalOpen(false), []);
  const closeFinalizeModal = useCallback(() => setFinalizeModalOpen(false), []);
  const closeImportModal = useCallback(() => setImportModalOpen(false), []);
  const closeGeneratedPasswordModal = useCallback(() => setGeneratedPasswordState(null), []);
  const closeDeleteModal = useCallback(() => { if (deleting) return; setDeleteModalOpen(false); setDeleteTargetIds([]); setDeleteError(null); }, [deleting]);

  const refreshBatchFilters = async (): Promise<BatchFilter[]> => {
    const response = await getAdminBatches();
    setBatches(response.items);
    return response.items;
  };

  const ensureBatchSelected = (actionLabel: string): boolean => {
    if (selectedBatch) return true;
    setError(`Select a batch first to ${actionLabel}.`);
    return false;
  };

  const openFinalizeModal = () => { if (!ensureBatchSelected("finalize this cohort cycle")) return; setFinalizeModalOpen(true); };
  const openImportModal = () => { if (!ensureBatchSelected("import trainees")) return; setImportModalOpen(true); };

  const handleSaved = useCallback((result: TraineeFormSaveResult) => {
    setModalOpen(false);
    setSelectedItem(null);
    setRefreshKey((prev) => prev + 1);

    if (result.mode === "create") {
      if (result.email_sent && result.password_delivery === "email") {
        setDeliveryNotice({ type: "success", message: `Email sent to ${result.item.email}.` });
      } else if (result.generated_password && result.password_delivery === "manual") {
        setDeliveryNotice({ type: "warning", message: `Email failed for ${result.item.email}. Manual password fallback is available.` });
      } else if (result.email_sent === false || result.password_delivery === "failed") {
        setDeliveryNotice({ type: "warning", message: `Email failed for ${result.item.email}. Trainee was created successfully.` });
      } else {
        setDeliveryNotice(null);
      }
    }

    if (result.mode === "create" && result.generated_password) {
      setGeneratedPasswordState({ email: result.item.email, password: result.generated_password });
    }

    setTimeout(() => setDeliveryNotice(null), 8000);
  }, []);

  const handleResendCredentials = useCallback(async (item: AdminTraineeItem) => {
    const traineeId = String(item.trainee_id);
    if (resendActionId || deleting) return;

    setResendActionId(traineeId);
    setError(null);
    setDeliveryNotice(null);

    try {
      const result = await resendAdminTraineeCredentials(traineeId);
      if (result.email_sent) {
        setDeliveryNotice({ type: "success", message: `Credentials resent to ${item.email}.` });
      } else {
        setDeliveryNotice({ type: "warning", message: `Failed to resend credentials for ${item.email}.` });
      }
    } catch (resendError) {
      const retryAfterSeconds = toRetryAfterSeconds(resendError);
      if (retryAfterSeconds !== null) {
        setError(`Credentials were sent recently. Retry in ${retryAfterSeconds} seconds.`);
      } else {
        setError(toErrorMessage(resendError));
      }
    } finally {
      setResendActionId(null);
      setTimeout(() => setDeliveryNotice(null), 8000);
    }
  }, [resendActionId, deleting]);

  const handleBatchCreated = useCallback(async (batch: BatchFilter) => {
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
  }, []);

  const handleResetCompleted = useCallback(async () => {
    setRefreshKey((prev) => prev + 1);
    try { await refreshBatchFilters(); setSelectedBatch(""); } catch (refreshError) { setError(toErrorMessage(refreshError)); }
  }, []);

  const handleImported = useCallback((batchCode: string, refreshedBatches: BatchFilter[]) => {
    setBatches(refreshedBatches); setSelectedBatch(batchCode); setRefreshKey((prev) => prev + 1);
  }, []);

  const handleToggleStatus = useCallback(async (item: AdminTraineeItem) => {
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
  }, []);

  const handleToggleSelectAll = () => {
    if (loading || rows.length === 0 || deleting) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allListedSelected) listedIds.forEach((id) => next.delete(id));
      else listedIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleToggleSelectOne = (traineeId: number, checked: boolean) => {
    if (deleting) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(traineeId);
      else next.delete(traineeId);
      return next;
    });
  };

  const openDeleteModal = useCallback((traineeIds: number[]) => {
    const uniqueIds = Array.from(new Set(traineeIds.filter((value) => Number.isInteger(value) && value > 0)));
    if (uniqueIds.length === 0 || deleting) return;
    setDeleteTargetIds(uniqueIds);
    setDeleteError(null);
    setDeleteModalOpen(true);
  }, [deleting]);

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
      const queryString = searchParams.toString();
      const url = `${API_BASE_URL}/api/admin/trainees/export-csv${queryString ? `?${queryString}` : ""}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const data = await response.json();
          if (data && typeof data === "object" && "error" in data && typeof data.error === "string") message = data.error;
        } catch { /* no-op */ }
        throw new Error(message);
      }
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

  const handleSwitchView = (nextView: ActiveView) => {
    if (nextView === activeView) return;
    const searchParams = new URLSearchParams(locationSearch);
    if (nextView === "reports") searchParams.set("view", "reports");
    else searchParams.delete("view");
    const queryString = searchParams.toString();
    navigate(`/admin/users${queryString ? `?${queryString}` : ""}`, { replace: true });
  };

  const viewToggle = (
    <div className="bg-white dark:bg-[#1E293B] rounded-full p-1.5 border border-slate-200 dark:border-slate-700/50 inline-flex items-center shadow-sm w-max mb-2">
      <button
        type="button"
        onClick={() => handleSwitchView("trainees")}
        className={`px-6 py-2 rounded-full font-bold text-sm transition-colors ${activeView === "trainees" ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
      >
        Trainees
      </button>
      <button
        type="button"
        onClick={() => handleSwitchView("reports")}
        className={`px-6 py-2 rounded-full font-bold text-sm transition-colors ${activeView === "reports" ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
      >
        Reports
      </button>
    </div>
  );

  if (activeView === "reports") {
    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0 relative">
        {viewToggle}
        <TraineeReportsPanel />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 min-w-0 w-full relative">

      {/* SECTION: VIEW TOGGLE & BANNERS */}
      <div className="flex flex-col gap-3 shrink-0">
        {viewToggle}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {deliveryNotice && (
          <div className={`rounded-2xl px-6 py-4 text-sm font-bold shadow-sm animate-in fade-in slide-in-from-top-2 flex items-center gap-3 ${deliveryNotice.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
            <Mail size={18} />
            {deliveryNotice.message}
          </div>
        )}
      </div>

      {/* SECTION: TOOLBAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 z-20 w-full min-w-0">

        {/* Left Side: Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto flex-1 min-w-0">
          <DebouncedSearchInput initialValue={debouncedSearch} onSearch={handleSearch} />

          <div className="flex flex-col sm:flex-row gap-3 flex-1 sm:flex-none">
            <select
              value={selectedBatch}
              onChange={(event) => setSelectedBatch(event.target.value)}
              className="py-2.5 px-3 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold w-full sm:w-[140px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors shadow-sm cursor-pointer"
            >
              <option value="">All Batches</option>
              {batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_code}>{batch.batch_code}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="py-2.5 px-3 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold w-full sm:w-[130px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors shadow-sm cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 justify-start sm:justify-end w-full lg:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar shrink-0">
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 mr-2">
              <button
                type="button"
                onClick={() => openDeleteModal(Array.from(selectedIds))}
                disabled={deleting}
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-sm disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
                {deleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
              </button>
            </div>
          ) : (
            <>
              <button onClick={openCreateBatchModal} className="bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 w-10 h-10 p-0 lg:w-auto lg:px-4 lg:py-2.5 rounded-full text-sm font-bold flex items-center justify-center transition-all shadow-sm shrink-0">
                <Layers size={16} aria-hidden="true" /> <span className="hidden lg:inline ml-2">Create Batch</span>
              </button>

              <button onClick={openFinalizeModal} className="bg-amber-500 hover:bg-amber-600 text-white w-10 h-10 p-0 lg:w-auto lg:px-4 lg:py-2.5 rounded-full text-sm font-bold flex items-center justify-center transition-all shadow-sm shrink-0">
                <CheckCircle size={16} aria-hidden="true" /> <span className="hidden lg:inline ml-2">Finalize Batch</span>
              </button>

              {ENABLE_CSV_IMPORT ? (
                <button onClick={openImportModal} className="bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 w-10 h-10 p-0 lg:w-auto lg:px-4 lg:py-2.5 rounded-full text-sm font-bold flex items-center justify-center transition-all shadow-sm shrink-0">
                  <Upload size={16} aria-hidden="true" /> <span className="hidden lg:inline ml-2">Import CSV</span>
                </button>
              ) : null}

              <button onClick={() => { void handleExportCsv(); }} disabled={exporting} className="bg-[#1E293B] dark:bg-slate-700 text-white w-10 h-10 p-0 lg:w-auto lg:px-4 lg:py-2.5 rounded-full text-sm font-bold flex items-center justify-center transition-all shadow-sm disabled:opacity-50 shrink-0">
                <Download size={16} aria-hidden="true" /> <span className="hidden lg:inline ml-2">{exporting ? "..." : "Export"}</span>
              </button>
            </>
          )}

          <button onClick={openCreateModal} className="bg-[#3B82F6] text-white px-4 lg:px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-sm shrink-0 ml-auto sm:ml-0">
            <Plus size={16} aria-hidden="true" /> Add User
          </button>
        </div>
      </div>

      {/* SECTION: DATA TABLE */}
      {/* OPTIMIZED: Removed fixed min-w-[950px] so table can fully compress dynamically into portrait screens */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden transition-colors relative z-0 border border-slate-100 dark:border-slate-800/50 w-full">
        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 w-full">

          <table className="w-full text-sm whitespace-nowrap border-collapse min-w-full">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[11px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider">
                <th className="px-3 sm:px-5 py-5 text-left w-8">
                  <div
                    onClick={handleToggleSelectAll}
                    className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center cursor-pointer transition-colors ${allListedSelected
                      ? "bg-[#3B82F6] border-[#3B82F6]"
                      : someListedSelected
                        ? "bg-[#3B82F6] border-[#3B82F6]"
                        : "bg-white dark:bg-[#0F172A] border-slate-300 dark:border-slate-600 hover:border-[#3B82F6] dark:hover:border-[#3B82F6]"
                      } ${(loading || rows.length === 0 || deleting) ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {allListedSelected && <Check size={12} className="text-white" strokeWidth={3.5} />}
                    {!allListedSelected && someListedSelected && <Minus size={12} className="text-white" strokeWidth={3.5} />}
                  </div>
                </th>
                <th className="px-2 sm:px-3 py-5 text-left">Name</th>
                <th className="px-3 sm:px-4 py-5 text-left hidden lg:table-cell">Email Address</th>
                <th className="px-3 sm:px-4 py-5 text-left hidden md:table-cell">Batch</th>
                <th className="px-2 sm:px-4 py-5 text-left">Progress</th>
                <th className="px-2 sm:px-4 py-5 text-center">Status</th>
                <th className="px-3 sm:px-5 py-5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {rows.map((row) => {
                const actionLabel = row.raw.status === "active" ? "Deactivate" : "Reactivate";
                const isToggling = statusActionId === row.id;
                const isResending = resendActionId === row.id;
                const isSelected = selectedIds.has(row.numericId);

                return (
                  <tr
                    key={row.id}
                    onClick={() => handleToggleSelectOne(row.numericId, !isSelected)}
                    className={`group cursor-pointer select-none transition-colors border-y border-transparent ${isSelected ? 'bg-blue-50/80 dark:bg-[#3B82F6]/10 !border-blue-200 dark:!border-blue-900/50 relative z-10'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:border-slate-200 dark:hover:border-slate-700/50'
                      }`}
                  >
                    <td className="px-3 sm:px-5 py-4">
                      <div
                        onClick={(e) => { e.stopPropagation(); handleToggleSelectOne(row.numericId, !isSelected); }}
                        className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center cursor-pointer transition-colors ${isSelected
                          ? "bg-[#3B82F6] border-[#3B82F6] shadow-sm"
                          : "bg-white dark:bg-[#0F172A] border-slate-300 dark:border-slate-600 group-hover:border-[#3B82F6]/50"
                          } ${deleting ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <Check size={12} className={`text-white transition-transform ${isSelected ? "scale-100" : "scale-0"}`} strokeWidth={3.5} />
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold shrink-0">
                          {row.initials}
                        </div>
                        <div className="leading-tight">
                          {/* OPTIMIZED: Dynamic truncation ensures names shrink aggressively on small screens */}
                          <div className="font-extrabold text-[#0B1B3D] dark:text-slate-200 truncate max-w-[100px] sm:max-w-[140px] xl:max-w-[200px]">{row.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5 truncate max-w-[100px] sm:max-w-[140px] xl:max-w-[200px]">{row.raw.trainee_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-4 text-slate-500 dark:text-slate-400 font-medium text-xs hidden lg:table-cell">{row.raw.email}</td>
                    <td className="px-3 sm:px-4 py-4 text-slate-500 dark:text-slate-400 font-bold text-xs hidden md:table-cell">{row.raw.batch.batch_code}</td>
                    <td className="px-2 sm:px-4 py-4">
                      {/* OPTIMIZED: Dynamic width scales heavily on portrait */}
                      <div className="w-[70px] sm:w-[120px] lg:w-[140px] 2xl:w-[180px] group-hover:scale-105 transition-transform">
                        <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">
                          <span>{row.raw.progress.label}</span>
                          <span>{row.raw.progress.percent}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-[#18B9C7] rounded-full transition-all" style={{ width: `${row.raw.progress.percent}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-4 text-center">
                      <span className={`inline-flex items-center justify-center w-[70px] py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${statusPillClass(row.displayStatus)}`}>
                        {row.displayStatus}
                      </span>
                    </td>
                    <td className="px-3 sm:px-5 py-4 pr-6">
                      {/* OPTIMIZED: Full text buttons transform into sleek circular icon buttons ONLY on tablet/mobile screens */}
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditModal(row.raw); }}
                          disabled={deleting}
                          className="group/btn bg-[#1E293B] text-white p-2 xl:px-3 xl:py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm disabled:opacity-50"
                          title="Edit Trainee"
                        >
                          <Pencil size={14} className="shrink-0" />
                          <span className="hidden xl:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleToggleStatus(row.raw); }}
                          disabled={isToggling || deleting}
                          className={`group/btn ${row.raw.status === "active" ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#22C55E] hover:bg-[#16A34A]"} text-white p-2 xl:px-3 xl:py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm disabled:opacity-50`}
                          title={actionLabel}
                        >
                          {isToggling ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Power size={14} className="shrink-0" />}
                          <span className="hidden xl:inline">{isToggling ? "..." : actionLabel}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleResendCredentials(row.raw); }}
                          disabled={isResending || deleting}
                          className="group/btn bg-[#2E415F] text-white p-2 xl:px-3 xl:py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm disabled:opacity-50"
                          title="Resend Credentials"
                        >
                          {isResending ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Mail size={14} className="shrink-0" />}
                          <span className="hidden xl:inline">{isResending ? "..." : "Resend"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openDeleteModal([row.numericId]); }}
                          disabled={deleting}
                          className="text-slate-400 hover:text-red-500 p-1.5 xl:p-2 transition-colors disabled:opacity-50 shrink-0"
                          title="Delete Trainee"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-500 dark:text-slate-400">
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
                  <td colSpan={7} className="px-8 py-20 text-center">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E293B] shadow-2xl overflow-hidden transform transition-all scale-100 opacity-100 animate-in zoom-in-95">
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
                className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                className="px-8 py-2.5 rounded-full text-sm font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] shadow-lg shadow-red-500/20 transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <TraineeFormModal open={modalOpen} mode={modalMode} initial={selectedItem} batches={batches} onClose={closeModal} onSaved={handleSaved} />
      <CreateBatchModal open={createBatchModalOpen} onClose={closeCreateBatchModal} onCreated={handleBatchCreated} />
      <FinalizeBatchWizardModal open={finalizeModalOpen} batches={batches} initialBatchCode={selectedBatch} onClose={closeFinalizeModal} onResetCompleted={handleResetCompleted} />
      <GeneratedPasswordModal open={Boolean(generatedPasswordState)} email={generatedPasswordState?.email ?? ""} password={generatedPasswordState?.password ?? ""} onClose={closeGeneratedPasswordModal} />

      {ENABLE_CSV_IMPORT ? (
        <ImportTraineesModal open={importModalOpen} batches={batches} initialBatchCode={selectedBatch} onClose={closeImportModal} onImported={handleImported} />
      ) : null}

    </div>
  );
}