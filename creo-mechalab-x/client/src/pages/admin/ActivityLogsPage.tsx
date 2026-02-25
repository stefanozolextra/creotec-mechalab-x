import { Calendar, Download, RotateCcw, ChevronLeft, ChevronRight, Search, ArrowRight } from 'lucide-react';
import { useMemo, useState, useRef, useEffect } from 'react';

type LogRow = {
  timestamp: string;
  action: string;
  actor: string;
  ip: string;
  path: string;
};

const mockLogs: LogRow[] = [
  { timestamp: 'Feb. 19, 2026 11:55 AM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephen Zoleta', ip: '2001:4451:bc3:f600:88d:5d17:bea69:3de2', path: '/api/auth/login' },
  { timestamp: 'Feb. 18, 2026 11:01 PM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephanie Montales', ip: '2341:3272:bc3:h723:98g:5d17:jbj33:5jh6', path: '/api/auth/login' },
  { timestamp: 'Feb. 18, 2026 09:15 AM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephen Zoleta', ip: '2001:4451:bc3:f600:88d:5d17:bea69:3de2', path: '/api/auth/login' },
  { timestamp: 'Feb. 17, 2026 03:01 PM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephanie Montales', ip: '2341:3272:bc3:h723:98g:5d17:jbj33:5jh6', path: '/api/auth/login' },
  { timestamp: 'Feb. 16, 2026 10:25 AM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephen Zoleta', ip: '2001:4451:bc3:f600:88d:5d17:bea69:3de2', path: '/api/auth/login' },
  { timestamp: 'Feb. 14, 2026 02:31 PM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephanie Montales', ip: '2341:3272:bc3:h723:98g:5d17:jbj33:5jh6', path: '/api/auth/login' },
  { timestamp: 'Feb. 14, 2026 09:12 AM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephen Zoleta', ip: '2001:4451:bc3:f600:88d:5d17:bea69:3de2', path: '/api/auth/login' },
  { timestamp: 'Feb. 13, 2026 04:45 PM', action: 'AUTH_LOGIN_SUCCESS', actor: 'Stephanie Montales', ip: '2341:3272:bc3:h723:98g:5d17:jbj33:5jh6', path: '/api/auth/login' },
];

