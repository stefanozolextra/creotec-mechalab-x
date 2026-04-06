import { Users, Activity, BookOpen, Bell, History, ArrowRight, AlertTriangle, Loader2, Filter } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import TutorialGuide, { type TutorialStep } from "../../components/TutorialGuide";
import { useNavigate } from "react-router-dom";
import { getAdminActivityLogs, getAdminTraineeProgressActivityLogs } from "../../api/adminActivityLogs";
import { listAdminBatches } from "../../api/adminBatches";
import { getAdminDashboard } from "../../api/adminDashboard";
import { ApiError } from "../../api/http";
import { formatAdminFeedTime, toAdminFeedText } from "../../utils/adminFeed";
import type { AdminActivityLogItem, AdminTraineeProgressLogItem } from "../../types/adminActivityLogs";
import type { AdminBatchItem } from "../../types/adminBatch";
import type { AdminDashboardResponse } from "../../types/adminDashboard";

const barColors = ["#3B82F6", "#06B6D4", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];
const SELECTED_BATCH_STORAGE_KEY = "mechalabx.selectedBatchCode";
const DASHBOARD_SCOPE_ALL_KEY = "__ALL__";
const DASHBOARD_FEED_DISPLAY_LIMIT = 10;
const DASHBOARD_FEED_FETCH_LIMIT = 20;
const DASHBOARD_ACTIVITY_PREVIEW_LIMIT = 8;

const feedIconsByType: Record<string, string> = {
  batch_export: "📤",
  system_reset: "♻️",
};

