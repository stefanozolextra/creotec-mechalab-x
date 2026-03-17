import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import CyberTransition from '../components/CyberTransition';
import ReactAntiCapture from '../components/AntiCapture';
import { API_BASE_URL } from '../api/http';
import { getTraineeDashboard } from '../api/trainees';
import { getAuthToken } from '../utils/auth';

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
            <div className="min-h-screen bg-slate-950 text-slate-200 relative overflow-x-hidden select-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none -z-10" />

                <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-2 shrink-0"
                            >
                                <ArrowLeft size={20} /> <span className="font-semibold text-sm">Return to Briefing</span>
                            </button>
                            <div className="hidden sm:block h-10 w-px bg-slate-800" />
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-400 font-black mb-1">
                                    Intel Manual Workspace
                                </p>
                                <h1 className="font-black text-xl sm:text-2xl text-white flex items-center gap-2 min-w-0">
                                    <BookOpen className="text-cyan-500 shrink-0" size={20} />
                                    <span className="truncate">{moduleTitle}</span>
                                </h1>
                                <p className="mt-1 text-xs sm:text-sm text-slate-400 font-mono uppercase tracking-widest">
                                    {lessonOptions.length === 1
                                        ? '1 lesson file linked'
                                        : `${lessonOptions.length} lesson files linked`}
                                </p>
                            </div>
                        </div>

                        {numPages && !isResolvingPdf && !resolveError && !viewerError ? (
                            <div className="flex items-center gap-3 self-start lg:self-center bg-slate-900/90 px-3 sm:px-4 py-2 rounded-xl border border-slate-800">
                                <button
                                    disabled={pageNumber <= 1}
                                    onClick={() => changePage(-1)}
                                    className="text-slate-400 hover:text-white disabled:opacity-30 transition"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-xs sm:text-sm font-mono text-slate-300 uppercase tracking-widest">
                                    Page {pageNumber} / {numPages}
                                </span>
                                <button
                                    disabled={pageNumber >= numPages}
                                    onClick={() => changePage(1)}
                                    className="text-slate-400 hover:text-white disabled:opacity-30 transition"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        ) : null}
                    </div>
                </header>

                <ReactAntiCapture
                    className="max-w-7xl mx-auto"
                    title="Module capture blocked"
                    message="Screenshots and print-screen attempts are blocked on this module."
                >
                    <main className="px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
                        <div className="grid gap-4 lg:gap-6 xl:gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
                            <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden h-fit">
                                <div className="px-4 py-4 border-b border-slate-800 bg-slate-900">
                                    <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400 font-black">
                                        Module Files
                                    </p>
                                    <div className="mt-3 flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-white truncate">{moduleTitle}</p>
                                            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                                {lessonOptions.length === 0
                                                    ? 'No files linked'
                                                    : lessonOptions.length === 1
                                                        ? '1 file ready'
                                                        : `${lessonOptions.length} files ready`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 sm:p-4 space-y-2">
                                    {isResolvingPdf ? (
                                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-center text-slate-400">
                                            <Loader2 size={24} className="animate-spin mx-auto mb-3 text-cyan-500" />
                                            <p className="text-xs font-mono uppercase tracking-widest">Syncing lesson files...</p>
                                        </div>
                                    ) : lessonOptions.length > 0 ? (
                                        lessonOptions.map((option, index) => {
                                            const isSelected = option.resourceId === selectedLessonResourceId;
                                            return (
                                                <button
                                                    key={option.resourceId}
                                                    type="button"
                                                    onClick={() => setSelectedLessonResourceId(option.resourceId)}
                                                    className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${isSelected
                                                            ? 'border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.08)]'
                                                            : 'border-slate-800 bg-slate-950/50 hover:bg-slate-900'
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                                                            }`}>
                                                            {String(index + 1).padStart(2, '0')}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                                                {option.title}
                                                            </p>
                                                            <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                                                {isSelected ? 'Active preview' : 'Select file'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-center text-slate-400">
                                            <FileText size={22} className="mx-auto mb-3 opacity-70" />
                                            <p className="text-sm font-semibold text-slate-300">No lesson files available</p>
                                            <p className="mt-1 text-xs font-mono uppercase tracking-widest">
                                                Admin uploads will appear here automatically
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </aside>

                            <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 flex flex-col">
                                <div className="px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-900 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400 font-black mb-2">
                                            Active Preview
                                        </p>
                                        <h2 className="text-lg sm:text-xl font-black text-white truncate">
                                            {resolvedPdfTitle}
                                        </h2>
                                        <p className="mt-1 text-xs sm:text-sm text-slate-400 font-mono uppercase tracking-widest">
                                            {selectedLessonResourceId ? `Resource ${selectedLessonResourceId}` : 'Awaiting file selection'}
                                        </p>
                                    </div>
                                    {numPages && !isResolvingPdf && !resolveError && !viewerError ? (
                                        <div className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-slate-500">
                                            Inline authenticated PDF preview
                                        </div>
                                    ) : null}
                                </div>

                                <div
                                    ref={previewPaneRef}
                                    className="p-4 md:p-6 flex justify-center items-start bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.08),_transparent_42%),linear-gradient(to_bottom,_rgba(2,6,23,0.82),_rgba(2,6,23,0.98))] min-h-[420px]"
                                >
                                    {isResolvingPdf ? (
                                        <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-300">
                                            <Loader2 size={42} className="animate-spin mx-auto mb-3 text-cyan-500" />
                                            Resolving lesson PDF...
                                        </div>
                                    ) : resolveError ? (
                                        <div className="w-full max-w-3xl bg-red-950/40 border border-red-900 rounded-2xl p-8 text-center text-red-200">
                                            <AlertTriangle size={38} className="mx-auto mb-3" />
                                            {resolveError}
                                        </div>
                                    ) : viewerError ? (
                                        <div className="w-full max-w-3xl bg-red-950/40 border border-red-900 rounded-2xl p-8 text-center text-red-200">
                                            <AlertTriangle size={38} className="mx-auto mb-3" />
                                            {viewerError}
                                        </div>
                                    ) : documentFile ? (
                                        <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-800 flex justify-center items-start max-w-full">
                                            <Document
                                                file={documentFile}
                                                onLoadSuccess={onDocumentLoadSuccess}
                                                onLoadError={(error) => {
                                                    setViewerError(getErrorMessage(error, 'Failed to load PDF document.'));
                                                }}
                                                loading={
                                                    <div className="flex flex-col items-center justify-center h-[500px] w-full text-slate-400 p-8 text-center">
                                                        <Loader2 size={48} className="animate-spin mb-4 text-cyan-500 mx-auto" />
                                                        <p>Loading lesson PDF...</p>
                                                    </div>
                                                }
                                            >
                                                <Page
                                                    pageNumber={pageNumber}
                                                    renderTextLayer={false}
                                                    renderAnnotationLayer={false}
                                                    width={pdfWidth}
                                                />
                                            </Document>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-300">
                                            No lesson PDF is available for this module.
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </main>
                </ReactAntiCapture>
            </div>
        </CyberTransition>
    );
};

export default ModuleView;
