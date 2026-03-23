import { ChevronLeft, ChevronRight, Folder, Home, Layers, LogOut as LogOutIcon, Moon, PieChart, Sun, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { flushSync } from "react-dom";
import { clearAuthRole } from "../../utils/auth";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: Home },
  { to: "/admin/users", label: "Trainees", icon: Users },
  { to: "/admin/cohorts", label: "Cohorts", icon: Layers },
  { to: "/admin/lessons", label: "Lessons", icon: Folder },
  { to: "/admin/activity-logs", label: "Activity Logs", icon: PieChart },
];

const AdminLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const getHeaderTitle = () => {
    const currentItem = navItems.find((item) => pathname.startsWith(item.to));
    return currentItem ? currentItem.label : "Dashboard";
  };

  const handleLogout = () => {
    clearAuthRole();
    navigate("/login", { replace: true });
  };

  const handleThemeChange = (newMode: boolean) => {
    if (newMode === isDark) return;

    document.documentElement.classList.add("theme-swapping");

    const applyTheme = () => {
      flushSync(() => {
        setIsDark(newMode);
        if (newMode) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      });
    };

    if (document.startViewTransition) {
      const transition = document.startViewTransition(applyTheme);
      transition.finished.finally(() => {
        document.documentElement.classList.remove("theme-swapping");
      });
    } else {
      applyTheme();
      setTimeout(() => document.documentElement.classList.remove("theme-swapping"), 50);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans select-none bg-[#EEF2F6] dark:bg-[#0F172A] text-slate-800 dark:text-slate-200">
      <aside
        className={`relative flex flex-col shrink-0 border-r transition-all duration-500 ease-in-out z-20 
          ${isCollapsed ? "w-[80px]" : "w-[240px]"} 
          bg-[#E3EBF3] dark:bg-[#1E293B] border-slate-200 dark:border-slate-800/50`}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3.5 top-10 w-7 h-7 bg-[#0B1B3D] dark:bg-slate-300 dark:text-[#0B1B3D] text-white rounded-full shadow-md flex items-center justify-center hover:scale-110 transition-transform z-50"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* LOGO SECTION - Mathematically Centered */}
        <div className="h-[90px] sm:h-[100px] flex items-center px-3 overflow-hidden shrink-0">
          <div className="flex items-center min-w-max">
            <div className="w-[56px] flex items-center justify-center shrink-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#0B1B3D] dark:bg-[#0F172A] shrink-0 grid place-items-center shadow-sm">
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-cyan-400 dark:bg-[#3B82F6]" />
              </div>
            </div>
            <div className={`flex flex-col justify-center overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 pl-2"}`}>
              <p className="font-bold text-base sm:text-lg dark:text-slate-100 leading-none">CREOSim</p>
              <p className="font-bold text-base sm:text-lg dark:text-slate-100 leading-none mt-1">MECHA</p>
            </div>
          </div>
        </div>

        {/* NAVIGATION ITEMS - Mathematically Centered */}
        <nav className="flex-1 px-3 mt-2 sm:mt-4 space-y-1.5 sm:space-y-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center h-[48px] sm:h-[52px] rounded-2xl font-bold transition-all duration-300 overflow-hidden ${isActive
                    ? "bg-white text-[#0B1B3D] shadow-sm dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]"
                    : "text-slate-500 hover:bg-white/40 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  }`
                }
              >
                <div className="w-[56px] flex items-center justify-center shrink-0">
                  <Icon size={20} className="sm:w-[22px] sm:h-[22px]" />
                </div>
                <div className={`text-sm sm:text-base transition-all duration-300 whitespace-nowrap overflow-hidden ${isCollapsed ? "w-0 opacity-0" : "flex-1 opacity-100 pr-4"}`}>
                  {item.label}
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* BOTTOM SECTION - Mathematically Centered */}
        <div className="p-3 space-y-3 sm:space-y-4 mb-2 sm:mb-4">

          {/* Theme Toggle */}
          <div
            className={`relative h-10 sm:h-11 flex items-center rounded-full transition-all duration-500 ${isCollapsed ? "w-10 sm:w-11 mx-auto" : "w-full px-1"
              } ${isDark ? "bg-[#0F172A] border border-white/5" : "bg-[#D1DCE8] shadow-inner"}`}
          >
            {isCollapsed ? (
              <button onClick={() => handleThemeChange(!isDark)} className="w-full h-full flex items-center justify-center relative rounded-full">
                <Sun size={18} className={`absolute transition-all duration-500 ${!isDark ? "text-[#0B1B3D] scale-100 rotate-0" : "scale-0 rotate-90"}`} />
                <Moon size={18} className={`absolute transition-all duration-500 ${isDark ? "text-slate-200 scale-100 rotate-0" : "scale-0 -rotate-90"}`} />
              </button>
            ) : (
              <>
                <div
                  className={`absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full transition-transform duration-300 bg-white dark:bg-[#1E293B] shadow-sm ${isDark ? "translate-x-full" : "translate-x-0"
                    }`}
                />
                <button
                  onClick={() => handleThemeChange(false)}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 h-full font-bold text-xs sm:text-sm ${!isDark ? "text-[#0B1B3D]" : "text-slate-500"}`}
                >
                  <Sun size={14} className="sm:w-4 sm:h-4" /> Light
                </button>
                <button
                  onClick={() => handleThemeChange(true)}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 h-full font-bold text-xs sm:text-sm ${isDark ? "text-slate-100" : "text-slate-500"}`}
                >
                  <Moon size={14} className="sm:w-4 sm:h-4" /> Dark
                </button>
              </>
            )}
          </div>

          {/* User Profile / Logout */}
          <div onClick={handleLogout} className="flex items-center h-12 sm:h-14 rounded-2xl hover:bg-white/40 dark:hover:bg-white/5 transition-all cursor-pointer group overflow-hidden">
            <div className="w-[56px] flex items-center justify-center shrink-0">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-tr from-orange-400 to-blue-900 border-2 border-white dark:border-slate-700 shadow-sm" />
            </div>
            <div className={`flex flex-col justify-center overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? "w-0 opacity-0 border-transparent" : "flex-1 opacity-100 pl-3 border-l-2 border-slate-300 dark:border-slate-700"}`}>
              <p className="font-bold text-xs sm:text-sm dark:text-slate-200">Juan Dela Cruz</p>
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold group-hover:text-red-500 transition-colors mt-0.5">
                <LogOutIcon size={10} /> Logout
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* RESPONSIVE HEADER: Text will no longer vanish on portrait sizes */}
        <header className="h-[80px] sm:h-[100px] px-4 sm:px-8 flex items-center justify-between shrink-0 gap-4 border-b border-transparent">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight dark:text-slate-100 transition-all truncate pr-2">
            {getHeaderTitle()}
          </h1>
          <div className="text-left md:text-right mt-1 md:mt-0 shrink-0">
            <p className="text-sm sm:text-lg lg:text-xl font-bold dark:text-slate-100 leading-none">CREOSim - MECHA</p>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs lg:text-sm font-medium mt-1">TESDA Mechatronics NC II Trainer</p>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 pt-0 flex flex-col relative z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;