const activityColorsByType: Record<string, string> = {
  batch_export: "bg-blue-400",
  system_reset: "bg-orange-400",
  simulation_completed: "bg-emerald-400",
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
  const [activityPreviewItems, setActivityPreviewItems] = useState<AdminTraineeProgressLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityPreviewLoading, setActivityPreviewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [activityPreviewError, setActivityPreviewError] = useState<string | null>(null);
  const [reloadSeq, setReloadSeq] = useState(0);
  const [feedRetrying, setFeedRetrying] = useState(false);
  const [activityPreviewRetrying, setActivityPreviewRetrying] = useState(false);
  const [batchOptions, setBatchOptions] = useState<AdminBatchItem[]>([]);

  const [selectedBatch, setSelectedBatch] = useState<string>(() => readStoredBatchCode());

  const isMountedRef = useRef(false);
  const hasLoadedBatchesRef = useRef(false);
  const lastDashboardRequestKeyRef = useRef<string | null>(null);
  const dashboardLoadControllerRef = useRef<AbortController | null>(null);
  const feedRetryControllerRef = useRef<AbortController | null>(null);
  const feedRetryRequestKeyRef = useRef<string | null>(null);
  const activityPreviewLoadControllerRef = useRef<AbortController | null>(null);
  const activityPreviewRetryControllerRef = useRef<AbortController | null>(null);
  const activityPreviewRequestKeyRef = useRef<string | null>(null);
  const activityPreviewRetryRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      dashboardLoadControllerRef.current?.abort();
      feedRetryControllerRef.current?.abort();
      activityPreviewLoadControllerRef.current?.abort();
      activityPreviewRetryControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    writeStoredBatchCode(selectedBatch);
  }, [selectedBatch]);

  useEffect(() => {
    if (hasLoadedBatchesRef.current) return;
    hasLoadedBatchesRef.current = true;

    const loadBatches = async () => {
      try {
        const response = await listAdminBatches();
        if (!isMountedRef.current) return;
        setBatchOptions(response.items);
        setSelectedBatch((currentValue) => {
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
    const requestKey = `${selectedBatch || DASHBOARD_SCOPE_ALL_KEY}|${reloadSeq}`;
    if (lastDashboardRequestKeyRef.current === requestKey) return;
    lastDashboardRequestKeyRef.current = requestKey;

    dashboardLoadControllerRef.current?.abort();
    feedRetryControllerRef.current?.abort();
    const controller = new AbortController();
    dashboardLoadControllerRef.current = controller;

    const load = async () => {
      setLoading(true);
      setError(null);
      setFeedError(null);

      const [dashboardResult, activityLogsResult] = await Promise.allSettled([
        getAdminDashboard(selectedBatch || undefined, { signal: controller.signal }),
        getAdminActivityLogs({
          batchCode: selectedBatch || undefined,
          limit: DASHBOARD_FEED_FETCH_LIMIT,
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
        setFeedItems(activityLogsResult.value.items);
      } else {
        setFeedItems([]);
        setFeedError(toErrorMessage(activityLogsResult.reason));
      }

      setLoading(false);
    };

    void load();
  }, [selectedBatch, reloadSeq]);

  useEffect(() => {
    const requestKey = `${selectedBatch || DASHBOARD_SCOPE_ALL_KEY}|activity-preview`;
    activityPreviewRequestKeyRef.current = requestKey;

    activityPreviewLoadControllerRef.current?.abort();
    activityPreviewRetryControllerRef.current?.abort();
    const controller = new AbortController();
    activityPreviewLoadControllerRef.current = controller;

    const loadPreview = async () => {
      setActivityPreviewLoading(true);
      setActivityPreviewRetrying(false);
      setActivityPreviewError(null);
      setActivityPreviewItems([]);

      try {
        const response = await getAdminTraineeProgressActivityLogs({
          batchCode: selectedBatch || undefined,
          limit: DASHBOARD_ACTIVITY_PREVIEW_LIMIT,
          signal: controller.signal,
        });
        if (!isMountedRef.current || controller.signal.aborted) return;
        if (activityPreviewRequestKeyRef.current !== requestKey) return;
        setActivityPreviewItems(response.items);
      } catch (previewError) {
        if (!isMountedRef.current || controller.signal.aborted) return;
        if (activityPreviewRequestKeyRef.current !== requestKey) return;
        setActivityPreviewItems([]);
        setActivityPreviewError(toErrorMessage(previewError));
      } finally {
        if (
          isMountedRef.current &&
          !controller.signal.aborted &&
          activityPreviewRequestKeyRef.current === requestKey
        ) {
          setActivityPreviewLoading(false);
          setActivityPreviewRetrying(false);
        }
      }
    };

    void loadPreview();
  }, [selectedBatch]);

  const handleRetry = () => {
    setReloadSeq((current) => current + 1);
  };

  const handleRetryFeed = async () => {
    const requestKey = `${selectedBatch || DASHBOARD_SCOPE_ALL_KEY}|feed-retry|${Date.now()}`;
    feedRetryRequestKeyRef.current = requestKey;

    feedRetryControllerRef.current?.abort();
    const controller = new AbortController();
    feedRetryControllerRef.current = controller;

    setFeedRetrying(true);
    setFeedError(null);

    try {
      const response = await getAdminActivityLogs({
        batchCode: selectedBatch || undefined,
        limit: DASHBOARD_FEED_FETCH_LIMIT,
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) return;
      if (feedRetryRequestKeyRef.current !== requestKey) return;
      setFeedItems(response.items);
    } catch (retryError) {
      if (!isMountedRef.current || controller.signal.aborted) return;
      if (feedRetryRequestKeyRef.current !== requestKey) return;
      setFeedError(toErrorMessage(retryError));
    } finally {
      if (isMountedRef.current && !controller.signal.aborted && feedRetryRequestKeyRef.current === requestKey) {
        setFeedRetrying(false);
      }
    }
  };

  const handleRetryActivityPreview = async () => {
    const requestKey = `${selectedBatch || DASHBOARD_SCOPE_ALL_KEY}|activity-preview-retry|${Date.now()}`;
    activityPreviewRetryRequestKeyRef.current = requestKey;

    activityPreviewLoadControllerRef.current?.abort();
    activityPreviewRetryControllerRef.current?.abort();
    const controller = new AbortController();
    activityPreviewRetryControllerRef.current = controller;

    setActivityPreviewRetrying(true);
    setActivityPreviewLoading(true);
    setActivityPreviewError(null);
    setActivityPreviewItems([]);

    try {
      const response = await getAdminTraineeProgressActivityLogs({
        batchCode: selectedBatch || undefined,
        limit: DASHBOARD_ACTIVITY_PREVIEW_LIMIT,
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) return;
      if (activityPreviewRetryRequestKeyRef.current !== requestKey) return;
      setActivityPreviewItems(response.items);
    } catch (previewError) {
      if (!isMountedRef.current || controller.signal.aborted) return;
      if (activityPreviewRetryRequestKeyRef.current !== requestKey) return;
      setActivityPreviewItems([]);
      setActivityPreviewError(toErrorMessage(previewError));
    } finally {
      if (
        isMountedRef.current &&
        !controller.signal.aborted &&
        activityPreviewRetryRequestKeyRef.current === requestKey
      ) {
        setActivityPreviewLoading(false);
        setActivityPreviewRetrying(false);
      }
    }
  };

  const feedPreviewItems = useMemo(
    () => feedItems.slice(0, DASHBOARD_FEED_DISPLAY_LIMIT),
    [feedItems],
  );

  const tutorialSteps: TutorialStep[] = [
    { message: "Welcome to the Admin Dashboard! This gives you a high-level overview of how your trainees and modules are performing." },
    { targetId: "admin-overview-kpis", message: "These metric cards provide a snapshot of total trainees, module progress, and active curriculum." },
    { targetId: "admin-overview-filter", message: "Use this drop-down to filter all metrics and graphs by a specific batch. Useful for checking cohort progress." },
    { targetId: "admin-overview-chart", message: "The Milestone Tracker displays real-time progress for each module so you can quickly spot challenges." },
    { targetId: "admin-overview-feeds", message: "Keep an eye on real-time system alerts and trainee activity logs in these feeds." },
  ];

  if (error && !loading) {
    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0 relative animate-in fade-in duration-500">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-8 shadow-sm flex-1 grid place-items-center border border-red-100 dark:border-red-900/30">
          <div className="text-center max-w-md">
            <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <p className="text-lg font-black text-[#0B1B3D] dark:text-slate-100">Connection Failed</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{error}</p>
            <button onClick={handleRetry} className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // OPTIMIZATION: Removed `-mt-2` to prevent shadow clipping. Added `pb-4` to ensure smooth bottom scrolling.
    <div className="flex-1 flex flex-col xl:flex-row gap-4 xl:min-h-0 relative animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
      <TutorialGuide steps={tutorialSteps} storageKey="creosim_tutorial_admin_overview" />

      {/* LEFT COLUMN */}
      <div className="flex-1 flex flex-col gap-4 xl:min-h-0">

        {/* A. KPI Summary Cards (FORCED TO 1 ROW: grid-cols-4) */}
        {/* We use responsive text & padding to shrink items safely without wrapping */}
        <div id="admin-overview-kpis" className="grid grid-cols-4 gap-2 sm:gap-3 xl:gap-4 shrink-0">

          {/* 1. Trainees Card */}
          <div
            onClick={() => navigate("/admin/users")}
            role="button"
            tabIndex={0}
            className="bg-white dark:bg-[#1E293B] rounded-xl sm:rounded-2xl p-2.5 sm:p-4 lg:p-5 shadow-sm border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-blue-500/30 dark:hover:border-blue-400/30 hover:-translate-y-1 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="text-slate-500 dark:text-slate-400 font-bold text-[8px] sm:text-[10px] lg:text-xs uppercase tracking-widest flex items-center gap-1.5 relative z-10 truncate">
              <Users size={14} className="text-blue-500 shrink-0 hidden sm:block" /> Trainees
            </div>

            <div className="mt-1.5 sm:mt-2 relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-0.5 xl:gap-0">
              <div className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-[#0B1B3D] dark:text-slate-100 tracking-tighter drop-shadow-sm leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {loading ? "--" : dashboard.summary.total_trainees}
              </div>
              <div className="text-[8px] sm:text-[10px] font-bold text-slate-400 group-hover:text-blue-500 flex items-center gap-1 transition-colors xl:pb-0.5">
                <span className="hidden xl:inline">Roster</span> <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* 2. Progress Card */}
          <div
            onClick={() => navigate("/admin/reports")}
            role="button"
            tabIndex={0}
            className="bg-white dark:bg-[#1E293B] rounded-xl sm:rounded-2xl p-2.5 sm:p-4 lg:p-5 shadow-sm border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-emerald-500/30 dark:hover:border-emerald-400/30 hover:-translate-y-1 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="text-slate-500 dark:text-slate-400 font-bold text-[8px] sm:text-[10px] lg:text-xs uppercase tracking-widest flex items-center gap-1.5 relative z-10 truncate">
              <Activity size={14} className="text-emerald-500 shrink-0 hidden sm:block" /> Progress
            </div>

            <div className="mt-1.5 sm:mt-2 relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-0.5 xl:gap-0">
              <div className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-[#0B1B3D] dark:text-slate-100 tracking-tighter flex items-baseline gap-[1px] sm:gap-1 leading-none group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {loading ? "--" : dashboard.summary.progress_percent} <span className="text-xs sm:text-sm lg:text-lg text-slate-400 group-hover:text-emerald-500/70 transition-colors">%</span>
              </div>
              <div className="text-[8px] sm:text-[10px] font-bold text-slate-400 group-hover:text-emerald-500 flex items-center gap-1 transition-colors xl:pb-0.5">
                <span className="hidden xl:inline">Reports</span> <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* 3. Modules Card */}
          <div
            onClick={() => navigate("/admin/lessons")}
            role="button"
            tabIndex={0}
            className="bg-white dark:bg-[#1E293B] rounded-xl sm:rounded-2xl p-2.5 sm:p-4 lg:p-5 shadow-sm border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-purple-500/30 dark:hover:border-purple-400/30 hover:-translate-y-1 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="text-slate-500 dark:text-slate-400 font-bold text-[8px] sm:text-[10px] lg:text-xs uppercase tracking-widest flex items-center gap-1.5 relative z-10 truncate">
              <BookOpen size={14} className="text-purple-500 shrink-0 hidden sm:block" /> Modules
            </div>

            <div className="mt-1.5 sm:mt-2 relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-0.5 xl:gap-0">
              <div className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-[#0B1B3D] dark:text-slate-100 tracking-tighter leading-none group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {loading ? "--" : String(dashboard.summary.total_modules).padStart(2, "0")}
              </div>
              <div className="text-[8px] sm:text-[10px] font-bold text-slate-400 group-hover:text-purple-500 flex items-center gap-1 transition-colors xl:pb-0.5">
                <span className="hidden xl:inline">Curriculum</span> <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* 4. Active View Filter */}
          <div id="admin-overview-filter" className="bg-slate-50 dark:bg-[#1E293B] rounded-xl sm:rounded-2xl p-2.5 sm:p-4 lg:p-5 shadow-inner border border-slate-200 dark:border-slate-800/50 flex flex-col justify-between">
            <div className="text-slate-500 dark:text-slate-400 font-bold text-[8px] sm:text-[10px] lg:text-xs uppercase tracking-widest flex items-center gap-1.5 relative z-10 truncate mb-1.5 sm:mb-2">
              <Filter size={14} className="text-slate-400 shrink-0 hidden sm:block" /> Active View
            </div>
            <div className="mt-auto">
              <select
                value={selectedBatch}
                onChange={(event) => setSelectedBatch(event.target.value)}
                className="w-full h-7 sm:h-9 lg:h-10 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[9px] sm:text-xs lg:text-sm font-bold text-[#0B1B3D] dark:text-slate-200 px-1 sm:px-3 outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm transition-colors truncate"
              >
                <option value="">Global (All)</option>
                {batchOptions.map((batch) => (
                  <option key={batch.batch_id} value={batch.batch_code}>{batch.batch_code}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* B. Milestone Tracker */}
        <div id="admin-overview-chart" className="bg-white dark:bg-[#1E293B] rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800/50 flex flex-col flex-1 min-h-[350px] xl:min-h-0 transition-colors">

          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h2 className="text-lg font-black text-[#0B1B3D] dark:text-slate-100 tracking-tight flex items-center gap-2">
                Milestone Tracker
              </h2>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time trainee progression by module
              </p>
            </div>
            {loading && <Loader2 className="animate-spin text-blue-500" size={20} />}
          </div>

          <div className="flex-1 flex min-h-[250px] xl:min-h-0 relative mt-2 gap-3 sm:gap-4">

            {/* Y-Axis Labels */}
            <div className="flex flex-col justify-between text-slate-400 dark:text-slate-500 text-[9px] sm:text-[10px] font-bold pb-[24px] w-[30px] sm:w-[40px] shrink-0 text-right pr-2 border-r border-slate-100 dark:border-slate-800">
              <span className="leading-none transform -translate-y-1/2">100%</span>
              <span className="leading-none transform -translate-y-1/2">75%</span>
              <span className="leading-none transform -translate-y-1/2">50%</span>
              <span className="leading-none transform -translate-y-1/2">25%</span>
              <span className="leading-none transform translate-y-[2px]">0%</span>
            </div>

            {/* Graph wrapper */}
            <div className="flex-1 relative flex flex-col h-full">

              <div className="flex-1 relative border-b-2 border-slate-300 dark:border-slate-600 z-0">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="w-full border-t border-dashed border-slate-200 dark:border-slate-700/50"></div>
                  <div className="w-full border-t border-dashed border-slate-200 dark:border-slate-700/50"></div>
                  <div className="w-full border-t border-dashed border-slate-200 dark:border-slate-700/50"></div>
                  <div className="w-full border-t border-dashed border-slate-200 dark:border-slate-700/50"></div>
                  <div className="w-full h-[1px]"></div>
                </div>

                <div className="absolute inset-0 flex items-end justify-around z-10 h-full">
                  {!loading && dashboard.chart.points.length === 0 ? (
                    <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-slate-400">
                      No module data available yet.
                    </div>
                  ) : (
                    dashboard.chart.points.map((item, idx) => {
                      const completionPercent = Math.max(0, Math.min(100, item.completion_percent));
                      const visualHeight = Math.max(2, completionPercent);

                      return (
                        <div key={item.module_id || idx} className="h-full flex flex-col justify-end w-8 sm:w-14 md:w-16 lg:w-20 relative group">

                          <div
                            className="w-full rounded-t-sm sm:rounded-t-md transition-all duration-700 ease-out shadow-sm relative overflow-hidden cursor-crosshair"
                            style={{
                              height: `${visualHeight}%`,
                              backgroundColor: barColors[idx % barColors.length],
                            }}
                          >
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                          </div>

                          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {item.module_code || `M${idx + 1}`}
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] sm:text-[11px] py-1.5 px-3 rounded-lg font-bold transition-all duration-200 pointer-events-none whitespace-nowrap text-center leading-tight shadow-xl z-50 translate-y-2 group-hover:translate-y-0">
                            <div className="text-cyan-400 mb-0.5">{item.module_code}</div>
                            <div>{completionPercent}% Cleared</div>
                            <div className="text-slate-400 font-medium mt-0.5">
                              {item.completed_trainees} of {item.total_trainees} Trainees
                            </div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="h-[24px] shrink-0 w-full"></div>
            </div>

          </div>

          {!loading && dashboard.chart.points.length > 0 && dashboard.summary.total_trainees === 0 && (
            <div className="mt-4 text-center text-[10px] sm:text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 py-2 rounded-lg">
              No trainees assigned. Modules reflect 0% completion.
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div id="admin-overview-feeds" className="w-full xl:w-[320px] shrink-0 flex flex-col gap-4 min-h-[400px] xl:min-h-0">

        {/* Notifications Panel */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/50 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                <Bell size={16} />
              </div>
              <h3 className="text-[#0B1B3D] dark:text-slate-100 font-black text-sm tracking-tight">
                System Status
              </h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            {feedError && !loading && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-center">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Feed offline.</p>
                <button onClick={() => void handleRetryFeed()} disabled={feedRetrying} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors mx-auto">
                  {feedRetrying ? "Reconnecting..." : "Reconnect"}
                </button>
              </div>
            )}

            {!feedError && feedPreviewItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 opacity-60">
                <Bell size={24} className="mb-2" />
                <p className="text-xs font-bold">
                  {loading ? "Syncing..." : "All caught up."}
                </p>
              </div>
            ) : (
              feedPreviewItems.map((note, i) => (
                <div key={`note-${note.type}-${note.occurred_at}-${i}`} className="flex gap-3 items-start group">
                  <div className="text-sm bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shrink-0 group-hover:scale-110 transition-transform">
                    {feedIconsByType[note.type] || "🔔"}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-xs font-bold text-[#0B1B3D] dark:text-slate-200 leading-snug">
                      {toAdminFeedText(note)}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                      {formatAdminFeedTime(note.occurred_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Log Panel */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/50 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              <History size={16} />
            </div>
            <h3 className="text-[#0B1B3D] dark:text-slate-100 font-black text-sm tracking-tight">
              Activity Logs
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-100 dark:bg-slate-800 -z-10"></div>

            {activityPreviewError && !activityPreviewLoading && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-center">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Activity preview offline.</p>
                <button
                  onClick={() => void handleRetryActivityPreview()}
                  disabled={activityPreviewRetrying}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors mx-auto"
                >
                  {activityPreviewRetrying ? "Reconnecting..." : "Reconnect"}
                </button>
              </div>
            )}

            {!activityPreviewError && activityPreviewItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 opacity-60">
                <History size={24} className="mb-2" />
                <p className="text-xs font-bold">
                  {activityPreviewLoading ? "Loading trainee progress..." : "No trainee progress activity."}
                </p>
              </div>
            ) : (
              activityPreviewItems.map((act) => (
                <div key={act.event_id} className="flex gap-3 items-start relative z-10">
                  <div className="pt-1 shrink-0 bg-white dark:bg-[#1E293B] py-1">
                    <div className={`w-2.5 h-2.5 rounded-full ring-[3px] ring-white dark:ring-[#1E293B] ${activityColorsByType[act.type] || "bg-slate-300 dark:bg-slate-600"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-snug">
                      {act.message}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      {act.batch_code && (
                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-500 dark:text-slate-300">
                          {act.batch_code}
                        </span>
                      )}
                      {act.simulation_title && (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-300">
                          {act.simulation_title}
                        </span>
                      )}
                      {act.status && (
                        <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800/80 px-1.5 py-0.5 text-slate-500 dark:text-slate-300">
                          {act.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>

                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                      {formatAdminFeedTime(act.occurred_at)} {act.trainee_name || act.actor ? `• ${act.trainee_name || act.actor}` : ""}
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
