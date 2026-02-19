/* SECTION: IMPORTS
   - USE: Standard React hooks, routing parameters, and UI icons.
   - KEYPOINT: 'react-pdf' is used to render the document directly onto the canvas to prevent easy downloading.
*/
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import PageTransition from '../components/PageTransition';

// Set up the PDF.js worker (Required for react-pdf to process files in the background)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ModuleView = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // Gets the module ID from the URL

    // SECTION: PDF STATE MANAGEMENT
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);

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
                    - KEYPOINT: Uses a placeholder PDF path. We disable text selection overlays for security and cleaner UI.
                */}
                <main className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <div className="bg-white rounded-sm shadow-2xl min-h-[800px] overflow-hidden border border-slate-800 flex justify-center items-start">
                        {/* Ensure you place a dummy file named 'mock-module.pdf' in your public/ folder */}
                        <Document
                            file="/mock-module.pdf"
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <div className="flex flex-col items-center justify-center h-[800px] w-[600px] text-slate-400">
                                    <Loader2 size={48} className="animate-spin mb-4 text-cyan-500" />
                                    <p>Loading Module {id} data...</p>
                                </div>
                            }
                            error={
                                <div className="flex flex-col items-center justify-center h-[800px] w-[600px] text-red-400 bg-slate-900">
                                    <p>Failed to load PDF file.</p>
                                    <p className="text-sm text-slate-500 mt-2">Did you add 'mock-module.pdf' to the public folder?</p>
                                </div>
                            }
                        >
                            <Page
                                pageNumber={pageNumber}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="max-w-4xl"
                                width={800} // Locks width for consistent reading experience
                            />
                        </Document>
                    </div>
                </main>

            </div>
        </PageTransition>
    );
};

export default ModuleView;