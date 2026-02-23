/* SECTION: IMPORTS */
import { Home, Users, Folder, PieChart, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { clearAuthRole } from '../../utils/auth';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { to: '/admin/users', label: 'Trainees', icon: Users },
  { to: '/admin/lessons', label: 'Lessons', icon: Folder },
  { to: '/admin/activity-logs', label: 'Activity Logs', icon: PieChart },
];

const AdminLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // NEW: Dark mode state
  const [isDark, setIsDark] = useState(false);

  const getHeaderTitle = () => {
    const currentItem = navItems.find(item => pathname.startsWith(item.to));
    return currentItem ? currentItem.label : 'Dashboard';
  };

  const handleLogout = () => {
    clearAuthRole();
    navigate('/login', { replace: true });
  };

  return (
    /* THE FIX: Wrapped the layout in a parent div that securely applies the 'dark' class.
       We now use standard `dark:bg-[#22314E]` so Tailwind compiles the color perfectly.
    */
    <div className={isDark ? 'dark' : ''}>
      <div className="h-screen w-full flex overflow-hidden font-sans text-slate-800 dark:text-slate-200 select-none transition-colors duration-300 bg-[#EEF2F6] dark:bg-[#22314E]">

        {/* SECTION: SIDEBAR */}
        <aside
          className={`${isCollapsed ? 'w-[88px]' : 'w-[260px]'} bg-[#E3EBF3] dark:bg-[#17233B] flex flex-col relative transition-all duration-300 ease-in-out shrink-0 border-r border-slate-200 dark:border-[#17233B] shadow-sm z-20`}
        >
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-4 top-8 bg-[#0B1B3D] dark:bg-white dark:text-[#0B1B3D] text-white p-1.5 rounded-full shadow-md hover:scale-105 transition-transform z-30"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          {/* Sidebar Header / Logo */}
          <div className={`h-[100px] flex items-center px-6 gap-4 ${isCollapsed ? 'justify-center px-0' : ''}`}>
            <div className="h-10 w-10 rounded-xl bg-[#0B1B3D] dark:bg-[#E3EBF3] shrink-0 shadow-inner grid place-items-center transition-colors">
              <div className="w-4 h-4 rounded bg-cyan-400 dark:bg-[#2E5BFF]"></div>
            </div>
            {!isCollapsed && (
              <div className="leading-tight whitespace-nowrap overflow-hidden">
                <p className="font-bold text-[#0B1B3D] dark:text-white text-lg transition-colors">Creo</p>
                <p className="font-bold text-[#0B1B3D] dark:text-white text-lg transition-colors">Mechalab X</p>
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
                      ? 'bg-white text-[#0B1B3D] shadow-sm scale-100 dark:bg-[#2E5BFF]/20 dark:text-[#60A5FA]'
                      : 'text-slate-500 hover:bg-white/50 hover:text-[#0B1B3D] dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white scale-95 hover:scale-100'}
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

            {/* THEME TOGGLE (SLIDING ANIMATION) */}
            {/* THEME TOGGLE */}
            {isCollapsed ? (
              /* COLLAPSED STATE: Single Animated Button */
              <button
                onClick={() => setIsDark(!isDark)}
                className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center relative overflow-hidden transition-colors duration-300 shadow-sm ${isDark ? 'bg-[#0B1221] border border-white/5' : 'bg-[#D1DCE8] shadow-inner'
                  }`}
                title="Toggle Theme"
              >
                {/* Sun icon (Spins out in Dark Mode) */}
                <Sun
                  size={22}
                  className={`absolute transition-all duration-500 ease-in-out ${!isDark
                      ? 'text-[#0B1B3D] opacity-100 rotate-0 scale-100'
                      : 'text-slate-500 opacity-0 rotate-90 scale-50'
                    }`}
                />
                {/* Moon icon (Spins in during Dark Mode) */}
                <Moon
                  size={22}
                  className={`absolute transition-all duration-500 ease-in-out ${isDark
                      ? 'text-white opacity-100 rotate-0 scale-100'
                      : 'text-slate-500 opacity-0 -rotate-90 scale-50'
                    }`}
                />
              </button>
            ) : (
              /* EXPANDED STATE: Sliding Pill */
              <div className={`relative p-1 flex transition-colors duration-300 rounded-full flex-row ${isDark ? 'bg-[#0B1221] border border-white/5' : 'bg-[#D1DCE8] shadow-inner'
                }`}>
                {/* THE SLIDING THUMB */}
                <div
                  className={`absolute left-1 top-1 rounded-full transition-transform duration-300 ease-out shadow-sm w-[calc(50%-4px)] h-[calc(100%-8px)] ${isDark ? 'bg-[#22314E] translate-x-full' : 'bg-white translate-x-0'
                    }`}
                />

                {/* LIGHT BUTTON */}
                <button
                  onClick={() => setIsDark(false)}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold transition-colors duration-300 ${!isDark ? 'text-[#0B1B3D]' : 'text-slate-500 hover:text-white'}`}
                >
                  <Sun size={18} />
                  <span className="text-sm">Light</span>
                </button>

                {/* DARK BUTTON */}
                <button
                  onClick={() => setIsDark(true)}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-500 hover:text-[#0B1B3D] dark:hover:text-white'}`}
                >
                  <Moon size={18} />
                  <span className="text-sm">Dark</span>
                </button>
              </div>
            )}

            {/* User Profile */}
            <div
              onClick={handleLogout}
              className={`flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition ${isCollapsed ? 'justify-center' : ''}`}
              title="Click to Logout"
            >
              <div className="h-10 w-10 rounded-full bg-slate-800 shrink-0 border-2 border-white dark:border-slate-600 shadow-sm overflow-hidden transition-colors">
                <div className="w-full h-full bg-gradient-to-tr from-orange-400 to-blue-900"></div>
              </div>
              {!isCollapsed && (
                <div className="leading-tight whitespace-nowrap overflow-hidden border-l-2 border-slate-300 dark:border-slate-600 pl-3 transition-colors">
                  <p className="font-bold text-[#0B1B3D] dark:text-white transition-colors">Juan Dela Cruz</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* SECTION: MAIN CONTENT WRAPPER */}
        <div className="flex-1 min-w-0 flex flex-col relative z-10">

          {/* Header */}
          <header className="h-[100px] px-8 flex items-center justify-between shrink-0">
            <h1 className="text-4xl font-extrabold text-[#0B1B3D] dark:text-white tracking-tight ml-2 transition-colors">
              {getHeaderTitle()}
            </h1>

            <div className="text-right leading-tight hidden md:block">
              <p className="text-xl text-[#0B1B3D] dark:text-white font-bold transition-colors">Creo Mechalab X</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide text-sm transition-colors">TESDA NC II Trainer</p>
            </div>
          </header>

          {/* Scrollable Content Area */}
          <main className="flex-1 overflow-auto p-4 md:p-8 pt-0 select-text">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;