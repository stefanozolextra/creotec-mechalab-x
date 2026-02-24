import { Download, RotateCcw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAdminBatches } from "../../api/adminBatches";
import { API_BASE_URL, ApiError } from "../../api/http";
import FinalizeBatchWizardModal from "../../components/admin/FinalizeBatchWizardModal";
import type { AdminBatchItem } from "../../types/adminBatch";
import type { BatchFilter } from "../../types/adminTrainee";
import { getAuthToken } from "../../utils/auth";

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

export default function CohortsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportingBatchCode, setExportingBatchCode] = useState<string | null>(null);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizeBatchCode, setFinalizeBatchCode] = useState("");

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

  const modalBatches = useMemo<BatchFilter[]>(
    () =>
      items.map((item) => ({
        batch_id: String(item.batch_id),
        batch_code: item.batch_code,
      })),
    [items]
  );

  const openFinalizeModal = (batchCode: string) => {
    setFinalizeBatchCode(batchCode);
    setFinalizeModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const closeFinalizeModal = () => {
    setFinalizeModalOpen(false);
  };

  const handleViewTrainees = (batchCode: string) => {
    navigate(`/admin/users?batch=${encodeURIComponent(batchCode)}`);
  };

  const handleExportBatch = async (batchCode: string) => {
    if (exportingBatchCode) return;

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

      setSuccess(`Exported ${batchCode}.`);
    } catch (exportError) {
      setError(toErrorMessage(exportError));
    } finally {
      setExportingBatchCode(null);
    }
  };

  const handleResetCompleted = () => {
    setRefreshKey((previous) => previous + 1);
    setSuccess(`Finalized ${finalizeBatchCode}.`);
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr className="text-xs font-extrabold text-slate-700 border-b border-black/20">
              <th className="px-6 py-4 text-left">BATCH CODE</th>
              <th className="px-4 py-4 text-left">TRAINEES</th>
              <th className="px-6 py-4 text-left">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {items.map((item) => {
              const isExporting = exportingBatchCode === item.batch_code;
              return (
                <tr key={item.batch_code} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold">{item.batch_code}</td>
                  <td className="px-4 py-4">{item.trainee_count}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleViewTrainees(item.batch_code)}
                        className="bg-slate-500 hover:bg-slate-600 text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2"
                      >
                        <Users size={16} aria-hidden="true" /> View Trainees
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleExportBatch(item.batch_code);
                        }}
                        disabled={Boolean(exportingBatchCode)}
                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-1.5 rounded-md font-semibold flex items-center gap-2 disabled:opacity-60"
                      >
                        <Download size={16} aria-hidden="true" /> {isExporting ? "Exporting..." : "Export CSV"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openFinalizeModal(item.batch_code)}
                        className="bg-[#8B1E2D] text-white hover:bg-[#721826] px-5 py-1.5 rounded-md font-semibold flex items-center gap-2"
                      >
                        <RotateCcw size={16} aria-hidden="true" /> Finalize
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                  No batches found.
                </td>
              </tr>
            ) : null}

            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                  Loading batches...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <FinalizeBatchWizardModal
        open={finalizeModalOpen}
        batches={modalBatches}
        initialBatchCode={finalizeBatchCode}
        onClose={closeFinalizeModal}
        onResetCompleted={handleResetCompleted}
      />
    </div>
  );
}
