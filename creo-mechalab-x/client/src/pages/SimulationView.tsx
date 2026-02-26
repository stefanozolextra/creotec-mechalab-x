import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Play, RotateCcw, Zap, Moon, Sun } from 'lucide-react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { useState, useEffect, useRef } from 'react';
import PageTransition from '../components/PageTransition';
import PortraitGuard from '../components/PortraitGuard';
import { completeSimulation, getTraineeDashboard } from '../api/trainees';

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

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const isCompletedValue = (value: boolean | string | number | null | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return false;
};

const SimulationView = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const simulationId = Number(id);
    const hasValidSimulationId = Number.isInteger(simulationId) && simulationId > 0;

    const [isCompleting, setIsCompleting] = useState(false);
    const [completeError, setCompleteError] = useState<string | null>(null);
    const [isCheckingCompletion, setIsCheckingCompletion] = useState(true);
    const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false);
    const [completionLookupError, setCompletionLookupError] = useState<string | null>(null);

    // Light/Dark Mode State
    const [isDarkMode, setIsDarkMode] = useState(true);

    // State to handle the responsive size of our Canvas window
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    const containerRef = useRef<HTMLDivElement>(null);
    const completeControllerRef = useRef<AbortController | null>(null);
    const completionLookupControllerRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);

    // Initialize theme based on document class
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

    // Keep the canvas sized correctly if the user resizes their browser
    useEffect(() => {
        const checkSize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight,
                });
            }
        };
        // Initial tiny delay ensures container has rendered before measuring
        setTimeout(checkSize, 50);
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, []);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            completeControllerRef.current?.abort();
            completionLookupControllerRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        completionLookupControllerRef.current?.abort();

        if (!hasValidSimulationId) {
            setIsCheckingCompletion(false);
            setIsAlreadyCompleted(false);
            setCompletionLookupError(null);
            return;
        }

        const controller = new AbortController();
        completionLookupControllerRef.current = controller;

        setIsCheckingCompletion(true);
        setCompletionLookupError(null);

        const loadCompletionState = async () => {
            try {
                const dashboard = await getTraineeDashboard({ signal: controller.signal });
                if (!isMountedRef.current || controller.signal.aborted) return;

                const progressRow = dashboard.simulationProgress.find(
                    (progress) => toNumber(progress.simulation_id) === simulationId
                );
                setIsAlreadyCompleted(isCompletedValue(progressRow?.is_completed));
            } catch (error) {
                if (controller.signal.aborted || isAbortError(error)) return;
                if (!isMountedRef.current) return;

                setCompletionLookupError(getErrorMessage(error, 'Unable to verify completion status.'));
                setIsAlreadyCompleted(false);
            } finally {
                if (!isMountedRef.current || controller.signal.aborted) return;
                setIsCheckingCompletion(false);
            }
        };

        void loadCompletionState();

        return () => {
            controller.abort();
        };
    }, [hasValidSimulationId, simulationId]);

    const handleComplete = async () => {
        if (!hasValidSimulationId) {
            setCompleteError('Invalid simulation id from route.');
            return;
        }
        if (isCheckingCompletion || isAlreadyCompleted) return;

        completeControllerRef.current?.abort();
        const controller = new AbortController();
        completeControllerRef.current = controller;

        setCompleteError(null);
        setIsCompleting(true);

        try {
            await completeSimulation(simulationId, undefined, { signal: controller.signal });
            if (!isMountedRef.current || controller.signal.aborted) return;
            setIsAlreadyCompleted(true);
            navigate('/dashboard', { replace: true });
        } catch (error) {
            if (controller.signal.aborted || isAbortError(error)) return;
            if (!isMountedRef.current) return;
            setCompleteError(getErrorMessage(error, 'Failed to complete this simulation.'));
        } finally {
            if (!isMountedRef.current || controller.signal.aborted) return;
            setIsCompleting(false);
        }
    };

    // Konva styling based on theme
    const strokeColor = isDarkMode ? '#334155' : '#cbd5e1';
    const componentFill = isDarkMode ? '#1e293b' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#0f172a';
    const subTextColor = isDarkMode ? '#94a3b8' : '#64748b';

    return (
        <PageTransition>
            <PortraitGuard>
                <div className="h-screen flex flex-col bg-slate-100 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 select-none overflow-hidden transition-colors duration-300 relative z-0">

                    {/* GAME HUD GRID BACKGROUND */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] pointer-events-none -z-10" />

                    {/* SECTION: HUD NAVIGATION BAR */}
                    <header className="bg-white/95 dark:bg-[#0B1120]/95 border-b-2 border-slate-300 dark:border-cyan-900/50 p-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(6,182,212,0.1)] backdrop-blur-md transition-colors duration-300 gap-4 sm:gap-0 shrink-0">

                        {/* Left: Return Action & Title */}
                        <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="group p-2 sm:px-4 sm:py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2 rounded-sm border-l-2 border-transparent hover:border-cyan-500 shrink-0"
                                title="Abort Simulation"
                            >
                                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest font-mono hidden sm:inline">Abort Sim</span>
                            </button>

                            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

                            <div className="flex flex-col min-w-0">
                                <h1 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest truncate">
                                    <Zap className="text-amber-500 dark:text-yellow-400 shrink-0" size={16} />
                                    <span className="truncate">WORKSPACE: SIM_{String(id).padStart(2, '0')}</span>
                                </h1>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0"></span>
                                    <p className="text-[9px] text-slate-500 dark:text-cyan-400/70 uppercase tracking-widest font-mono transition-colors truncate">
                                        CANVAS_ACTIVE
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Controls & Actions */}
                        <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-6">

                            {/* Theme Toggle */}
                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 transition hover:bg-slate-200 dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 shrink-0"
                                title="Toggle Optics"
                            >
                                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>

                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 sm:px-4 py-2 rounded-sm text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                                >
                                    <RotateCcw size={14} /> <span className="hidden sm:inline">Reset Board</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { void handleComplete(); }}
                                    disabled={isCompleting || isCheckingCompletion || isAlreadyCompleted || !hasValidSimulationId}
                                    className="group/btn relative overflow-hidden flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 disabled:opacity-50 disabled:grayscale px-4 sm:px-6 py-2 rounded-sm text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all text-white dark:text-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                >
                                    <span className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500 ease-out" />
                                    {isCompleting || isCheckingCompletion ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Play size={14} fill="currentColor" />
                                    )}
                                    {isAlreadyCompleted
                                        ? 'Verified'
                                        : isCheckingCompletion
                                            ? 'Scanning...'
                                            : isCompleting
                                                ? 'Processing...'
                                                : 'Mark Complete'}
                                </button>

                                {isAlreadyCompleted && (
                                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-sm border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-[10px] sm:text-xs font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 size={14} />
                                        Cleared
                                    </span>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* STATUS MESSAGES */}
                    {completionLookupError && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
                            <div className="rounded-sm border border-amber-500/50 bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 px-4 py-3 text-xs font-mono font-bold shadow-lg flex items-center gap-3">
                                <AlertTriangle size={16} />
                                {completionLookupError}
                            </div>
                        </div>
                    )}

                    {completeError && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
                            <div className="rounded-sm border-l-4 border-red-500 bg-white dark:bg-[#111827] text-red-600 dark:text-red-400 px-4 py-3 text-xs font-mono font-bold shadow-lg flex items-center gap-3">
                                <AlertTriangle size={16} />
                                {completeError}
                            </div>
                        </div>
                    )}

                    {/* SECTION: INTERACTIVE CANVAS (Konva) */}
                    <main
                        ref={containerRef}
                        className="flex-1 relative z-10"
                    >
                        {dimensions.width > 0 && dimensions.height > 0 && (
                            <Stage width={dimensions.width} height={dimensions.height}>
                                <Layer>

                                    {/* MOCK COMPONENT: 24V Power Supply */}
                                    <Group draggable x={50} y={50}>
                                        {/* Main Body */}
                                        <Rect
                                            width={140}
                                            height={90}
                                            fill={componentFill}
                                            stroke={strokeColor}
                                            strokeWidth={2}
                                            cornerRadius={4}
                                            shadowColor="rgba(0,0,0,0.1)"
                                            shadowBlur={10}
                                            shadowOffsetY={4}
                                        />
                                        {/* Header Bar */}
                                        <Rect width={140} height={24} fill="#0ea5e9" cornerRadius={[4, 4, 0, 0]} />
                                        <Text text="24V PSU" x={12} y={7} fill="white" fontSize={11} fontFamily="monospace" fontStyle="bold" />

                                        {/* Decorative Lines */}
                                        <Rect x={100} y={8} width={28} height={2} fill="rgba(255,255,255,0.3)" />
                                        <Rect x={100} y={14} width={28} height={2} fill="rgba(255,255,255,0.3)" />

                                        {/* 24V Terminal (+) */}
                                        <Group x={30} y={45}>
                                            <Rect width={20} height={20} fill="#fca5a5" stroke="#ef4444" strokeWidth={2} cornerRadius={10} />
                                            <Circle radius={4} x={10} y={10} fill="#ef4444" />
                                            <Text text="+24V" x={-3} y={28} fill={subTextColor} fontSize={10} fontFamily="monospace" fontStyle="bold" />
                                        </Group>

                                        {/* 0V Terminal (-) */}
                                        <Group x={90} y={45}>
                                            <Rect width={20} height={20} fill="#bfdbfe" stroke="#3b82f6" strokeWidth={2} cornerRadius={10} />
                                            <Circle radius={4} x={10} y={10} fill="#3b82f6" />
                                            <Text text="0V" x={4} y={28} fill={subTextColor} fontSize={10} fontFamily="monospace" fontStyle="bold" />
                                        </Group>
                                    </Group>

                                    {/* MOCK COMPONENT: Push Button (PB1) */}
                                    <Group draggable x={250} y={50}>
                                        <Rect
                                            width={80}
                                            height={90}
                                            fill={componentFill}
                                            stroke={strokeColor}
                                            strokeWidth={2}
                                            cornerRadius={4}
                                            shadowColor="rgba(0,0,0,0.1)"
                                            shadowBlur={10}
                                            shadowOffsetY={4}
                                        />
                                        <Rect width={80} height={20} fill="#334155" cornerRadius={[4, 4, 0, 0]} />
                                        <Text text="PB 1" x={24} y={5} fill="white" fontSize={10} fontFamily="monospace" fontStyle="bold" />

                                        {/* The Button Graphic */}
                                        <Rect
                                            x={20}
                                            y={35}
                                            width={40}
                                            height={40}
                                            fill="#10b981"
                                            stroke="#059669"
                                            strokeWidth={2}
                                            cornerRadius={20}
                                            shadowBlur={4}
                                            shadowColor="rgba(0,0,0,0.3)"
                                            shadowOffsetY={2}
                                        />
                                        <Circle radius={12} x={40} y={55} fill="rgba(255,255,255,0.2)" />
                                    </Group>

                                </Layer>
                            </Stage>
                        )}
                    </main>
                </div>
            </PortraitGuard>
        </PageTransition>
    );
};

// Helper component for drawing terminal circles
const Circle = (props: any) => {
    return <Rect {...props} cornerRadius={props.radius} width={props.radius * 2} height={props.radius * 2} offsetX={props.radius} offsetY={props.radius} />
}

export default SimulationView;