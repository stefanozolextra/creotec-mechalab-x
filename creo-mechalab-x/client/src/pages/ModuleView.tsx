import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Loader2, Sun, Moon, Crosshair } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import PageTransition from '../components/PageTransition';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ModuleView = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [pdfWidth, setPdfWidth] = useState(800);
    const [isDarkMode, setIsDarkMode] = useState(true);

    // Initialize theme based on document class to match Dashboard
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

    // Dynamically adjust PDF width based on the user's screen size
    useEffect(() => {
        const handleResize = () => {
            // Screen width minus padding to fit nicely inside the HUD container
            const screenWidth = window.innerWidth;
            setPdfWidth(screenWidth < 864 ? screenWidth - 48 : 800);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    const changePage = (offset: number) => {
        setPageNumber(prevPageNumber => prevPageNumber + offset);
    };

    return (
        <PageTransition>
            <div className="min-h-screen w-full overflow-x-hidden bg-slate-100 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 font-sans selection:bg-cyan-500 selection:text-white flex flex-col select-none transition-colors duration-300 z-0 relative">

                {/* GAME HUD GRID BACKGROUND */}
                <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] pointer-events-none -z-10" />

                {/* SECTION: HUD NAVIGATION BAR */}
                <header className="bg-white/95 dark:bg-[#0B1120]/95 border-b-2 border-slate-300 dark:border-cyan-900/50 p-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(6,182,212,0.1)] backdrop-blur-md transition-colors duration-300 gap-4 sm:gap-0">

                    {/* Left: Return Action & Title */}
                    <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="group p-2 sm:px-4 sm:py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2 rounded-sm border-l-2 border-transparent hover:border-cyan-500 shrink-0"
                            title="Abort Review"
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest font-mono hidden sm:inline">Abort Review</span>
                        </button>

                        <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

                        <div className="flex flex-col min-w-0">
                            <h1 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest truncate">
                                <BookOpen className="text-cyan-600 dark:text-cyan-400 shrink-0" size={16} />
                                <span className="truncate">INTEL: PROTOCOL {id}</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                <p className="text-[9px] text-slate-500 dark:text-cyan-400/70 uppercase tracking-widest font-mono transition-colors truncate">
                                    DATA_STREAM_ACTIVE
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Controls & Pagination */}
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-6">
                        {/* Theme Toggle */}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 transition hover:bg-slate-200 dark:hover:bg-slate-800 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 shrink-0"
                            title="Toggle Optics"
                        >
                            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        {/* Pagination HUD */}
                        {numPages && (
                            <div className="flex items-center gap-2 sm:gap-4 bg-slate-100 dark:bg-[#0B1120] px-2 sm:px-4 py-1.5 rounded-sm border border-slate-300 dark:border-cyan-900/50 shadow-inner">
                                <button
                                    disabled={pageNumber <= 1}
                                    onClick={() => changePage(-1)}
                                    className="p-1 sm:p-1.5 bg-slate-200 hover:bg-cyan-500 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-cyan-500/20 dark:hover:text-cyan-400 disabled:opacity-30 disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-colors rounded-sm"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-700 dark:text-cyan-500 tracking-widest uppercase min-w-[90px] text-center">
                                    PAGE_{String(pageNumber).padStart(2, '0')}/{String(numPages).padStart(2, '0')}
                                </span>

                                <button
                                    disabled={pageNumber >= numPages}
                                    onClick={() => changePage(1)}
                                    className="p-1 sm:p-1.5 bg-slate-200 hover:bg-cyan-500 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-cyan-500/20 dark:hover:text-cyan-400 disabled:opacity-30 disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-colors rounded-sm"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                {/* SECTION: CONTENT VIEWER */}
                <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 flex justify-center items-start z-10">

                    {/* HUD Target Container */}
                    <div className="relative group">

                        {/* Decorative Corner Accents */}
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-cyan-500 z-20 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-cyan-500 z-20 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />

                        <div className="bg-white dark:bg-[#111827] ring-1 ring-slate-300 dark:ring-cyan-900/50 shadow-2xl dark:shadow-[0_0_30px_rgba(6,182,212,0.1)] p-1 sm:p-2 relative overflow-hidden flex justify-center items-start min-h-[60vh]">

                            {/* Scanning Line overlay (subtle) */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/20 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-[scan_4s_ease-in-out_infinite] pointer-events-none z-30 hidden dark:block" />

                            <Document
                                file="/mock-module.pdf"
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="flex flex-col items-center justify-center h-[60vh] w-full text-slate-500 dark:text-cyan-600 p-8 text-center bg-slate-50 dark:bg-[#0B1120]">
                                        <Crosshair size={48} className="animate-[spin_4s_linear_infinite] mb-6 opacity-50" strokeWidth={1} />
                                        <div className="flex items-center gap-3 font-mono text-xs sm:text-sm tracking-widest uppercase font-bold">
                                            <Loader2 size={16} className="animate-spin" />
                                            Decrypting Intel Archive...
                                        </div>
                                    </div>
                                }
                                className="bg-white" // Keep PDF background strictly white so document colors render correctly
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    width={pdfWidth}
                                    className="shadow-inner"
                                />
                            </Document>
                        </div>
                    </div>
                </main>
            </div>
        </PageTransition>
    );
};

export default ModuleView;