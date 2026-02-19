import { Search, Plus, Upload, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type UserStatus = 'Passed' | 'Active' | 'Inactive';

const mockUsers = [
  { name: 'Stephen Zoleta', id: '0001', email: 'stephen@example.com', progressLabel: 'Done', progressPct: 100, status: 'Passed' as UserStatus },
  { name: 'Stephanie Montales', id: '0002', email: 'stephanie@example.com', progressLabel: '5/10 Lessons', progressPct: 50, status: 'Active' as UserStatus },
  { name: 'John Doe', id: '0003', email: 'johndoe@example.com', progressLabel: '7/10 Lessons', progressPct: 70, status: 'Inactive' as UserStatus },
  { name: 'Stephen Zoleta', id: '0004', email: 'stephen@example.com', progressLabel: '8/10 Lessons', progressPct: 80, status: 'Active' as UserStatus },
  { name: 'Stephanie Montales', id: '0005', email: 'stephanie@example.com', progressLabel: '5/10 Lessons', progressPct: 50, status: 'Active' as UserStatus },
  { name: 'John Doe', id: '0006', email: 'johndoe@example.com', progressLabel: '7/10 Lessons', progressPct: 70, status: 'Inactive' as UserStatus },
  { name: 'Stephen Zoleta', id: '0007', email: 'stephen@example.com', progressLabel: '8/10 Lessons', progressPct: 80, status: 'Active' as UserStatus },
  { name: 'Stephanie Montales', id: '0008', email: 'stephanie@example.com', progressLabel: '5/10 Lessons', progressPct: 50, status: 'Active' as UserStatus },
  { name: 'John Doe', id: '0009', email: 'johndoe@example.com', progressLabel: '7/10 Lessons', progressPct: 70, status: 'Inactive' as UserStatus },
  { name: 'Stephen Zoleta', id: '0010', email: 'stephen@example.com', progressLabel: '8/10 Lessons', progressPct: 80, status: 'Active' as UserStatus },
];

const statusPill = (s: UserStatus) => {
  if (s === 'Passed') return 'bg-emerald-500 text-white';
  if (s === 'Active') return 'bg-[#151F8C] text-white';
  return 'bg-[#EC5151] text-white';
};

const isUserStatus = (v: string): v is UserStatus =>
  v === 'Passed' || v === 'Active' || v === 'Inactive';

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | UserStatus>('All');

  const rows = useMemo(() => {
    return mockUsers.filter((u) => {
      const matchesQuery =
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.id.includes(query) ||
        u.email.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'All' ? true : u.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border border-black/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10 pr-4 py-2 rounded-md border border-slate-400 w-[260px] outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value;
              setStatus(v === 'All' ? 'All' : isUserStatus(v) ? v : 'All');
            }}

            className="py-2 px-3 rounded-md border border-slate-400 w-[180px] outline-none focus:ring-2 focus:ring-slate-300 font-semibold"
          >
            <option value="All">Status</option>
            <option value="Passed">Passed</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button className="bg-[#2E415F] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2">
            <Plus size={18} aria-hidden="true" /> Add User
          </button>
          <button className="bg-white border border-slate-400 px-6 py-2 rounded-lg font-semibold flex items-center gap-2">
            <Upload size={18} aria-hidden="true" /> Import CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr className="text-xs font-extrabold text-slate-700 border-b border-black/20">
              <th className="px-6 py-4 text-left">NAME</th>
              <th className="px-4 py-4 text-left">STUDENT ID</th>
              <th className="px-4 py-4 text-left">EMAIL ADDRESS</th>
              <th className="px-4 py-4 text-left">PROGRESS</th>
              <th className="px-4 py-4 text-left">STATUS</th>
              <th className="px-6 py-4 text-left">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/10">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 grid place-items-center text-slate-600">
                      {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </div>
                    <div className="leading-tight">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">{u.id}</td>
                <td className="px-4 py-4">{u.email}</td>
                <td className="px-4 py-4">
                  <div className="w-[220px]">
                    <div className="flex justify-between text-xs text-slate-700 font-semibold">
                      <span>{u.progressLabel}</span>
                    </div>
                    <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#18B9C7]" style={{ width: `${u.progressPct}%` }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center justify-center px-5 py-1.5 rounded-full text-xs font-bold ${statusPill(u.status)}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button className="bg-slate-500 text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2">
                      <Pencil size={16} aria-hidden="true" /> Edit
                    </button>
                    <button className="bg-[#EC5151] text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2">
                      <Trash2 size={16} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
