import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Circle, Line, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

// Lucide Icons for Taskbar
import {
    ArrowLeft, Play, Trash2, Undo2, Redo2, Sun, Moon, RefreshCw
} from 'lucide-react';

import './SimulationApp.css';

// --- VISUAL STYLES & HARDWARE REALISM ---
const HW_STYLES = {
    panelBg: '#f8fafc',
    panelBorder: '#cbd5e1',
    frameSilver: '#94a3b8',
    jackRed: '#e74c3c',
    jackBlack: '#111827',
    jackBlue: '#3498db',
    jackYellow: '#f1c40f',
    labelYellow: '#f1c40f',
    switchRedOff: '#7f1d1d',
    switchRedOn: '#ef4444',
    ledOff: '#475569',
    ledOn: '#22c55e',
    ledRed: '#ef4444',
    omronBody: '#1e293b',
    technicalMono: 'Consolas, monaco, monospace',
    technicalSans: 'Inter, system-ui, sans-serif'
};

// --- CONFIGURATION: PLC BOARD PORTS (1:1 with Reference Photo) ---
const GOTT_TRAINER_PORTS: Record<string, { x: number; y: number; color: string; label: string; desc: string }> = {
    // === POWER SUPPLY ===
    '24v_1': { x: 377, y: 530, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '24v_2': { x: 420, y: 530, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '24v_3': { x: 377, y: 570, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '24v_4': { x: 420, y: 570, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '0v_1': { x: 377, y: 620, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },
    '0v_2': { x: 420, y: 620, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },
    '0v_3': { x: 377, y: 660, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },
    '0v_4': { x: 420, y: 660, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },

    // === INPUT (00CH) ===
    // Adjust x/y here to reposition the INPUT 00CH circles on the board layout.
    'plc_com_in': { x: 60, y: 370, color: HW_STYLES.jackRed, label: 'COM', desc: 'Input COM' },
    'plc_in_00': { x: 110, y: 350, color: HW_STYLES.jackYellow, label: '00', desc: 'Input 0.00' },
    'plc_in_01': { x: 170, y: 350, color: HW_STYLES.jackYellow, label: '01', desc: 'Input 0.01' },
    'plc_in_02': { x: 230, y: 350, color: HW_STYLES.jackYellow, label: '02', desc: 'Input 0.02' },
    'plc_in_03': { x: 290, y: 350, color: HW_STYLES.jackYellow, label: '03', desc: 'Input 0.03' },
    'plc_in_04': { x: 350, y: 350, color: HW_STYLES.jackYellow, label: '04', desc: 'Input 0.04' },
    'plc_in_05': { x: 410, y: 350, color: HW_STYLES.jackYellow, label: '05', desc: 'Input 0.05' },
    'plc_in_06': { x: 111, y: 420, color: HW_STYLES.jackYellow, label: '06', desc: 'Input 0.06' },
    'plc_in_07': { x: 170, y: 420, color: HW_STYLES.jackYellow, label: '07', desc: 'Input 0.07' },
    'plc_in_08': { x: 230, y: 420, color: HW_STYLES.jackYellow, label: '08', desc: 'Input 0.08' },
    'plc_in_09': { x: 290, y: 420, color: HW_STYLES.jackYellow, label: '09', desc: 'Input 0.09' },
    'plc_in_10': { x: 350, y: 420, color: HW_STYLES.jackYellow, label: '10', desc: 'Input 0.10' },
    'plc_in_11': { x: 410, y: 420, color: HW_STYLES.jackYellow, label: '11', desc: 'Input 0.11' },

    // === RELAY OUTPUT (10CH) ===
    'plc_com_out_1': { x: 55, y: 570, color: HW_STYLES.jackBlack, label: 'COM1', desc: 'Output COM 1' },
    'plc_out_00': { x: 85, y: 570, color: HW_STYLES.jackBlue, label: '00', desc: 'Output 10.00' },
    'plc_com_out_2': { x: 130, y: 570, color: HW_STYLES.jackBlack, label: 'COM2', desc: 'Output COM 2' },
    'plc_out_01': { x: 160, y: 570, color: HW_STYLES.jackBlue, label: '01', desc: 'Output 10.01' },
    'plc_com_out_3': { x: 205, y: 570, color: HW_STYLES.jackBlack, label: 'COM3', desc: 'Output COM 3' },
    'plc_out_02': { x: 235, y: 570, color: HW_STYLES.jackBlue, label: '02', desc: 'Output 10.02' },
    'plc_out_03': { x: 295, y: 570, color: HW_STYLES.jackBlue, label: '03', desc: 'Output 10.03' },
    'plc_com_out_4': { x: 55, y: 655, color: HW_STYLES.jackBlack, label: 'COM4', desc: 'Output COM 4' },
    'plc_out_04': { x: 95, y: 655, color: HW_STYLES.jackBlue, label: '04', desc: 'Output 10.04' },
    'plc_out_05': { x: 160, y: 655, color: HW_STYLES.jackBlue, label: '05', desc: 'Output 10.05' },
    'plc_out_06': { x: 225, y: 655, color: HW_STYLES.jackBlue, label: '06', desc: 'Output 10.06' },
    'plc_out_07': { x: 290, y: 655, color: HW_STYLES.jackBlue, label: '07', desc: 'Output 10.07' },

    // === MANUAL INPUTS ===
    'start_no_in': { x: 660, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'Start (NO) In' },
    'start_no_out': { x: 700, y: 660, color: HW_STYLES.jackBlue, label: 'NO', desc: 'Start (NO) Out' },
    'stop_nc_in': { x: 780, y: 660, color: HW_STYLES.jackYellow, label: 'NC', desc: 'Stop (NC) In' },
    'stop_nc_out': { x: 820, y: 660, color: HW_STYLES.jackBlue, label: 'NC', desc: 'Stop (NC) Out' },

    // === SOLENOID VALVES ===
    'sol_a_plus': { x: 550, y: 530, color: HW_STYLES.jackRed, label: 'A+', desc: 'Valve A+' },
    'sol_a_minus': { x: 590, y: 530, color: HW_STYLES.jackBlack, label: 'A-', desc: 'Valve A-' },

    // === REED SWITCHES ===
    'reed_ret': { x: 510, y: 410, color: HW_STYLES.jackYellow, label: 'RET', desc: 'Cyl Retracted' },
    'reed_ext': { x: 570, y: 410, color: HW_STYLES.jackYellow, label: 'EXT', desc: 'Cyl Extended' },
};

interface Connection { id: string; fromPin: string; toPin: string; color: string; }
interface PLCSimulationAppProps { routeId?: string; onNavigateBack?: () => void; }

export default function PLCSimulationApp({ routeId, onNavigateBack }: PLCSimulationAppProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true);
    const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Logic flow control for visual interactivity
    const [isAcPowerOn, setIsAcPowerOn] = useState<boolean>(false);

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

    // Layout Measurements
    const SIDEBAR_WIDTH = 360;
    const PADDING = 24;
    const BASE_CANVAS_WIDTH = 1280;
    const BASE_CANVAS_HEIGHT = 720;
    const MIDDLE_ROW_START_X = 110;
    const MIDDLE_ROW_SPACING = 60;
    const MIDDLE_ROW_Y = 320;
    const SECOND_ROW_Y = 390;
    const UPPER_RELAY_LIGHT_START_X = 70;
    const UPPER_RELAY_LIGHT_SPACING = 75;
    const UPPER_RELAY_LIGHT_Y = 530;
    const BOTTOM_RELAY_LIGHT_START_X = 95;
    const BOTTOM_RELAY_LIGHT_SPACING = 65;
    const BOTTOM_RELAY_LIGHT_Y = 620;

    const availableCanvasWidth = viewport.width - SIDEBAR_WIDTH - PADDING * 2;
    const availableCanvasHeight = viewport.height - PADDING * 2;
    const canvasScale = Math.max(0.1, Math.min(availableCanvasWidth / BASE_CANVAS_WIDTH, availableCanvasHeight / BASE_CANVAS_HEIGHT));

    useEffect(() => {
        const handleResize = () => { if (containerRef.current) setViewport({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleTheme = () => { const newMode = !isDarkMode; setIsDarkMode(newMode); document.documentElement.classList.toggle('dark', newMode); };

    // WIRING LOGIC
    const handlePortMouseDown = (portId: string) => { if (selectedWireId) { setSelectedWireId(null); return; } setActivePin(portId); setMousePos(GOTT_TRAINER_PORTS[portId]); };
    const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => { if (activePin) { const pos = e.target.getStage()?.getPointerPosition(); if (pos) setMousePos({ x: pos.x / canvasScale, y: pos.y / canvasScale }); } };

    const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
        if (activePin) {
            const targetPin = (e.target as { attrs?: { id?: string } }).attrs?.id;
            if (targetPin && targetPin !== activePin && GOTT_TRAINER_PORTS[targetPin]) {
                const isDuplicate = wires.some(w => (w.fromPin === activePin && w.toPin === targetPin) || (w.fromPin === targetPin && w.toPin === activePin));
                if (!isDuplicate) {
                    setWires(prev => {
                        const next = [...prev, { id: crypto.randomUUID(), fromPin: activePin, toPin: targetPin, color: wireColor }];
                        setHistoryPast(hp => [...hp, prev].slice(-50));
                        setHistoryFuture([]);
                        return next;
                    });
                }
            }
            setActivePin(null); setMousePos(null);
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

    const handleUndo = () => { if (!historyPast.length) return; const previous = historyPast[historyPast.length - 1]; setHistoryPast((prev) => prev.slice(0, -1)); setHistoryFuture((prev) => [wires, ...prev]); setWires(previous); };
    const handleRedo = () => { if (!historyFuture.length) return; const next = historyFuture[0]; setHistoryFuture((prev) => prev.slice(1)); setHistoryPast((prev) => [...prev, wires]); setWires(next); };
    const handleResetBoard = () => { setHistoryPast(prev => [...prev, wires].slice(-50)); setHistoryFuture([]); setWires([]); setSelectedWireId(null); setActivePin(null); setIsAcPowerOn(false); };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedWire(); } };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [deleteSelectedWire]);

    // --- HARDWARE REPLICA DRAWING FUNCTIONS ---
    const renderHardwareJack = (portId: string, isHovered: boolean, isActive: boolean) => {
        const pos = GOTT_TRAINER_PORTS[portId];
        return (
            <Group key={`jack-${portId}`} x={pos.x} y={pos.y}>
                <Circle radius={11} fill={HW_STYLES.labelYellow} />
                <Text text={pos.label} x={-15} y={11} width={30} fontSize={9} fontFamily={HW_STYLES.technicalMono} fontStyle="bold" align="center" fill="#000000" />
                <Circle radius={7} fill="#bdc3c7" stroke="#34495e" strokeWidth={1} />
                <Circle
                    id={portId}
                    radius={8}
                    fill={pos.color}
                    stroke={isHovered ? '#ffffff' : '#000000'}
                    strokeWidth={isHovered || isActive ? 2 : 1}
                    shadowColor="rgba(0,0,0,0.4)" shadowBlur={3} shadowOffsetY={2}
                    onMouseDown={() => handlePortMouseDown(portId)}
                    onMouseEnter={(e) => {
                        setHoveredPin(portId);
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'crosshair';
                    }}
                    onMouseLeave={(e) => {
                        setHoveredPin(null);
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'default';
                    }}
                />
                <Circle radius={4} fill="#000000" listening={false} />
            </Group>
        );
    };

    const renderTechnicalPanel = (id: string, x: number, y: number, width: number, height: number, title: string) => (
        <Group key={`panel-${id}`} x={x} y={y}>
            <Rect width={width} height={height} fill={HW_STYLES.panelBg} stroke={HW_STYLES.panelBorder} strokeWidth={2} cornerRadius={4} shadowColor="rgba(0,0,0,0.15)" shadowBlur={6} shadowOffsetY={3} listening={false} />
            <Rect width={width} height={28} fill="#e2e8f0" stroke={HW_STYLES.panelBorder} strokeWidth={1} cornerRadius={4} listening={false} />
            <Text text={title} x={10} y={8} fontSize={13} fontStyle="bold" fill="#1e293b" listening={false} />
        </Group>
    );

    return (
        <div className={`flex flex-col h-screen w-screen text-slate-800 dark:text-slate-200 font-sans overflow-hidden select-none transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0B1120]' : 'bg-slate-50'}`}>

            <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shadow-md relative">
                <div className="flex items-center gap-4">
                    <button onClick={onNavigateBack} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-cyan-400 rounded-lg transition-colors shadow-sm" title="Abort Sequence"><ArrowLeft size={20} /></button>
                    <div>
                        <h1 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><Play size={16} className="text-cyan-600 dark:text-cyan-500" /> Laboratory Sequence</h1>
                        <p className="text-[10px] text-slate-500 dark:text-cyan-500/70 font-mono tracking-widest uppercase">Target: GOTT PLC Trainer • Task: {routeId || 'Default'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-inner">
                        <button onClick={deleteSelectedWire} disabled={!selectedWireId} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 disabled:opacity-30 rounded-lg" title="Delete Selected Wire"><Trash2 size={16} /></button>
                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                        <button onClick={handleUndo} disabled={!historyPast.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 rounded-lg" title="Undo"><Undo2 size={16} /></button>
                        <button onClick={handleRedo} disabled={!historyFuture.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 rounded-lg" title="Redo"><Redo2 size={16} /></button>
                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

                        <div className="px-2 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shadow-inner border border-slate-400" style={{ backgroundColor: wireColor }} />
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

                    <button type="button" onClick={toggleTheme} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-cyan-400 rounded-xl border border-slate-300 dark:border-slate-700 transition-all shadow-sm">
                        {isDarkMode ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-row w-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-950" ref={containerRef}>

                <aside className="w-[360px] flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg transition-colors duration-300">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="font-black text-slate-800 dark:text-cyan-400 uppercase tracking-widest text-sm">Hardware Guide</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">Active Task: Powering the System</h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-mono">You must act as the hardware technician to simulate wiring and powering the physical GOTT PLC Trainer.</p>
                            <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                                <li>Toggle the physical rocker switch in the **INPUT AC** panel to the ON position. Note the PLC's PWR LED illuminates.</li>
                                <li>Verify internal power rails by wiring <strong>24V</strong> supply output to PLC Input COM.</li>
                                <li>Establish safe grounding of the logic rail by wiring PLC Output COM1 to <strong>0V</strong> supply output.</li>
                            </ul>
                            <button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-md">Verify Configuration</button>
                        </div>
                    </div>
                </aside>

                <div className="flex-1 relative flex items-center justify-center p-6">
                    <div className="relative shadow-2xl rounded-lg border-4 border-slate-400 dark:border-slate-800 bg-[#e2e8f0] overflow-hidden" style={{ width: BASE_CANVAS_WIDTH * canvasScale, height: BASE_CANVAS_HEIGHT * canvasScale }}>
                        <Stage width={BASE_CANVAS_WIDTH * canvasScale} height={BASE_CANVAS_HEIGHT * canvasScale} onMouseMove={handleMouseMove} onMouseUp={handleStageMouseUp}>
                            <Layer scaleX={canvasScale} scaleY={canvasScale} id="board-layer">

                                {/* 1. ENCLOSURE BACKGROUND */}
                                <Rect width={BASE_CANVAS_WIDTH} height={BASE_CANVAS_HEIGHT} fill="#e2e8f0" id="enclosure-base" />

                                {/* 2. RENDER TECHNICAL PANELS (1:1 Grid Layout) */}

                                {/* Top Row */}
                                {renderTechnicalPanel("ac-power", 30, 30, 160, 220, "INPUT AC220V-240V")}
                                {renderTechnicalPanel("plc", 210, 30, 470, 220, "OMRON SYSMAC CP1E")}

                                {/* Middle Row */}
                                {renderTechnicalPanel("inputs", 30, 270, 420, 180, "INPUT (00CH)")}
                                {renderTechnicalPanel("reeds", 470, 270, 210, 180, "REED SWITCH")}

                                {/* Bottom Row */}
                                {renderTechnicalPanel("relays", 30, 470, 300, 220, "RELAY TYPE OUTPUT (10CH)")}
                                {renderTechnicalPanel("power", 345, 470, 105, 220, "POWER SUPPLY")}
                                {renderTechnicalPanel("solenoids", 460, 470, 790, 90, "SOLENOID VALVES")}
                                {renderTechnicalPanel("buzzer", 460, 575, 140, 115, "BUZZER")}
                                {renderTechnicalPanel("manual", 615, 575, 635, 115, "MANUAL INPUTS")}

                                {/* 3. REVISED HARDWARE DEVICES & DECALS */}

                                {/* --- AC POWER SWITCH MODULE --- */}
                                <Group x={65} y={70} id="ac-switch-group"
                                    onClick={() => setIsAcPowerOn(prev => !prev)}
                                    onTap={() => setIsAcPowerOn(prev => !prev)}
                                    onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                                    onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                >
                                    {/* Hexagonal/Rect Bezel */}
                                    <Rect width={90} height={130} fill="#1e293b" cornerRadius={8} shadowColor="rgba(0,0,0,0.4)" shadowBlur={4} shadowOffsetY={2} />

                                    {/* AC Receptacle */}
                                    <Rect width={50} height={35} x={20} y={15} fill="#0f172a" cornerRadius={4} />
                                    <Rect width={10} height={4} x={30} y={25} fill="#cbd5e1" />
                                    <Rect width={10} height={4} x={50} y={25} fill="#cbd5e1" />
                                    <Rect width={10} height={4} x={40} y={35} fill="#cbd5e1" />

                                    {/* Rocker Switch */}
                                    <Rect width={44} height={54} x={23} y={60} fill="#000000" cornerRadius={4} />
                                    <Rect width={36} height={23} x={27} y={64}
                                        fill={isAcPowerOn ? HW_STYLES.switchRedOn : HW_STYLES.switchRedOff}
                                        cornerRadius={2}
                                        shadowColor={isAcPowerOn ? HW_STYLES.switchRedOn : 'transparent'} shadowBlur={10}
                                    />
                                    <Rect width={36} height={23} x={27} y={87}
                                        fill={isAcPowerOn ? HW_STYLES.switchRedOff : HW_STYLES.switchRedOn}
                                        cornerRadius={2}
                                    />
                                    <Text text="I" x={42} y={70} fontSize={12} fill="#ffffff" fontStyle="bold" listening={false} />
                                    <Text text="O" x={40} y={92} fontSize={12} fill="#ffffff" fontStyle="bold" listening={false} />

                                    {/* Power Label */}
                                    <Text text="POWER" x={25} y={142} fontSize={12} fontStyle="bold" fill="#1e293b" listening={false} />
                                </Group>


                                {/* --- OMRON CP1E PLC FACEPLATE --- */}
                                <Group x={240} y={80} id="plc-faceplate">
                                    {/* Main Body */}
                                    <Rect width={410} height={140} fill={HW_STYLES.omronBody} cornerRadius={4} shadowColor="rgba(0,0,0,0.6)" shadowBlur={12} shadowOffsetY={6} listening={false} />

                                    {/* Branding Column */}
                                    <Text text="OMRON" x={15} y={15} fill="#ffffff" fontSize={12} fontStyle="bold" fontFamily={HW_STYLES.technicalSans} listening={false} />
                                    <Text text="SYSMAC" x={15} y={30} fill="#cbd5e1" fontSize={12} fontStyle="bold" fontFamily={HW_STYLES.technicalSans} listening={false} />
                                    <Text text="CP1E" x={15} y={45} fill="#cbd5e1" fontSize={16} fontStyle="bold" fontFamily={HW_STYLES.technicalSans} listening={false} />
                                    <Text text="PERIPHERAL" x={15} y={115} fill="#cbd5e1" fontSize={8} fontFamily={HW_STYLES.technicalSans} listening={false} />
                                    <Rect x={15} y={90} width={40} height={20} fill="#0f172a" cornerRadius={2} listening={false} />

                                    {/* Status LEDs Column */}
                                    <Group x={110} y={15} id="status-leds">
                                        <Circle x={10} y={10} radius={4} fill={isAcPowerOn ? HW_STYLES.ledOn : HW_STYLES.ledOff} shadowColor={HW_STYLES.ledOn} shadowBlur={isAcPowerOn ? 5 : 0} listening={false} />
                                        <Text text="POWER" x={20} y={6} fontSize={8} fill="#cbd5e1" listening={false} />

                                        <Circle x={10} y={25} radius={4} fill={isAcPowerOn ? HW_STYLES.ledOn : HW_STYLES.ledOff} shadowColor={HW_STYLES.ledOn} shadowBlur={isAcPowerOn ? 3 : 0} listening={false} />
                                        <Text text="RUN" x={20} y={21} fontSize={8} fill="#cbd5e1" listening={false} />

                                        <Circle x={10} y={40} radius={4} fill={HW_STYLES.ledOff} listening={false} />
                                        <Text text="ERR/ALM" x={20} y={36} fontSize={8} fill="#cbd5e1" listening={false} />

                                        <Circle x={10} y={55} radius={4} fill={HW_STYLES.ledOff} listening={false} />
                                        <Text text="INH" x={20} y={51} fontSize={8} fill="#cbd5e1" listening={false} />

                                        <Circle x={10} y={70} radius={4} fill={HW_STYLES.ledOff} listening={false} />
                                        <Text text="PRPHL" x={20} y={66} fontSize={8} fill="#cbd5e1" listening={false} />

                                        <Circle x={10} y={85} radius={4} fill={HW_STYLES.ledOff} listening={false} />
                                        <Text text="BKUP" x={20} y={81} fontSize={8} fill="#cbd5e1" listening={false} />
                                    </Group>

                                    {/* Inputs LEDs Area */}
                                    <Group x={190} y={15} id="input-led-grid">
                                        <Rect width={205} height={50} fill="#0f172a" cornerRadius={4} opacity={0.3} listening={false} />
                                        <Text text="IN  CH00" x={5} y={5} fontSize={10} fontStyle="bold" fill="#ffffff" listening={false} />
                                        {[...Array(12)].map((_, i) => (
                                            <Group key={`in-led-group-${i}`} x={10 + (i % 6) * 32} y={20 + Math.floor(i / 6) * 18}>
                                                <Circle radius={3} fill={HW_STYLES.ledOff} listening={false} />
                                                <Text text={(i).toString().padStart(2, '0')} x={-5} y={6} fontSize={8} fill="#cbd5e1" listening={false} />
                                            </Group>
                                        ))}
                                    </Group>

                                    {/* Outputs LEDs Area */}
                                    <Group x={190} y={75} id="output-led-grid">
                                        <Rect width={205} height={50} fill="#0f172a" cornerRadius={4} opacity={0.3} listening={false} />
                                        <Text text="OUT CH10" x={5} y={5} fontSize={10} fontStyle="bold" fill="#ffffff" listening={false} />
                                        {[...Array(8)].map((_, i) => (
                                            <Group key={`out-led-group-${i}`} x={10 + (i % 6) * 32} y={20 + Math.floor(i / 6) * 18}>
                                                <Circle radius={3} fill={HW_STYLES.ledOff} listening={false} />
                                                <Text text={(i).toString().padStart(2, '0')} x={-5} y={6} fontSize={8} fill="#cbd5e1" listening={false} />
                                            </Group>
                                        ))}
                                    </Group>
                                </Group>

                                {/* First Row Input 00CH */}
                                {[...Array(6)].map((_, i) => (
                                    <Group key={`knob-${i}`} x={MIDDLE_ROW_START_X + i * MIDDLE_ROW_SPACING} y={MIDDLE_ROW_Y}>
                                        <Circle radius={14} fill="#1e293b" stroke="#cbd5e1" strokeWidth={2} listening={false} />
                                        <Circle radius={3} y={-10} fill="#cbd5e1" listening={false} />
                                    </Group>
                                ))}

                                {/* Second Row Input 00CH */}
                                {[...Array(6)].map((_, i) => (
                                    <Group key={`knob-second-${i}`} x={MIDDLE_ROW_START_X + i * MIDDLE_ROW_SPACING} y={SECOND_ROW_Y}>
                                        <Circle radius={14} fill="#1e293b" stroke="#cbd5e1" strokeWidth={2} listening={false} />
                                        <Circle radius={3} y={-10} fill="#cbd5e1" listening={false} />
                                    </Group>
                                ))}

                                {/* Upper Relay Type Light */}
                                {[...Array(4)].map((_, i) => (
                                    <Circle key={`relay-light-${i}`} x={UPPER_RELAY_LIGHT_START_X + i * UPPER_RELAY_LIGHT_SPACING} y={UPPER_RELAY_LIGHT_Y} radius={16} fill={HW_STYLES.switchRedOff} stroke="#cbd5e1" strokeWidth={4} listening={false} />
                                ))}

                                {/* Bottom Row Relay Type Light */}
                                {[...Array(4)].map((_, i) => (
                                    <Circle key={`relay-light-bottom-${i}`} x={BOTTOM_RELAY_LIGHT_START_X + i * BOTTOM_RELAY_LIGHT_SPACING} y={BOTTOM_RELAY_LIGHT_Y} radius={16} fill={HW_STYLES.switchRedOff} stroke="#cbd5e1" strokeWidth={4} listening={false} />
                                ))}

                                <Group x={680} y={610} listening={false}>
                                    <Circle radius={24} fill="#10b981" shadowColor="rgba(0,0,0,0.4)" shadowBlur={6} shadowOffsetY={3} />
                                    <Circle radius={18} fill="#34d399" />
                                    <Text text="START" x={-15} y={35} fontSize={11} fontStyle="bold" fill="#1e293b" />
                                </Group>
                                <Group x={800} y={610} listening={false}>
                                    <Circle radius={24} fill="#ef4444" shadowColor="rgba(0,0,0,0.4)" shadowBlur={6} shadowOffsetY={3} />
                                    <Circle radius={18} fill="#f87171" />
                                    <Text text="STOP" x={-12} y={35} fontSize={11} fontStyle="bold" fill="#1e293b" />
                                </Group>

                                <Group x={690} y={30} listening={false}>
                                    <Rect width={560} height={420} fill="#e2e8f0" cornerRadius={6} />
                                    <Rect width={560} height={24} fill="#cbd5e1" cornerRadius={6} />
                                    <Text text="PNEUMATIC ACTUATORS (HARDWARE MODULE)" x={10} y={8} fill="#475569" fontSize={12} fontStyle="bold" />
                                    <Rect x={50} y={80} width={200} height={40} fill="#94a3b8" cornerRadius={4} />
                                    <Rect x={250} y={90} width={120} height={20} fill="#cbd5e1" cornerRadius={4} />
                                    <Rect x={50} y={200} width={200} height={40} fill="#94a3b8" cornerRadius={4} />
                                    <Rect x={180} y={210} width={190} height={20} fill="#cbd5e1" cornerRadius={4} />
                                </Group>

                                {/* 4. RENDER PATCH PORTS */}
                                {Object.entries(GOTT_TRAINER_PORTS).map(([id]) => {
                                    const isHovered = hoveredPin === id;
                                    const isActive = activePin === id;
                                    return renderHardwareJack(id, isHovered, isActive);
                                })}

                                {/* 5. RENDER WIRES */}
                                {wires.map((wire) => {
                                    const startPos = GOTT_TRAINER_PORTS[wire.fromPin];
                                    const endPos = GOTT_TRAINER_PORTS[wire.toPin];
                                    if (!startPos || !endPos) return null;
                                    const isSelected = selectedWireId === wire.id;

                                    const distance = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
                                    const droopAmount = Math.min(250, distance * 0.45);
                                    const controlPointX = (startPos.x + endPos.x) / 2;
                                    const controlPointY = Math.max(startPos.y, endPos.y) + droopAmount;

                                    return (
                                        <Line
                                            key={`wire-${wire.id}`}
                                            points={[startPos.x, startPos.y, controlPointX, controlPointY, endPos.x, endPos.y]}
                                            tension={0.65}
                                            stroke={wire.color}
                                            strokeWidth={isSelected ? 10 : 8}
                                            hitStrokeWidth={20}
                                            lineCap="round"
                                            shadowColor={isSelected ? '#f1c40f' : 'rgba(0,0,0,0.5)'}
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
                                    <Line points={[GOTT_TRAINER_PORTS[activePin].x, GOTT_TRAINER_PORTS[activePin].y, mousePos.x, mousePos.y]} stroke={wireColor} strokeWidth={6} dash={[10, 8]} opacity={0.7} tension={0.5} listening={false} />
                                )}

                                {/* PORT HOVER TOOLTIP */}
                                {hoveredPin && !activePin && (
                                    <Group x={GOTT_TRAINER_PORTS[hoveredPin].x + 20} y={GOTT_TRAINER_PORTS[hoveredPin].y - 30} listening={false}>
                                        <Rect height={24} width={140} fill="#1e293b" cornerRadius={4} />
                                        <Text text={GOTT_TRAINER_PORTS[hoveredPin].desc} fill="#ffffff" fontSize={11} fontFamily={HW_STYLES.technicalMono} padding={6} />
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