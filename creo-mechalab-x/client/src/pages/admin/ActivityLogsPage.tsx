import { Calendar, Download } from 'lucide-react';
import { useMemo, useState } from 'react';

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
];

export default function ActivityLogsPage() {
  const [studentId, setStudentId] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  const rows = useMemo(() => mockLogs, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border border-black/10">
        <div className="font-extrabold text-slate-900 mb-2">FILTERS</div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-end">
          <div>
            <label className="block text-sm font-semibold mb-2">Student ID</label>
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g 0001"
              className="w-full rounded-md border border-slate-400 px-4 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Since</label>
            <div className="relative">
              <input
                value={since}
                onChange={(e) => setSince(e.target.value)}
                placeholder="dd/mm/yyyy --:-- --"
                className="w-full rounded-md border border-slate-400 px-4 py-2 pr-10 outline-none focus:ring-2 focus:ring-slate-300"
              />
              <Calendar size={18} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Until</label>
            <div className="relative">
              <input
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                placeholder="dd/mm/yyyy --:-- --"
                className="w-full rounded-md border border-slate-400 px-4 py-2 pr-10 outline-none focus:ring-2 focus:ring-slate-300"
              />
              <Calendar size={18} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => {
              setStudentId('');
              setSince('');
              setUntil('');
            }}
            className="px-8 py-2 rounded-full border border-slate-500 bg-white font-semibold"
          >
            Reset
          </button>
          <button
            type="button"
            className="px-8 py-2 rounded-full bg-black text-white font-semibold"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="bg-[#D4D4D4] rounded-lg p-4 border border-black/10 flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold">
          Showing Page <span className="font-extrabold">1</span> of <span className="font-extrabold">13</span> -- <span className="font-extrabold">167</span> Total Logs
        </div>

        <div className="flex items-center gap-3">
          <button className="px-8 py-2 rounded-full border border-slate-500 bg-white font-semibold">
            Prev
          </button>
          <button className="px-8 py-2 rounded-full border border-slate-500 bg-white font-semibold">
            Next
          </button>
          <button className="px-6 py-2 rounded-full bg-black text-white font-semibold flex items-center gap-2">
            <Download size={18} aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-extrabold text-slate-700 border-b border-black/20">
              <th className="px-6 py-4 text-left">TIMESTAMP</th>
              <th className="px-4 py-4 text-left">ACTION</th>
              <th className="px-4 py-4 text-left">ACTOR</th>
              <th className="px-4 py-4 text-left">IP</th>
              <th className="px-6 py-4 text-left">PATH</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/10">
            {rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">{r.timestamp}</td>
                <td className="px-4 py-4 font-semibold">{r.action}</td>
                <td className="px-4 py-4">{r.actor}</td>
                <td className="px-4 py-4 text-slate-700">{r.ip}</td>
                <td className="px-6 py-4 text-slate-700">{r.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
