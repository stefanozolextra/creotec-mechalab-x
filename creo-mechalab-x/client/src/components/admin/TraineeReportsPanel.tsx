import { Download, Search, SearchX, X, Layers, Activity } from "lucide-react";
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
  if (status === "Passed") return "bg-[#22C55E] text-white";
  if (status === "Active") return "bg-[#3B82F6] text-white";
  return "bg-[#64748B] text-white";
};

const moduleStatusPillClass = (status: ModuleStatus): string => {
  if (status === "COMPLETED") return "bg-[#22C55E] text-white border-transparent";
  if (status === "IN_PROGRESS") return "bg-blue-50 dark:bg-[#3B82F6]/10 text-[#3B82F6] border-blue-200 dark:border-blue-900/50";
  return "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700";
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

  // Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsTrainee, setDetailsTrainee] = useState<AdminTraineeItem | null>(null);
  const [detailsRows, setDetailsRows] = useState<AdminTraineeModuleStatusItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Animation State for Details Modal
  const [shouldRenderModal, setShouldRenderModal] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const detailsRequestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
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
    return () => { active = false; };
  }, [debouncedSearch, selectedBatch, statusFilter]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const displayStatus: PillStatus = item.progress.percent === 100 ? "Passed" : item.status === "active" ? "Active" : "Inactive";
      const fullName = toDisplayName(item);
      return {
        id: String(item.trainee_id),
        raw: item,
        displayStatus,
        fullName,
        initials: toInitials(fullName),
      };
    });
  }, [items]);

  // Handle Modal Animation
  useEffect(() => {
    let showTimer: number;
    let unmountTimer: number;

    if (detailsModalOpen) {
      setShouldRenderModal(true);
      showTimer = window.setTimeout(() => setIsModalVisible(true), 10);
    } else {
      setIsModalVisible(false);
      unmountTimer = window.setTimeout(() => setShouldRenderModal(false), 300);
    }

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [detailsModalOpen]);

  const closeDetailsModal = () => {
    detailsRequestIdRef.current += 1;
    setDetailsModalOpen(false);
    setTimeout(() => {
      setDetailsTrainee(null);
      setDetailsRows([]);
      setDetailsLoading(false);
      setDetailsError(null);
    }, 300);
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
          const data = (await response.json()) as { error?: string };
          if (typeof data?.error === "string" && data.error.trim()) message = data.error;
        } catch { /* no-op */ }
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
    if (!selectedBatch) { setError("Select a batch first to export module report."); return; }
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
    <div className="flex-1 flex flex-col gap-6 min-h-0 relative">

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0 animate-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* SECTION: TOOLBAR */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0 z-20">

        {/* Left Side: Search & Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trainees..."
              className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-[220px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm"
            />
          </div>

          <select
            value={selectedBatch}
            onChange={(event) => setSelectedBatch(event.target.value)}
            className="py-2.5 px-4 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold w-[160px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm cursor-pointer"
          >
            <option value="">All Batches</option>
            {batches.map((batch) => (
              <option key={batch.batch_id} value={batch.batch_code}>{batch.batch_code}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="py-2.5 px-4 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold w-[160px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => { void handleExportModuleReportCsv(); }}
            disabled={!selectedBatch || exportingModuleReport}
            className="bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" /> {exportingModuleReport ? "Exporting..." : "Export Module Report"}
          </button>
          <button
            type="button"
            onClick={() => { void handleExportCsv(); }}
            disabled={exporting}
            className="bg-[#1E293B] dark:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" /> {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* SECTION: DATA TABLE */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 relative z-0 border border-slate-100 dark:border-slate-800/50">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[12px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="px-8 py-6 text-left">Name</th>
                <th className="px-6 py-6 text-left">Email Address</th>
                <th className="px-6 py-6 text-left">Batch</th>
                <th className="px-6 py-6 text-left">Progress</th>
                <th className="px-6 py-6 text-center">Modules</th>
                <th className="px-6 py-6 text-center">Status</th>
                <th className="px-8 py-6 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {rows.map((row) => (
                <tr key={row.id} className="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-300">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold transition-colors duration-500">
                        {row.initials}
                      </div>
                      <div className="leading-tight">
                        <div className="font-extrabold text-[#0B1B3D] dark:text-slate-200 transition-colors">{row.fullName}</div>
                        <div className="text-xs text-slate-400 font-medium mt-0.5">{row.raw.trainee_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{row.raw.email}</td>
                  <td className="px-6 py-5 text-slate-500 dark:text-slate-400 font-bold transition-colors duration-500">{row.raw.batch.batch_code}</td>
                  <td className="px-6 py-5">
                    <div className="w-[160px] group-hover:scale-105 transition-transform duration-300">
                      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">
                        <span>{row.raw.progress.label}</span>
                        <span>{row.raw.progress.percent}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden transition-colors duration-500">
                        <div className="h-full bg-[#18B9C7] rounded-full transition-all duration-500" style={{ width: `${row.raw.progress.percent}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-bold transition-colors duration-500">
                    <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs transition-colors">
                      {row.raw.progress.completed_modules} / {row.raw.progress.total_modules}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center justify-center w-[90px] py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${statusPillClass(row.displayStatus)} transition-colors duration-500`}>
                      {row.displayStatus}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button
                      type="button"
                      onClick={() => { void handleViewDetails(row.raw); }}
                      className="bg-[#1E293B] dark:bg-slate-700 text-white px-5 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 shadow-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-500 dark:text-slate-400 transition-colors duration-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <SearchX size={40} className="text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-lg text-[#0B1B3D] dark:text-slate-200">No report rows found.</p>
                      <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
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
        </div>
      </div>

      {/* SECTION: SLEEK DETAILS MODAL */}
      {shouldRenderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">

          {/* Animated Backdrop */}
          <div
            className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isModalVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDetailsModal}
          />

          {/* Animated Modal Container */}
          <div className={`relative w-full max-w-4xl rounded-3xl bg-white dark:bg-[#1E293B] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all duration-300 ease-out ${isModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>

            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-[#3B82F6]/20 text-[#3B82F6] rounded-2xl">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100">Trainee Module Details</h2>
                    {detailsTrainee && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{toDisplayName(detailsTrainee)}</span> • {detailsTrainee.trainee_code}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDetailsModal}
                  className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">

              {detailsLoading ? (
                <div className="flex justify-center items-center gap-2 py-10">
                  <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : null}

              {detailsError ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-5 py-4 text-sm font-semibold text-red-600 dark:text-red-400">
                  {detailsError}
                </div>
              ) : null}

              {!detailsLoading && !detailsError && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr className="text-[11px] font-extrabold text-[#0B1B3D] dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/50">
                        <th className="px-6 py-4 text-left">Module</th>
                        <th className="px-4 py-4 text-center">Required Sims</th>
                        <th className="px-4 py-4 text-center">Completed</th>
                        <th className="px-6 py-4 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {detailsRows.map((row) => {
                        const moduleId = String(row.module_id);
                        const moduleStatus = row.module_status as ModuleStatus;
                        return (
                          <tr key={moduleId} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-300">
                            <td className="px-6 py-4">
                              <div className="font-bold text-[#0B1B3D] dark:text-slate-200">{row.module_code}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{row.module_title}</div>
                            </td>
                            <td className="px-4 py-4 text-center text-slate-600 dark:text-slate-300 font-bold">{row.required_sims}</td>
                            <td className="px-4 py-4 text-center text-[#3B82F6] font-black">{row.completed_required_sims}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[10px] font-black tracking-wide uppercase border ${moduleStatusPillClass(moduleStatus)}`}>
                                {formatModuleStatus(moduleStatus)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {detailsRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                            <Layers size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            No module status records found for this trainee.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={closeDetailsModal}
                className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-300 shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}