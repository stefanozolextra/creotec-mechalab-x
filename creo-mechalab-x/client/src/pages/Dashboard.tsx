import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BookOpen,
    CheckCircle,
    ChevronRight,
    Loader2,
    Lock,
    LogOut,
    Play,
    Settings,
    Shield,
    Terminal,
    User,
    X,
    Moon,
    Sun,
    Crosshair
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CyberTransition from '../components/CyberTransition';
import { clearAuthRole } from '../utils/auth';
import { getTraineeDashboard } from '../api/trainees';
import type {
    DashboardState,
    ModuleStatusApi,
    ModuleStatusValue,
    SimulationApi,
} from '../types/traineeDashboard';

type LevelCard = {
    id: number;
    title: string;
    moduleCode: string;
    description: string | null;
    status: 'completed' | 'unlocked' | 'locked';
    score: number;
};

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getLevelStatus = (moduleStatus: ModuleStatusValue | undefined): LevelCard['status'] => {
    if (moduleStatus === 'COMPLETED') return 'completed';
    if (moduleStatus === 'IN_PROGRESS') return 'unlocked';
    return 'locked';
};

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const isAbortError = (error: unknown): boolean => {
    return (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
    );
};

const getScorePercent = (moduleStatus: ModuleStatusApi | undefined): number => {
    if (!moduleStatus) return 0;

    const required = toNumber(moduleStatus.required_sims);
    const completed = toNumber(moduleStatus.completed_required_sims);

    if (required <= 0) return 100;
    const percent = Math.round((completed / required) * 100);
    return Math.max(0, Math.min(100, percent));
};

const isCompletedValue = (value: boolean | string | number | null | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return false;
};

const getNextSimulationByModuleId = (
    simulations: SimulationApi[],
    simulationProgressById: Map<number, boolean>
): Map<number, number> => {
    const grouped = new Map<number, SimulationApi[]>();

    for (const simulation of simulations) {
        const moduleId = toNumber(simulation.module_id);
        if (!grouped.has(moduleId)) grouped.set(moduleId, []);
        grouped.get(moduleId)?.push(simulation);
    }

    const nextByModule = new Map<number, number>();

    for (const [moduleId, moduleSimulations] of grouped.entries()) {
        moduleSimulations.sort((a, b) => toNumber(a.order_no) - toNumber(b.order_no));
        const requiredSimulations = moduleSimulations.filter((simulation) => simulation.is_required);

        const candidate =
            requiredSimulations.length > 0
                ? requiredSimulations.find(
                    (simulation) => !simulationProgressById.get(toNumber(simulation.simulation_id))
                ) ?? requiredSimulations[0]
                : moduleSimulations[0];

        if (candidate) {
            nextByModule.set(moduleId, toNumber(candidate.simulation_id));
        }
    }

    return nextByModule;
};

