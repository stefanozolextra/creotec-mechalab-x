import { Download, Search, SearchX, Layers, MousePointerClick, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

// --- Helpers ---

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

// --- Main Component ---

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

  // Split-View State
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<Record<string, { loading: boolean; error: string | null; data: AdminTraineeModuleStatusItem[] }>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Clear selection if filters change
  useEffect(() => {
    setSelectedTraineeId(null);
  }, [debouncedSearch, selectedBatch, statusFilter]);

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
        numericId: Number(item.trainee_id),
        raw: item,
        displayStatus,
        fullName,
        initials: toInitials(fullName),
      };
    });
  }, [items]);

  const selectedTrainee = useMemo(() => {
    return rows.find(r => r.id === selectedTraineeId) || null;
  }, [rows, selectedTraineeId]);

  const handleSelectTrainee = async (traineeId: string) => {
    if (selectedTraineeId === traineeId) {
      setSelectedTraineeId(null); // Toggle off if clicked again
      return;
    }

    setSelectedTraineeId(traineeId);

    // Fetch module data if we haven't already cached it
    if (!moduleData[traineeId]) {
      setModuleData((prev) => ({ ...prev, [traineeId]: { loading: true, error: null, data: [] } }));
      try {
        const data = await getAdminTraineeModuleStatus(Number(traineeId));
        setModuleData((prev) => ({ ...prev, [traineeId]: { loading: false, error: null, data } }));
      } catch (err) {
        setModuleData((prev) => ({ ...prev, [traineeId]: { loading: false, error: toErrorMessage(err, "Failed to load modules"), data: [] } }));
      }
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

  const currentModuleData = selectedTraineeId ? moduleData[selectedTraineeId] : null;

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 relative w-full">

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0 animate-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* SECTION: TOOLBAR (Matched to UsersPage styling) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 z-20 w-full min-w-0">

        {/* Left Side: Search, Filters & Navigation Hint */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto flex-1 min-w-0">
          <div className="relative w-full sm:max-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trainees..."
              className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-full outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors shadow-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-1 sm:flex-none">
            {/* OPTIMIZED: Changed padding from px-4 to px-3 and exact widths to match Trainees Tab */}
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

          {/* HINT BANNER (Styled precisely like the Lessons Page) */}
          <div className="hidden xl:flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-[#1E293B]/30 text-xs select-none shadow-sm ml-2">
            <MousePointerClick size={14} className="text-[#3B82F6]" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              <strong className="text-slate-700 dark:text-slate-200 font-bold">Left-click</strong> a row <span className="opacity-80">to view modules</span>
            </span>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 justify-start sm:justify-end w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={() => { void handleExportModuleReportCsv(); }}
            disabled={!selectedBatch || exportingModuleReport}
            className="bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 lg:px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 shrink-0"
          >
            <Download size={16} aria-hidden="true" /> <span className="hidden lg:inline">Export Module Report</span>
          </button>
          <button
            type="button"
            onClick={() => { void handleExportCsv(); }}
            disabled={exporting}
            className="bg-[#1E293B] dark:bg-slate-700 text-white px-4 lg:px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 shrink-0"
          >
            <Download size={16} aria-hidden="true" /> <span className="hidden lg:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* SECTION: SPLIT VIEW CONTAINER */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 w-full">

        {/* LEFT PANEL: Master Table */}
        <div className="flex-[2] bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex flex-col min-h-0 overflow-hidden transition-colors duration-500 border border-slate-100 dark:border-slate-800/50 relative">
          <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-sm whitespace-nowrap border-collapse min-w-[550px]">
              {/* Header synchronized with UsersPage layout */}
              <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
                <tr className="text-[11px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider">
                  <th className="px-5 py-5 text-left">Name</th>
                  <th className="px-4 py-5 text-left">Batch</th>
                  <th className="px-4 py-5 text-left">Progress</th>
                  <th className="px-5 py-5 text-right pr-8">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
                {rows.map((row) => {
                  const isSelected = selectedTraineeId === row.id;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => void handleSelectTrainee(row.id)}
                      className={`group cursor-pointer transition-all duration-300 border-l-4 ${isSelected ? "bg-blue-50/60 dark:bg-[#3B82F6]/10 border-[#3B82F6]" : "border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:border-slate-300 dark:hover:border-slate-600"}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {/* Avatar fully matched to UsersPage */}
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 shrink-0 ${isSelected ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/30 border border-transparent" : "bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
                            {row.initials}
                          </div>
                          <div className="leading-tight">
                            {/* Text sizes fully matched to UsersPage */}
                            <div className="font-extrabold text-sm text-[#0B1B3D] dark:text-slate-200 transition-colors">{row.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{row.raw.trainee_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500 dark:text-slate-400 font-bold text-sm transition-colors duration-500">{row.raw.batch.batch_code}</td>
                      <td className="px-4 py-4">
                        {/* Progress Bar fully matched to UsersPage (140-180px width) */}
                        <div className="w-[140px] 2xl:w-[180px] group-hover:scale-105 transition-transform duration-300">
                          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">
                            <span>{row.raw.progress.label}</span>
                            <span>{row.raw.progress.percent}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden transition-colors duration-500">
                            <div className="h-full bg-[#18B9C7] rounded-full transition-all duration-500" style={{ width: `${row.raw.progress.percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right pr-8">
                        {/* Status Pill fully matched to UsersPage */}
                        <span className={`inline-flex items-center justify-center w-[80px] py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${statusPillClass(row.displayStatus)} transition-colors duration-500`}>
                          {row.displayStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-500 dark:text-slate-400 transition-colors duration-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <SearchX size={40} className="text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-lg text-[#0B1B3D] dark:text-slate-200">No trainees found.</p>
                        <p className="text-sm">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}

                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
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

        {/* RIGHT PANEL: Pure Module Details Sidebar (No Redundancies) */}
        <div className="flex-[1] min-w-[350px] max-w-md bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex flex-col min-h-[400px] overflow-hidden transition-colors duration-500 border border-slate-100 dark:border-slate-800/50">

          {selectedTrainee ? (
            <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">

              {/* Clean, Non-Redundant Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 shrink-0 flex items-center justify-between bg-slate-50/50 dark:bg-[#0B1120]/30">
                <h3 className="text-sm font-black text-[#0B1B3D] dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                  <Layers size={18} className="text-[#3B82F6]" /> Module Status
                </h3>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full shadow-sm truncate max-w-[150px]">
                  {selectedTrainee.fullName}
                </span>
              </div>

              {/* Scrollable Modules List */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 bg-slate-50/30 dark:bg-transparent">

                {currentModuleData?.loading && (
                  <div className="flex justify-center items-center gap-2 py-10">
                    <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}

                {currentModuleData?.error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-4 text-xs font-semibold text-red-600 dark:text-red-400 flex items-start gap-3">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{currentModuleData.error}</span>
                  </div>
                )}

                {currentModuleData?.data && !currentModuleData.loading && !currentModuleData.error && (
                  <div className="flex flex-col gap-3">
                    {currentModuleData.data.map((mod) => {
                      const moduleStatus = mod.module_status as ModuleStatus;
                      return (
                        <div key={mod.module_id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#0B1120]/30 hover:bg-white dark:hover:bg-[#1E293B] shadow-sm transition-colors">
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-sm text-[#0B1B3D] dark:text-slate-200 truncate">{mod.module_code}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{mod.module_title}</p>
                            </div>
                            <span className={`shrink-0 inline-flex items-center justify-center px-3 py-1 rounded-full text-[9px] font-black tracking-wide uppercase border ${moduleStatusPillClass(moduleStatus)}`}>
                              {formatModuleStatus(moduleStatus)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/50">
                            <span className="uppercase tracking-wider text-[10px]">Simulations</span>
                            <span><span className="text-[#3B82F6]">{mod.completed_required_sims}</span> / {mod.required_sims} Completed</span>
                          </div>
                        </div>
                      );
                    })}

                    {currentModuleData.data.length === 0 && (
                      <div className="text-center py-10 px-4 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-700/50 border-dashed">
                        <Layers size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No modules found for this trainee.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Empty State (No Trainee Selected)
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-transparent animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-blue-50 dark:bg-[#3B82F6]/10 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-[#1E293B] shadow-sm">
                <MousePointerClick size={32} className="text-[#3B82F6] ml-1 mt-1" />
              </div>
              <h3 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-200 mb-2">Module Details</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-[250px] leading-relaxed">
                Select a trainee from the list on the left to view their specific module completion progress.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}