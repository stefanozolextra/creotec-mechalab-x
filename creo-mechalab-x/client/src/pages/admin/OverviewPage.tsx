import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminDashboard } from "../../api/adminDashboard";
import { ApiError } from "../../api/http";
import type { AdminDashboardFeedItem, AdminDashboardResponse } from "../../types/adminDashboard";

const barColors = ["#93C5FD", "#5EEAD4", "#0B1B3D", "#60A5FA", "#C084FC", "#4ADE80"];

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

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load dashboard.";
};

const formatFeedTime = (value: string): string => {
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return "Unknown time";
  return asDate.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toFeedText = (item: AdminDashboardFeedItem): string => {
  const batchLabel = item.batch_code ? `[${item.batch_code}] ` : "";
  return `${batchLabel}${item.message}`;
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboardResponse>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getAdminDashboard();
        if (!active) return;
        setDashboard(response);
      } catch (loadError) {
        if (!active) return;
        setDashboard(emptyDashboard);
        setError(toErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 lg:overflow-hidden">
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6 h-full min-h-0">
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
                  No module data available.
                </div>
              ) : (
                dashboard.chart.points.map((item, idx) => {
                  const barHeight = Math.max(0, Math.min(100, item.completion_percent));
                  const isDarkBar = idx === 2;
                  return (
                    <div key={item.module_id || idx} className="h-full flex flex-col justify-end w-8 sm:w-12 relative group">
                      <div
                        className={`w-full rounded-t-xl transition-all duration-500 hover:brightness-110 ${isDarkBar ? "bg-[#0B1B3D] dark:bg-slate-300" : ""}`}
                        style={{
                          height: `${barHeight}%`,
                          backgroundColor: isDarkBar ? undefined : barColors[idx % barColors.length],
                        }}
                      />
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0B1B3D] dark:bg-slate-700 text-white text-xs py-1 px-2 rounded font-bold transition-opacity pointer-events-none whitespace-nowrap">
                        {barHeight}% ({item.completed_trainees}/{item.total_trainees})
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

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
            {dashboard.notifications.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                {loading ? "Loading notifications..." : "No recent notifications."}
              </p>
            ) : (
              dashboard.notifications.map((note, i) => (
                <div key={`${note.type}-${note.occurred_at}-${i}`} className="flex gap-4 items-start">
                  <div className="text-lg bg-slate-50 dark:bg-slate-800 p-2 rounded-full border border-slate-100 dark:border-slate-700 shrink-0 transition-colors">
                    {feedIconsByType[note.type] || "🔔"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0B1B3D] dark:text-slate-200 leading-tight transition-colors">
                      {toFeedText(note)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">
                      {formatFeedTime(note.occurred_at)}
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
            {dashboard.activities.length === 0 ? (
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                {loading ? "Loading activities..." : "No recent activities."}
              </p>
            ) : (
              dashboard.activities.map((act, i) => (
                <div key={`${act.type}-${act.occurred_at}-${i}`} className="flex gap-4 items-start">
                  <div
                    className={`w-8 h-8 rounded-full shadow-inner border border-white dark:border-[#1E293B] shrink-0 ${
                      activityColorsByType[act.type] || "bg-teal-400"
                    } transition-colors`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#0B1B3D] dark:text-slate-200 leading-tight transition-colors">
                      {toFeedText(act)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">
                      {formatFeedTime(act.occurred_at)}
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
