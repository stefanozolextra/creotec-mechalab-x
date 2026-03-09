import { Download, RotateCcw, Users, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAdminBatches } from "../../api/adminBatches";
import { API_BASE_URL, ApiError } from "../../api/http";
import FinalizeBatchWizardModal from "../../components/admin/FinalizeBatchWizardModal";
import AdminTableScroll from "../../components/admin/ui/AdminTableScroll";
import RowActionsMenu from "../../components/admin/ui/RowActionsMenu";
import type { AdminBatchItem } from "../../types/adminBatch";
import type { BatchFilter } from "../../types/adminTrainee";
import { getAuthToken } from "../../utils/auth";

const SELECTED_BATCH_STORAGE_KEY = "mechalabx.selectedBatchCode";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load cohorts.";
};

const parseFilenameFromHeader = (contentDisposition: string | null, fallback: string): string => {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (!match || !match[1]) return fallback;
  return match[1];
};

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

type CohortStatus = "Active" | "Recently Reset" | "Finalized" | "Empty";

const toCohortStatus = (item: AdminBatchItem, nowMs = Date.now()): CohortStatus => {
  if (item.trainee_count > 0) return "Active";
  if (!item.last_reset_at) return "Empty";

  const resetAtMs = new Date(item.last_reset_at).getTime();
  if (Number.isFinite(resetAtMs) && nowMs - resetAtMs <= SEVEN_DAYS_MS) {
    return "Recently Reset";
  }
  return "Finalized";
};

const cohortStatusClass = (status: CohortStatus): string => {
  if (status === "Active") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30";
  }
  if (status === "Recently Reset") {
    return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30";
  }
  if (status === "Finalized") {
    return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
};

