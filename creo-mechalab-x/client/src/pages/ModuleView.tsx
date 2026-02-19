import { useState, useEffect } from 'react'; // Added useEffect
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import PageTransition from '../components/PageTransition';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ModuleView = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);

    // NEW: Mobile Responsiveness State
    const [pdfWidth, setPdfWidth] = useState(800);

    // NEW: Dynamically adjust PDF width based on the user's screen size
    useEffect(() => {
        const handleResize = () => {
            // Screen width minus padding (64px) to fit nicely on mobile
            const screenWidth = window.innerWidth;
            setPdfWidth(screenWidth < 864 ? screenWidth - 64 : 800);
        };
        handleResize(); // Fire once on load
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
            <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col select-none">
                {/* SECTION: TOP NAVIGATION BAR
                    - USE: Allows the trainee to exit back to the mission map.
                */}
                <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-2"
                        >
                            <ArrowLeft size={20} /> <span className="font-semibold text-sm">Return to Map</span>
                        </button>
                        <div className="h-6 w-px bg-slate-700"></div>
                        <h1 className="font-bold text-lg text-white flex items-center gap-2">
                            <BookOpen className="text-cyan-500" size={20} />
                            Module {id} Theory Manual
                        </h1>
                    </div>
                    {/* The Download PDF button has been intentionally removed to protect proprietary materials. */}

                    {/* SECTION: PAGINATION CONTROLS (TOP RIGHT) */}
                    {numPages && (
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
                    )}
                </header>

                {/* SECTION: CONTENT VIEWER 
                    - USE: Renders the PDF page-by-page.
                    - EDIT: Adjusted min-heights so the PDF viewer doesn't overflow drastically on landscape phones.
                */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
                    <div className="bg-white rounded-sm shadow-2xl overflow-hidden border border-slate-800 flex justify-center items-start max-h-[85vh]">
                        {/* Ensure you place a dummy file named 'mock-module.pdf' in your public/ folder */}
                        <Document
                            file="/mock-module.pdf"
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <div className="flex flex-col items-center justify-center h-[500px] w-full text-slate-400 p-8 text-center">
                                    <Loader2 size={48} className="animate-spin mb-4 text-cyan-500 mx-auto" />
                                    <p>Loading Module {id} data...</p>
                                </div>
                            }
                        >
                            <Page
                                pageNumber={pageNumber}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                width={pdfWidth} // DYNAMIC WIDTH APPLIED HERE
                            />
                        </Document>
                    </div>
                </main>
            </div>
        </PageTransition>
    );
};

export default ModuleView;