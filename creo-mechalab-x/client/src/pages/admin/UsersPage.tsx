import { Search, Plus, Upload, Pencil, Power, Download, Layers, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listAdminTrainees, setAdminTraineeStatus } from "../../api/adminTrainees";
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
  if (status === "Passed") return "bg-emerald-500 text-white";
  if (status === "Active") return "bg-[#151F8C] text-white";
  return "bg-[#EC5151] text-white";
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

const ENABLE_CSV_IMPORT = String(import.meta.env.VITE_ENABLE_CSV_IMPORT ?? "false").toLowerCase() === "true";

export default function UsersPage() {
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
  const [generatedPasswordState, setGeneratedPasswordState] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

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

    return () => {
      active = false;
    };
  }, [debouncedSearch, selectedBatch, statusFilter, refreshKey]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const displayStatus: PillStatus =
        item.progress.percent === 100 ? "Passed" : item.status === "active" ? "Active" : "Inactive";
      const fullName = toDisplayName(item);
      const id = String(item.trainee_id);

      return {
        id,
        raw: item,
        displayStatus,
        fullName,
        initials: toInitials(fullName),
      };
    });
  }, [items]);

  const openCreateModal = () => {
    setSelectedItem(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEditModal = (item: AdminTraineeItem) => {
    setSelectedItem(item);
    setModalMode("edit");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const refreshBatchFilters = async (): Promise<BatchFilter[]> => {
    const response = await getAdminBatches();
    setBatches(response.items);
    return response.items;
  };

  const openCreateBatchModal = () => {
    setCreateBatchModalOpen(true);
  };

  const closeCreateBatchModal = () => {
    setCreateBatchModalOpen(false);
  };

  const openFinalizeModal = () => {
    setFinalizeModalOpen(true);
  };

  const closeFinalizeModal = () => {
    setFinalizeModalOpen(false);
  };

  const openImportModal = () => {
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
  };

  const handleSaved = (result: TraineeFormSaveResult) => {
    setModalOpen(false);
    setSelectedItem(null);
    setRefreshKey((prev) => prev + 1);

    if (result.mode === "create" && result.generated_password) {
      setGeneratedPasswordState({
        email: result.item.email,
        password: result.generated_password,
      });
    }
  };

  const closeGeneratedPasswordModal = () => {
    setGeneratedPasswordState(null);
  };

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
    try {
      await refreshBatchFilters();
      setSelectedBatch("");
    } catch (refreshError) {
      setError(toErrorMessage(refreshError));
    }
  };

  const handleImported = (batchCode: string, refreshedBatches: BatchFilter[]) => {
    setBatches(refreshedBatches);
    setSelectedBatch(batchCode);
    setRefreshKey((prev) => prev + 1);
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

  const handleExportCsv = async () => {
    if (exporting) return;

    const token = getAuthToken();
    if (!token) {
      setError("Unauthorized");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (selectedBatch) {
        searchParams.set("batch_code", selectedBatch);
      }
      const queryString = searchParams.toString();
      const url = `${API_BASE_URL}/api/admin/trainees/export-csv${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const data = await response.json();
          if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
            message = data.error;
          }
        } catch {
          // no-op
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const datePart = new Date().toISOString().slice(0, 10);
      link.href = objectUrl;
      link.download = `trainees-${selectedBatch || "all"}-${datePart}.csv`;
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

  // Derived state for pending trainees only
  const pendingTrainees = useMemo(() => mockUsers.filter(u => u.status === 'Pending'), []);

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  // --- ADD MODAL HANDLERS ---
  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setTimeout(() => setIsModalVisible(true), 10);
  };

  const handleCloseAddModal = () => {
    setIsModalVisible(false);
    setTimeout(() => {
      setIsAddModalOpen(false);
      setTraineesToAdd([{ name: '', email: '' }]);
    }, 300);
  };

  const handleCountChange = (newCount: number) => {
    const count = Math.max(1, Math.min(50, newCount));
    const updated = [...traineesToAdd];
    if (count > updated.length) {
      while (updated.length < count) updated.push({ name: '', email: '' });
    } else {
      updated.length = count;
    }
    setTraineesToAdd(updated);
  };

  const handleTraineeAddChange = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...traineesToAdd];
    updated[index][field] = value;
    setTraineesToAdd(updated);
  };

  // --- EDIT MODAL HANDLERS ---
  const handleOpenEditModal = () => {
    const selectedData = mockUsers
      .filter(u => selectedRows.includes(u.id))
      .map(u => ({ id: u.id, name: u.name, email: u.email }));

    setTraineesToEdit(selectedData);
    setIsEditModalOpen(true);
    setTimeout(() => setIsEditModalVisible(true), 10);
  };

  const handleCloseEditModal = () => {
    setIsEditModalVisible(false);
    setTimeout(() => {
      setIsEditModalOpen(false);
      setTraineesToEdit([]);
    }, 300);
  };

  const handleTraineeEditChange = (id: string, field: 'name' | 'email', value: string) => {
    setTraineesToEdit(prev =>
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  // --- EMAIL MODAL HANDLERS (NEW) ---
  const handleOpenEmailModal = () => {
    // Pre-select everyone who is pending to save the admin time
    setSelectedPending(pendingTrainees.map(t => t.id));
    setIsEmailModalOpen(true);
    setTimeout(() => setIsEmailModalVisible(true), 10);
  };

  const handleCloseEmailModal = () => {
    setIsEmailModalVisible(false);
    setTimeout(() => {
      setIsEmailModalOpen(false);
      setSelectedPending([]);
    }, 300);
  };

  const handleTogglePendingTrainee = (id: string) => {
    setSelectedPending(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const statusOptions: ('All' | UserStatus)[] = ['All', 'Active', 'Inactive', 'Done', 'Pending'];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border border-black/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search trainees..."
              className="pl-10 pr-4 py-2 rounded-md border border-slate-400 w-[260px] outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <select
            value={selectedBatch}
            onChange={(event) => setSelectedBatch(event.target.value)}
            className="py-2 px-3 rounded-md border border-slate-400 w-[180px] outline-none focus:ring-2 focus:ring-slate-300 font-semibold"
          >
            <option value="">All Batches</option>
            {batches.map((batch) => (
              <option key={batch.batch_id} value={batch.batch_code}>
                {batch.batch_code}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="py-2 px-3 rounded-md border border-slate-400 w-[180px] outline-none focus:ring-2 focus:ring-slate-300 font-semibold"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-[#2E415F] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <Plus size={18} aria-hidden="true" /> Add User
          </button>
          <button
            type="button"
            onClick={openCreateBatchModal}
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <Layers size={18} aria-hidden="true" /> Create Batch
          </button>
          <button
            type="button"
            onClick={() => {
              void handleExportCsv();
            }}
            disabled={exporting}
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            <Download size={18} aria-hidden="true" /> {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={openFinalizeModal}
            className="bg-[#8B1E2D] text-white hover:bg-[#721826] px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <RotateCcw size={18} aria-hidden="true" /> Finalize Batch
          </button>
          {ENABLE_CSV_IMPORT ? (
            <button
              type="button"
              onClick={openImportModal}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
            >
              <Upload size={18} aria-hidden="true" /> Import CSV
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr className="text-xs font-extrabold text-slate-700 border-b border-black/20">
              <th className="px-6 py-4 text-left">NAME</th>
              <th className="px-4 py-4 text-left">STUDENT ID</th>
              <th className="px-4 py-4 text-left">EMAIL ADDRESS</th>
              <th className="px-4 py-4 text-left">BATCH</th>
              <th className="px-4 py-4 text-left">PROGRESS</th>
              <th className="px-4 py-4 text-left">STATUS</th>
              <th className="px-6 py-4 text-left">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/10">
            {rows.map((row) => {
              const actionLabel = row.raw.status === "active" ? "Deactivate" : "Reactivate";
              const actionClass =
                row.raw.status === "active"
                  ? "bg-[#EC5151] hover:bg-[#d94545]"
                  : "bg-emerald-600 hover:bg-emerald-700";
              const isToggling = statusActionId === row.id;

              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 grid place-items-center text-slate-600">
                        {row.initials}
                      </div>
                      <div className="leading-tight">
                        <div className="font-semibold">{row.fullName}</div>
                        <div className="text-xs text-slate-400">{row.raw.trainee_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{row.raw.trainee_code}</td>
                  <td className="px-4 py-4">{row.raw.email}</td>
                  <td className="px-4 py-4">{row.raw.batch.batch_code}</td>
                  <td className="px-4 py-4">
                    <div className="w-[220px]">
                      <div className="flex justify-between text-xs text-slate-700 font-semibold">
                        <span>{row.raw.progress.label}</span>
                      </div>
                      <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#18B9C7]" style={{ width: `${row.raw.progress.percent}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center justify-center px-5 py-1.5 rounded-full text-xs font-bold ${statusPillClass(
                        row.displayStatus
                      )}`}
                    >
                      {row.displayStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(row.raw)}
                        className="bg-slate-500 hover:bg-slate-600 text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2"
                      >
                        <Pencil size={16} aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleStatus(row.raw);
                        }}
                        className={`${actionClass} text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2 disabled:opacity-60`}
                        disabled={isToggling}
                      >
                        <Power size={16} aria-hidden="true" />
                        {isToggling ? "Saving..." : actionLabel}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  Loading trainees...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TraineeFormModal
        open={modalOpen}
        mode={modalMode}
        initial={selectedItem}
        batches={batches}
        onClose={closeModal}
        onSaved={handleSaved}
      />

      <CreateBatchModal open={createBatchModalOpen} onClose={closeCreateBatchModal} onCreated={handleBatchCreated} />

      <FinalizeBatchWizardModal
        open={finalizeModalOpen}
        batches={batches}
        initialBatchCode={selectedBatch}
        onClose={closeFinalizeModal}
        onResetCompleted={handleResetCompleted}
      />

      <GeneratedPasswordModal
        open={Boolean(generatedPasswordState)}
        email={generatedPasswordState?.email ?? ""}
        password={generatedPasswordState?.password ?? ""}
        onClose={closeGeneratedPasswordModal}
      />

      {ENABLE_CSV_IMPORT ? (
        <ImportTraineesModal
          open={importModalOpen}
          batches={batches}
          initialBatchCode={selectedBatch}
          onClose={closeImportModal}
          onImported={handleImported}
        />
      ) : null}
    </div>
  );
}