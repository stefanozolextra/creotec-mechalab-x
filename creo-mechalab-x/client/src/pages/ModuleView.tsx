import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Loader2, Sun, Moon, Crosshair, FileText, CheckCircle2, Lock } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import CyberTransition from '../components/CyberTransition';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// MOCK DATA: Lessons within the module
type LessonStatus = 'completed' | 'active' | 'locked';
type Lesson = {
    id: string;
    title: string;
    file: string; // URL to the PDF
    status: LessonStatus;
};

const MOCK_LESSONS: Lesson[] = [
    { id: '01', title: 'System Overview', file: '/mock-module.pdf', status: 'completed' },
    { id: '02', title: 'Component Wiring', file: '/mock-module.pdf', status: 'active' },
    { id: '03', title: 'Safety Protocols', file: '/mock-module.pdf', status: 'locked' },
];

const ModuleView = () => {
    const navigate = useNavigate();
    const { id: moduleId } = useParams();

    const [activeLessonId, setActiveLessonId] = useState<string>(MOCK_LESSONS.find(l => l.status === 'active')?.id || MOCK_LESSONS[0].id);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfWidth, setPdfWidth] = useState(800);
    const [isDarkMode, setIsDarkMode] = useState(true);

    const pdfContainerRef = useRef<HTMLDivElement>(null);
    const activeLesson = MOCK_LESSONS.find(l => l.id === activeLessonId);

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

    // Dynamically adjust PDF width strictly based on its wrapper container
    useEffect(() => {
        const handleResize = () => {
            if (pdfContainerRef.current) {
                // Subtracting 32px to leave a nice 16px padding on both sides
                setPdfWidth(pdfContainerRef.current.clientWidth - 32);
            }
        };

        handleResize(); // Fire immediately
        // Slight delay to ensure DOM has painted the grid before measuring
        setTimeout(handleResize, 100);

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [activeLessonId]); // Re-run if lesson changes cause layout shifts

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1); // Reset to page 1 when loading a new PDF
    };

    const changePage = (offset: number) => {
        setPageNumber(prevPageNumber => prevPageNumber + offset);
    };

    const handleLessonSwitch = (lessonId: string, status: LessonStatus) => {
        if (status === 'locked') return;
        setActiveLessonId(lessonId);
        setPageNumber(1);
        setNumPages(null);
    };

    return (
        <CyberTransition>
            <div className="h-screen w-full overflow-hidden bg-slate-100 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 font-sans selection:bg-cyan-500 selection:text-white flex flex-col select-none transition-colors duration-300 z-0 relative">

                {/* GAME HUD GRID BACKGROUND */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] pointer-events-none -z-10" />

                {/* SECTION: HUD NAVIGATION BAR */}
                <header className="bg-white/95 dark:bg-[#0B1120]/95 border-b-2 border-slate-300 dark:border-cyan-900/50 p-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(6,182,212,0.1)] backdrop-blur-md transition-colors duration-300 gap-4 sm:gap-0 shrink-0">

                    <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="group p-2 sm:px-4 sm:py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2 rounded-sm border-l-2 border-transparent hover:border-cyan-500 shrink-0"
                            title="Abort Review"
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest font-mono hidden sm:inline">Dashboard</span>
                        </button>

                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

                        <div className="flex flex-col min-w-0">
                            <h1 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest truncate">
                                <BookOpen className="text-cyan-600 dark:text-cyan-400 shrink-0" size={16} />
                                <span className="truncate">INTEL: PROTOCOL {moduleId}</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                <p className="text-[9px] text-slate-500 dark:text-cyan-400/70 uppercase tracking-widest font-mono transition-colors truncate">
                                    DATA_STREAM_ACTIVE
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-6">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 transition hover:bg-slate-200 dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 shrink-0"
                            title="Toggle Optics"
                        >
                            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <div className="flex items-center gap-2 sm:gap-4 bg-slate-100 dark:bg-[#0B1120] px-2 sm:px-4 py-1.5 rounded-sm border border-slate-300 dark:border-cyan-900/50 shadow-inner min-w-[160px] justify-center">
                            {numPages ? (
                                <>
                                    <button
                                        disabled={pageNumber <= 1}
                                        onClick={() => changePage(-1)}
                                        className="p-1 sm:p-1.5 bg-slate-200 hover:bg-cyan-500 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-cyan-500/20 dark:hover:text-cyan-400 disabled:opacity-30 disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-colors rounded-sm"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>

                                    <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-700 dark:text-cyan-500 tracking-widest uppercase text-center w-full">
                                        PAGE_{String(pageNumber).padStart(2, '0')}/{String(numPages).padStart(2, '0')}
                                    </span>

                                    <button
                                        disabled={pageNumber >= numPages}
                                        onClick={() => changePage(1)}
                                        className="p-1 sm:p-1.5 bg-slate-200 hover:bg-cyan-500 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-cyan-500/20 dark:hover:text-cyan-400 disabled:opacity-30 disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-colors rounded-sm"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </>
                            ) : (
                                <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 uppercase tracking-widest text-center py-1">
                                    AWAITING_DATA
                                </span>
                            )}
                        </div>
                    </div>
                </header>

                {/* SECTION: GRID LAYOUT */}
                <div className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col md:flex-row gap-6 lg:gap-8">

                    {/* CONTAINER 1: FILE INDEX */}
                    <aside className="w-full md:w-72 lg:w-80 shrink-0 flex flex-col bg-white dark:bg-[#111827] ring-1 ring-slate-300 dark:ring-cyan-900/50 shadow-[0_10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_0_20px_rgba(6,182,212,0.1)] relative group rounded-sm max-h-[35vh] md:max-h-none h-full overflow-hidden transition-colors duration-300">
                        {/* Decorative Corners */}
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500 z-20 pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500 z-20 pointer-events-none" />

                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] shrink-0">
                            <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-sm flex items-center gap-2">
                                <FileText size={16} className="text-cyan-600 dark:text-cyan-400" />
                                Module List
                            </h2>
                        </div>

                        {/* Scrollable List of Files */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-cyan-900/50">
                            {MOCK_LESSONS.map((lesson) => {
                                const isSelected = activeLessonId === lesson.id;
                                const isCompleted = lesson.status === 'completed';
                                const isLocked = lesson.status === 'locked';

                                return (
                                    <button
                                        key={lesson.id}
                                        onClick={() => handleLessonSwitch(lesson.id, lesson.status)}
                                        disabled={isLocked}
                                        className={`
                                            flex flex-col gap-2 p-3 rounded-sm w-full transition-all duration-300 text-left border relative overflow-hidden
                                            ${isSelected
                                                ? 'bg-white dark:bg-cyan-950/20 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                                            }
                                            ${isLocked ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />}

                                        <div className="flex items-center justify-between w-full pl-1">
                                            <span className={`text-[10px] font-mono tracking-widest font-bold ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                                FILE_{lesson.id}
                                            </span>
                                            {isCompleted && !isSelected && <CheckCircle2 size={14} className="text-emerald-500" />}
                                            {isLocked && <Lock size={14} className="text-slate-400" />}
                                            {isSelected && <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_5px_#06b6d4]"></span>}
                                        </div>
                                        <h3 className={`text-xs lg:text-sm font-bold uppercase tracking-wide truncate w-full pl-1 ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {lesson.title}
                                        </h3>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    {/* CONTAINER 2: CONTENT VIEWER */}
                    <section className="flex-1 shrink-0 bg-white dark:bg-[#111827] ring-1 ring-slate-300 dark:ring-cyan-900/50 shadow-2xl relative group rounded-sm flex flex-col overflow-hidden h-full">
                        {/* Decorative Corners */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500 z-20 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500 z-20 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />

                        {/* Scanning Line overlay */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/20 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-[scan_4s_ease-in-out_infinite] pointer-events-none z-30 hidden dark:block" />

                        {/* PDF Container - Flex-1 ensures it pushes everything correctly */}
                        <div
                            ref={pdfContainerRef}
                            className="flex-1 overflow-y-auto overflow-x-hidden flex justify-center items-start p-4 bg-slate-50/50 dark:bg-slate-900/20 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-cyan-900/50 relative z-10"
                        >
                            <Document
                                file={activeLesson?.file || "/mock-module.pdf"}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="flex flex-col items-center justify-center h-full w-full text-slate-500 dark:text-cyan-600 p-8 text-center mt-20">
                                        <Crosshair size={48} className="animate-[spin_4s_linear_infinite] mb-6 opacity-50" strokeWidth={1} />
                                        <div className="flex items-center gap-3 font-mono text-xs sm:text-sm tracking-widest uppercase font-bold">
                                            <Loader2 size={16} className="animate-spin" />
                                            Decrypting File {activeLessonId}...
                                        </div>
                                    </div>
                                }
                                error={
                                    <div className="flex flex-col items-center justify-center h-full w-full text-red-500 p-8 text-center mt-20 font-mono">
                                        <Crosshair size={48} className="mb-6 opacity-50" strokeWidth={1} />
                                        <p className="text-sm tracking-widest uppercase font-bold">Error: File Corrupted or Missing</p>
                                    </div>
                                }
                                className="bg-white flex flex-col items-center shadow-md ring-1 ring-slate-200 dark:ring-slate-800"
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    width={pdfWidth}
                                    className="max-w-full"
                                />
                            </Document>
                        </div>
                    </section>
                </div>
            </div>
        </CyberTransition>
    );
};

export default ModuleView;