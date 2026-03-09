import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Circle, Line, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

// Lucide Icons for Taskbar
import {
    ArrowLeft, Play, Trash2, Undo2, Redo2, Sun, Moon, RefreshCw
} from 'lucide-react';

import './SimulationApp.css';

// --- CONFIGURATION: PLC BOARD PORTS ---
const PLC_PORTS: Record<string, { x: number; y: number; color: string; label: string }> = {
    // --- POWER SUPPLY ---
    '24v_1': { x: 130, y: 270, color: '#e74c3c', label: '24VDC' },
    '24v_2': { x: 170, y: 270, color: '#e74c3c', label: '24VDC' },
    '0v_1': { x: 130, y: 310, color: '#111827', label: '0VDC' },
    '0v_2': { x: 170, y: 310, color: '#111827', label: '0VDC' },

    // --- MANUAL INPUTS (Buttons) ---
    'start_no_in': { x: 130, y: 450, color: '#f1c40f', label: 'START (NO) In' },
    'start_no_out': { x: 170, y: 450, color: '#3498db', label: 'START (NO) Out' },
    'stop_nc_in': { x: 130, y: 530, color: '#f1c40f', label: 'STOP (NC) In' },
    'stop_nc_out': { x: 170, y: 530, color: '#3498db', label: 'STOP (NC) Out' },

    // --- PLC INPUTS (00CH) ---
    'plc_com_in': { x: 450, y: 100, color: '#e74c3c', label: 'PLC COM' },
    'plc_in_00': { x: 450, y: 140, color: '#f1c40f', label: 'Input 00' },
    'plc_in_01': { x: 450, y: 180, color: '#f1c40f', label: 'Input 01' },
    'plc_in_02': { x: 450, y: 220, color: '#f1c40f', label: 'Input 02' },

    // --- RELAY TYPE OUTPUT (10CH) ---
    'plc_com_out': { x: 230, y: 100, color: '#111827', label: 'Output COM' },
    'plc_out_00': { x: 230, y: 140, color: '#3498db', label: 'Output 00' },
    'plc_out_01': { x: 230, y: 180, color: '#3498db', label: 'Output 01' },

    // --- SOLENOID VALVES ---
    'sol_a_plus': { x: 380, y: 550, color: '#e74c3c', label: 'Solenoid A+' },
    'sol_a_minus': { x: 420, y: 550, color: '#111827', label: 'Solenoid A-' },
    'sol_b_plus': { x: 380, y: 620, color: '#e74c3c', label: 'Solenoid B+' },
    'sol_b_minus': { x: 420, y: 620, color: '#111827', label: 'Solenoid B-' },
};

interface Connection {
    id: string;
    fromPin: string;
    toPin: string;
    color: string;
}

interface PLCSimulationAppProps {
    routeId?: string;
    onNavigateBack?: () => void;
}