// --- Premium Custom Date Picker Component with Drill-Down ---
function CustomDatePicker({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ONLY ONE EFFECT: Closes calendar if user clicks outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state natively exactly when the user clicks to open the calendar (NO MORE USEEFFECT ERRORS!)
  const handleToggleOpen = () => {
    if (!isOpen) {
      setViewMode('days'); // Reset view to days
      if (value) {
        const [y, m] = value.split('-');
        setCurrentMonth(new Date(Number(y), Number(m) - 1, 1));
      } else {
        setCurrentMonth(new Date());
      }
    }
    setIsOpen(!isOpen);
  };

  const handleSelectDay = (day: number) => {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleSelectMonth = (monthIndex: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
    setViewMode('days');
  };

  const handleSelectYear = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setViewMode('months');
  };

  // Header Logic based on View Mode
  let headerLabel = '';
  let onHeaderClick = () => { };
  let onPrev = () => { };
  let onNext = () => { };

  if (viewMode === 'days') {
    headerLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    onHeaderClick = () => setViewMode('years');
    onPrev = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    onNext = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  } else if (viewMode === 'months') {
    headerLabel = currentMonth.getFullYear().toString();
    onHeaderClick = () => setViewMode('years');
    onPrev = () => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1));
    onNext = () => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1));
  } else if (viewMode === 'years') {
    const startYear = Math.floor(currentMonth.getFullYear() / 10) * 10;
    headerLabel = `${startYear} - ${startYear + 9}`;
    onPrev = () => setCurrentMonth(new Date(currentMonth.getFullYear() - 10, currentMonth.getMonth(), 1));
    onNext = () => setCurrentMonth(new Date(currentMonth.getFullYear() + 10, currentMonth.getMonth(), 1));
  }

  const displayValue = useMemo(() => {
    if (!value) return "";
    const [y, m, d] = value.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [value]);

  return (
    <div className="relative flex items-center" ref={wrapperRef}>
      <Calendar className="absolute left-3 text-slate-400 z-10 pointer-events-none" size={14} />
      <input
        type="text"
        readOnly
        value={displayValue}
        onClick={handleToggleOpen}
        placeholder={placeholder}
        className="pl-9 pr-3 py-1.5 w-[140px] bg-transparent text-[#0B1B3D] dark:text-slate-200 font-bold text-sm outline-none cursor-pointer relative z-0 placeholder:text-slate-400 placeholder:font-medium transition-colors"
      />

      {isOpen && (
        <div className="absolute top-[calc(100%+12px)] left-0 p-5 bg-white dark:bg-[#1E293B] rounded-3xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 border border-slate-200 dark:border-slate-700/80 z-50 w-[280px] animate-in fade-in zoom-in-95 duration-200 select-none">

          {/* Calendar Header */}
          <div className="flex justify-between items-center mb-4">
            <button type="button" onClick={onPrev} className="p-2 text-slate-500 hover:text-[#0B1B3D] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={onHeaderClick}
              className="px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-extrabold text-sm text-[#0B1B3D] dark:text-slate-200 uppercase tracking-wide transition-colors"
            >
              {headerLabel}
            </button>
            <button type="button" onClick={onNext} className="p-2 text-slate-500 hover:text-[#0B1B3D] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Render Days View */}
          {viewMode === 'days' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 mb-2 uppercase tracking-wider">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}

                {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                  const day = i + 1;
                  const isSelected = value === `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={`h-9 w-full flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-300 ${isSelected
                          ? 'bg-[#3B82F6] text-white shadow-md shadow-blue-500/30 scale-105'
                          : 'text-[#0B1B3D] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Render Months View */}
          {viewMode === 'months' && (
            <div className="grid grid-cols-3 gap-2 animate-in fade-in zoom-in-95 duration-200">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleSelectMonth(index)}
                  className="h-12 flex items-center justify-center rounded-xl text-xs font-bold text-[#0B1B3D] dark:text-slate-200 hover:bg-[#3B82F6] hover:text-white transition-all duration-300"
                >
                  {month}
                </button>
              ))}
            </div>
          )}

          {/* Render Years View */}
          {viewMode === 'years' && (
            <div className="grid grid-cols-3 gap-2 animate-in fade-in zoom-in-95 duration-200">
              {Array.from({ length: 12 }).map((_, i) => {
                const startYear = Math.floor(currentMonth.getFullYear() / 10) * 10;
                const year = startYear - 1 + i;
                const isDecadeEdge = i === 0 || i === 11;

                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleSelectYear(year)}
                    className={`h-12 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-300 ${isDecadeEdge
                        ? 'text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-[#0B1B3D] dark:text-slate-200 hover:bg-[#3B82F6] hover:text-white'
                      }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function ActivityLogsPage() {
  const [studentId, setStudentId] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  const rows = useMemo(() => mockLogs, []);

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 relative">

      {/* SECTION: COMPACT FILTER TOOLBAR */}
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-800/50 shrink-0 z-20 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-colors duration-500">

        {/* Left Side: Filter Inputs */}
        <div className="flex flex-wrap items-center gap-2.5">

          {/* Student ID Search */}
          <div className="relative z-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Search Student ID..."
              className="pl-9 pr-4 py-2 w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-medium text-sm outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-300"
            />
          </div>

          <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />

          {/* Sleek Custom Date Range Group */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0F172A] p-1 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors duration-300">
            <CustomDatePicker value={since} onChange={setSince} placeholder="Since date" />
            <ArrowRight size={14} className="text-slate-400 shrink-0" />
            <CustomDatePicker value={until} onChange={setUntil} placeholder="Until date" />
          </div>

          {/* Filter Actions */}
          <div className="flex items-center gap-2 ml-1">
            <button className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-md shadow-blue-500/20 transition-all hover:scale-105">
              Apply
            </button>
            <button
              onClick={() => { setStudentId(''); setSince(''); setUntil(''); }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Reset Filters"
            >
              <RotateCcw size={16} />
            </button>
          </div>

        </div>

        {/* Right Side: Export */}
        <button className="px-5 py-2 rounded-xl bg-[#1E293B] dark:bg-slate-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-sm">
          <Download size={14} aria-hidden="true" /> <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* SECTION: DATA TABLE & PAGINATION */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 border border-slate-100 dark:border-slate-800/50 z-10 relative">

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[11px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="px-8 py-5 text-left">Timestamp</th>
                <th className="px-6 py-5 text-left">Action</th>
                <th className="px-6 py-5 text-left">Actor</th>
                <th className="px-6 py-5 text-left">IP Address</th>
                <th className="px-8 py-5 text-left">Path</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {rows.map((r, idx) => (
                <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-300">
                  <td className="px-8 py-4 text-slate-500 dark:text-slate-400 font-medium text-xs transition-colors duration-500">
                    {r.timestamp}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 transition-colors duration-500">
                      {r.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#0B1B3D] dark:text-slate-200 text-xs transition-colors duration-500">
                    {r.actor}
                  </td>
                  <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono text-[11px] transition-colors duration-500">
                    {r.ip}
                  </td>
                  <td className="px-8 py-4 text-slate-400 dark:text-slate-500 font-mono text-[11px] transition-colors duration-500">
                    {r.path}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sticky Pagination Footer */}
        <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex items-center justify-between transition-colors duration-500">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-[#0B1B3D] dark:text-slate-200">1</span> to <span className="font-bold text-[#0B1B3D] dark:text-slate-200">10</span> of <span className="font-bold text-[#0B1B3D] dark:text-slate-200">167</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm text-xs font-bold flex items-center gap-1">
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="flex items-center gap-1 px-2">
              <button className="w-8 h-8 rounded-lg bg-[#3B82F6] text-white font-bold text-xs shadow-md">1</button>
              <button className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs transition-colors">2</button>
              <button className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs transition-colors">3</button>
              <span className="text-slate-400 text-xs font-bold px-1">...</span>
              <button className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs transition-colors">17</button>
            </div>
            <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm text-xs font-bold flex items-center gap-1">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}