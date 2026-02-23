/* SECTION: IMPORTS & MOCK DATA */
// import { useMemo } from 'react';
import { Plus } from 'lucide-react'; // Added Plus icon

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
  // Added an extra to demonstrate internal scrolling
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
    // Height lock: Calculates screen height minus the Header & Padding to prevent full-page scrolling
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px] pb-4">

      {/* SECTION: LEFT COLUMN (Cards & Chart) */}
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6 h-full min-h-0">

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">

          {/* Trainees Card with Integrated 'Add Trainee' Button */}
          <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex justify-between items-start">
            <div>
              <div className="text-slate-500 font-semibold mb-2 text-sm">Trainees</div>
              <div className="text-5xl font-extrabold text-[#0B1B3D]">20</div>
            </div>
            {/* NEW PLACEMENT: Sleek Action Button */}
            <button
              className="bg-[#2E5BFF]/10 text-[#2E5BFF] p-3 rounded-2xl hover:bg-[#2E5BFF] hover:text-white transition-all hover:scale-105 shadow-sm"
              title="Add New Trainee"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
            <div className="text-slate-500 font-semibold mb-2 text-sm">Progress</div>
            <div className="text-5xl font-extrabold text-[#0B1B3D]">81%</div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
            <div className="text-slate-500 font-semibold mb-2 text-sm">Modules</div>
            <div className="text-5xl font-extrabold text-[#0B1B3D]">06</div>
          </div>
        </div>

        {/* MILESTONE TRACKING CHART */}
        {/* flex-1 lets the chart stretch to match the height of the right column perfectly */}
        <div className="bg-white rounded-3xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex-1 flex flex-col min-h-0">
          <h2 className="text-xl font-bold text-[#0B1B3D] mb-8 shrink-0">Milestone Tracking</h2>

          <div className="flex-1 grid grid-cols-[40px_1fr] gap-4 min-h-0">
            {/* Y-Axis Labels */}
            <div className="flex flex-col justify-between text-slate-400 text-xs font-semibold py-2">
              <span>30K</span>
              <span>20K</span>
              <span>10K</span>
              <span>0</span>
            </div>

            {/* Bars Area */}
            <div className="relative flex items-end justify-around pt-4 pb-2">
              {milestoneData.map((item, idx) => (
                <div key={idx} className="h-full flex flex-col justify-end w-4 sm:w-6 relative group">
                  <div
                    className="w-full rounded-full transition-all duration-500 hover:brightness-110"
                    style={{ height: `${item.pct}%`, backgroundColor: barColors[idx] }}
                  />
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0B1B3D] text-white text-xs py-1 px-2 rounded font-bold transition-opacity pointer-events-none">
                    {item.pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* X-Axis Labels */}
          <div className="ml-[56px] mt-4 flex justify-around text-slate-400 text-xs font-semibold shrink-0">
            {milestoneData.map((item, idx) => (
              <div key={idx} className="text-center w-8 truncate">{item.label}</div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION: RIGHT COLUMN (Notifications & Activities) */}
      <div className="col-span-1 lg:col-span-4 flex flex-col gap-6 h-full min-h-0">

        {/* NOTIFICATIONS PANEL */}
        {/* flex-1 splits the right column 50/50 exactly */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex-1 flex flex-col min-h-0">
          <h3 className="text-[#0B1B3D] font-bold text-lg mb-4 shrink-0">Notifications</h3>
          {/* overflow-y-auto allows internal scrolling with a styled custom scrollbar */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {mockNotifications.map((note, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="text-lg bg-slate-50 p-2 rounded-full border border-slate-100 shrink-0">{note.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1B3D] leading-tight">{note.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{note.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIVITIES PANEL */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] flex-1 flex flex-col min-h-0">
          <h3 className="text-[#0B1B3D] font-bold text-lg mb-4 shrink-0">Activities</h3>
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {mockActivities.map((act, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className={`w-8 h-8 rounded-full shadow-inner border border-white shrink-0 ${act.color}`}></div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1B3D] leading-tight">{act.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}