export default function PLCSimulationApp({ routeId, onNavigateBack }: PLCSimulationAppProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Theme State
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark');
        return true;
    });

    const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Wiring States
    const [wires, setWires] = useState<Connection[]>([]);
    const [wireColor, setWireColor] = useState<string>('#e74c3c');
    const [activePin, setActivePin] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    const [hoveredPin, setHoveredPin] = useState<string | null>(null);
    const [selectedWireId, setSelectedWireId] = useState<string | null>(null);

    // Undo/Redo History
    const [historyPast, setHistoryPast] = useState<Connection[][]>([]);
    const [historyFuture, setHistoryFuture] = useState<Connection[][]>([]);

    // --- Layout Measurements ---
    const SIDEBAR_WIDTH = 320; // Fixed width for the static instructions sidebar
    const PADDING = 48; // Breathing room around the canvas

    // Base Canvas Design Size
    const BASE_CANVAS_WIDTH = 1280;
    const BASE_CANVAS_HEIGHT = 720;

    // Calculate scale so the board perfectly fits in the available area beside the sidebar
    const availableCanvasWidth = viewport.width - SIDEBAR_WIDTH - PADDING;
    const availableCanvasHeight = viewport.height - PADDING;

    const canvasScale = Math.max(0.1, Math.min(
        availableCanvasWidth / BASE_CANVAS_WIDTH,
        availableCanvasHeight / BASE_CANVAS_HEIGHT
    ));

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                // Measure only the main area (excluding the header)
                setViewport({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial measure
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        document.documentElement.classList.toggle('dark', newMode);
    };

    // --- WIRING LOGIC ---
    const handlePortMouseDown = (portId: string) => {
        if (selectedWireId) {
            setSelectedWireId(null);
            return;
        }
        setActivePin(portId);
        setMousePos(PLC_PORTS[portId]);
    };

    const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
        if (activePin) {
            const pos = e.target.getStage()?.getPointerPosition();
            if (pos) {
                // Adjust mouse position strictly for the canvas scale
                setMousePos({
                    x: pos.x / canvasScale,
                    y: pos.y / canvasScale
                });
            }
        }
    };

    const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
        if (activePin) {
            const targetPin = (e.target as { attrs?: { id?: string } }).attrs?.id;

            if (targetPin && targetPin !== activePin && PLC_PORTS[targetPin]) {
                // Prevent duplicate wires between the exact same two ports
                const isDuplicate = wires.some(w =>
                    (w.fromPin === activePin && w.toPin === targetPin) ||
                    (w.fromPin === targetPin && w.toPin === activePin)
                );

                if (!isDuplicate) {
                    setWires(prev => {
                        const next = [...prev, { id: crypto.randomUUID(), fromPin: activePin, toPin: targetPin, color: wireColor }];
                        setHistoryPast(hp => [...hp, prev].slice(-50));
                        setHistoryFuture([]);
                        return next;
                    });
                }
            }
            setActivePin(null);
            setMousePos(null);
        }
    };

    const deleteSelectedWire = useCallback(() => {
        if (!selectedWireId) return;
        setWires((prevWires) => {
            const newWires = prevWires.filter((w) => w.id !== selectedWireId);
            setHistoryPast((hp) => [...hp, prevWires].slice(-50));
            setHistoryFuture([]);
            return newWires;
        });
        setSelectedWireId(null);
    }, [selectedWireId]);

    const handleUndo = () => {
        if (!historyPast.length) return;
        const previous = historyPast[historyPast.length - 1];
        setHistoryPast((prev) => prev.slice(0, -1));
        setHistoryFuture((prev) => [wires, ...prev]);
        setWires(previous);
    };

    const handleRedo = () => {
        if (!historyFuture.length) return;
        const next = historyFuture[0];
        setHistoryFuture((prev) => prev.slice(1));
        setHistoryPast((prev) => [...prev, wires]);
        setWires(next);
    };

    const handleResetBoard = () => {
        setHistoryPast(prev => [...prev, wires].slice(-50));
        setHistoryFuture([]);
        setWires([]);
        setSelectedWireId(null);
        setActivePin(null);
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelectedWire();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [deleteSelectedWire]);

    // Render a specific sub-panel on the board
    const renderPanel = (x: number, y: number, width: number, height: number, title: string) => (
        <Group x={x} y={y}>
            <Rect width={width} height={height} fill="#ffffff" stroke="#cbd5e1" strokeWidth={2} cornerRadius={8} shadowColor="rgba(0,0,0,0.1)" shadowBlur={4} shadowOffsetY={2} />
            <Text x={10} y={10} text={title} fontSize={14} fontFamily="sans-serif" fontStyle="bold" fill="#475569" />
        </Group>
    );

    return (
        <div className={`flex flex-col h-screen w-screen text-slate-800 dark:text-slate-200 font-sans overflow-hidden select-none transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0B1120]' : 'bg-slate-50'}`}>

            {/* HEADER TASKBAR */}
            <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0B1120] border-b border-slate-200 dark:border-cyan-900/50 z-20 shadow-md relative">
                <div className="flex items-center gap-4">
                    <button onClick={onNavigateBack} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-cyan-400 rounded-lg transition-colors shadow-sm" title="Abort Sequence">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                            <Play size={16} className="text-cyan-600 dark:text-cyan-500" /> Hardware Simulation
                        </h1>
                        <p className="text-[10px] text-slate-500 dark:text-cyan-500/70 font-mono tracking-widest uppercase">Target: GOTT PLC Trainer • Sequence: {routeId || 'Default'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-300 dark:border-slate-800 shadow-inner transition-colors">
                        <button type="button" onClick={deleteSelectedWire} disabled={!selectedWireId} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 rounded-lg transition-colors" title="Delete Wire"><Trash2 size={16} strokeWidth={2.5} /></button>
                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                        <button type="button" onClick={handleUndo} disabled={!historyPast.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Undo"><Undo2 size={16} strokeWidth={2.5} /></button>
                        <button type="button" onClick={handleRedo} disabled={!historyFuture.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Redo"><Redo2 size={16} strokeWidth={2.5} /></button>
                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

                        <div className="px-2 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: wireColor }} />
                            <select value={wireColor} onChange={(e) => setWireColor(e.target.value)} className="bg-transparent text-xs text-slate-900 dark:text-white font-bold outline-none border-none cursor-pointer py-1" title="Select Patch Cable Color">
                                <option value="#e74c3c" className="bg-white dark:bg-slate-900">24V Red</option>
                                <option value="#111827" className="bg-white dark:bg-slate-900">0V Black</option>
                                <option value="#3498db" className="bg-white dark:bg-slate-900">Signal Blue</option>
                                <option value="#f1c40f" className="bg-white dark:bg-slate-900">Signal Yellow</option>
                                <option value="#27ae60" className="bg-white dark:bg-slate-900">Earth Green</option>
                            </select>
                        </div>
                    </div>

                    <button type="button" onClick={handleResetBoard} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 transition-colors shadow-sm">
                        <RefreshCw size={16} strokeWidth={2.5} /> <span className="hidden xl:inline">Clear Board</span>
                    </button>

                    <button type="button" onClick={toggleTheme} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-cyan-400 rounded-xl border border-slate-300 dark:border-slate-700 transition-all shadow-sm" title="Toggle Theme">
                        {isDarkMode ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
                    </button>

                    <div className="flex items-center gap-2 pl-3 border-l border-slate-300 dark:border-slate-700 h-8">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black tracking-widest uppercase">Trainer Online</span>
                    </div>
                </div>
            </header>

            {/* MAIN BODY: Flex Row for Side-by-Side Layout */}
            <main className="flex-1 flex flex-row w-full min-h-0 overflow-hidden bg-slate-300 dark:bg-[#0F172A]" ref={containerRef}>

                {/* STATIC LEFT SIDEBAR: Lab Instructions */}
                <aside className="w-[320px] flex-shrink-0 flex flex-col bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-cyan-900/50 z-10 shadow-lg transition-colors duration-300">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="font-black text-slate-800 dark:text-cyan-400 uppercase tracking-widest text-sm">Lab Instructions</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Objective</h3>
                            <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Basic PLC Input Wiring</h4>
                                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-4 leading-relaxed">
                                    <li>Connect <strong>24VDC</strong> from the Power Supply to the <strong>START (NO) In</strong> port.</li>
                                    <li>Connect the <strong>START (NO) Out</strong> port to PLC <strong>Input 00</strong>.</li>
                                    <li>Ensure the PLC <strong>COM</strong> port is grounded to <strong>0VDC</strong>.</li>
                                </ul>

                                <button type="button" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-md">
                                    Verify Wiring
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* DYNAMIC CANVAS AREA */}
                <div className="flex-1 relative flex items-center justify-center p-6">
                    <div
                        className="relative shadow-2xl rounded-md border border-slate-400 dark:border-slate-800 bg-[#cbd5e1] overflow-hidden"
                        style={{ width: BASE_CANVAS_WIDTH * canvasScale, height: BASE_CANVAS_HEIGHT * canvasScale }}
                    >
                        <Stage
                            width={BASE_CANVAS_WIDTH * canvasScale}
                            height={BASE_CANVAS_HEIGHT * canvasScale}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleStageMouseUp}
                            onMouseDown={(e) => {
                                // Deselect wire if clicking the background empty space
                                if (e.target === e.target.getStage() || e.target.attrs.id === 'board-bg' || e.target.attrs.id === 'board-inner') {
                                    setSelectedWireId(null);
                                }
                            }}
                        >
                            <Layer scaleX={canvasScale} scaleY={canvasScale}>

                                {/* THE HARDWARE BOARD BACKGROUND (Gray Suitcase Texture) */}
                                <Rect id="board-bg" width={BASE_CANVAS_WIDTH} height={BASE_CANVAS_HEIGHT} fill="#cbd5e1" />
                                <Rect id="board-inner" x={20} y={20} width={BASE_CANVAS_WIDTH - 40} height={BASE_CANVAS_HEIGHT - 40} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={4} cornerRadius={8} />

                                {/* DRAW SUB-PANELS */}
                                {renderPanel(100, 220, 120, 140, "POWER SUPPLY")}
                                {renderPanel(100, 380, 120, 280, "MANUAL INPUTS")}
                                {renderPanel(350, 480, 200, 180, "SOLENOIDS")}
                                {renderPanel(200, 50, 120, 160, "RELAY OUTPUT")}
                                {renderPanel(350, 50, 200, 250, "INPUT (00CH)")}

                                {/* PLC Visual Representation */}
                                <Group x={650} y={50}>
                                    <Rect width={150} height={200} fill="#1e293b" cornerRadius={4} shadowColor="black" shadowBlur={10} shadowOffsetY={5} />
                                    <Text x={10} y={10} text="OMRON PLC" fill="#38bdf8" fontSize={16} fontStyle="bold" />
                                    {/* Decorative PLC lights */}
                                    {[...Array(6)].map((_, i) => (
                                        <Circle key={i} x={130} y={40 + i * 15} radius={3} fill="#22c55e" shadowColor="#22c55e" shadowBlur={5} />
                                    ))}
                                </Group>

                                {/* DRAW FIXED PORTS (Jacks) */}
                                {Object.entries(PLC_PORTS).map(([id, pos]) => {
                                    const isHovered = hoveredPin === id;
                                    const isActive = activePin === id;
                                    return (
                                        <Group key={`group-${id}`} x={pos.x} y={pos.y}>
                                            {/* The colored Jack Socket */}
                                            <Circle
                                                id={id}
                                                radius={isHovered || isActive ? 14 : 12}
                                                fill={pos.color}
                                                stroke={isHovered ? '#ffffff' : '#475569'}
                                                strokeWidth={isHovered ? 3 : 4}
                                                shadowColor="rgba(0,0,0,0.5)"
                                                shadowBlur={4}
                                                shadowOffsetY={2}
                                                onMouseDown={() => handlePortMouseDown(id)}
                                                onMouseEnter={(e) => {
                                                    setHoveredPin(id);
                                                    const container = e.target.getStage()?.container();
                                                    if (container) container.style.cursor = 'crosshair';
                                                }}
                                                onMouseLeave={(e) => {
                                                    setHoveredPin(null);
                                                    const container = e.target.getStage()?.container();
                                                    if (container) container.style.cursor = 'default';
                                                }}
                                            />
                                            {/* Inner dark hole to make it look like a real port */}
                                            <Circle radius={5} fill="#000000" listening={false} />
                                        </Group>
                                    );
                                })}

                                {/* RENDER WIRES */}
                                {wires.map((wire) => {
                                    const startPos = PLC_PORTS[wire.fromPin];
                                    const endPos = PLC_PORTS[wire.toPin];
                                    if (!startPos || !endPos) return null;

                                    const isSelected = selectedWireId === wire.id;

                                    // Calculate "Droop" for physical gravity simulation
                                    const distance = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
                                    const droopAmount = Math.min(200, distance * 0.4);
                                    const controlPointX = (startPos.x + endPos.x) / 2;
                                    const controlPointY = Math.max(startPos.y, endPos.y) + droopAmount;

                                    return (
                                        <Line
                                            key={wire.id}
                                            points={[startPos.x, startPos.y, controlPointX, controlPointY, endPos.x, endPos.y]}
                                            tension={0.6} // Smooth bezier curve
                                            stroke={wire.color}
                                            strokeWidth={isSelected ? 8 : 6}
                                            hitStrokeWidth={20}
                                            lineCap="round"
                                            shadowColor={isSelected ? '#f1c40f' : 'rgba(0,0,0,0.4)'}
                                            shadowBlur={isSelected ? 15 : 6}
                                            shadowOffsetY={isSelected ? 0 : 8}
                                            onMouseDown={(e) => { e.cancelBubble = true; setSelectedWireId(wire.id); }}
                                            onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                                            onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                        />
                                    );
                                })}

                                {/* LIVE GHOST WIRE */}
                                {activePin && mousePos && (
                                    <Line
                                        points={[PLC_PORTS[activePin].x, PLC_PORTS[activePin].y, mousePos.x, mousePos.y]}
                                        stroke={wireColor}
                                        strokeWidth={4}
                                        dash={[10, 8]}
                                        opacity={0.7}
                                    />
                                )}

                                {/* PORT HOVER TOOLTIP */}
                                {hoveredPin && !activePin && (
                                    <Group x={PLC_PORTS[hoveredPin].x + 20} y={PLC_PORTS[hoveredPin].y - 30}>
                                        <Rect height={24} width={100} fill="#1e293b" cornerRadius={4} />
                                        <Text text={PLC_PORTS[hoveredPin].label} fill="#ffffff" fontSize={12} fontFamily="monospace" padding={6} />
                                    </Group>
                                )}

                            </Layer>
                        </Stage>
                    </div>
                </div>
            </main>
        </div>
    );
}