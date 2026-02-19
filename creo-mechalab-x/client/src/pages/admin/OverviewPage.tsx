import { Plus, Minus } from 'lucide-react';

const lessonCompletion = [
  100, 95, 90, 76, 70, 67, 60, 45, 23, 9,
];

const recentActivity = [
  { name: 'Stephen Zoleta', action: 'finished lesson 4', when: '5 mins ago' },
  { name: 'Stephanie Montales', action: 'finished lesson 2', when: '3 hours ago' },
  { name: 'Stephan Pasia', action: 'finished lesson 7', when: '8 hours ago' },
];

const barColors = [
  '#112BC2',
  '#083D86',
  '#1050AB',
  '#1783C2',
  '#151D78',
  '#1150AA',
  '#001F4A',
  '#536FE4',
  '#001B48',
  '#0A3D9A',
];

export default function OverviewPage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-4 border border-black/10">
            <div className="text-slate-800 font-semibold">Students</div>
            <div className="mt-2 text-4xl font-medium text-slate-900">25</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-black/10">
            <div className="text-slate-800 font-semibold">Overall Completion</div>
            <div className="mt-2 text-4xl font-medium text-slate-900">78 %</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-black/10">
            <div className="text-slate-800 font-semibold">Lessons</div>
            <div className="mt-2 text-4xl font-medium text-slate-900">10</div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3 space-y-3">
          <button
            type="button"
            className="w-full bg-[#2E415F] text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Plus size={18} aria-hidden="true" /> Add User
          </button>
          <button
            type="button"
            className="w-full bg-[#EC5151] text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Minus size={18} aria-hidden="true" /> Remove User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-black/10">
        <h2 className="text-3xl font-bold text-slate-800 mb-4">Lessons Completion</h2>

        <div className="grid grid-cols-[56px_1fr] gap-2">
          <div className="h-72 flex flex-col justify-between text-slate-500 text-sm py-1">
            <span>100 %</span>
            <span>80 %</span>
            <span>60 %</span>
            <span>40 %</span>
            <span>20 %</span>
            <span>0 %</span>
          </div>

          <div className="h-72 relative">
            <div className="absolute inset-0 flex flex-col justify-between">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="border-t border-slate-300" />
              ))}
            </div>
            <div className="relative h-full flex items-end gap-2 pt-2">
              {lessonCompletion.map((pct, idx) => (
                <div key={idx} className="flex-1 min-w-0 h-full flex flex-col justify-end">
                  <div
                    className="w-full rounded-t-lg"
                    style={{ height: `${pct}%`, backgroundColor: barColors[idx] }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ml-14 mt-2 grid grid-cols-10 gap-2 text-slate-600 text-sm">
          {lessonCompletion.map((_, idx) => (
            <div key={idx} className="text-center truncate">
              Lesson {idx + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        <div className="px-5 py-4 text-3xl font-bold text-slate-800 border-b border-black/15">
          Recent Activity
        </div>

        <div className="divide-y divide-black/10">
          {recentActivity.map((row) => (
            <div key={row.name + row.when} className="px-6 py-3 flex items-center justify-between">
              <div className="text-slate-700 text-base">
                {row.name} {row.action}
              </div>
              <div className="text-slate-500 text-base">{row.when}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
