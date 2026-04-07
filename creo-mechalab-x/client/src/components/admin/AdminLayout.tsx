import { ChevronLeft, ChevronRight, Folder, Home, Layers, LogOut as LogOutIcon, Moon, PieChart, Sun, Users, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logoSrc from '../../assets/logo.png';
import { flushSync } from "react-dom";
import { clearAuthRole, getAuthRole } from "../../utils/auth"; // <-- Imported getAuthRole
import TutorialGuide, { type TutorialStep } from "../TutorialGuide";

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

  // FIX: Default to Light Mode
  const [isDark, setIsDark] = useState(false);

  const role = getAuthRole(); // <-- Get the current active role

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

  const tutorialSteps: TutorialStep[] = [
    { targetId: "admin-nav-dashboard", message: "Dashboard: Your home base. View high-level KPIs, activity feeds, and system health.", sprite: "pointing" },
    { targetId: "admin-nav-trainees", message: "Trainees: Manage all your students, import lists, and reset credentials here.", sprite: "pointing" },
    { targetId: "admin-nav-cohorts", message: "Cohorts: View all your organized batches of trainees to track group progress.", sprite: "pointing" },
    { targetId: "admin-nav-lessons", message: "Lessons: Build your curriculum by creating Modules and assigning interactive Simulations to them.", sprite: "pointing" },
    { targetId: "admin-nav-activity-logs", message: "Activity Logs: A complete timeline of everything trainees have done inside the platform.", sprite: "pointing" }
  ];

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
              <img src={logoSrc} alt="CREOSim Logo" className="h-9 w-9 sm:h-10 sm:w-10 object-contain drop-shadow-[0_0_6px_rgba(6,182,212,0.4)] dark:drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
            </div>
            <div className={`flex flex-col justify-center overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 pl-2"}`}>
              <p className="font-extrabold text-base sm:text-lg tracking-tight dark:text-slate-100 leading-none">CREOSim</p>
              <p className="font-extrabold text-[11px] sm:text-xs tracking-[0.2em] uppercase text-cyan-600 dark:text-cyan-400 leading-none mt-1">MECHA</p>
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
                id={`admin-nav-${item.label.toLowerCase().replace(" ", "-")}`}
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
        <div className={`p-3 space-y-3 sm:space-y-4 flex flex-col ${role === 'developer' ? 'mb-24' : 'mb-2 sm:mb-4'}`}>

          {/* Sidebar Guide Feature */}
          <TutorialGuide
            variant="admin"
            steps={tutorialSteps}
            storageKey="creosim_tutorial_admin_layout"
            renderTrigger={(onClick) => (
              <div onClick={onClick} className="flex items-center h-10 sm:h-11 rounded-[14px] bg-white dark:bg-[#0F172A] shadow-sm hover:shadow-md cursor-pointer transition-all border border-slate-200 dark:border-slate-800 hover:border-blue-300 group">
                <div className="w-[44px] flex items-center justify-center shrink-0">
                  <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-500 transition-transform group-hover:scale-110">
                    <Info size={14} strokeWidth={3} />
                  </div>
                </div>
                <div className={`text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-200 whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "w-0 opacity-0" : "flex-1 opacity-100 pr-3"}`}>
                  System Guide
                </div>
              </div>
            )}
          />

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

          {/* User Profile / Logout (HIDDEN FOR DEVELOPER) */}
          {role !== 'developer' && (
            <div onClick={handleLogout} className="flex items-center h-12 sm:h-14 rounded-2xl hover:bg-white/40 dark:hover:bg-white/5 transition-all cursor-pointer group overflow-hidden">
              <div className="w-[56px] flex items-center justify-center shrink-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-tr from-slate-400 to-blue-900 border-2 border-white dark:border-slate-700 shadow-sm" />
              </div>
              <div className={`flex flex-col justify-center overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? "w-0 opacity-0 border-transparent" : "flex-1 opacity-100 pl-3 border-l-2 border-slate-300 dark:border-slate-700"}`}>
                <p className="font-bold text-xs sm:text-sm dark:text-slate-200">System Administrator</p>
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold group-hover:text-red-500 transition-colors mt-0.5">
                  <LogOutIcon size={10} /> Logout
                </div>
              </div>
            </div>
          )}
        </div>      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* RESPONSIVE HEADER */}
        <header className="h-[80px] sm:h-[100px] px-4 sm:px-8 flex items-center justify-between shrink-0 gap-4 border-b border-transparent">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight dark:text-slate-100 transition-all truncate pr-2">
            {getHeaderTitle()}
          </h1>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm sm:text-base lg:text-lg font-extrabold tracking-tight dark:text-slate-100 leading-none">CREOSim<span className="text-cyan-600 dark:text-cyan-400 ml-1 text-xs sm:text-sm lg:text-base font-black tracking-wide">MECHA</span></p>
              <p className="text-slate-400 dark:text-slate-500 text-[9px] sm:text-[10px] lg:text-xs font-semibold tracking-wider uppercase mt-1">TESDA Mechatronics NC II</p>
            </div>
            <img src={logoSrc} alt="CREOSim Logo" className="hidden sm:block h-9 w-9 lg:h-10 lg:w-10 object-contain drop-shadow-[0_0_6px_rgba(6,182,212,0.3)] dark:drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
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