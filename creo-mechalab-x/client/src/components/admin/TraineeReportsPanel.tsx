import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportModuleStatusCsv,
  getAdminTraineeModuleStatus,
  listAdminTraineesReport,
  type AdminTraineeModuleStatusItem,
} from "../../api/adminReports";
import { API_BASE_URL, ApiError } from "../../api/http";
import type { AdminTraineeItem, BatchFilter } from "../../types/adminTrainee";
import { getAuthToken } from "../../utils/auth";

type StatusFilter = "all" | "active" | "inactive";
type PillStatus = "Passed" | "Active" | "Inactive";
type ModuleStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

const statusPillClass = (status: PillStatus): string => {
  if (status === "Passed") return "bg-emerald-500 text-white";
  if (status === "Active") return "bg-[#151F8C] text-white";
  return "bg-[#EC5151] text-white";
};

const moduleStatusPillClass = (status: ModuleStatus): string => {
  if (status === "COMPLETED") return "bg-emerald-500 text-white";
  if (status === "IN_PROGRESS") return "bg-[#151F8C] text-white";
  return "bg-slate-400 text-white";
};

const toDisplayName = (item: AdminTraineeItem): string => {
  const middle = item.middle_name ? ` ${item.middle_name}` : "";
  return `${item.first_name}${middle} ${item.last_name}`.replace(/\s+/g, " ").trim();
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const parseFilenameFromHeader = (contentDisposition: string | null, fallback: string): string => {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (!match || !match[1]) return fallback;
  return match[1];
};

const formatModuleStatus = (status: ModuleStatus): string => {
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "NOT_STARTED") return "Not Started";
  return "Completed";
};

const formatModuleExportFileName = (batchCode: string, value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `module-status_${batchCode}_${year}${month}${day}-${hours}${minutes}.csv`;
};