const Dashboard = () => {
    const navigate = useNavigate();

    const [dashboardState, setDashboardState] = useState<DashboardState>({
        data: null,
        loading: true,
        error: null,
        completingSimulationIds: {},
        staleAfterMutation: false,
    });

    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const requestControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        if (newMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const loadDashboard = useCallback(async () => {
        requestControllerRef.current?.abort();
        const controller = new AbortController();
        requestControllerRef.current = controller;

        setDashboardState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const data = await getTraineeDashboard({ signal: controller.signal });

            const moduleIds = data.moduleContent.modules
                .map((module) => toNumber(module.module_id))
                .filter((moduleId) => Number.isInteger(moduleId) && moduleId > 0);

            setSelectedLevel((previousSelection) => {
                if (moduleIds.length === 0) return null;
                if (previousSelection !== null && moduleIds.includes(previousSelection)) {
                    return previousSelection;
                }
                return moduleIds[0];
            });

            setDashboardState((prev) => ({
                ...prev,
                data,
                loading: false,
                error: null,
            }));
        } catch (error) {
            if (controller.signal.aborted || isAbortError(error)) return;

            setDashboardState((prev) => ({
                ...prev,
                data: null,
                loading: false,
                error: getErrorMessage(error, 'System failure: Unable to establish link to central core.'),
            }));
            setSelectedLevel(null);
        }
    }, []);

    useEffect(() => {
        void loadDashboard();
        return () => {
            requestControllerRef.current?.abort();
        };
    }, [loadDashboard]);

    const moduleStatusByModuleId = useMemo(() => {
        const map = new Map<number, ModuleStatusApi>();
        const data = dashboardState.data;
        if (!data) return map;

        for (const moduleStatus of data.moduleStatus) {
            map.set(toNumber(moduleStatus.module_id), moduleStatus);
        }

        return map;
    }, [dashboardState.data]);

    const simulationProgressById = useMemo(() => {
        const map = new Map<number, boolean>();
        const data = dashboardState.data;
        if (!data) return map;

        for (const progressRow of data.simulationProgress) {
            map.set(toNumber(progressRow.simulation_id), isCompletedValue(progressRow.is_completed));
        }

        return map;
    }, [dashboardState.data]);

    const levels = useMemo<LevelCard[]>(() => {
        const data = dashboardState.data;
        if (!data) return [];

        return [...data.moduleContent.modules]
            .sort((a, b) => toNumber(a.order_no) - toNumber(b.order_no))
            .map((module) => {
                const moduleId = toNumber(module.module_id);
                const moduleStatus = moduleStatusByModuleId.get(moduleId);

                return {
                    id: moduleId,
                    title: module.title,
                    moduleCode: module.module_code,
                    description: module.description,
                    status: getLevelStatus(moduleStatus?.module_status),
                    score: getScorePercent(moduleStatus),
                };
            });
    }, [dashboardState.data, moduleStatusByModuleId]);

    const nextSimulationByModuleId = useMemo(() => {
        const simulations = dashboardState.data?.moduleContent.simulations ?? [];
        return getNextSimulationByModuleId(simulations, simulationProgressById);
    }, [dashboardState.data, simulationProgressById]);

    const selectedLevelData = useMemo(
        () => levels.find((level) => level.id === selectedLevel) ?? null,
        [levels, selectedLevel]
    );

    const selectedSimulationId =
        selectedLevel !== null ? nextSimulationByModuleId.get(selectedLevel) ?? null : null;

    const trainee = dashboardState.data?.trainee ?? null;

    const handleLogout = () => {
        clearAuthRole();
        navigate('/login', { replace: true });
    };

    const handleStartSimulation = () => {
        if (!selectedSimulationId) return;
        navigate(`/simulation/${selectedSimulationId}`);
    };

    const handleViewModule = () => {
        if (!selectedLevelData) return;
        navigate(`/module/${selectedLevelData.id}`);
    };

    return (
        // 2. Wrapped everything in CyberTransition!
        <CyberTransition>
            <div className="min-h-screen w-full overflow-x-hidden bg-slate-100 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-8 relative transition-colors duration-300 z-0">

                {/* GAME HUD GRID BACKGROUND */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] pointer-events-none -z-10" />

                {/* HEADER - HUD BAR */}
                <header className="border-b-2 border-slate-300 dark:border-cyan-900/50 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md sticky top-0 z-50 px-3 sm:px-6 py-3 flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(6,182,212,0.1)] transition-colors duration-300">

                    {/* Logo & Trainee Info */}
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <div className="bg-cyan-500/10 p-1.5 sm:p-2 border-l-2 border-cyan-500 transition-colors shrink-0 flex items-center justify-center -skew-x-6">
                            <Crosshair aria-hidden="true" className="text-cyan-600 dark:text-cyan-400 w-4 h-4 sm:w-6 sm:h-6 animate-[spin_10s_linear_infinite]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="font-black text-sm sm:text-xl text-slate-900 dark:text-white tracking-widest uppercase transition-colors leading-tight truncate">
                                CREO <span className="text-cyan-600 dark:text-cyan-400">MECHALAB</span> <span className="hidden sm:inline">X</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-cyan-400/70 uppercase tracking-widest sm:tracking-[0.2em] font-mono transition-colors truncate">
                                    SYS.ONLINE <span className="hidden sm:inline">| {trainee?.batch_code ?? 'BATCH --'}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="p-2 sm:p-2.5 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 transition hover:bg-slate-200 dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 font-mono text-xs flex items-center gap-2"
                            title="Toggle Optics"
                        >
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                            <span className="hidden lg:inline uppercase font-bold tracking-widest">Optics</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 sm:p-2.5 text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 transition hover:bg-slate-200 dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 font-mono text-xs flex items-center gap-2"
                            title="System Config"
                        >
                            <Settings size={16} aria-hidden="true" />
                            <span className="hidden lg:inline uppercase font-bold tracking-widest">Config</span>
                        </button>

                        <div className="w-px h-5 sm:h-6 bg-slate-300 dark:bg-slate-700 mx-1 transition-colors hidden sm:block" />

                        <button
                            onClick={handleLogout}
                            type="button"
                            className="p-2 sm:p-2.5 text-slate-500 hover:bg-red-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400 rounded border border-transparent dark:hover:border-red-500/50 transition-colors font-mono text-xs flex items-center gap-2"
                            title="Disconnect"
                        >
                            <LogOut size={16} aria-hidden="true" />
                            <span className="hidden lg:inline uppercase font-bold tracking-widest">Abort</span>
                        </button>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto p-3 sm:p-6 flex flex-col md:grid md:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 mt-2 sm:mt-4">

                    {/* MODULES TIMELINE LIST */}
                    <div className="md:col-span-7 xl:col-span-8 relative">

                        <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-slate-300 dark:border-slate-800 pb-2">
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 sm:gap-3">
                                <Terminal className="text-cyan-600 dark:text-cyan-400 w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="truncate">Training Protocols</span>
                            </h2>
                            <span className="font-mono text-[9px] sm:text-xs text-slate-500 dark:text-slate-500 tracking-widest hidden sm:inline">
                                SELECT_MISSION
                            </span>
                        </div>

                        <div className="space-y-3 sm:space-y-4">
                            {dashboardState.loading ? (
                                <div className="h-32 sm:h-48 flex flex-col items-center justify-center text-cyan-600 dark:text-cyan-500 border border-slate-300 dark:border-cyan-900/50 rounded bg-white/50 dark:bg-cyan-950/10 font-mono text-xs sm:text-sm tracking-widest uppercase">
                                    <Loader2 size={24} className="animate-spin mb-3" /> Establishing link...
                                </div>
                            ) : dashboardState.error ? (
                                <div className="p-4 sm:p-6 border-l-4 border-red-500 bg-white dark:bg-[#111827] shadow-lg text-red-600 dark:text-red-400">
                                    <p className="font-black text-sm sm:text-base uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <AlertTriangle size={18} /> Critical Error
                                    </p>
                                    <p className="text-xs sm:text-sm font-mono mb-4 text-slate-600 dark:text-slate-400">{dashboardState.error}</p>
                                    <button
                                        type="button"
                                        onClick={() => void loadDashboard()}
                                        className="bg-red-500 hover:bg-red-600 text-white px-4 sm:px-6 py-2 uppercase font-black tracking-widest text-[10px] sm:text-xs transition-colors"
                                    >
                                        Re-establish Connection
                                    </button>
                                </div>
                            ) : levels.length === 0 ? (
                                <div className="h-32 sm:h-48 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/20 font-mono text-xs sm:text-sm tracking-widest uppercase text-center p-4">
                                    No protocols assigned.
                                </div>
                            ) : (
                                levels.map((level, index) => {
                                    const isLocked = level.status === 'locked';
                                    const isCompleted = level.status === 'completed';
                                    const isSelected = selectedLevel === level.id;

                                    const hexId = `0x${(level.id * 12345).toString(16).toUpperCase().substring(0, 4)}`;

                                    return (
                                        <div
                                            key={level.id}
                                            className={`
                                                relative w-full text-left flex flex-col transition-all duration-300
                                                ${isSelected
                                                    ? 'bg-white dark:bg-[#111827] border-l-4 border-l-cyan-500 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-slate-200 dark:ring-cyan-500/20 z-10 md:scale-[1.01] md:translate-x-2'
                                                    : 'bg-white/70 dark:bg-slate-800/30 border-l-4 border-l-transparent hover:border-l-slate-400 dark:hover:border-l-slate-600 hover:bg-white dark:hover:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-800'
                                                }
                                                ${isLocked ? 'opacity-60 grayscale' : ''}
                                            `}
                                        >
                                            <div
                                                role="button"
                                                tabIndex={isLocked ? -1 : 0}
                                                onClick={() => !isLocked && setSelectedLevel(level.id)}
                                                onKeyDown={(e) => {
                                                    if (!isLocked && (e.key === 'Enter' || e.key === ' ')) {
                                                        e.preventDefault();
                                                        setSelectedLevel(level.id);
                                                    }
                                                }}
                                                className={`flex flex-row items-center p-3 sm:p-4 w-full outline-none ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                aria-pressed={isSelected}
                                            >
                                                <div className="flex items-center mr-3 sm:mr-5 shrink-0">
                                                    <div
                                                        className={`
                                                            w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-black text-sm sm:text-lg -skew-x-12 transition-all duration-300 shadow-sm
                                                            ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                                                            ${!isCompleted && !isLocked ? 'bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-900 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : ''}
                                                            ${isLocked ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500' : ''}
                                                        `}
                                                    >
                                                        <div className="skew-x-12">
                                                            {isCompleted ? <CheckCircle size={18} className="sm:w-[22px] sm:h-[22px]" /> : isLocked ? <Lock size={16} /> : String(index + 1).padStart(2, '0')}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h3 className={`font-black text-sm sm:text-base truncate uppercase tracking-wide transition-colors ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                            {level.title}
                                                        </h3>
                                                        {isSelected && <ChevronRight className="text-cyan-600 dark:text-cyan-400 animate-pulse hidden sm:block shrink-0" size={20} />}
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 mt-1 sm:mt-2 text-[9px] sm:text-xs font-mono tracking-widest uppercase">
                                                        <span className="text-cyan-600 dark:text-cyan-500 font-bold bg-cyan-50 dark:bg-cyan-950/30 px-1.5 py-0.5 rounded-sm">
                                                            {level.moduleCode}
                                                        </span>
                                                        <span className={`font-bold ${isCompleted ? 'text-emerald-500' : isLocked ? 'text-slate-400' : 'text-cyan-600 dark:text-cyan-400'} sm:hidden`}>
                                                            {isCompleted ? 'CLEARED' : isLocked ? 'LOCKED' : 'READY'}
                                                        </span>
                                                        <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">ADDR:{hexId}</span>

                                                        <div className="flex items-center gap-2 ml-auto sm:ml-0">
                                                            <span className={isCompleted ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}>
                                                                {level.score}%
                                                            </span>
                                                            <div className="w-12 sm:w-16 h-1 sm:h-1.5 bg-slate-200 dark:bg-slate-800 overflow-hidden rounded-sm hidden xs:block">
                                                                <div
                                                                    className={`h-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                                                                    style={{ width: `${level.score}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mobile Accordion */}
                                            {isSelected && (
                                                <div className="px-3 pb-3 md:hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-3 mt-1">
                                                        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3 font-mono">
                                                            {'>'} {level.description ?? 'Initialize the wiring interface for this module before testing the circuit.'}
                                                        </p>
                                                        <div className="flex flex-col gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleStartSimulation}
                                                                disabled={!selectedSimulationId}
                                                                className="group relative overflow-hidden w-full bg-cyan-600 dark:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white dark:text-slate-900 py-2.5 text-[10px] sm:text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                                            >
                                                                <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-out" />
                                                                <Play size={12} fill="currentColor" />
                                                                {selectedSimulationId ? 'Initiate Sequence' : 'Offline'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleViewModule}
                                                                className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 py-2.5 text-[10px] sm:text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-all"
                                                            >
                                                                <BookOpen size={12} /> Intel / Manual
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* SIDE PANEL DETAILS (Hidden on mobile) */}
                    <div className="hidden md:block md:col-span-5 xl:col-span-4">
                        <div className="sticky top-24 z-10">

                            <div className="flex items-center justify-between mb-6 border-b border-slate-300 dark:border-slate-800 pb-2">
                                <h2 className="text-base lg:text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                                    <Shield className="text-emerald-600 dark:text-emerald-400" size={18} /> Briefing
                                </h2>
                            </div>

                            {dashboardState.loading ? (
                                <div className="bg-white dark:bg-[#111827] ring-1 ring-slate-200 dark:ring-slate-800 p-8 shadow-xl flex flex-col items-center justify-center h-[350px] lg:h-[400px]">
                                    <Loader2 size={32} className="animate-spin text-cyan-500 mb-4" />
                                    <p className="font-mono text-xs lg:text-sm text-slate-500 uppercase tracking-widest text-center">Decrypting data...</p>
                                </div>
                            ) : dashboardState.error ? (
                                <div className="bg-red-50 dark:bg-[#111827] ring-1 ring-red-200 dark:ring-red-900/50 p-8 shadow-xl text-center h-[350px] lg:h-[400px] flex flex-col items-center justify-center">
                                    <AlertTriangle size={48} className="text-red-500 mb-4" />
                                    <p className="font-mono text-xs lg:text-sm text-red-600 dark:text-red-400 uppercase tracking-widest">Briefing unavailable</p>
                                </div>
                            ) : selectedLevelData ? (
                                <div className="bg-white dark:bg-[#111827] ring-1 ring-slate-200 dark:ring-cyan-900/30 p-1 shadow-2xl relative overflow-hidden group">

                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500 z-20 pointer-events-none" />
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500 z-20 pointer-events-none" />

                                    <div className="bg-slate-50 dark:bg-[#0B1120] p-4 lg:p-6 h-full relative z-10">

                                        <div className="h-32 lg:h-40 bg-slate-200 dark:bg-slate-900 relative mb-4 lg:mb-6 flex items-center justify-center border border-slate-300 dark:border-slate-800 overflow-hidden">
                                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080801a_1px,transparent_1px),linear-gradient(to_bottom,#8080801a_1px,transparent_1px)] bg-[size:16px_16px]" />
                                            <Terminal size={48} className="text-slate-400 dark:text-slate-700 relative z-10 lg:w-16 lg:h-16" strokeWidth={1} />
                                            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-[scan_3s_ease-in-out_infinite]" />
                                        </div>

                                        <div className="flex justify-between items-start mb-3 lg:mb-4">
                                            <h2 className="text-lg lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider leading-tight">
                                                {selectedLevelData.title}
                                            </h2>
                                        </div>

                                        <div className="bg-slate-200 dark:bg-slate-900/50 p-3 lg:p-4 rounded-sm border-l-2 border-cyan-500 mb-6 lg:mb-8 font-mono text-[10px] lg:text-xs text-slate-700 dark:text-slate-400 leading-relaxed">
                                            {'>'} {selectedLevelData.description ?? 'Initialize the wiring interface for this module before testing the circuit.'}
                                            <span className="inline-block w-1.5 h-3 bg-cyan-500 ml-1 animate-pulse" />
                                        </div>

                                        <div className="space-y-3 lg:space-y-4">
                                            <button
                                                type="button"
                                                onClick={handleStartSimulation}
                                                disabled={!selectedSimulationId}
                                                className="group/btn relative overflow-hidden w-full bg-cyan-600 dark:bg-cyan-500 disabled:opacity-50 disabled:grayscale text-white dark:text-slate-900 py-3 lg:py-4 text-[10px] lg:text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 lg:gap-3 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]"
                                            >
                                                <span className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500 ease-out" />
                                                <Play size={16} fill="currentColor" className="lg:w-[18px] lg:h-[18px]" />
                                                {selectedSimulationId ? 'Initiate Sequence' : 'System Offline'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleViewModule}
                                                className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-200 py-3 uppercase tracking-widest font-bold text-[10px] lg:text-xs flex items-center justify-center gap-2 transition-colors border border-transparent dark:border-slate-700"
                                            >
                                                <BookOpen size={14} className="lg:w-4 lg:h-4" /> Access Intel Manual
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-[#111827] ring-1 ring-slate-200 dark:ring-slate-800 p-8 shadow-xl flex flex-col items-center justify-center h-[350px] lg:h-[400px] text-slate-400 dark:text-slate-600 font-mono text-xs lg:text-sm tracking-widest uppercase text-center">
                                    <Crosshair size={40} className="mb-4 opacity-20 lg:w-12 lg:h-12" />
                                    Awaiting Target Selection
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                {/* SETTINGS MODAL */}
                <AnimatePresence>
                    {isSettingsOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-[#0B1120]/80 backdrop-blur-sm select-none transition-colors duration-300">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white dark:bg-[#111827] ring-1 ring-slate-200 dark:ring-cyan-900/50 shadow-2xl w-full max-w-md relative overflow-hidden"
                            >
                                <div className="h-2 w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#06b6d4_10px,#06b6d4_20px)] opacity-50" />

                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-white transition z-10"
                                >
                                    <X size={24} />
                                </button>

                                <div className="p-8">
                                    <div className="flex items-center gap-5 mb-8">
                                        <div className="bg-slate-100 dark:bg-slate-900 p-4 border-2 border-slate-300 dark:border-cyan-900/50 shadow-inner -skew-x-6">
                                            <User className="text-cyan-600 dark:text-cyan-400 skew-x-6" size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider">System Config</h2>
                                            <p className="text-xs text-slate-500 dark:text-cyan-500/70 font-mono uppercase tracking-widest mt-1">
                                                ID_CODE: {trainee?.trainee_code ?? (trainee?.trainee_id ? `TRN-${trainee.trainee_id}` : 'NULL')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-8 font-mono text-xs uppercase tracking-widest">
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-[#0B1120] p-4 border border-slate-200 dark:border-slate-800">
                                            <span className="text-slate-500 flex items-center gap-2 shrink-0">
                                                <Shield size={14} /> Security Level
                                            </span>
                                            <span className="text-slate-900 dark:text-cyan-400 font-bold truncate ml-2">Cadet_Lvl_1</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-[#0B1120] p-4 border border-slate-200 dark:border-slate-800">
                                            <span className="text-slate-500 shrink-0">Active Cohort</span>
                                            <span className="text-slate-900 dark:text-white font-bold truncate ml-2">
                                                {trainee?.batch_code ?? 'UNASSIGNED'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-[#0B1120] p-4 border border-slate-200 dark:border-slate-800">
                                            <span className="text-slate-500 shrink-0">Designation</span>
                                            <span className="text-slate-900 dark:text-white font-bold text-right truncate ml-2">
                                                {trainee ? `${trainee.first_name} ${trainee.last_name}` : 'AWAITING_DATA'}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-black uppercase tracking-widest dark:hover:bg-red-500/20 dark:hover:text-red-300 transition-colors flex items-center justify-center gap-3 border border-red-200 dark:border-red-500/20"
                                    >
                                        <LogOut size={18} /> Terminate Connection
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}} />
        </CyberTransition>
    );
};

export default Dashboard;