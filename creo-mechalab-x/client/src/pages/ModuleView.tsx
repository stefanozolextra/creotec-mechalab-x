import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, ChevronLeft, ChevronRight, FileText, Loader2, Moon, Sun, Target, CheckCircle2, Lock } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import CyberTransition from '../components/CyberTransition';
// import ReactAntiCapture from '../components/AntiCapture';
import { API_BASE_URL } from '../api/http';
import { getTraineeDashboard } from '../api/trainees';
import { getAuthToken } from '../utils/auth';
import { setNativeSecureScreen } from '../utils/nativeSecureScreen';
import { resolveSupportedVideoLesson } from '../utils/videoLessons';
import type { ResourceType } from '../types/traineeDashboard';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type ModuleLessonOption = {
    resourceId: number;
    title: string;
    url: string;
    orderNo: number;
    type: ResourceType;
};

type ModuleSimulationLaunch = {
    simulationId: number;
    orderNo: number | null;
};

type ModuleLocationState = {
    pdfUrl?: unknown;
    lessonUrl?: unknown;
    lessonType?: unknown;
    lessonResourceId?: unknown;
    lessonTitle?: unknown;
} | null;

const toNumber = (value: string | number | null | undefined): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

// --- FIX: Added completion check helper to match Dashboard logic ---
const isCompletedValue = (value: boolean | string | number | null | undefined): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return false;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const toAbsoluteUrl = (value: string): string => {
    const trimmed = value.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${API_BASE_URL}${normalizedPath}`;
};

const ModuleView = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    const moduleId = Number(id);
    const hasValidModuleId = Number.isInteger(moduleId) && moduleId > 0;

    const locationState = (location.state as ModuleLocationState) || null;
    const hintedLessonUrl =
        typeof locationState?.lessonUrl === 'string'
            ? locationState.lessonUrl.trim()
            : typeof locationState?.pdfUrl === 'string'
                ? locationState.pdfUrl.trim()
                : '';
    const hintedLessonTitle = typeof locationState?.lessonTitle === 'string' ? locationState.lessonTitle.trim() : '';
    const hintedLessonType: ResourceType =
        locationState?.lessonType === 'VIDEO'
            ? 'VIDEO'
            : locationState?.lessonType === 'PDF'
                ? 'PDF'
                : resolveSupportedVideoLesson(hintedLessonUrl)
                    ? 'VIDEO'
                    : 'PDF';
    const hintedLessonResourceId = (() => {
        const parsed = Number(locationState?.lessonResourceId);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    })();

    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);

    // --- RESPONSIVE DIMENSION TRACKING ---
    const [viewerDims, setViewerDims] = useState({ width: 800, height: 600 });

    const [isResolvingLesson, setIsResolvingLesson] = useState(true);
    const [resolvedLessonUrl, setResolvedLessonUrl] = useState<string | null>(hintedLessonUrl || null);
    const [resolvedLessonTitle, setResolvedLessonTitle] = useState<string>(hintedLessonTitle || `Module ${id} Theory Manual`);
    const [resolvedLessonType, setResolvedLessonType] = useState<ResourceType>(hintedLessonType);
    const [moduleTitle, setModuleTitle] = useState<string>(`Module ${id} Theory Manual`);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [viewerError, setViewerError] = useState<string | null>(null);

    const [lessonOptions, setLessonOptions] = useState<ModuleLessonOption[]>([]);
    const [selectedLessonResourceId, setSelectedLessonResourceId] = useState<number | null>(hintedLessonResourceId);
    const [moduleSimulationLaunch, setModuleSimulationLaunch] = useState<ModuleSimulationLaunch | null>(null);

    const [highestUnlockedIndex, setHighestUnlockedIndex] = useState<number>(0);

    const authToken = getAuthToken();
    const previewPaneRef = useRef<HTMLDivElement | null>(null);

    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    const toggleTheme = () => {
        setIsDarkMode((prev) => {
            const nextMode = !prev;
            if (nextMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            return nextMode;
        });
    };

    useEffect(() => {
        setNativeSecureScreen(false);
        return () => {
            setNativeSecureScreen(false);
        };
    }, []);

    useEffect(() => {
        const node = previewPaneRef.current;
        if (!node) return;

        const updateDims = () => {
            const w = node.clientWidth;
            const h = node.clientHeight;
            if (w && h) {
                setViewerDims({ width: w, height: h });
            }
        };

        updateDims();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateDims);
            return () => window.removeEventListener('resize', updateDims);
        }

        const observer = new ResizeObserver(() => updateDims());
        observer.observe(node);
        return () => observer.disconnect();
    }, [isResolvingLesson, lessonOptions.length, resolvedLessonUrl, resolvedLessonType]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();

        setIsResolvingLesson(true);
        setResolveError(null);
        setViewerError(null);
        setNumPages(null);
        setPageNumber(1);
        setLessonOptions([]);
        setHighestUnlockedIndex(0);
        setModuleSimulationLaunch(null);

        if (!hasValidModuleId) {
            setResolveError('Invalid module id.');
            setResolvedLessonUrl(null);
            setIsResolvingLesson(false);
            return () => {
                controller.abort();
            };
        }

        const loadLessonResources = async () => {
            try {
                const dashboard = await getTraineeDashboard({ signal: controller.signal });
                if (!active || controller.signal.aborted) return;

                const moduleRow =
                    dashboard.moduleContent.modules.find((module) => toNumber(module.module_id) === moduleId) ?? null;
                const resolvedModuleTitle =
                    typeof moduleRow?.title === 'string' && moduleRow.title.trim()
                        ? moduleRow.title.trim()
                        : `Module ${moduleId} Theory Manual`;
                setModuleTitle(resolvedModuleTitle);

                const moduleResources = dashboard.moduleContent.resources.filter(
                    (resource) => toNumber(resource.module_id) === moduleId
                );

                // --- FIX: Smart Simulation Launcher Routing ---
                // We map out the progress first, exactly like the Dashboard does
                const progressMap = new Map<number, boolean>();
                dashboard.simulationProgress.forEach((p) => {
                    progressMap.set(toNumber(p.simulation_id), isCompletedValue(p.is_completed));
                });

                // Get all simulations for this module and sort them
                const rawSimulations = dashboard.moduleContent.simulations
                    .filter((simulation) => toNumber(simulation.module_id) === moduleId)
                    .sort((a, b) => {
                        const leftOrder = toNumber(a.order_no) || Number.MAX_SAFE_INTEGER;
                        const rightOrder = toNumber(b.order_no) || Number.MAX_SAFE_INTEGER;
                        return leftOrder - rightOrder;
                    });

                const requiredSimulations = rawSimulations.filter(s => s.is_required);

                // Find the first uncompleted simulation to launch, fallback to [0]
                const candidate = requiredSimulations.length > 0
                    ? requiredSimulations.find(s => !progressMap.get(toNumber(s.simulation_id))) ?? requiredSimulations[0]
                    : rawSimulations[0];

                if (candidate && toNumber(candidate.simulation_id) > 0) {
                    const orderNo = toNumber(candidate.order_no);
                    setModuleSimulationLaunch({
                        simulationId: toNumber(candidate.simulation_id),
                        orderNo: orderNo > 0 ? orderNo : null,
                    });
                } else {
                    setModuleSimulationLaunch(null);
                }
                // ------------------------------------------------

                const options = moduleResources
                    .map((resource) => {
                        const type = String(resource.type).toUpperCase() === 'VIDEO' ? 'VIDEO' : 'PDF';
                        const resolved = typeof resource.resolved_url === 'string' ? resource.resolved_url.trim() : '';
                        const fallback = typeof resource.url === 'string' ? resource.url.trim() : '';
                        const url = resolved || fallback;
                        const resourceId = toNumber(resource.resource_id);
                        if (!url || resourceId < 1) return null;
                        if (type === 'VIDEO' && !resolveSupportedVideoLesson(url)) return null;

                        const title =
                            typeof resource.title === 'string' && resource.title.trim()
                                ? resource.title.trim()
                                : `Lesson ${resourceId}`;

                        return {
                            resourceId,
                            title,
                            url,
                            orderNo: toNumber(resource.order_no),
                            type,
                        } as ModuleLessonOption;
                    })
                    .filter((entry): entry is ModuleLessonOption => entry !== null)
                    .sort((a, b) => {
                        if (a.orderNo !== b.orderNo) return a.orderNo - b.orderNo;
                        return a.resourceId - b.resourceId;
                    });

                setLessonOptions(options);

                if (options.length === 0) {
                    if (hintedLessonUrl && (hintedLessonType !== 'VIDEO' || resolveSupportedVideoLesson(hintedLessonUrl))) {
                        setResolvedLessonUrl(hintedLessonUrl);
                        setResolvedLessonTitle(hintedLessonTitle || resolvedModuleTitle);
                        setResolvedLessonType(hintedLessonType);
                        setSelectedLessonResourceId(null);
                        return;
                    }

                    setResolvedLessonUrl(null);
                    setResolvedLessonTitle(resolvedModuleTitle);
                    setResolvedLessonType('PDF');
                    setSelectedLessonResourceId(null);
                    setResolveError('No supported lesson content is assigned to this module yet.');
                    return;
                }

                const initialLesson =
                    (hintedLessonResourceId
                        ? options.find((option) => option.resourceId === hintedLessonResourceId)
                        : null) ?? options[0];

                setSelectedLessonResourceId(initialLesson.resourceId);
                setResolvedLessonUrl(initialLesson.url);
                setResolvedLessonTitle(initialLesson.title || resolvedModuleTitle);
                setResolvedLessonType(initialLesson.type);
            } catch (error) {
                if (controller.signal.aborted) return;
                if (!active) return;
                setResolvedLessonUrl(null);
                setResolveError(getErrorMessage(error, 'Failed to load module lesson.'));
            } finally {
                if (active && !controller.signal.aborted) setIsResolvingLesson(false);
            }
        };

        void loadLessonResources();

        return () => {
            active = false;
            controller.abort();
        };
    }, [hasValidModuleId, hintedLessonResourceId, hintedLessonTitle, hintedLessonType, hintedLessonUrl, moduleId]);

    useEffect(() => {
        if (isResolvingLesson) return;
        if (lessonOptions.length === 0) return;

        const selectedLesson =
            (selectedLessonResourceId !== null
                ? lessonOptions.find((option) => option.resourceId === selectedLessonResourceId)
                : null) ?? lessonOptions[0];

        if (!selectedLesson) return;

        if (selectedLessonResourceId !== selectedLesson.resourceId) {
            setSelectedLessonResourceId(selectedLesson.resourceId);
        }

        setResolvedLessonUrl(selectedLesson.url);
        setResolvedLessonTitle(selectedLesson.title || moduleTitle || `Module ${moduleId} Theory Manual`);
        setResolvedLessonType(selectedLesson.type);
        setResolveError(null);
        setViewerError(null);
        setNumPages(null);
        setPageNumber(1);
    }, [isResolvingLesson, lessonOptions, moduleId, moduleTitle, selectedLessonResourceId]);

    const documentFile = useMemo(() => {
        if (resolvedLessonType !== 'PDF' || !resolvedLessonUrl) return null;
        const absoluteUrl = toAbsoluteUrl(resolvedLessonUrl);
        const shouldAttachAuthHeader = resolvedLessonUrl.startsWith('/') || absoluteUrl.startsWith(API_BASE_URL);

        return {
            url: absoluteUrl,
            ...(shouldAttachAuthHeader && authToken
                ? {
                    httpHeaders: {
                        Authorization: `Bearer ${authToken}`,
                    },
                }
                : {}),
        };
    }, [authToken, resolvedLessonType, resolvedLessonUrl]);

    const selectedLessonIndex = lessonOptions.findIndex((option) => option.resourceId === selectedLessonResourceId);
    const currentVideoLesson = useMemo(() => {
        if (resolvedLessonType !== 'VIDEO' || !resolvedLessonUrl) return null;
        return resolveSupportedVideoLesson(resolvedLessonUrl);
    }, [resolvedLessonType, resolvedLessonUrl]);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
        setViewerError(null);
    };

    const changePage = useCallback((offset: number) => {
        setPageNumber((prevPageNumber) => {
            if (numPages === null) return prevPageNumber;
            const nextPage = prevPageNumber + offset;

            if (nextPage >= 1 && nextPage <= numPages) {
                return nextPage;
            }
            return prevPageNumber;
        });
    }, [numPages]);

    // --- NEXT / PREV LESSON LOGIC ---
    const hasNextLesson = selectedLessonIndex !== -1 && selectedLessonIndex < lessonOptions.length - 1;
    const hasPrevLesson = selectedLessonIndex > 0;

    const goToNextLesson = useCallback(() => {
        if (hasNextLesson) {
            setSelectedLessonResourceId(lessonOptions[selectedLessonIndex + 1].resourceId);
        }
    }, [hasNextLesson, lessonOptions, selectedLessonIndex]);

    const goToPrevLesson = useCallback(() => {
        if (hasPrevLesson) {
            setSelectedLessonResourceId(lessonOptions[selectedLessonIndex - 1].resourceId);
        }
    }, [hasPrevLesson, lessonOptions, selectedLessonIndex]);
    // -------------------------

    // --- SMART KEYBOARD NAVIGATION ---
    useEffect(() => {
        if (resolvedLessonType !== 'PDF' || numPages === null) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (pageNumber === 1 && hasPrevLesson) {
                    goToPrevLesson();
                } else {
                    changePage(-1);
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (pageNumber === numPages && hasNextLesson) {
                    goToNextLesson();
                } else {
                    changePage(1);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [resolvedLessonType, numPages, pageNumber, changePage, hasNextLesson, goToNextLesson, hasPrevLesson, goToPrevLesson]);
    // -----------------------------------------

    const selectedLessonIndexRef = useRef(selectedLessonIndex);
    useEffect(() => {
        selectedLessonIndexRef.current = selectedLessonIndex;
    }, [selectedLessonIndex]);

    const handleMarkVideoComplete = useCallback(() => {
        setHighestUnlockedIndex((prevHighest) => {
            const currentIdx = selectedLessonIndexRef.current;
            if (currentIdx !== -1 && currentIdx === prevHighest) {
                return prevHighest + 1;
            }
            return prevHighest;
        });
    }, []);

    useEffect(() => {
        if (resolvedLessonType === 'PDF' && numPages !== null && pageNumber === numPages) {
            handleMarkVideoComplete();
        }
    }, [pageNumber, numPages, resolvedLessonType, handleMarkVideoComplete]);

    useEffect(() => {
        if (resolvedLessonType !== 'VIDEO' || !currentVideoLesson || currentVideoLesson.kind === 'direct') return;

        const handleVideoMessage = (event: MessageEvent) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

                if (data.event === 'infoDelivery' && data.info?.playerState === 0) {
                    handleMarkVideoComplete();
                }

                if (data.event === 'ended') {
                    handleMarkVideoComplete();
                }
            } catch {
                // Ignore irrelevant messages
            }
        };

        window.addEventListener('message', handleVideoMessage);
        return () => window.removeEventListener('message', handleVideoMessage);
    }, [resolvedLessonType, currentVideoLesson, handleMarkVideoComplete]);

    return (
        <CyberTransition>
            <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#050810] font-sans select-none transition-colors duration-300 relative z-0">
                {/* Dual-theme Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e140_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e140_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none -z-10" />

                {/* Top Cyan Accent Line */}
                <div className="h-1 w-full bg-cyan-500 relative z-20" />

                {/* Header */}
                <header className="bg-white dark:bg-[#0A0E17] border-b border-slate-200 dark:border-slate-800/60 px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-sm transition-colors duration-300">
                    <div className="flex items-center gap-4 min-w-0 sm:gap-8">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 bg-slate-100 dark:bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-400 px-4 py-2.5 rounded font-bold text-xs tracking-wider uppercase transition-colors shrink-0"
                        >
                            <ArrowLeft size={16} strokeWidth={2.5} /> <span className="hidden sm:inline">DASHBOARD</span>
                        </button>

                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <BookOpen size={20} className="text-cyan-600 dark:text-cyan-500 shrink-0" />
                                <h1 className="font-black text-lg sm:text-xl tracking-widest uppercase truncate">INTEL: {moduleTitle}</h1>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest font-bold">DATA_STREAM_ACTIVE</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={toggleTheme}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors hidden sm:block focus:outline-none"
                        >
                            {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                        </button>

                        {/* --- REPLACED: AWAITING_DATA placeholder with Simulation Launcher --- */}
                        <button
                            onClick={() => {
                                if (!moduleSimulationLaunch) return;

                                // Navigate using the Activity Number (orderNo) instead of the Database Primary Key
                                const targetRoute = moduleSimulationLaunch.orderNo ?? 1;
                                navigate(`/simulation/${targetRoute}`);
                            }}
                            disabled={!moduleSimulationLaunch}
                            className="hidden sm:flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-600 dark:text-cyan-400 border border-cyan-500/50 px-6 py-2.5 rounded font-black text-xs tracking-widest uppercase transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        >
                            <Target size={16} strokeWidth={2.5} /> LAUNCH SIMULATOR
                        </button>
                        {/* ------------------------------------------------------------------ */}                    </div>
                </header>

                <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full relative z-10">

                    {/* Sidebar - Module List */}
                    <aside className="w-full lg:w-[360px] flex-shrink-0 flex flex-col lg:h-[calc(100vh-140px)]">
                        <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800/80 shadow-sm relative h-full flex flex-col transition-colors duration-300">
                            {/* Corner Accents */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />

                            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-3 shrink-0 transition-colors duration-300">
                                <FileText size={18} className="text-slate-700 dark:text-cyan-500" strokeWidth={2.5} />
                                <h2 className="font-black text-slate-800 dark:text-white tracking-widest uppercase text-sm">MODULE LIST</h2>
                            </div>

                            <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                                {isResolvingLesson ? (
                                    <div className="flex flex-col items-center justify-center p-6 text-slate-400 dark:text-slate-500">
                                        <Loader2 size={24} className="animate-spin mb-2 text-cyan-500" />
                                        <p className="text-[10px] font-mono uppercase tracking-widest font-bold">Syncing lessons...</p>
                                    </div>
                                ) : lessonOptions.length > 0 ? (
                                    lessonOptions.map((option, index) => {
                                        const isSelected = option.resourceId === selectedLessonResourceId;

                                        const isLocked = index > highestUnlockedIndex;
                                        const isCompleted = index < highestUnlockedIndex;

                                        return (
                                            <div
                                                key={option.resourceId}
                                                onClick={() => !isLocked && setSelectedLessonResourceId(option.resourceId)}
                                                className={`relative p-5 border transition-all bg-white dark:bg-[#0B0F19]
                                                        ${isSelected ? 'border-cyan-200 dark:border-cyan-500/30 border-l-[3px] border-l-cyan-400 dark:border-l-cyan-500 dark:bg-[#162133] shadow-[0_4px_20px_-5px_rgba(34,211,238,0.15)] cursor-pointer' : ''}
                                                        ${isLocked ? 'opacity-50 grayscale cursor-not-allowed border-slate-100 dark:border-slate-800/40' : ''}
                                                        ${!isSelected && !isLocked ? 'border-slate-100 dark:border-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer' : ''}
                                                    `}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0 pr-2">
                                                        <p className={`text-[10px] font-bold tracking-widest uppercase mb-1.5 ${isSelected ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                            FILE_{String(index + 1).padStart(2, '0')}
                                                        </p>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <h3 className={`font-extrabold tracking-wide uppercase text-sm truncate ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                                                {option.title}
                                                            </h3>
                                                            <span className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[9px] font-black tracking-widest text-slate-500 dark:text-slate-400">
                                                                {option.type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isCompleted && <CheckCircle2 size={18} className="text-emerald-500 mt-1 shrink-0" />}
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
                                                    {isLocked && <Lock size={16} className="text-slate-300 dark:text-slate-600 mt-1 shrink-0" />}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 text-center text-slate-400 dark:text-slate-600">
                                        <FileText size={22} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-xs font-semibold uppercase tracking-widest">No lessons found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <section className="flex-1 flex flex-col h-[600px] lg:h-[calc(100vh-140px)] relative">
                        <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800/80 shadow-sm relative h-full flex flex-col transition-colors duration-300">
                            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />

                            {!isResolvingLesson && !resolveError && !viewerError && (documentFile || currentVideoLesson) ? (
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-transparent transition-colors duration-300 z-10">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-black text-slate-800 dark:text-white truncate">
                                            {resolvedLessonTitle}
                                        </h2>
                                        {selectedLessonResourceId && (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                                                Resource ID: {selectedLessonResourceId}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 bg-white dark:bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 transition-colors duration-300">
                                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase tracking-widest font-bold">
                                            {resolvedLessonType}
                                        </span>
                                    </div>
                                </div>
                            ) : null}

                            {/* Lesson Viewer / Error States */}
                            <div
                                ref={previewPaneRef}
                                className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10 flex flex-col items-center justify-center bg-slate-50/30 dark:bg-[#0A0E17] relative transition-colors duration-300 min-h-0"
                            >
                                {isResolvingLesson ? (
                                    <div className="flex flex-col items-center justify-center h-full w-full text-slate-400 dark:text-slate-500">
                                        <Loader2 size={42} className="animate-spin mb-4 text-cyan-500" />
                                        <p className="text-xs font-mono uppercase tracking-widest font-bold">Resolving Lesson...</p>
                                    </div>
                                ) : resolveError || viewerError ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full p-4">
                                        <div className="bg-white dark:bg-[#2a1115] border border-slate-100 dark:border-red-900/50 shadow-xl dark:shadow-2xl w-full max-w-lg p-10 flex flex-col items-center justify-center gap-6 transition-colors duration-300 rounded-lg">
                                            <Target size={56} className="text-red-400 dark:hidden" strokeWidth={1} />
                                            <AlertTriangle size={42} className="hidden dark:block mx-auto text-red-200 opacity-80" strokeWidth={1.5} />

                                            <p className="text-red-500 dark:text-red-200 font-bold dark:font-medium tracking-widest dark:tracking-wide text-xs dark:text-sm uppercase text-center font-mono dark:font-sans">
                                                {(resolveError || viewerError || "CONTENT UNAVAILABLE").toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                ) : resolvedLessonType === 'VIDEO' && currentVideoLesson ? (
                                    <div className="flex w-full h-full flex-col items-center justify-center min-h-0">
                                        {currentVideoLesson.kind === 'direct' ? (
                                            <video
                                                controls
                                                preload="metadata"
                                                className="w-full h-full max-h-full object-contain rounded-lg shadow-2xl bg-black"
                                                src={currentVideoLesson.sourceUrl}
                                                onEnded={handleMarkVideoComplete}
                                            >
                                                Your browser does not support this video lesson.
                                            </video>
                                        ) : (() => {
                                            let embedSrc = currentVideoLesson.embedUrl;

                                            if (embedSrc.includes('youtube.com') || embedSrc.includes('youtu.be')) {
                                                if (!embedSrc.includes('enablejsapi=1')) {
                                                    embedSrc += embedSrc.includes('?') ? '&enablejsapi=1' : '?enablejsapi=1';
                                                }
                                            } else if (embedSrc.includes('vimeo.com')) {
                                                if (!embedSrc.includes('api=1')) {
                                                    embedSrc += embedSrc.includes('?') ? '&api=1' : '?api=1';
                                                }
                                            }

                                            return (
                                                <div className="w-full h-full flex items-center justify-center max-h-full overflow-hidden rounded-lg shadow-2xl bg-black">
                                                    <iframe
                                                        title={`${resolvedLessonTitle} ${currentVideoLesson.providerLabel}`}
                                                        src={embedSrc}
                                                        className="w-full h-full max-h-full aspect-video border-0"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                        allowFullScreen
                                                        onLoad={(e) => {
                                                            const iframe = e.target as HTMLIFrameElement;
                                                            if (!iframe.contentWindow) return;

                                                            if (embedSrc.includes('youtube.com') || embedSrc.includes('youtu.be')) {
                                                                iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
                                                            }
                                                            if (embedSrc.includes('vimeo.com')) {
                                                                iframe.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: 'ended' }), '*');
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : documentFile ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full pb-16">
                                        <Document
                                            file={documentFile}
                                            className="flex justify-center"
                                            onLoadSuccess={onDocumentLoadSuccess}
                                            onLoadError={(error) => {
                                                setViewerError(getErrorMessage(error, 'Unable to open PDF lesson'));
                                            }}
                                            loading={
                                                <div className="flex flex-col items-center justify-center h-[500px] w-full text-slate-400 dark:text-slate-500 p-8 text-center">
                                                    <Loader2 size={48} className="animate-spin mb-4 text-cyan-500 mx-auto" />
                                                    <p className="text-xs font-mono uppercase tracking-widest font-bold">Loading Data Array...</p>
                                                </div>
                                            }
                                        >
                                            <Page
                                                pageNumber={pageNumber}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                {...(viewerDims.width < 640
                                                    ? { width: Math.max(260, viewerDims.width - 48) }
                                                    : { height: Math.max(300, viewerDims.height - 120) }
                                                )}
                                                className="shadow-2xl border border-slate-200 dark:border-slate-800"
                                            />
                                        </Document>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center w-full h-full p-4">
                                        <div className="bg-white dark:bg-[#2a1115] border border-slate-100 dark:border-red-900/50 shadow-xl dark:shadow-2xl w-full max-w-lg p-10 flex flex-col items-center justify-center gap-6 transition-colors duration-300 rounded-lg">
                                            <Target size={56} className="text-slate-300 dark:hidden" strokeWidth={1} />
                                            <AlertTriangle size={42} className="hidden dark:block mx-auto text-red-200 opacity-80" strokeWidth={1.5} />

                                            <p className="text-slate-400 dark:text-red-200 font-bold dark:font-medium tracking-widest dark:tracking-wide text-xs dark:text-sm uppercase text-center font-mono dark:font-sans">
                                                ERROR: NO LESSON CONTENT AVAILABLE
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* DYNAMIC OVERLAY NAVIGATION FOR PDF */}
                            {resolvedLessonType === 'PDF' && numPages && !isResolvingLesson && !resolveError && !viewerError && documentFile && (
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all">

                                    {pageNumber === 1 && hasPrevLesson ? (
                                        <button
                                            onClick={goToPrevLesson}
                                            className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors p-1 pl-2 font-bold text-xs tracking-widest uppercase"
                                        >
                                            <ChevronLeft size={20} strokeWidth={2.5} /> PREV
                                        </button>
                                    ) : (
                                        <button
                                            disabled={pageNumber <= 1}
                                            onClick={() => changePage(-1)}
                                            className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 dark:hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-slate-600 dark:disabled:hover:text-slate-300 transition-colors p-1"
                                        >
                                            <ChevronLeft size={24} strokeWidth={2.5} />
                                        </button>
                                    )}

                                    <div className="flex flex-col items-center justify-center min-w-[80px]">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase leading-none mb-1">Page</span>
                                        <span className="text-sm font-mono text-slate-800 dark:text-white tracking-wider font-bold leading-none">
                                            {pageNumber} / {numPages}
                                        </span>
                                    </div>

                                    {pageNumber === numPages && hasNextLesson ? (
                                        <button
                                            onClick={goToNextLesson}
                                            className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors p-1 pr-2 font-bold text-xs tracking-widest uppercase"
                                        >
                                            NEXT <ChevronRight size={20} strokeWidth={2.5} />
                                        </button>
                                    ) : (
                                        <button
                                            disabled={pageNumber >= numPages}
                                            onClick={() => changePage(1)}
                                            className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 dark:hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-slate-600 dark:disabled:hover:text-slate-300 transition-colors p-1"
                                        >
                                            <ChevronRight size={24} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            )}

                        </div>
                    </section>
                </main>
            </div>
        </CyberTransition>
    );
};

export default ModuleView;