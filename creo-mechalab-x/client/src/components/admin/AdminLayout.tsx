import { Activity, BookOpen, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

type TitleMap = Record<string, string>;

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: UserRound },
  { to: '/admin/lessons', label: 'Lessons', icon: BookOpen },
  { to: '/admin/activity-logs', label: 'Activity Logs', icon: Activity },
];

const routeTitles: TitleMap = {
  '/admin/dashboard': 'DASHBOARD',
  '/admin/users': 'USER MANAGEMENT',
  '/admin/lessons': 'LESSONS MANAGEMENT',
  '/admin/activity-logs': 'SYSTEM AUDIT LOG',
};

const navClassName = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-7 py-3 text-lg font-medium transition ${
    isActive ? 'bg-[#3871C1] text-white' : 'text-slate-100 hover:bg-white/10'
  }`;

const getHeaderTitle = (pathname: string): string => {
  const matched = Object.keys(routeTitles).find((routePath) => pathname.startsWith(routePath));
  return matched ? routeTitles[matched] : 'DASHBOARD';
};

const AdminLayout = () => {
  const { pathname } = useLocation();
  const headerTitle = getHeaderTitle(pathname);

  return (
    <div className="h-screen bg-[#E6E6E6] flex overflow-hidden">
      <aside className="w-[220px] bg-[#2E415F] flex flex-col">
        <div className="h-[74px] bg-white border-r border-black/10 px-5 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full border-2 border-[#2E415F] grid place-items-center text-[#2E415F] font-bold text-xs">
            CP
          </div>
          <div className="leading-tight">
            <p className="font-bold text-[#2E415F] text-xl">CREOTEC</p>
            <p className="text-[#2E415F] text-lg">Philippines Inc.</p>
          </div>
        </div>

        <nav className="pt-14" aria-label="Admin sidebar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={navClassName}>
                <Icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/30 p-6">
          <button
            type="button"
            className="w-full flex items-center gap-3 text-white hover:text-slate-200 font-medium"
          >
            <LogOut size={20} aria-hidden="true" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[74px] border-b border-black/10 px-5 flex items-center justify-between bg-[#E6E6E6]">
          <h1 className="text-4xl font-bold text-black">{headerTitle}</h1>

          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="text-2xl text-slate-800 font-medium">Olivia Wilson</p>
              <p className="text-slate-700 text-lg">Admin</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-slate-300 border border-slate-500 grid place-items-center text-sm font-semibold text-slate-700">
              OW
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
