/* SECTION: IMPORTS & MOCK DATA */
import { Plus } from 'lucide-react';

const barColors = [
  '#93C5FD', '#5EEAD4', '#0B1B3D', '#60A5FA', '#C084FC', '#4ADE80'
];

const milestoneData = [
  { label: 'Linux', pct: 40 },
  { label: 'Mac', pct: 90 },
  { label: 'iOS', pct: 60 },
  { label: 'Windows', pct: 100 },
  { label: 'Android', pct: 35 },
  { label: 'Other', pct: 80 },
];

const mockNotifications = [
  { text: "You fixed a bug.", time: "Just now", icon: "🐞" },
  { text: "New user registered.", time: "59 minutes ago", icon: "👤" },
  { text: "You fixed a bug.", time: "12 hours ago", icon: "🐞" },
  { text: "Andi Lane subscribed to you.", time: "Today, 11:59 AM", icon: "📡" },
  { text: "System backup complete.", time: "Yesterday", icon: "💾" },
];

const mockActivities = [
  { text: "Changed the style.", time: "Just now", color: "bg-red-400" },
  { text: "Released a new version.", time: "59 minutes ago", color: "bg-orange-400" },
  { text: "Submitted a bug.", time: "12 hours ago", color: "bg-blue-400" },
  { text: "Modified A data in Page X.", time: "Today, 11:59 AM", color: "bg-purple-400" },
  { text: "Deleted a page in Project X.", time: "Feb 2, 2026", color: "bg-teal-400" },
];

export default function OverviewPage() {
  return (
    /* THE FIX: 
       - Replaced the fragile `h-[calc(...)]` math with `flex-1 min-h-0`.
       - This mathematically guarantees the dashboard perfectly hugs the edge of the screen without ever spilling over!
    */
    <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 lg:overflow-hidden">

      {/* SECTION: LEFT COLUMN (Cards & Chart) */}
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6 h-full min-h-0">

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">

          <div className="bg-white dark:bg-[#17233B] rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none flex justify-between items-start transition-colors">
            <div>
              <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2 text-sm transition-colors">Trainees</div>
              <div className="text-5xl font-extrabold text-[#0B1B3D] dark:text-white transition-colors">20</div>
            </div>
            <button
              className="bg-[#2E5BFF]/10 dark:bg-[#2E5BFF]/20 text-[#2E5BFF] dark:text-blue-400 p-3 rounded-2xl hover:bg-[#2E5BFF] hover:text-white dark:hover:bg-[#2E5BFF] dark:hover:text-white transition-all hover:scale-105 shadow-sm"
              title="Add New Trainee"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="bg-white dark:bg-[#17233B] rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none transition-colors">
            <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2 text-sm transition-colors">Progress</div>
            <div className="text-5xl font-extrabold text-[#0B1B3D] dark:text-white transition-colors">81%</div>
          </div>

          <div className="bg-white dark:bg-[#17233B] rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none transition-colors">
            <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2 text-sm transition-colors">Modules</div>
            <div className="text-5xl font-extrabold text-[#0B1B3D] dark:text-white transition-colors">06</div>
          </div>
        </div>

        {/* MILESTONE TRACKING CHART */}
        <div className="bg-white dark:bg-[#17233B] rounded-3xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none flex-1 flex flex-col min-h-0 transition-colors">
          <h2 className="text-xl font-bold text-[#0B1B3D] dark:text-white mb-8 shrink-0 transition-colors">Milestone Tracking</h2>

          <div className="flex-1 grid grid-cols-[40px_1fr] gap-4 min-h-0">
            <div className="flex flex-col justify-between text-slate-400 dark:text-slate-500 text-xs font-semibold py-2 transition-colors">
              <span>30K</span>
              <span>20K</span>
              <span>10K</span>
              <span>0</span>
            </div>

            <div className="relative flex items-end justify-around pt-4 pb-2">
              {milestoneData.map((item, idx) => {
                const isDarkBar = idx === 2;
                return (
                  <div key={idx} className="h-full flex flex-col justify-end w-4 sm:w-6 relative group">
                    <div
                      className={`w-full rounded-full transition-all duration-500 hover:brightness-110 ${isDarkBar ? 'bg-[#0B1B3D] dark:bg-white' : ''}`}
                      style={{
                        height: `${item.pct}%`,
                        backgroundColor: isDarkBar ? undefined : barColors[idx]
                      }}
                    />
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0B1B3D] dark:bg-white text-white dark:text-[#0B1B3D] text-xs py-1 px-2 rounded font-bold transition-opacity pointer-events-none">
                      {item.pct}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="ml-[56px] mt-4 flex justify-around text-slate-400 dark:text-slate-500 text-xs font-semibold shrink-0 transition-colors">
            {milestoneData.map((item, idx) => (
              <div key={idx} className="text-center w-8 truncate">{item.label}</div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION: RIGHT COLUMN (Notifications & Activities) */}
      <div className="col-span-1 lg:col-span-4 flex flex-col gap-6 h-full min-h-0">

        {/* NOTIFICATIONS PANEL */}
        <div className="bg-white dark:bg-[#17233B] rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none flex-1 flex flex-col min-h-0 transition-colors">
          <h3 className="text-[#0B1B3D] dark:text-white font-bold text-lg mb-4 shrink-0 transition-colors">Notifications</h3>
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            {mockNotifications.map((note, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="text-lg bg-slate-50 dark:bg-white/5 p-2 rounded-full border border-slate-100 dark:border-white/5 shrink-0 transition-colors">{note.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1B3D] dark:text-white leading-tight transition-colors">{note.text}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">{note.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIVITIES PANEL */}
        <div className="bg-white dark:bg-[#17233B] rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none flex-1 flex flex-col min-h-0 transition-colors">
          <h3 className="text-[#0B1B3D] dark:text-white font-bold text-lg mb-4 shrink-0 transition-colors">Activities</h3>
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            {mockActivities.map((act, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className={`w-8 h-8 rounded-full shadow-inner border border-white dark:border-[#17233B] shrink-0 ${act.color} transition-colors`}></div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1B3D] dark:text-white leading-tight transition-colors">{act.text}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}