const formatLifecycleTimestamp = (value: string | null): string => {
  if (!value) return "—";
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return "—";
  return asDate.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CohortsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportingBatchCode, setExportingBatchCode] = useState<string | null>(null);
  const [selectedBatchCode, setSelectedBatchCode] = useState("");
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizeBatchCode, setFinalizeBatchCode] = useState("");
  const [finalizeBusy, setFinalizeBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await listAdminBatches();
        if (!active) return;
        setItems(response.items);
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
  }, [refreshKey]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedBatchCode("");
      return;
    }

    if (selectedBatchCode) {
      const stillExists = items.some((item) => item.batch_code === selectedBatchCode);
      if (!stillExists) {
        setSelectedBatchCode("");
      }
      return;
    }

    const storedBatchCode = readStoredBatchCode();
    if (!storedBatchCode) return;

    const exists = items.some((item) => item.batch_code === storedBatchCode);
    if (exists) {
      setSelectedBatchCode(storedBatchCode);
    }
  }, [items, selectedBatchCode]);

  useEffect(() => {
    writeStoredBatchCode(selectedBatchCode);
  }, [selectedBatchCode]);

  const modalBatches = useMemo<BatchFilter[]>(
    () =>
      items.map((item) => ({
        batch_id: String(item.batch_id),
        batch_code: item.batch_code,
      })),
    [items]
  );

  const openFinalizeModal = (batchCode: string) => {
    if (finalizeModalOpen || finalizeBusy) return;
    setSelectedBatchCode(batchCode);
    setFinalizeBusy(false);
    setFinalizeBatchCode(batchCode);
    setFinalizeModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const closeFinalizeModal = () => {
    if (finalizeBusy) return;
    setFinalizeBusy(false);
    setFinalizeModalOpen(false);
  };

  const handleViewTrainees = (batchCode: string) => {
    setSelectedBatchCode(batchCode);
    navigate(`/admin/users?batch=${encodeURIComponent(batchCode)}`);
  };

  const handleExportBatch = async (batchCode: string) => {
    if (exportingBatchCode) return;
    setSelectedBatchCode(batchCode);

    const token = getAuthToken();
    if (!token) {
      setError("Unauthorized");
      return;
    }

    setExportingBatchCode(batchCode);
    setError(null);
    setSuccess(null);

    try {
      const query = new URLSearchParams({ batch_code: batchCode }).toString();
      const response = await fetch(`${API_BASE_URL}/api/admin/trainees/export-csv?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const data = (await response.json()) as { error?: string };
          if (typeof data?.error === "string" && data.error.trim()) {
            message = data.error;
          }
        } catch {
          // no-op
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const fallbackName = `trainees-${batchCode}.csv`;
      const fileName = parseFilenameFromHeader(response.headers.get("content-disposition"), fallbackName);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      setSuccess(`Exported ${batchCode} successfully.`);

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (exportError) {
      setError(toErrorMessage(exportError));
    } finally {
      setExportingBatchCode(null);
    }
  };

  const handleResetCompleted = (batchCode: string) => {
    setFinalizeBusy(false);
    setFinalizeModalOpen(false);
    setFinalizeBatchCode(batchCode);
    setSelectedBatchCode(batchCode);
    setRefreshKey((previous) => previous + 1);
    setSuccess(`Successfully finalized and reset batch ${batchCode}.`);
    setTimeout(() => setSuccess(null), 5000);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 relative">

      {/* ERROR & SUCCESS BANNERS */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0 animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-sm font-semibold text-emerald-700 shadow-sm shrink-0 animate-in fade-in slide-in-from-top-2">
          {success}
        </div>
      )}

      {/* SECTION: DATA TABLE */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 relative z-0 border border-slate-100 dark:border-slate-800/50">
        <AdminTableScroll className="flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="min-w-[980px] w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[13px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="px-8 py-6 text-left sticky left-0 z-20 bg-white dark:bg-[#1E293B]">Batch Code</th>
                <th className="px-6 py-6 text-center">Status</th>
                <th className="px-6 py-6 text-center">Trainees Enrolled</th>
                <th className="px-6 py-6 text-center">Last Export</th>
                <th className="px-6 py-6 text-center">Last Reset</th>
                <th className="px-8 py-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {items.map((item) => {
                const isExporting = exportingBatchCode === item.batch_code;
                const status = toCohortStatus(item);
                const isSelected = selectedBatchCode === item.batch_code;
                const isFinalizeLocked = finalizeModalOpen && finalizeBatchCode === item.batch_code;
                const stickyBatchCellClass = isSelected
                  ? "bg-blue-50/60 dark:bg-blue-500/10"
                  : "bg-white dark:bg-[#1E293B] group-hover:bg-slate-50 dark:group-hover:bg-white/[0.02]";
                return (
                  <tr
                    key={item.batch_code}
                    onClick={() => setSelectedBatchCode(item.batch_code)}
                    className={`group transition-colors duration-300 ${
                      isSelected
                        ? "bg-blue-50/60 dark:bg-blue-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className={`px-8 py-5 text-left font-bold text-[#0B1B3D] dark:text-slate-200 transition-colors duration-500 sticky left-0 z-[5] ${stickyBatchCellClass}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-[#3B82F6]/10 text-[#3B82F6] rounded-xl transition-colors duration-500">
                          <Layers size={18} />
                        </div>
                        {item.batch_code}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${cohortStatusClass(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">
                      <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors duration-500">
                        {item.trainee_count} {item.trainee_count === 1 ? 'Cadet' : 'Cadets'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors duration-500">
                      {formatLifecycleTimestamp(item.last_export_at)}
                    </td>
                    <td className="px-6 py-5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors duration-500">
                      {formatLifecycleTimestamp(item.last_reset_at)}
                    </td>
                    <td className="px-8 py-5">
                      <RowActionsMenu
                        actions={[
                          {
                            label: "View Trainees",
                            onClick: () => handleViewTrainees(item.batch_code),
                          },
                          {
                            label: isExporting ? "Exporting..." : "Export CSV",
                            onClick: () => { void handleExportBatch(item.batch_code); },
                            disabled: Boolean(exportingBatchCode),
                          },
                          {
                            label: isFinalizeLocked && finalizeBusy ? "Finalizing..." : "Finalize",
                            onClick: () => openFinalizeModal(item.batch_code),
                            disabled: finalizeBusy || isFinalizeLocked,
                          },
                        ]}
                      />
                      <div className="hidden sm:flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewTrainees(item.batch_code)}
                          className="bg-[#1E293B] dark:bg-slate-700 text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm"
                        >
                          <Users size={14} aria-hidden="true" /> View Trainees
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleExportBatch(item.batch_code); }}
                          disabled={Boolean(exportingBatchCode)}
                          className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm disabled:opacity-50"
                        >
                          <Download size={14} aria-hidden="true" /> {isExporting ? "Exporting..." : "Export CSV"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openFinalizeModal(item.batch_code)}
                          disabled={finalizeBusy || isFinalizeLocked}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 shadow-sm disabled:opacity-50"
                        >
                          <RotateCcw size={14} aria-hidden="true" /> {isFinalizeLocked && finalizeBusy ? "Finalizing..." : "Finalize"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-500 dark:text-slate-400 transition-colors duration-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Layers size={40} className="text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-lg text-[#0B1B3D] dark:text-slate-200">No cohorts found.</p>
                      <p className="text-sm">Create a batch from the Trainees page to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AdminTableScroll>
      </div>

      {/* MODAL */}
      <FinalizeBatchWizardModal
        open={finalizeModalOpen}
        batches={modalBatches}
        initialBatchCode={finalizeBatchCode}
        lockedBatchCode={finalizeBatchCode}
        onBusyChange={setFinalizeBusy}
        onClose={closeFinalizeModal}
        onResetCompleted={handleResetCompleted}
      />
    </div>
  );
}
