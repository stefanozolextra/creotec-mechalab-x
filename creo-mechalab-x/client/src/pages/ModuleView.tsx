import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import PageTransition from '../components/PageTransition';
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
    const [pdfWidth, setPdfWidth] = useState(800);

    const [isResolvingPdf, setIsResolvingPdf] = useState(true);
    const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string | null>(hintedPdfUrl || null);
    const [resolvedPdfTitle, setResolvedPdfTitle] = useState<string>(hintedLessonTitle || `Module ${id} Theory Manual`);
    const [moduleTitle, setModuleTitle] = useState<string>(`Module ${id} Theory Manual`);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [viewerError, setViewerError] = useState<string | null>(null);

    const [lessonOptions, setLessonOptions] = useState<ModuleLessonOption[]>([]);
    const [selectedLessonResourceId, setSelectedLessonResourceId] = useState<number | null>(hintedLessonResourceId);

    const authToken = getAuthToken();

    useEffect(() => {
        const handleResize = () => {
            const screenWidth = window.innerWidth;
            setPdfWidth(screenWidth < 864 ? screenWidth - 64 : 800);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
        <PageTransition>
            <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col select-none">
                <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-10 shadow-lg gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-2"
                        >
                            <ArrowLeft size={20} /> <span className="font-semibold text-sm">Return to Map</span>
                        </button>
                        <div className="h-6 w-px bg-slate-700" />
                        <div className="min-w-0">
                            <h1 className="font-bold text-lg text-white flex items-center gap-2 truncate">
                                <BookOpen className="text-cyan-500" size={20} />
                                <span className="truncate">{resolvedPdfTitle}</span>
                            </h1>
                            {lessonOptions.length > 0 ? (
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Lesson</span>
                                    <select
                                        value={selectedLessonResourceId ?? lessonOptions[0].resourceId}
                                        onChange={(event) => {
                                            const nextResourceId = Number(event.target.value);
                                            setSelectedLessonResourceId(Number.isFinite(nextResourceId) ? nextResourceId : null);
                                        }}
                                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                                    >
                                        {lessonOptions.map((option) => (
                                            <option key={option.resourceId} value={option.resourceId}>
                                                {option.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {numPages && !isResolvingPdf && !resolveError && !viewerError ? (
                        <div className="flex items-center gap-4 bg-slate-800 px-4 py-1.5 rounded-lg border border-slate-700">
                            <button
                                disabled={pageNumber <= 1}
                                onClick={() => changePage(-1)}
                                className="text-slate-400 hover:text-white disabled:opacity-30 transition"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="text-sm font-mono text-slate-300">
                                Page {pageNumber} of {numPages}
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
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
                    {isResolvingPdf ? (
                        <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-300">
                            <Loader2 size={42} className="animate-spin mx-auto mb-3 text-cyan-500" />
                            Resolving lesson PDF...
                        </div>
                    ) : resolveError ? (
                        <div className="w-full max-w-3xl bg-red-950/40 border border-red-900 rounded-xl p-8 text-center text-red-200">
                            <AlertTriangle size={38} className="mx-auto mb-3" />
                            {resolveError}
                        </div>
                    ) : viewerError ? (
                        <div className="w-full max-w-3xl bg-red-950/40 border border-red-900 rounded-xl p-8 text-center text-red-200">
                            <AlertTriangle size={38} className="mx-auto mb-3" />
                            {viewerError}
                        </div>
                    ) : documentFile ? (
                        <div className="bg-white rounded-sm shadow-2xl overflow-hidden border border-slate-800 flex justify-center items-start max-h-[85vh]">
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
                        <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-300">
                            No lesson PDF is available for this module.
                        </div>
                    )}
                </main>
            </div>
        </PageTransition>
    );
};

export default ModuleView;
