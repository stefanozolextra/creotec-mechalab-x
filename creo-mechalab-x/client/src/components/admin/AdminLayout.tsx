import { ChevronLeft, ChevronRight, Folder, Home, LogOut as LogOutIcon, Moon, PieChart, Sun, Users } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAuthRole } from "../../utils/auth";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: Home },
  { to: "/admin/users", label: "Trainees", icon: Users },
  { to: "/admin/lessons", label: "Lessons", icon: Folder },
  { to: "/admin/activity-logs", label: "Activity Logs", icon: PieChart },
];

const AdminLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const getHeaderTitle = () => {
    const currentItem = navItems.find((item) => pathname.startsWith(item.to));
    return currentItem ? currentItem.label : "Dashboard";
  };

  const handleLogout = () => {
    clearAuthRole();
    navigate("/login", { replace: true });
  };

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="h-screen w-full flex overflow-hidden font-sans select-none transition-colors duration-300 bg-[#EEF2F6] dark:bg-[#0F172A] text-slate-800 dark:text-slate-200">
        <aside
          className={`relative flex flex-col shrink-0 border-r transition-all duration-500 ease-in-out z-20 
            ${isCollapsed ? "w-[88px]" : "w-[280px]"} 
            bg-[#E3EBF3] dark:bg-[#1E293B] border-slate-200 dark:border-slate-800/50`}
        >
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3.5 top-10 w-7 h-7 bg-[#0B1B3D] dark:bg-slate-300 dark:text-[#0B1B3D] text-white rounded-full shadow-md flex items-center justify-center hover:scale-110 transition-transform z-50"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <div className="h-[100px] flex items-center px-6 overflow-hidden shrink-0">
            <div className="flex items-center gap-4 min-w-[210px]">
              <div className="h-10 w-10 rounded-xl bg-[#0B1B3D] dark:bg-[#0F172A] shrink-0 grid place-items-center">
                <div className="w-4 h-4 rounded bg-cyan-400 dark:bg-[#3B82F6]" />
              </div>
              <div className={`transition-all duration-300 ${isCollapsed ? "opacity-0 -translate-x-4" : "opacity-100 translate-x-0"}`}>
                <p className="font-bold text-lg dark:text-slate-100 leading-none">Creo</p>
                <p className="font-bold text-lg dark:text-slate-100 leading-none mt-1">Mechalab X</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 mt-4 space-y-2 overflow-y-auto overflow-x-hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center h-[52px] rounded-2xl font-bold transition-all duration-300 whitespace-nowrap ${
                      isActive
                        ? "bg-white text-[#0B1B3D] shadow-sm dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]"
                        : "text-slate-500 hover:bg-white/40 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                    }`
                  }
                >
                  <div className="w-[56px] flex items-center justify-center shrink-0">
                    <Icon size={22} />
                  </div>
                  <span className={`transition-all duration-300 ${isCollapsed ? "opacity-0 -translate-x-4" : "opacity-100 translate-x-0"}`}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 space-y-4 mb-4">
            <div
              className={`relative h-11 flex items-center rounded-full transition-all duration-500 ${
                isCollapsed ? "w-11 mx-auto" : "w-full px-1"
              } ${isDark ? "bg-[#0F172A] border border-white/5" : "bg-[#D1DCE8] shadow-inner"}`}
            >
              {isCollapsed ? (
                <button onClick={() => setIsDark(!isDark)} className="w-full h-full flex items-center justify-center relative rounded-full">
                  <Sun size={20} className={`absolute transition-all duration-500 ${!isDark ? "text-[#0B1B3D] scale-100 rotate-0" : "scale-0 rotate-90"}`} />
                  <Moon size={20} className={`absolute transition-all duration-500 ${isDark ? "text-slate-200 scale-100 rotate-0" : "scale-0 -rotate-90"}`} />
                </button>
              ) : (
                <>
                  <div
                    className={`absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full transition-transform duration-300 bg-white dark:bg-[#1E293B] shadow-sm ${
                      isDark ? "translate-x-full" : "translate-x-0"
                    }`}
                  />
                  <button
                    onClick={() => setIsDark(false)}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2 h-full font-bold text-sm ${!isDark ? "text-[#0B1B3D]" : "text-slate-500"}`}
                  >
                    <Sun size={16} /> Light
                  </button>
                  <button
                    onClick={() => setIsDark(true)}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2 h-full font-bold text-sm ${isDark ? "text-slate-100" : "text-slate-500"}`}
                  >
                    <Moon size={16} /> Dark
                  </button>
                </>
              )}
            </div>

            <div onClick={handleLogout} className="flex items-center h-14 rounded-2xl hover:bg-white/40 dark:hover:bg-white/5 transition-all cursor-pointer group overflow-hidden">
              <div className="w-[56px] flex items-center justify-center shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-orange-400 to-blue-900 border-2 border-white dark:border-slate-700 shadow-sm" />
              </div>
              <div className={`flex-1 border-l-2 border-slate-300 dark:border-slate-700 pl-3 transition-all duration-300 ${isCollapsed ? "opacity-0 -translate-x-4" : "opacity-100 translate-x-0"}`}>
                <p className="font-bold whitespace-nowrap text-sm dark:text-slate-200">Juan Dela Cruz</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-bold group-hover:text-red-500 transition-colors">
                  <LogOutIcon size={10} /> Logout
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-[100px] px-8 flex items-center justify-between shrink-0">
            <h1 className="text-4xl font-black tracking-tight dark:text-slate-100 transition-all">{getHeaderTitle()}</h1>
            <div className="text-right hidden md:block">
              <p className="text-xl font-bold dark:text-slate-100 leading-none">Creo Mechalab X</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">TESDA NC II Trainer</p>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-8 pt-0 flex flex-col">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
