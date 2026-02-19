import { Search, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type LessonRow = {
  lesson: string;
  title: string;
  progress: number;
  fileName?: string;
};

const mockLessons: LessonRow[] = [
  { lesson: 'Lesson 1', title: 'Intro to Electronics', progress: 80, fileName: 'Lesson_1...' },
  { lesson: 'Lesson 2', title: 'Basic Circuit Components', progress: 50, fileName: 'Lesson_2...' },
  { lesson: 'Lesson 3', title: "Ohm’s Law", progress: 80, fileName: 'Lesson_1...' },
  { lesson: 'Lesson 4', title: 'Series and Parallel Circuits', progress: 50, fileName: 'Lesson_2...' },
  { lesson: 'Lesson 5', title: 'Basic Measurements', progress: 80, fileName: 'Lesson_1...' },
  { lesson: 'Lesson 6', title: 'Intro to Semiconductors', progress: 50, fileName: 'Lesson_2...' },
  { lesson: 'Lesson 7', title: 'Digital Logic Gates', progress: 80, fileName: 'Lesson_1...' },
  { lesson: 'Lesson 8', title: 'Basic Sensors', progress: 50, fileName: 'Lesson_2...' },
  { lesson: 'Lesson 9', title: 'Microcontrollers Basics', progress: 0 },
  { lesson: 'Lesson 10', title: 'Final Assessment', progress: 0 },
];

export default function LessonsPage() {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockLessons;
    return mockLessons.filter((l) => (l.lesson + ' ' + l.title).toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border border-black/10 flex flex-wrap items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="pl-10 pr-4 py-2 rounded-md border border-slate-400 w-[260px] outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <button className="bg-[#2E415F] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2">
          <Plus size={18} aria-hidden="true" /> Add Lesson
        </button>
      </div>

      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-extrabold text-slate-700 border-b border-black/20">
              <th className="px-6 py-4 text-left">LESSONS</th>
              <th className="px-4 py-4 text-left">TITLE</th>
              <th className="px-4 py-4 text-left">PROGRESS</th>
              <th className="px-4 py-4 text-left">FILE</th>
              <th className="px-6 py-4 text-left">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/10">
            {rows.map((l) => {
              const fileButton =
                l.fileName ? (
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-400 text-white text-xs font-bold">
                    {l.fileName}
                  </span>
                ) : (
                  <button className="inline-flex items-center px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold">
                    Upload File
                  </button>
                );

              const replaceClass = l.fileName
                ? 'bg-[#151F8C] text-white'
                : 'bg-slate-400 text-white';

              return (
                <tr key={l.lesson} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold">{l.lesson}</td>
                  <td className="px-4 py-4">{l.title}</td>
                  <td className="px-4 py-4">
                    <div className="w-[230px]">
                      <div className="text-sm text-slate-800">
                        {l.progress} % Complete
                      </div>
                      <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#18B9C7]" style={{ width: `${l.progress}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{fileButton}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button className={`px-5 py-1.5 rounded-md font-semibold ${replaceClass}`}>
                        Replace
                      </button>
                      <button className="bg-[#EC5151] text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2">
                        <Trash2 size={16} aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                  No lessons found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
