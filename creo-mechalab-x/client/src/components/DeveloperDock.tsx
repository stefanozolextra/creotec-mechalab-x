import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuthRole, clearAuthSession } from '../utils/auth';

const DeveloperDock: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = getAuthRole();
    const [isExpanded, setIsExpanded] = useState(false);

    // If the user is not the developer, this component remains invisible
    if (role !== 'developer') return null;

    const handleLogout = () => {
        // 1. Use your official clear function
        clearAuthSession();
        // 2. Redirect to login
        window.location.href = '/login';
    };

    const isAdminView = location.pathname.startsWith('/admin');

    return (
        /* CHANGED: 'right-6' to 'left-6' and 'items-end' to 'items-start' */
        <div className="fixed bottom-6 left-6 z-[9999] font-mono select-none flex flex-col items-start gap-3">
            
            {/* Expanded Action Menu */}
            {isExpanded && (
                /* CHANGED: 'origin-bottom-right' to 'origin-bottom-left' */
                <div className="bg-black/95 border border-green-500/50 p-3 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.2)] backdrop-blur-md flex flex-col gap-2 min-w-[220px] origin-bottom-left animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="text-green-500 text-xs tracking-[0.2em] uppercase mb-1 border-b border-green-500/30 pb-2 text-center font-bold">
                        System Override
                    </div>

                    <button
                        onClick={() => {
                            navigate(isAdminView ? '/dashboard' : '/admin/dashboard');
                            setIsExpanded(false);
                        }}
                        /* CHANGED: 'text-right' to 'text-left' and 'flex-row-reverse' or standard flex to ensure icon is on the opposite side */
                        className="w-full py-2.5 px-3 bg-green-500/10 hover:bg-green-500/25 text-green-400 text-sm border border-green-500/30 transition-all rounded text-left flex justify-between items-center group"
                    >
                        <span className="group-hover:translate-x-1 transition-transform">
                            {isAdminView ? 'Switch to Trainee' : 'Switch to Admin'}
                        </span>
                        <span>{isAdminView ? '👤' : '🛡️'}</span>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full py-2.5 px-3 bg-red-500/10 hover:bg-red-500/25 text-red-400 text-sm border border-red-500/30 transition-all rounded text-left flex justify-between items-center group mt-1"
                    >
                        <span className="group-hover:translate-x-1 transition-transform">Terminate Session</span>
                        <span>⏻</span>
                    </button>
                </div>
            )}

            {/* Main Floating Indicator Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-3 px-5 py-3 rounded-full border shadow-lg transition-all duration-300 ${isExpanded
                        ? 'bg-green-500 text-black border-green-400 shadow-[0_0_25px_rgba(34,197,94,0.5)]'
                        : 'bg-black/80 text-green-400 border-green-500/50 hover:bg-green-900/40 hover:border-green-400 backdrop-blur-md'
                    }`}
            >
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm font-bold tracking-widest">DEV MODE</span>
            </button>
        </div>
    );
};

export default DeveloperDock;