export default function TraineeReportsPanel() {
  const [items, setItems] = useState<AdminTraineeItem[]>([]);
  const [batches, setBatches] = useState<BatchFilter[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingModuleReport, setExportingModuleReport] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsTrainee, setDetailsTrainee] = useState<AdminTraineeItem | null>(null);
  const [detailsRows, setDetailsRows] = useState<AdminTraineeModuleStatusItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const detailsRequestIdRef = useRef(0);

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
        const response = await listAdminTraineesReport({
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
        setError(toErrorMessage(loadError, "Failed to load reports."));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [debouncedSearch, selectedBatch, statusFilter]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const displayStatus: PillStatus =
        item.progress.percent === 100 ? "Passed" : item.status === "active" ? "Active" : "Inactive";

      return {
        id: String(item.trainee_id),
        raw: item,
        displayStatus,
        fullName: toDisplayName(item),
      };
    });
  }, [items]);

  const closeDetailsModal = () => {
    detailsRequestIdRef.current += 1;
    setDetailsModalOpen(false);
    setDetailsTrainee(null);
    setDetailsRows([]);
    setDetailsLoading(false);
    setDetailsError(null);
  };

  const handleViewDetails = async (item: AdminTraineeItem) => {
    const traineeId = Number(item.trainee_id);
    if (!Number.isInteger(traineeId) || traineeId < 1) {
      setDetailsModalOpen(true);
      setDetailsTrainee(item);
      setDetailsRows([]);
      setDetailsLoading(false);
      setDetailsError("Invalid trainee id.");
      return;
    }

    const requestId = detailsRequestIdRef.current + 1;
    detailsRequestIdRef.current = requestId;

    setDetailsModalOpen(true);
    setDetailsTrainee(item);
    setDetailsRows([]);
    setDetailsError(null);
    setDetailsLoading(true);

    try {
      const moduleRows = await getAdminTraineeModuleStatus(traineeId);
      if (detailsRequestIdRef.current !== requestId) return;
      setDetailsRows(moduleRows);
    } catch (loadError) {
      if (detailsRequestIdRef.current !== requestId) return;
      setDetailsError(toErrorMessage(loadError, "Failed to load module details."));
    } finally {
      if (detailsRequestIdRef.current === requestId) setDetailsLoading(false);
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
      const fallbackName = `trainees-${selectedBatch || "all"}.csv`;
      const fileName = parseFilenameFromHeader(response.headers.get("content-disposition"), fallbackName);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      setError(toErrorMessage(exportError, "Failed to export CSV."));
    } finally {
      setExporting(false);
    }
  };

  const handleExportModuleReportCsv = async () => {
    if (exportingModuleReport) return;
    if (!selectedBatch) {
      setError("Select a batch first to export module report.");
      return;
    }

    setExportingModuleReport(true);
    setError(null);

    try {
      const blob = await exportModuleStatusCsv(selectedBatch);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = formatModuleExportFileName(selectedBatch);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      setError(toErrorMessage(exportError, "Failed to export module report."));
    } finally {
      setExportingModuleReport(false);
    }
  };

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
            onClick={() => {
              void handleExportModuleReportCsv();
            }}
            disabled={!selectedBatch || exportingModuleReport}
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-6 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            <Download size={18} aria-hidden="true" /> {exportingModuleReport ? "Exporting..." : "Export Module Report"}
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
              <th className="px-4 py-4 text-left">TRAINEE CODE</th>
              <th className="px-4 py-4 text-left">EMAIL</th>
              <th className="px-4 py-4 text-left">BATCH</th>
              <th className="px-4 py-4 text-left">PROGRESS %</th>
              <th className="px-4 py-4 text-left">COMPLETED MODULES</th>
              <th className="px-4 py-4 text-left">STATUS</th>
              <th className="px-6 py-4 text-left">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/10">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold">{row.fullName}</td>
                <td className="px-4 py-4">{row.raw.trainee_code}</td>
                <td className="px-4 py-4">{row.raw.email}</td>
                <td className="px-4 py-4">{row.raw.batch.batch_code}</td>
                <td className="px-4 py-4">
                  <div className="w-[180px]">
                    <div className="text-xs text-slate-700 font-semibold">{row.raw.progress.percent}%</div>
                    <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#18B9C7]" style={{ width: `${row.raw.progress.percent}%` }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {row.raw.progress.completed_modules}/{row.raw.progress.total_modules}
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
                  <button
                    type="button"
                    onClick={() => {
                      void handleViewDetails(row.raw);
                    }}
                    className="bg-slate-500 hover:bg-slate-600 text-white px-5 py-1.5 rounded-md font-semibold disabled:opacity-60"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                  No report rows found.
                </td>
              </tr>
            ) : null}

            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                  Loading reports...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detailsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-lg bg-white border border-black/10 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Trainee Module Details</h2>
                {detailsTrainee ? (
                  <p className="text-sm text-slate-500 mt-1">
                    {toDisplayName(detailsTrainee)} • {detailsTrainee.trainee_code}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDetailsModal}
                className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="p-6">
              {detailsLoading ? <p className="text-sm text-slate-500">Loading module status...</p> : null}

              {detailsError ? <p className="text-sm font-semibold text-red-600">{detailsError}</p> : null}

              {!detailsLoading && !detailsError ? (
                <div className="rounded-lg border border-black/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-white">
                      <tr className="text-xs font-extrabold text-slate-700 border-b border-black/20">
                        <th className="px-6 py-4 text-left">MODULE</th>
                        <th className="px-4 py-4 text-left">REQUIRED SIMS</th>
                        <th className="px-4 py-4 text-left">COMPLETED</th>
                        <th className="px-6 py-4 text-left">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {detailsRows.map((row) => {
                        const moduleId = String(row.module_id);
                        const moduleStatus = row.module_status as ModuleStatus;
                        return (
                          <tr key={moduleId} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="font-semibold">{row.module_code}</div>
                              <div className="text-xs text-slate-500">{row.module_title}</div>
                            </td>
                            <td className="px-4 py-4">{row.required_sims}</td>
                            <td className="px-4 py-4">{row.completed_required_sims}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold ${moduleStatusPillClass(
                                  moduleStatus
                                )}`}
                              >
                                {formatModuleStatus(moduleStatus)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {detailsRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                            No module status records found for this trainee.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
