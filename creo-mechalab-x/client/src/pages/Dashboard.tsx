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
    Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import { clearAuthRole } from '../utils/auth';
import { getDefaultTraineeId, getTraineeDashboard } from '../api/trainees';
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
    const traineeId = getDefaultTraineeId();

    const [dashboardState, setDashboardState] = useState<DashboardState>({
        data: null,
        loading: true,
        error: null,
        completingSimulationIds: {},
        staleAfterMutation: false,
    });

    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const requestControllerRef = useRef<AbortController | null>(null);

    const loadDashboard = useCallback(async () => {
        requestControllerRef.current?.abort();
        const controller = new AbortController();
        requestControllerRef.current = controller;

        setDashboardState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const data = await getTraineeDashboard(traineeId, { signal: controller.signal });

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
                error: getErrorMessage(error, 'Failed to load dashboard data.'),
            }));
            setSelectedLevel(null);
        }
    }, [traineeId]);

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
        <PageTransition>
            <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-24 relative">
                <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-600/20 p-2 rounded-lg border border-cyan-500/50">
                            <Terminal aria-hidden="true" className="text-cyan-400 w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-white tracking-wide">
                                CREO <span className="text-cyan-400">MECHALAB</span> X
                            </h1>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">
                                Cadet Interface • {trainee?.batch_code ?? 'Batch --'}
                            </p>
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

                <main className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col-reverse lg:grid lg:grid-cols-3 gap-6 lg:gap-8">
                    <div className="lg:col-span-2 relative">
                        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                            <Zap className="text-yellow-400" size={20} aria-hidden="true" /> Simulation Modules
                        </h2>

                        <div className="space-y-4 relative">
                            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-700 -z-10"></div>

                            {dashboardState.loading ? (
                                <div className="h-48 flex items-center justify-center text-slate-400 border border-slate-700 rounded-xl bg-slate-800/40">
                                    <Loader2 size={20} className="animate-spin mr-2" /> Loading dashboard modules...
                                </div>
                            ) : dashboardState.error ? (
                                <div className="p-5 border border-red-500/40 bg-red-500/10 rounded-xl text-red-200">
                                    <p className="font-semibold flex items-center gap-2">
                                        <AlertTriangle size={18} /> {dashboardState.error}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void loadDashboard();
                                        }}
                                        className="mt-3 bg-red-500/20 hover:bg-red-500/30 px-4 py-2 rounded-lg text-sm font-semibold"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : levels.length === 0 ? (
                                <div className="h-48 flex items-center justify-center text-slate-500 italic border-2 border-dashed border-slate-700 rounded-xl">
                                    No modules available.
                                </div>
                            ) : (
                                levels.map((level) => {
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
                                                ${
                                                    isSelected
                                                        ? 'bg-slate-800 border-cyan-500 shadow-lg shadow-cyan-900/20 translate-x-2'
                                                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-500'
                                                }
                                                ${isLocked ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
                                            `}
                                        >
                                            <div
                                                className={`
                                                w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-4 font-bold border-2 z-10
                                                ${isCompleted ? 'bg-green-500 border-green-400 text-white' : ''}
                                                ${!isCompleted && !isLocked ? 'bg-slate-900 border-cyan-400 text-cyan-400' : ''}
                                                ${isLocked ? 'bg-slate-800 border-slate-600 text-slate-500' : ''}
                                            `}
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle size={20} aria-hidden="true" />
                                                ) : isLocked ? (
                                                    <Lock size={16} aria-hidden="true" />
                                                ) : (
                                                    level.id
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <h3 className={`font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                                    {level.title}
                                                </h3>
                                                <div className="text-xs text-slate-500 uppercase font-mono mt-1">
                                                    {level.moduleCode} • {level.status} • {level.score}%
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <ChevronRight className="text-cyan-400 animate-pulse" aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="sticky top-24 z-10">
                            {dashboardState.loading ? (
                                <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 shadow-2xl text-slate-300 flex items-center justify-center h-64">
                                    <Loader2 size={24} className="animate-spin mr-2" /> Preparing module details...
                                </div>
                            ) : dashboardState.error ? (
                                <div className="bg-slate-800 border border-red-500/40 rounded-xl p-6 shadow-2xl text-red-200">
                                    <p className="font-semibold">Unable to load module details.</p>
                                    <p className="text-sm mt-2">{dashboardState.error}</p>
                                </div>
                            ) : selectedLevelData ? (
                                <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 shadow-2xl">
                                    <div className="h-32 md:h-40 bg-slate-700/50 rounded-lg mb-6 flex items-center justify-center border border-slate-600 border-dashed">
                                        <Terminal size={48} className="text-slate-500" aria-hidden="true" />
                                    </div>

                                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                                        {selectedLevelData.title}
                                    </h2>

                                    <p className="text-slate-400 text-sm mb-2 leading-relaxed">
                                        {selectedLevelData.description ??
                                            'Initialize the wiring interface for this module before testing the circuit.'}
                                    </p>
                                    <p className="text-xs text-cyan-400 mb-6 uppercase tracking-wider font-mono">
                                        Progress: {selectedLevelData.score}%
                                    </p>

                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleStartSimulation}
                                            disabled={!selectedSimulationId}
                                            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/50"
                                        >
                                            <Play size={18} fill="currentColor" aria-hidden="true" />
                                            {selectedSimulationId
                                                ? `Start Simulation #${selectedSimulationId}`
                                                : 'Simulation Not Available'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleViewModule}
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

                <AnimatePresence>
                    {isSettingsOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative"
                            >
                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition"
                                >
                                    <X size={24} />
                                </button>

                                <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-800/30">
                                    <div className="bg-slate-700 p-3 rounded-full border border-slate-600">
                                        <User className="text-cyan-400" size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Trainee Profile</h2>
                                        <p className="text-sm text-cyan-500 font-mono">
                                            ID: {trainee?.trainee_code ?? `Trainee-${traineeId}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm flex items-center gap-2">
                                                <Shield size={16} /> Clearance Level
                                            </span>
                                            <span className="text-white font-semibold">Student / Cadet</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm">Active Batch</span>
                                            <span className="text-white font-semibold">
                                                {trainee?.batch_code ?? 'Batch --'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm">Account</span>
                                            <span className="text-white font-semibold text-right max-w-[180px] truncate">
                                                {trainee
                                                    ? `${trainee.first_name} ${trainee.last_name}`
                                                    : 'Loading trainee...'}
                                            </span>
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
