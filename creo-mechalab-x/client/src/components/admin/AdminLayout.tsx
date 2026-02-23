/* SECTION: IMPORTS */
import { Home, Users, Folder, PieChart, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { clearAuthRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/admin/overview', label: 'Dashboard', icon: Home },
  { to: '/admin/users', label: 'Trainees', icon: Users },
  { to: '/admin/lessons', label: 'Lessons', icon: Folder },
  { to: '/admin/activity-logs', label: 'Activity Logs', icon: PieChart },
];

const AdminLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Helper to extract the current page title for the Header
  const getHeaderTitle = () => {
    const currentItem = navItems.find(item => pathname.startsWith(item.to));
    return currentItem ? currentItem.label : 'Dashboard';
  };

  const handleLogout = () => {
    clearAuthRole();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen bg-[#F0F4F8] flex overflow-hidden font-sans text-slate-800 select-none">

      {/* SECTION: SIDEBAR
          - USE: Collapsible navigation.
          - HOW IT WORKS: Width transitions between 260px (expanded) and 88px (collapsed).
      */}
      <aside
        className={`${isCollapsed ? 'w-[88px]' : 'w-[260px]'} bg-[#E5EEF5] flex flex-col relative transition-all duration-300 ease-in-out shrink-0 border-r border-slate-200 shadow-sm z-20`}
      >
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-4 top-8 bg-[#0B1B3D] text-white p-1.5 rounded-full shadow-md hover:scale-105 transition-transform z-30"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        {/* Sidebar Header / Logo */}
        <div className={`h-[100px] flex items-center px-6 gap-4 ${isCollapsed ? 'justify-center px-0' : ''}`}>
          <div className="h-10 w-10 rounded-xl bg-[#0B1B3D] shrink-0 shadow-inner grid place-items-center">
            <div className="w-4 h-4 rounded bg-cyan-400"></div>
          </div>
          {!isCollapsed && (
            <div className="leading-tight whitespace-nowrap overflow-hidden">
              <p className="font-bold text-[#0B1B3D] text-lg">Creo</p>
              <p className="font-bold text-[#0B1B3D] text-lg">Mechalab X</p>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 pt-4 px-4 space-y-2" aria-label="Admin sidebar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `
                  flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold transition-all whitespace-nowrap overflow-hidden
                  ${isActive
                    ? 'bg-white text-[#0B1B3D] shadow-sm scale-100'
                    : 'text-slate-500 hover:bg-white/50 hover:text-[#0B1B3D] scale-95 hover:scale-100'}
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={22} className="shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer (Theme Toggle & Profile) */}
        <div className="p-4 space-y-4 mb-4">

          {/* Theme Toggle Pill */}
          <div className={`bg-white rounded-full p-1 flex items-center ${isCollapsed ? 'flex-col gap-2' : 'justify-between'}`}>
            <button className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold transition-all ${!isCollapsed ? 'flex-1' : ''} bg-white shadow-sm text-slate-800`}>
              <Sun size={18} />
              {!isCollapsed && <span className="text-sm">Light</span>}
            </button>
            <button className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold transition-all ${!isCollapsed ? 'flex-1' : ''} text-slate-400 hover:text-slate-600`}>
              <Moon size={18} />
              {!isCollapsed && <span className="text-sm">Dark</span>}
            </button>
          </div>

          {/* User Profile */}
          <div
            onClick={handleLogout}
            className={`flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-white/50 rounded-xl transition ${isCollapsed ? 'justify-center' : ''}`}
            title="Click to Logout"
          >
            <div className="h-10 w-10 rounded-full bg-slate-800 shrink-0 border-2 border-white shadow-sm overflow-hidden">
              {/* Mock Avatar Gradient */}
              <div className="w-full h-full bg-gradient-to-tr from-orange-400 to-blue-900"></div>
            </div>
            {!isCollapsed && (
              <div className="leading-tight whitespace-nowrap overflow-hidden border-l-2 border-slate-300 pl-3">
                <p className="font-bold text-[#0B1B3D]">Juan Dela Cruz</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* SECTION: MAIN CONTENT WRAPPER */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">

        {/* Header */}
        <header className="h-[100px] px-8 flex items-center justify-between shrink-0">
          <h1 className="text-4xl font-extrabold text-[#0B1B3D] tracking-tight ml-2">
            {getHeaderTitle()}
          </h1>

          <div className="text-right leading-tight hidden md:block">
            <p className="text-xl text-[#0B1B3D] font-bold">Creo Mechalab X</p>
            <p className="text-slate-500 font-medium tracking-wide text-sm">TESDA NC II Trainer</p>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8 pt-0 select-text">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;