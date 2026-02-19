/* SECTION: IMPORTS
   - USE: Routing, UI icons, and the Konva Canvas engine.
*/
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, RotateCcw, Zap } from 'lucide-react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { useState, useEffect, useRef } from 'react';
import PageTransition from '../components/PageTransition';
import PortraitGuard from '../components/PortraitGuard'; // <-- Import it here

const SimulationView = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    // State to handle the responsive size of our Canvas window
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    const containerRef = useRef<HTMLDivElement>(null);

    // Keep the canvas sized correctly if the user resizes their browser
    useEffect(() => {
        const checkSize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        checkSize();
        window.addEventListener("resize", checkSize);
        return () => window.removeEventListener("resize", checkSize);
    }, []);

    return (
        <PageTransition>
            <PortraitGuard>
                <div className="h-screen flex flex-col bg-slate-950 text-slate-200 select-none overflow-hidden">

                    {/* SECTION: SIMULATION TOOLBAR */}
                    <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between z-10 shadow-lg shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                                title="Abort Simulation"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="font-bold text-lg text-white flex items-center gap-2 border-l border-slate-700 pl-4">
                                <Zap className="text-yellow-400" size={20} />
                                Level {id} Workspace
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition text-slate-300">
                                <RotateCcw size={16} /> Reset Board
                            </button>
                            <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 px-6 py-2 rounded-lg text-sm font-bold transition text-white shadow-lg shadow-cyan-900/50">
                                <Play size={16} fill="currentColor" /> Energize Circuit
                            </button>
                        </div>
                    </header>

                    {/* SECTION: INTERACTIVE CANVAS (Konva)
                    - USE: The dynamic area where components are dragged and wires are drawn.
                */}
                    <main
                        ref={containerRef}
                        className="flex-1 relative bg-[#0f172a]"
                        style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                    >
                        {/* The Stage is the root container for Konva */}
                        <Stage width={dimensions.width} height={dimensions.height}>
                            <Layer>

                                {/* MOCK COMPONENT: 24V Power Supply */}
                                <Group draggable x={50} y={50}>
                                    <Rect width={120} height={80} fill="#1e293b" stroke="#334155" strokeWidth={2} cornerRadius={8} />
                                    <Rect width={120} height={20} fill="#0ea5e9" cornerRadius={[8, 8, 0, 0]} />
                                    <Text text="24V PSU" x={10} y={5} fill="white" fontSize={12} fontStyle="bold" />

                                    {/* 24V Terminal (+) */}
                                    <Rect x={20} y={40} width={16} height={16} fill="#ef4444" cornerRadius={8} />
                                    <Text text="+24V" x={15} y={65} fill="#94a3b8" fontSize={10} />

                                    {/* 0V Terminal (-) */}
                                    <Rect x={84} y={40} width={16} height={16} fill="#3b82f6" cornerRadius={8} />
                                    <Text text="0V" x={86} y={65} fill="#94a3b8" fontSize={10} />
                                </Group>

                                {/* MOCK COMPONENT: Push Button (PB1) */}
                                <Group draggable x={250} y={50}>
                                    <Rect width={80} height={80} fill="#1e293b" stroke="#334155" strokeWidth={2} cornerRadius={8} />
                                    <Text text="PB 1" x={25} y={10} fill="white" fontSize={12} fontStyle="bold" />

                                    {/* The Button Graphic */}
                                    <Rect x={20} y={30} width={40} height={40} fill="#10b981" cornerRadius={20} shadowBlur={5} shadowColor="black" shadowOffsetY={2} />
                                </Group>

                            </Layer>
                        </Stage>
                    </main>
                </div>
            </PortraitGuard>
        </PageTransition>
    );
};

export default SimulationView;