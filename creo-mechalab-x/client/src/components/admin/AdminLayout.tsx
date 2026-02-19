import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/users', label: 'Trainees / Users' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/activity-logs', label: 'Activity Logs' },
];

const tabClassName = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-md text-sm font-medium transition ${
    isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-300 hover:bg-slate-800'
  }`;

const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-xl font-bold tracking-wide">Admin Console</h1>
          <p className="text-sm text-slate-400">Manage trainees, reports, and activity.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Admin tabs">
          {tabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} className={tabClassName}>
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
