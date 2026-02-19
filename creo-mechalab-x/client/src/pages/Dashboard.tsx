/* SECTION: IMPORTS & MOCK DATA
   - USE: Standard React hooks, navigation, and custom industrial-style icons.
   - [cite_start]DATA: 'levels' represents the core Mechatronics NC II subjects [cite: 6, 115-123].
   - HOW TO EDIT: Add or change objects in the 'levels' array to update the simulation map.
*/
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Zap, CheckCircle, ChevronRight, Terminal, BookOpen, Settings, LogOut, Play } from 'lucide-react';
import PageTransition from '../components/PageTransition';

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

    /* SECTION: SESSION LOGIC
       - USE: Handles exiting the trainee environment.
       - HOW IT WORKS: Redirects the trainee to the login screen.
       - EDIT: Add logic to clear local storage or session tokens here later.
    */
    const handleLogout = () => {
        console.log("Logging out...");
        navigate('/login');
    };

    return (
        /* SECTION: ANIMATION WRAPPER
           - USE: Ensures smooth transitions between the dashboard and other pages.
        */
        <PageTransition>
            <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-24">

                {/* SECTION: HUD (HEADER)
                    - USE: Displays the system branding and the logout command.
                    - HOW TO EDIT: Change the 'Batch 25' text when moving to a new enrollment group.
                */}
                <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-600/20 p-2 rounded-lg border border-cyan-500/50">
                            <Terminal className="text-cyan-400 w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-white tracking-wide">CREO <span className="text-cyan-400">MECHALAB</span> X</h1>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Cadet Interface • Batch 25</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-2 hover:bg-red-500/20 rounded-full hover:text-red-400 transition"
                        title="Logout"
                    >
                        <LogOut size={20} />
                    </button>
                </header>

                {/* SECTION: MAIN INTERFACE
                    - USE: Two-column grid for level selection (Left) and mission details (Right).
                */}
                <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* SECTION: LEVEL SELECTION (LEFT)
                        - USE: Interactive vertical map of training modules.
                        - KEYPOINT: Clicking a level updates 'selectedLevel' unless it is 'locked'.
                        - IF REWRITTEN: Ensure the 'Connecting Line' div remains relative to its parent.
                    */}
                    <div className="lg:col-span-2 relative">
                        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                            <Zap className="text-yellow-400" size={20} /> Simulation Modules
                        </h2>

                        <div className="space-y-4 relative">
                            {/* Visual aesthetic: The line connecting modules */}
                            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-700 -z-10"></div>

                            {levels.map((level) => {
                                const isLocked = level.status === 'locked';
                                const isCompleted = level.status === 'completed';
                                const isSelected = selectedLevel === level.id;

                                return (
                                    <div
                                        key={level.id}
                                        onClick={() => !isLocked && setSelectedLevel(level.id)}
                                        className={`
                                            relative flex items-center p-4 rounded-xl border transition-all cursor-pointer
                                            ${isSelected ? 'bg-slate-800 border-cyan-500 shadow-lg shadow-cyan-900/20 translate-x-2' : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'}
                                            ${isLocked ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                                        `}
                                    >
                                        {/* CIRCLE ICON: Shows status (Completed/Locked/Active) */}
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-4 font-bold border-2 z-10
                                            ${isCompleted ? 'bg-green-500 border-green-400 text-white' : ''}
                                            ${!isCompleted && !isLocked ? 'bg-slate-900 border-cyan-400 text-cyan-400' : ''}
                                            ${isLocked ? 'bg-slate-800 border-slate-600 text-slate-500' : ''}
                                        `}>
                                            {isCompleted ? <CheckCircle size={20} /> : isLocked ? <Lock size={16} /> : level.id}
                                        </div>

                                        <div className="flex-1">
                                            <h3 className={`font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{level.title}</h3>
                                            <div className="text-xs text-slate-500 uppercase font-mono mt-1">{level.status}</div>
                                        </div>

                                        {isSelected && <ChevronRight className="text-cyan-400 animate-pulse" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION: MISSION DETAIL PANEL (RIGHT)
                        - USE: Displays dynamic info based on the module selected in the Left Column.
                        - KEYPOINT: 'levels.find' is used to pull the correct title from the mock data.
                        - EDIT: Update 'Start Simulation' button to link to Level 1-10 components.
                    */}
                    <div className="lg:col-span-1">
                        {selectedLevel ? (
                            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 sticky top-24 shadow-2xl">
                                <div className="h-40 bg-slate-700/50 rounded-lg mb-6 flex items-center justify-center border border-slate-600 border-dashed">
                                    <Terminal size={48} className="text-slate-500" />
                                </div>

                                <h2 className="text-2xl font-bold text-white mb-2">
                                    {levels.find(l => l.id === selectedLevel)?.title}
                                </h2>

                                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                    Initialize the wiring interface for this module. Ensure all components are grounded before testing the circuit.
                                </p>

                                <div className="space-y-3">
                                    <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/50">
                                        <Play size={18} fill="currentColor" /> Start Simulation
                                    </button>
                                    <button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all">
                                        <BookOpen size={18} /> View PDF Manual
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 italic border-2 border-dashed border-slate-700 rounded-xl">
                                Select a module to view details
                            </div>
                        )}
                    </div>

                </main>

                {/* SECTION: FLOATING TOOLBAR
                    - USE: Quick access to system settings.
                    - HOW TO EDIT: Add more buttons here for 'Profile' or 'Help'.
                */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-full px-6 py-2 flex gap-6 shadow-2xl z-20">
                    <button className="text-slate-400 hover:text-white transition p-2"><Settings size={20} /></button>
                </div>

            </div>
        </PageTransition>
    );
};

export default Dashboard;