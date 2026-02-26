import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminActivityLogs } from "../../api/adminActivityLogs";
import { listAdminBatches } from "../../api/adminBatches";
import { getAdminDashboard } from "../../api/adminDashboard";
import { ApiError } from "../../api/http";
import { formatAdminFeedTime, toAdminFeedText } from "../../utils/adminFeed";
import type { AdminActivityLogItem } from "../../types/adminActivityLogs";
import type { AdminBatchItem } from "../../types/adminBatch";
import type { AdminDashboardResponse } from "../../types/adminDashboard";

const barColors = ["#93C5FD", "#5EEAD4", "#0B1B3D", "#60A5FA", "#C084FC", "#4ADE80"];
const SELECTED_BATCH_STORAGE_KEY = "mechalabx.selectedBatchCode";
const DASHBOARD_SCOPE_ALL_KEY = "__ALL__";
const DASHBOARD_FEED_LIMIT = 8;

const feedIconsByType: Record<string, string> = {
  batch_export: "📤",
  system_reset: "♻️",
};

const activityColorsByType: Record<string, string> = {
  batch_export: "bg-blue-400",
  system_reset: "bg-orange-400",
};

const emptyDashboard: AdminDashboardResponse = {
  generated_at: "",
  scope: { batch_code: null },
  summary: {
    total_trainees: 0,
    total_modules: 0,
    progress_percent: 0,
    completed_module_rows: 0,
    total_module_rows: 0,
  },
  chart: {
    kind: "module_completion_percent",
    points: [],
  },
  notifications: [],
  activities: [],
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

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load dashboard.";
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboardResponse>(emptyDashboard);
  const [feedItems, setFeedItems] = useState<AdminActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [batchOptions, setBatchOptions] = useState<AdminBatchItem[]>([]);
  const [selectedBatchCode, setSelectedBatchCode] = useState<string>(() => readStoredBatchCode());
  const isMountedRef = useRef(false);
  const hasLoadedBatchesRef = useRef(false);
  const lastDashboardRequestKeyRef = useRef<string | null>(null);
  const dashboardLoadControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      dashboardLoadControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    writeStoredBatchCode(selectedBatchCode);
  }, [selectedBatchCode]);

  useEffect(() => {
    if (hasLoadedBatchesRef.current) return;
    hasLoadedBatchesRef.current = true;

    const loadBatches = async () => {
      try {
        const response = await listAdminBatches();
        if (!isMountedRef.current) return;
        setBatchOptions(response.items);
        setSelectedBatchCode((currentValue) => {
          if (!currentValue) return "";
          const exists = response.items.some((item) => item.batch_code === currentValue);
          return exists ? currentValue : "";
        });
      } catch {
        if (!isMountedRef.current) return;
        setBatchOptions([]);
      }
    };

    void loadBatches();
  }, []);

  useEffect(() => {
    const requestKey = selectedBatchCode || DASHBOARD_SCOPE_ALL_KEY;
    if (lastDashboardRequestKeyRef.current === requestKey) return;
    lastDashboardRequestKeyRef.current = requestKey;

    dashboardLoadControllerRef.current?.abort();
    const controller = new AbortController();
    dashboardLoadControllerRef.current = controller;

    const load = async () => {
      setLoading(true);
      setError(null);
      setFeedError(null);

      const [dashboardResult, activityLogsResult] = await Promise.allSettled([
        getAdminDashboard(selectedBatchCode || undefined, { signal: controller.signal }),
        getAdminActivityLogs({
          batchCode: selectedBatchCode || undefined,
          limit: DASHBOARD_FEED_LIMIT,
          signal: controller.signal,
        }),
      ]);

      if (!isMountedRef.current) return;
      if (controller.signal.aborted) return;
      if (lastDashboardRequestKeyRef.current !== requestKey) return;

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value);
      } else {
        setDashboard(emptyDashboard);
        setError(toErrorMessage(dashboardResult.reason));
      }

      if (activityLogsResult.status === "fulfilled") {
        setFeedItems(activityLogsResult.value.items.slice(0, DASHBOARD_FEED_LIMIT));
      } else {
        setFeedItems([]);
        setFeedError(toErrorMessage(activityLogsResult.reason));
      }

      setLoading(false);
    };

    void load();
  }, [selectedBatchCode]);

  return (
    <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 lg:overflow-hidden">
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6 h-full min-h-0">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl px-4 py-3 shadow-sm transition-colors flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" htmlFor="dashboard-batch">
            Batch Scope
          </label>
          <select
            id="dashboard-batch"
            value={selectedBatchCode}
            onChange={(event) => setSelectedBatchCode(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-sm font-semibold text-slate-700 dark:text-slate-200 px-3 outline-none focus:ring-2 focus:ring-blue-400/50"
          >
            <option value="">All batches</option>
            {batchOptions.map((batch) => (
              <option key={batch.batch_id} value={batch.batch_code}>
                {batch.batch_code}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0">
            {error}
          </div>
        )}

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 text-sm font-semibold text-blue-700 shadow-sm shrink-0">
            Loading dashboard...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
          <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 shadow-sm flex justify-between items-start transition-colors">
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2 text-sm transition-colors uppercase tracking-wider">
                Trainees
              </div>
              <div className="text-5xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors tracking-tighter">
                {dashboard.summary.total_trainees}
              </div>
            </div>

            <button
              onClick={() => navigate("/admin/users")}
              className="bg-[#3B82F6] text-white p-3 rounded-2xl hover:scale-110 active:scale-95 shadow-lg shadow-blue-500/20 transition-all"
              title="Add New Trainee"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 shadow-sm transition-colors">
            <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2 text-sm transition-colors uppercase tracking-wider">
              Progress
            </div>
            <div className="text-5xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors tracking-tighter">
              {dashboard.summary.progress_percent}%
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 shadow-sm transition-colors">
            <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2 text-sm transition-colors uppercase tracking-wider">
              Modules
            </div>
            <div className="text-5xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors tracking-tighter">
              {String(dashboard.summary.total_modules).padStart(2, "0")}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-8 shadow-sm flex-1 flex flex-col min-h-0 transition-colors">
          <h2 className="text-xl font-bold text-[#0B1B3D] dark:text-slate-100 mb-8 shrink-0 transition-colors">
            Milestone Tracking
          </h2>

          <div className="flex-1 grid grid-cols-[40px_1fr] gap-4 min-h-0">
            <div className="flex flex-col justify-between text-slate-400 dark:text-slate-500 text-xs font-bold py-2">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>0%</span>
            </div>

            <div className="relative flex items-end justify-around pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              {dashboard.chart.points.length === 0 && !loading ? (
                <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-slate-400 dark:text-slate-500">
                  No modules available yet.
                </div>
              ) : (
                dashboard.chart.points.map((item, idx) => {
                  const completionPercent = Math.max(0, Math.min(100, item.completion_percent));
                  const visualHeight = Math.max(4, completionPercent);
                  const isDarkBar = idx === 2;
                  return (
                    <div key={item.module_id || idx} className="h-full flex flex-col justify-end w-8 sm:w-12 relative group">
                      <div
                        className={`w-full rounded-t-xl transition-all duration-500 hover:brightness-110 ${isDarkBar ? "bg-[#0B1B3D] dark:bg-slate-300" : ""}`}
                        style={{
                          height: `${visualHeight}%`,
                          backgroundColor: isDarkBar ? undefined : barColors[idx % barColors.length],
                        }}
                      />
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-16 left-1/2 -translate-x-1/2 bg-[#0B1B3D] dark:bg-slate-700 text-white text-[11px] py-1.5 px-2 rounded font-bold transition-opacity pointer-events-none whitespace-nowrap text-center leading-tight">
                        <div>{item.module_title || item.module_code}</div>
                        <div>{completionPercent}% complete</div>
                        <div>
                          {item.completed_trainees}/{item.total_trainees} trainees
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {!loading && dashboard.chart.points.length > 0 && dashboard.summary.total_trainees === 0 && (
            <p className="ml-[56px] mt-3 text-xs font-semibold text-slate-400 dark:text-slate-500">
              No trainees in this scope yet. Modules are shown at 0%.
            </p>
          )}

          <div className="ml-[56px] mt-4 flex justify-around text-slate-400 dark:text-slate-500 text-xs font-bold shrink-0">
            {dashboard.chart.points.map((item, idx) => (
              <div key={`${item.module_id}-${idx}`} className="text-center w-12 truncate" title={item.module_title || item.module_code}>
                {item.module_code || `M${idx + 1}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-1 lg:col-span-4 flex flex-col gap-6 h-full min-h-0">
        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 shadow-sm flex-1 flex flex-col min-h-0 transition-colors">
          <h3 className="text-[#0B1B3D] dark:text-slate-100 font-bold text-lg mb-4 shrink-0 transition-colors uppercase tracking-wider">
            Notifications
          </h3>
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            {feedError && !loading && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Activity feed unavailable.
              </p>
            )}
            {feedItems.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                {loading ? "Loading notifications..." : feedError ? "Feed unavailable." : "No recent notifications."}
              </p>
            ) : (
              feedItems.map((note, i) => (
                <div key={`${note.type}-${note.occurred_at}-${i}`} className="flex gap-4 items-start">
                  <div className="text-lg bg-slate-50 dark:bg-slate-800 p-2 rounded-full border border-slate-100 dark:border-slate-700 shrink-0 transition-colors">
                    {feedIconsByType[note.type] || "🔔"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0B1B3D] dark:text-slate-200 leading-tight transition-colors">
                      {toAdminFeedText(note)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">
                      {formatAdminFeedTime(note.occurred_at)}
                      {note.actor ? ` • ${note.actor}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 shadow-sm flex-1 flex flex-col min-h-0 transition-colors">
          <h3 className="text-[#0B1B3D] dark:text-slate-100 font-bold text-lg mb-4 shrink-0 transition-colors uppercase tracking-wider">
            Activities
          </h3>
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            {feedError && !loading && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Activity feed unavailable.
              </p>
            )}
            {feedItems.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                {loading ? "Loading activities..." : feedError ? "Feed unavailable." : "No recent activities."}
              </p>
            ) : (
              feedItems.map((act, i) => (
                <div key={`${act.type}-${act.occurred_at}-${i}`} className="flex gap-4 items-start">
                  <div
                    className={`w-8 h-8 rounded-full shadow-inner border border-white dark:border-[#1E293B] shrink-0 ${
                      activityColorsByType[act.type] || "bg-teal-400"
                    } transition-colors`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#0B1B3D] dark:text-slate-200 leading-tight transition-colors">
                      {toAdminFeedText(act)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">
                      {formatAdminFeedTime(act.occurred_at)}
                      {act.actor ? ` • ${act.actor}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
