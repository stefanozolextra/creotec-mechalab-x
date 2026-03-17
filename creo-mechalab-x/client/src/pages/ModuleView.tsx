import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, FileText, Loader2, Moon, Target, CheckCircle2, Lock } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import CyberTransition from '../components/CyberTransition';
import ReactAntiCapture from '../components/AntiCapture';
import { API_BASE_URL } from '../api/http';
import { getTraineeDashboard } from '../api/trainees';
import { getAuthToken } from '../utils/auth';
import { setNativeSecureScreen } from '../utils/nativeSecureScreen';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type ModuleLessonOption = {
    resourceId: number;
    title: string;
    url: string;
    orderNo: number;
};

type ModuleLocationState = {
    pdfUrl?: unknown;
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
    const hintedPdfUrl = typeof locationState?.pdfUrl === 'string' ? locationState.pdfUrl.trim() : '';
    const hintedLessonTitle = typeof locationState?.lessonTitle === 'string' ? locationState.lessonTitle.trim() : '';
    const hintedLessonResourceId = (() => {
        const parsed = Number(locationState?.lessonResourceId);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    })();

    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfWidth, setPdfWidth] = useState(760);

    const [isResolvingPdf, setIsResolvingPdf] = useState(true);
    const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string | null>(hintedPdfUrl || null);
    const [resolvedPdfTitle, setResolvedPdfTitle] = useState<string>(hintedLessonTitle || `Module ${id} Theory Manual`);
    const [moduleTitle, setModuleTitle] = useState<string>(`Module ${id} Theory Manual`);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [viewerError, setViewerError] = useState<string | null>(null);

    const [lessonOptions, setLessonOptions] = useState<ModuleLessonOption[]>([]);
    const [selectedLessonResourceId, setSelectedLessonResourceId] = useState<number | null>(hintedLessonResourceId);

    const authToken = getAuthToken();
    const previewPaneRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setNativeSecureScreen(true);
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
    }, [isResolvingPdf, lessonOptions.length, resolvedPdfUrl]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();

        setIsResolvingPdf(true);
        setResolveError(null);
        setViewerError(null);
        setNumPages(null);
        setPageNumber(1);
        setLessonOptions([]);

        if (!hasValidModuleId) {
            setResolveError('Invalid module id.');
            setResolvedPdfUrl(null);
            setIsResolvingPdf(false);
            return () => {
                controller.abort();
            };
        }

        const loadPdfResource = async () => {
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
                    (resource) => String(resource.type).toUpperCase() === 'PDF' && toNumber(resource.module_id) === moduleId
                );

                const options = moduleResources
                    .map((resource) => {
                        const resolved = typeof resource.resolved_url === 'string' ? resource.resolved_url.trim() : '';
                        const fallback = typeof resource.url === 'string' ? resource.url.trim() : '';
                        const url = resolved || fallback;
                        const resourceId = toNumber(resource.resource_id);
                        if (!url || resourceId < 1) return null;

                        const title =
                            typeof resource.title === 'string' && resource.title.trim()
                                ? resource.title.trim()
                                : `Lesson ${resourceId}`;

                        return {
                            resourceId,
                            title,
                            url,
                            orderNo: toNumber(resource.order_no),
                        } as ModuleLessonOption;
                    })
                    .filter((entry): entry is ModuleLessonOption => entry !== null)
                    .sort((a, b) => {
                        if (a.orderNo !== b.orderNo) return a.orderNo - b.orderNo;
                        return a.resourceId - b.resourceId;
                    });

                setLessonOptions(options);

                if (options.length === 0) {
                    if (hintedPdfUrl) {
                        setResolvedPdfUrl(hintedPdfUrl);
                        setResolvedPdfTitle(hintedLessonTitle || resolvedModuleTitle);
                        setSelectedLessonResourceId(null);
                        return;
                    }

                    setResolvedPdfUrl(null);
                    setResolvedPdfTitle(resolvedModuleTitle);
                    setSelectedLessonResourceId(null);
                    setResolveError('No lesson PDFs are assigned to this module yet.');
                    return;
                }

                const initialLesson =
                    (hintedLessonResourceId
                        ? options.find((option) => option.resourceId === hintedLessonResourceId)
                        : null) ?? options[0];

                setSelectedLessonResourceId(initialLesson.resourceId);
                setResolvedPdfUrl(initialLesson.url);
                setResolvedPdfTitle(initialLesson.title || resolvedModuleTitle);
            } catch (error) {
                if (controller.signal.aborted) return;
                if (!active) return;
                setResolvedPdfUrl(null);
                setResolveError(getErrorMessage(error, 'Failed to load module PDF.'));
            } finally {
                if (active && !controller.signal.aborted) setIsResolvingPdf(false);
            }
        };

        void loadPdfResource();

        return () => {
            active = false;
            controller.abort();
        };
    }, [hasValidModuleId, hintedLessonResourceId, hintedLessonTitle, hintedPdfUrl, moduleId]);

    useEffect(() => {
        if (isResolvingPdf) return;
        if (lessonOptions.length === 0) return;

        const selectedLesson =
            (selectedLessonResourceId !== null
                ? lessonOptions.find((option) => option.resourceId === selectedLessonResourceId)
                : null) ?? lessonOptions[0];

        if (!selectedLesson) return;

        if (selectedLessonResourceId !== selectedLesson.resourceId) {
            setSelectedLessonResourceId(selectedLesson.resourceId);
        }

        setResolvedPdfUrl(selectedLesson.url);
        setResolvedPdfTitle(selectedLesson.title || moduleTitle || `Module ${moduleId} Theory Manual`);
        setResolveError(null);
        setViewerError(null);
        setNumPages(null);
        setPageNumber(1);
    }, [isResolvingPdf, lessonOptions, moduleId, moduleTitle, selectedLessonResourceId]);

    const documentFile = useMemo(() => {
        if (!resolvedPdfUrl) return null;
        const absoluteUrl = toAbsoluteUrl(resolvedPdfUrl);
        const shouldAttachAuthHeader = resolvedPdfUrl.startsWith('/') || absoluteUrl.startsWith(API_BASE_URL);

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
    }, [authToken, resolvedPdfUrl]);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
        setViewerError(null);
    };

    const changePage = (offset: number) => {
        setPageNumber((prevPageNumber) => prevPageNumber + offset);
    };

    return (
        <CyberTransition>
            <div
                className="min-h-screen flex flex-col bg-slate-50 font-sans select-none"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #cbd5e140 1px, transparent 1px),
                        linear-gradient(to bottom, #cbd5e140 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                }}
            >
                {/* Top Cyan Accent Line */}
                <div className="h-1 w-full bg-cyan-500" />

                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-sm">
                    <div className="flex items-center gap-4 min-w-0 sm:gap-8">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded font-bold text-xs tracking-wider uppercase transition-colors shrink-0"
                        >
                            <ArrowLeft size={16} strokeWidth={2.5} /> <span className="hidden sm:inline">DASHBOARD</span>
                        </button>

                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 text-slate-900">
                                <BookOpen size={20} className="text-cyan-600 shrink-0" />
                                <h1 className="font-black text-lg sm:text-xl tracking-widest uppercase truncate">INTEL: {moduleTitle}</h1>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">DATA_STREAM_ACTIVE</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="text-slate-400 hover:text-slate-600 transition-colors hidden sm:block">
                            <Moon size={22} />
                        </button>
                        <div className="hidden sm:block bg-slate-100 text-slate-400 px-6 py-2.5 rounded font-bold text-xs tracking-widest uppercase border border-slate-200">
                            AWAITING_DATA
                        </div>
                    </div>
                </header>

                <ReactAntiCapture
                    className="max-w-[1600px] mx-auto w-full"
                    title="Module capture blocked"
                    message="Screenshots and print-screen attempts are blocked on this module."
                >
                    <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full relative z-10">

                        {/* Sidebar - Module List */}
                        <aside className="w-full lg:w-[360px] flex-shrink-0 flex flex-col lg:h-[calc(100vh-140px)]">
                            <div className="bg-white border border-slate-200 shadow-sm relative h-full flex flex-col">
                                {/* Corner Accents */}
                                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />

                                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 shrink-0">
                                    <FileText size={18} className="text-slate-700" strokeWidth={2.5} />
                                    <h2 className="font-black text-slate-800 tracking-widest uppercase text-sm">MODULE LIST</h2>
                                </div>

                                <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                                    {isResolvingPdf ? (
                                        <div className="flex flex-col items-center justify-center p-6 text-slate-400">
                                            <Loader2 size={24} className="animate-spin mb-2 text-cyan-500" />
                                            <p className="text-[10px] font-mono uppercase tracking-widest font-bold">Syncing files...</p>
                                        </div>
                                    ) : lessonOptions.length > 0 ? (
                                        lessonOptions.map((option, index) => {
                                            const isSelected = option.resourceId === selectedLessonResourceId;

                                            // Visual mockup logic: Assume previous indexes are completed, current is active, future are locked
                                            const activeIndex = lessonOptions.findIndex(opt => opt.resourceId === selectedLessonResourceId);
                                            const isCompleted = index < activeIndex;
                                            const isLocked = index > activeIndex;

                                            return (
                                                <div
                                                    key={option.resourceId}
                                                    onClick={() => !isLocked && setSelectedLessonResourceId(option.resourceId)}
                                                    className={`relative p-5 border transition-all bg-white
                                                        ${isSelected ? 'border-cyan-200 border-l-[3px] border-l-cyan-400 shadow-[0_4px_20px_-5px_rgba(34,211,238,0.15)] cursor-pointer' : ''}
                                                        ${isLocked ? 'opacity-50 grayscale cursor-not-allowed border-slate-100' : ''}
                                                        ${!isSelected && !isLocked ? 'border-slate-100 hover:border-slate-200 cursor-pointer' : ''}
                                                    `}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="min-w-0 pr-2">
                                                            <p className={`text-[10px] font-bold tracking-widest uppercase mb-1.5 ${isSelected ? 'text-cyan-500' : 'text-slate-400'}`}>
                                                                FILE_{String(index + 1).padStart(2, '0')}
                                                            </p>
                                                            <h3 className={`font-extrabold tracking-wide uppercase text-sm truncate ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                                                                {option.title}
                                                            </h3>
                                                        </div>
                                                        {isCompleted && <CheckCircle2 size={18} className="text-emerald-500 mt-1 shrink-0" />}
                                                        {isSelected && <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />}
                                                        {isLocked && <Lock size={16} className="text-slate-300 mt-1 shrink-0" />}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-6 text-center text-slate-400">
                                            <FileText size={22} className="mx-auto mb-2 opacity-30" />
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">No files found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </aside>

                        {/* Main Content Area */}
                        <section className="flex-1 flex flex-col h-[600px] lg:h-[calc(100vh-140px)]">
                            <div className="bg-white border border-slate-200 shadow-sm relative h-full flex flex-col">
                                {/* Corner Accents */}
                                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />

                                {numPages && !isResolvingPdf && !resolveError && !viewerError ? (
                                    <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-50/50">
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-black text-slate-800 truncate">
                                                {resolvedPdfTitle}
                                            </h2>
                                            {selectedLessonResourceId && (
                                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">
                                                    Resource ID: {selectedLessonResourceId}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                            <button
                                                disabled={pageNumber <= 1}
                                                onClick={() => changePage(-1)}
                                                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 transition"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="text-xs font-mono text-slate-600 uppercase tracking-widest font-bold">
                                                PG {pageNumber}/{numPages}
                                            </span>
                                            <button
                                                disabled={pageNumber >= numPages}
                                                onClick={() => changePage(1)}
                                                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 transition"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ) : null}

                                {/* PDF Viewer / Error States */}
                                <div
                                    ref={previewPaneRef}
                                    className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-50/30 relative"
                                >
                                    {isResolvingPdf ? (
                                        <div className="flex flex-col items-center justify-center h-full w-full text-slate-400">
                                            <Loader2 size={42} className="animate-spin mb-4 text-cyan-500" />
                                            <p className="text-xs font-mono uppercase tracking-widest font-bold">Resolving Document...</p>
                                        </div>
                                    ) : resolveError ? (
                                        <div className="flex flex-col items-center justify-center w-full">
                                            <div className="bg-white border border-slate-100 shadow-xl w-full max-w-lg h-72 flex flex-col items-center justify-center gap-6">
                                                <Target size={56} className="text-red-400" strokeWidth={1} />
                                                <p className="text-red-500 font-bold tracking-widest text-xs uppercase text-center font-mono">
                                                    ERROR: {resolveError.toUpperCase()}
                                                </p>
                                            </div>
                                        </div>
                                    ) : viewerError ? (
                                        <div className="flex flex-col items-center justify-center w-full">
                                            <div className="bg-white border border-slate-100 shadow-xl w-full max-w-lg h-72 flex flex-col items-center justify-center gap-6">
                                                <Target size={56} className="text-red-400" strokeWidth={1} />
                                                <p className="text-red-500 font-bold tracking-widest text-xs uppercase text-center font-mono">
                                                    ERROR: {viewerError.toUpperCase()}
                                                </p>
                                            </div>
                                        </div>
                                    ) : documentFile ? (
                                        <div className="bg-white shadow-xl border border-slate-200 flex justify-center max-w-full h-full overflow-y-auto w-full items-start pt-4">
                                            <Document
                                                file={documentFile}
                                                onLoadSuccess={onDocumentLoadSuccess}
                                                onLoadError={(error) => {
                                                    setViewerError(getErrorMessage(error, 'FILE CORRUPTED OR MISSING'));
                                                }}
                                                loading={
                                                    <div className="flex flex-col items-center justify-center h-[500px] w-full text-slate-400 p-8 text-center">
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
                                                    className="shadow-sm"
                                                />
                                            </Document>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full">
                                            <div className="bg-white border border-slate-100 shadow-xl w-full max-w-lg h-72 flex flex-col items-center justify-center gap-6">
                                                <Target size={56} className="text-red-400" strokeWidth={1} />
                                                <p className="text-red-500 font-bold tracking-widest text-xs uppercase text-center font-mono">
                                                    ERROR: FILE CORRUPTED OR MISSING
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </main>
                </ReactAntiCapture>
            </div>
        </CyberTransition>
    );
};

export default ModuleView;