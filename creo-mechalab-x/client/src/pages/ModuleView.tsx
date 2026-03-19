import { useEffect, useMemo, useRef, useState } from 'react';
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
    const [pdfWidth, setPdfWidth] = useState(760);

    const [isResolvingLesson, setIsResolvingLesson] = useState(true);
    const [resolvedLessonUrl, setResolvedLessonUrl] = useState<string | null>(hintedLessonUrl || null);
    const [resolvedLessonTitle, setResolvedLessonTitle] = useState<string>(hintedLessonTitle || `Module ${id} Theory Manual`);
    const [resolvedLessonType, setResolvedLessonType] = useState<ResourceType>(hintedLessonType);
    const [moduleTitle, setModuleTitle] = useState<string>(`Module ${id} Theory Manual`);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [viewerError, setViewerError] = useState<string | null>(null);

    const [lessonOptions, setLessonOptions] = useState<ModuleLessonOption[]>([]);
    const [selectedLessonResourceId, setSelectedLessonResourceId] = useState<number | null>(hintedLessonResourceId);

    // --- SEQUENTIAL UNLOCK STATE ---
    const [highestUnlockedIndex, setHighestUnlockedIndex] = useState<number>(0);

    const authToken = getAuthToken();
    const previewPaneRef = useRef<HTMLDivElement | null>(null);

    // --- WORKING THEME TOGGLE LOGIC ---
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
    // ----------------------------------

    useEffect(() => {
        // setNativeSecureScreen(true);
        setNativeSecureScreen(false);
        return () => {
            setNativeSecureScreen(false);
        };
    }, []);

    useEffect(() => {
        const node = previewPaneRef.current;
        if (!node) return;

        const updateWidth = () => {
            const containerWidth = node.clientWidth;
            if (!containerWidth) return;
            const nextWidth = Math.max(260, Math.min(containerWidth - 48, 820));
            setPdfWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
        };

        updateWidth();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateWidth);
            return () => window.removeEventListener('resize', updateWidth);
        }

        const observer = new ResizeObserver(() => updateWidth());
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
        setHighestUnlockedIndex(0); // Reset progress on module load

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

    useEffect(() => {
        if (resolvedLessonType === 'PDF' && numPages !== null && pageNumber === numPages) {
            const currentIndex = lessonOptions.findIndex(opt => opt.resourceId === selectedLessonResourceId);
            if (currentIndex !== -1 && currentIndex === highestUnlockedIndex) {
                setHighestUnlockedIndex(prev => prev + 1);
            }
        }
    }, [pageNumber, numPages, resolvedLessonType, selectedLessonResourceId, lessonOptions, highestUnlockedIndex]);

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

    const changePage = (offset: number) => {
        setPageNumber((prevPageNumber) => prevPageNumber + offset);
    };

    const handleMarkVideoComplete = () => {
        if (selectedLessonIndex === -1) return;
        if (selectedLessonIndex === highestUnlockedIndex) {
            setHighestUnlockedIndex((prev) => prev + 1);
        }
    };

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
                        <div className="hidden sm:block bg-slate-100 dark:bg-[#111622] text-slate-400 dark:text-slate-500 px-6 py-2.5 rounded font-bold text-xs tracking-widest uppercase border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                            AWAITING_DATA
                        </div>
                    </div>
                </header>

                {/* <ReactAntiCapture
                    className="max-w-[1600px] mx-auto w-full"
                    title="Module capture blocked"
                    message="Screenshots and print-screen attempts are blocked on this module."
                > */}
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
                    <section className="flex-1 flex flex-col h-[600px] lg:h-[calc(100vh-140px)]">
                        <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800/80 shadow-sm relative h-full flex flex-col transition-colors duration-300">
                            {/* Corner Accents */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />

                            {!isResolvingLesson && !resolveError && !viewerError && (documentFile || currentVideoLesson) ? (
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-transparent transition-colors duration-300">
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
                                    {resolvedLessonType === 'PDF' && numPages ? (
                                        <div className="flex items-center gap-3 bg-white dark:bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 transition-colors duration-300">
                                            <button
                                                disabled={pageNumber <= 1}
                                                onClick={() => changePage(-1)}
                                                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 transition"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase tracking-widest font-bold">
                                                PG {pageNumber}/{numPages}
                                            </span>
                                            <button
                                                disabled={pageNumber >= numPages}
                                                onClick={() => changePage(1)}
                                                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 transition"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-white dark:bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 transition-colors duration-300">
                                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase tracking-widest font-bold">
                                                {resolvedLessonType}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {/* Lesson Viewer / Error States */}
                            <div
                                ref={previewPaneRef}
                                className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10 flex items-start justify-center bg-slate-50/30 dark:bg-[#0A0E17] relative transition-colors duration-300"
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
                                    <div className="flex w-full max-w-5xl flex-col items-center gap-6">
                                        {currentVideoLesson.kind === 'direct' ? (
                                            <video
                                                controls
                                                preload="metadata"
                                                className="w-full rounded-lg border border-slate-200 shadow-2xl dark:border-slate-800"
                                                src={currentVideoLesson.sourceUrl}
                                            >
                                                Your browser does not support this video lesson.
                                            </video>
                                        ) : (
                                            <div className="w-full overflow-hidden rounded-lg border border-slate-200 shadow-2xl dark:border-slate-800 aspect-video bg-black">
                                                <iframe
                                                    title={`${resolvedLessonTitle} ${currentVideoLesson.providerLabel}`}
                                                    src={currentVideoLesson.embedUrl}
                                                    className="h-full w-full border-0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                    allowFullScreen
                                                />
                                            </div>
                                        )}

                                        <div className="flex flex-col items-center gap-3 text-center">
                                            <button
                                                type="button"
                                                onClick={handleMarkVideoComplete}
                                                disabled={selectedLessonIndex === -1 || selectedLessonIndex < highestUnlockedIndex}
                                                className="rounded-lg border border-cyan-500/40 bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {selectedLessonIndex !== -1 && selectedLessonIndex < highestUnlockedIndex ? 'Video Complete' : 'Mark Video Complete'}
                                            </button>
                                            <p className="max-w-xl text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                Video lessons unlock the next lesson when you mark the current video as complete.
                                            </p>
                                        </div>
                                    </div>
                                ) : documentFile ? (
                                    <div className="flex justify-center w-full max-w-full">
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
                                                width={pdfWidth}
                                                // Border and shadow applied directly to the page canvas so it snaps to aspect ratio
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
                        </div>
                    </section>
                </main>
                {/* </ReactAntiCapture> */}
            </div>
        </CyberTransition>
    );
};

export default ModuleView;
