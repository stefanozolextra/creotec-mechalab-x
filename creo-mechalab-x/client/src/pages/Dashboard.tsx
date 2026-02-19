/* SECTION: IMPORTS & MOCK DATA
   - USE: Standard React hooks, navigation, and custom industrial-style icons.
   - DATA: 'levels' represents the core Mechatronics NC II subjects.
   - HOW TO EDIT: Add or change objects in the 'levels' array to update the simulation map.
*/
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Zap, CheckCircle, ChevronRight, Terminal, BookOpen, Settings, LogOut, Play, X, User, Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { clearAuthRole } from '../utils/auth';

const levels = [
    { id: 1, title: "Mechatronics Basics", status: "completed", score: 100 },
    { id: 2, title: "Hardwired Relay Logic", status: "unlocked", score: 0 },
    { id: 3, title: "Industrial Sensors", status: "locked", score: 0 },
    { id: 4, title: "Pneumatics Systems", status: "locked", score: 0 },
    { id: 5, title: "Electro-Pneumatics", status: "locked", score: 0 },
    { id: 6, title: "Basic PLC", status: "locked", score: 0 },
];

const Dashboard = () => {
    const navigate = useNavigate();
    const [selectedLevel, setSelectedLevel] = useState<number | null>(2);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // NEW: Controls the Modal

    /* SECTION: SESSION LOGIC
       - USE: Handles exiting the trainee environment.
       - HOW IT WORKS: Redirects the trainee to the login screen.
       - EDIT: Add logic to clear local storage or session tokens here later.
    */
    const handleLogout = () => {
        clearAuthRole();
        navigate('/login', { replace: true });
    };

    return (
        /* SECTION: ANIMATION WRAPPER
           - USE: Ensures smooth transitions between the dashboard and other pages.
        */
        <PageTransition>
            <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-24 relative">

                {/* SECTION: HUD (HEADER)
                    - USE: Displays the system branding and the logout command.
                    - HOW TO EDIT: Change the 'Batch 25' text when moving to a new enrollment group.
                */}
                <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-600/20 p-2 rounded-lg border border-cyan-500/50">
                            <Terminal aria-hidden="true" className="text-cyan-400 w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-white tracking-wide">CREO <span className="text-cyan-400">MECHALAB</span> X</h1>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Cadet Interface • Batch 25</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        type="button"
                        className="p-2 hover:bg-red-500/20 rounded-full hover:text-red-400 transition"
                        title="Logout"
                        aria-label="Logout"
                    >
                        <LogOut size={20} aria-hidden="true" />
                    </button>
                </header>

                {/* SECTION: MAIN INTERFACE
                    - USE: Responsive layout. 
                    - MOBILE: 'flex-col-reverse' puts the Mission Detail Panel (Start Button) at the TOP so users don't have to scroll down after selecting a level.
                    - DESKTOP: 'lg:grid lg:grid-cols-3' snaps it back to the side-by-side view.
                */}
                <main className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col-reverse lg:grid lg:grid-cols-3 gap-6 lg:gap-8">

                    {/* SECTION: LEVEL SELECTION (LEFT ON DESKTOP, BOTTOM ON MOBILE)
                        - USE: Interactive vertical map of training modules.
                        - KEYPOINT: Clicking a level updates 'selectedLevel' unless it is 'locked'.
                        - IF REWRITTEN: Ensure the 'Connecting Line' div remains relative to its parent.
                    */}
                    <div className="lg:col-span-2 relative">
                        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                            <Zap className="text-yellow-400" size={20} aria-hidden="true" /> Simulation Modules
                        </h2>

                        <div className="space-y-4 relative">
                            {/* Visual aesthetic: The line connecting modules */}
                            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-700 -z-10"></div>

                            {levels.map((level) => {
                                const isLocked = level.status === 'locked';
                                const isCompleted = level.status === 'completed';
                                const isSelected = selectedLevel === level.id;

                                return (
                                    <button
                                        type="button"
                                        key={level.id}
                                        onClick={() => !isLocked && setSelectedLevel(level.id)}
                                        disabled={isLocked}
                                        aria-pressed={isSelected}
                                        aria-label={`${level.title} module, ${level.status}`}
                                        className={`
                                            relative w-full text-left flex items-center p-4 rounded-xl border transition-all
                                            ${isSelected ? 'bg-slate-800 border-cyan-500 shadow-lg shadow-cyan-900/20 translate-x-2' : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'}
                                            ${isLocked ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
                                        `}
                                    >
                                        {/* CIRCLE ICON: Shows status (Completed/Locked/Active) */}
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-4 font-bold border-2 z-10
                                            ${isCompleted ? 'bg-green-500 border-green-400 text-white' : ''}
                                            ${!isCompleted && !isLocked ? 'bg-slate-900 border-cyan-400 text-cyan-400' : ''}
                                            ${isLocked ? 'bg-slate-800 border-slate-600 text-slate-500' : ''}
                                        `}>
                                            {isCompleted ? <CheckCircle size={20} aria-hidden="true" /> : isLocked ? <Lock size={16} aria-hidden="true" /> : level.id}
                                        </div>

                                        <div className="flex-1">
                                            <h3 className={`font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{level.title}</h3>
                                            <div className="text-xs text-slate-500 uppercase font-mono mt-1">{level.status}</div>
                                        </div>

                                        {isSelected && <ChevronRight className="text-cyan-400 animate-pulse" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION: MISSION DETAIL PANEL (RIGHT ON DESKTOP, TOP ON MOBILE) */}
                    <div className="lg:col-span-1">
                        {/* Sticky wrapper so the panel follows the user on desktop */}
                        <div className="sticky top-24 z-10">
                            {selectedLevel ? (
                                <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 shadow-2xl">
                                    <div className="h-32 md:h-40 bg-slate-700/50 rounded-lg mb-6 flex items-center justify-center border border-slate-600 border-dashed">
                                        <Terminal size={48} className="text-slate-500" aria-hidden="true" />
                                    </div>

                                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                                        {levels.find(l => l.id === selectedLevel)?.title}
                                    </h2>

                                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                        Initialize the wiring interface for this module. Ensure all components are grounded before testing the circuit.
                                    </p>

                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/simulation/${selectedLevel}`)}
                                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/50"
                                        >
                                            <Play size={18} fill="currentColor" aria-hidden="true" /> Start Simulation
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => navigate(`/module/${selectedLevel}`)}
                                            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                                        >
                                            <BookOpen size={18} aria-hidden="true" /> View PDF Manual
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-64 flex items-center justify-center text-slate-500 italic border-2 border-dashed border-slate-700 rounded-xl">
                                    Select a module to view details
                                </div>
                            )}
                        </div>
                    </div>

                </main>

                {/* SECTION: FLOATING TOOLBAR
                    - USE: Quick access to system settings. Trigger sets 'isSettingsOpen' to true.
                */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-full px-6 py-2 flex gap-6 shadow-2xl z-20">
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="text-slate-400 hover:text-white transition p-2"
                        aria-label="Open settings"
                    >
                        <Settings size={20} aria-hidden="true" />
                    </button>
                </div>

                {/* SECTION: PROFILE & SETTINGS MODAL 
                    - USE: Animated overlay displaying Trainee data.
                    - HOW IT WORKS: Framer Motion handles the fade/scale in. Uses a backdrop blur to focus attention.
                */}
                <AnimatePresence>
                    {isSettingsOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative"
                            >
                                {/* Close Button */}
                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition"
                                >
                                    <X size={24} />
                                </button>

                                {/* Modal Header */}
                                <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-800/30">
                                    <div className="bg-slate-700 p-3 rounded-full border border-slate-600">
                                        <User className="text-cyan-400" size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Trainee Profile</h2>
                                        <p className="text-sm text-cyan-500 font-mono">ID: CREO20067</p>
                                    </div>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm flex items-center gap-2"><Shield size={16} /> Clearance Level</span>
                                            <span className="text-white font-semibold">Student / Cadet</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm">Active Batch</span>
                                            <span className="text-white font-semibold">Batch 25</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm">System Access Validity</span>
                                            <span className="text-yellow-500 font-bold">25 Days Remaining</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full py-3 rounded-lg bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 hover:text-red-300 transition flex items-center justify-center gap-2 border border-red-500/20"
                                    >
                                        <LogOut size={18} /> Disconnect from Terminal
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </PageTransition>
    );
};

export default Dashboard;