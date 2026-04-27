import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Lock } from 'lucide-react'; 
import { isGodModeSession, clearAuthSession } from '../utils/auth';

const DeveloperDock: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const godMode = isGodModeSession();
    
    const [isExpanded, setIsExpanded] = useState(false);
    const [isTerminating, setIsTerminating] = useState(false);
    const [step, setStep] = useState(0);

    // 🚀 CRITICAL FIX: We must keep this component mounted if it is currently animating 
    // the termination sequence, even if the role is wiped from storage!
    if (!godMode && !isTerminating) return null;

    const handleLogout = () => {
        setIsExpanded(false); 
        setIsTerminating(true); 
        setStep(0); // Stage 0: Doors closing
        
        // Stage 1: Terminal Boot (800ms) - Doors are closed, show wipe UI
        setTimeout(() => setStep(1), 800);

        // Stage 2: Wipe Complete (2600ms) - Hide Wipe UI
        setTimeout(() => setStep(2), 2600);

        // 🌟 SEAMLESS REDIRECT 🌟 (2800ms)
        // Wipe the auth token and swap the route to /login behind the closed doors
        setTimeout(() => {
            clearAuthSession();
            navigate('/login', { replace: true });
        }, 2800);

        // Stage 3: Hangar Doors blast open! (3000ms)
        // The user will see the Login screen underneath
        setTimeout(() => setStep(3), 3000);

        // Cleanup: Unmount component completely (4000ms)
        setTimeout(() => setIsTerminating(false), 4000); 
    };

    const isAdminView = location.pathname.startsWith('/admin');

    // Determines if doors should be closed
    const doorsClosed = step === 0 || step === 1 || step === 2;

    return (
        <>
            {/* 🌟 M.A.X. HANGAR DOOR SHUTDOWN SEQUENCE 🌟 */}
            <AnimatePresence>
                {isTerminating && (
                    <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center overflow-hidden select-none pointer-events-none">
                        
                        {/* TOP HANGAR DOOR */}
                        <motion.div
                            initial={{ y: '-100%' }}
                            animate={{ y: doorsClosed ? '0%' : '-100%' }}
                            transition={{ type: 'spring', stiffness: 50, damping: 12, mass: 2 }}
                            className="absolute top-0 left-0 w-full h-1/2 bg-[#0B1120] border-b-[16px] border-slate-800 z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col justify-end overflow-hidden"
                        >
                            <div className="absolute bottom-0 left-0 w-full h-4 bg-[repeating-linear-gradient(45deg,#eab308_0px,#eab308_20px,#000_20px,#000_40px)] opacity-80" />
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-slate-500 font-black tracking-[0.5em] text-xl sm:text-2xl uppercase opacity-40 whitespace-nowrap">
                                <Lock size={32} className="hidden sm:block" /> SYSTEM SECURED <Lock size={32} className="hidden sm:block" />
                            </div>
                        </motion.div>

                        {/* BOTTOM HANGAR DOOR */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: doorsClosed ? '0%' : '100%' }}
                            transition={{ type: 'spring', stiffness: 50, damping: 12, mass: 2 }}
                            className="absolute bottom-0 left-0 w-full h-1/2 bg-[#0B1120] border-t-[16px] border-slate-800 z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] flex flex-col justify-start overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-4 bg-[repeating-linear-gradient(45deg,#eab308_0px,#eab308_20px,#000_20px,#000_40px)] opacity-80" />
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-slate-500 font-black tracking-[0.5em] text-xl sm:text-2xl uppercase opacity-40 whitespace-nowrap">
                                <Lock size={32} className="hidden sm:block" /> LINK SEVERED <Lock size={32} className="hidden sm:block" />
                            </div>
                        </motion.div>

                        {/* WIPE PROGRESS TERMINAL (Appears only when doors are fully closed) */}
                        <AnimatePresence>
                            {step === 1 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute inset-0 z-[110] bg-[#050B14]/80 text-rose-500 font-mono flex flex-col items-center justify-center overflow-hidden"
                                >
                                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] z-0" />
                                    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] z-0" />

                                    <motion.div className="flex flex-col items-center z-10 p-8 border border-rose-500/30 bg-rose-950/80 rounded-2xl backdrop-blur-md shadow-[0_0_50px_rgba(225,29,72,0.2)]">
                                        <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                            <Power className="w-16 h-16 text-rose-500 mb-6 drop-shadow-[0_0_15px_rgba(225,29,72,0.8)]" />
                                        </motion.div>

                                        <h1 className="text-2xl sm:text-4xl font-black tracking-[0.2em] mb-2 text-center drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]">
                                            TERMINATING
                                        </h1>
                                        
                                        <p className="text-rose-300 tracking-[0.2em] uppercase text-[10px] sm:text-xs mb-8 font-bold text-center">
                                            Wiping M.A.X. Diagnostic Link
                                        </p>

                                        {/* Wipe Progress Bar */}
                                        <div className="w-64 sm:w-80 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-rose-900 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                                            <motion.div
                                                initial={{ width: "0%" }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 1.8, ease: "linear" }}
                                                className="h-full bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.9)]"
                                            />
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </div>
                )}
            </AnimatePresence>

            {/* Main Dock UI */}
            <div className={`fixed bottom-6 left-6 z-[9999] font-mono select-none flex flex-col items-start gap-3 transition-opacity duration-300 ${isTerminating ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                
                {/* Expanded Action Menu */}
                {isExpanded && (
                    <div className="bg-black/95 border border-green-500/50 p-3 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.2)] backdrop-blur-md flex flex-col gap-2 min-w-[220px] origin-bottom-left animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <div className="text-green-500 text-xs tracking-[0.2em] uppercase mb-1 border-b border-green-500/30 pb-2 text-center font-bold">
                            System Override
                        </div>

                        <button
                            onClick={() => {
                                navigate(isAdminView ? '/dashboard' : '/admin/dashboard');
                                setIsExpanded(false);
                            }}
                            className="w-full py-2.5 px-3 bg-green-500/10 hover:bg-green-500/25 text-green-400 text-sm border border-green-500/30 transition-all rounded text-left flex justify-between items-center group"
                        >
                            <span className="group-hover:translate-x-1 transition-transform">
                                {isAdminView ? 'Switch to Trainee' : 'Switch to Admin'}
                            </span>
                            <span>{isAdminView ? '👤' : '🛡️'}</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full py-2.5 px-3 bg-red-500/10 hover:bg-red-500/25 text-rose-400 text-sm border border-red-500/30 transition-all rounded text-left flex justify-between items-center group mt-1"
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
        </>
    );
};

export default DeveloperDock;
