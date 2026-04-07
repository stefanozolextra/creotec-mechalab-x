import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Circle, Line, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

import { ArrowLeft, Play, Trash2, Undo2, Redo2, Sun, Moon, RefreshCw } from 'lucide-react';
import './SimulationApp.css';
import PortraitGuard from '../components/PortraitGuard';
import CyberTransition from '../components/CyberTransition';

import { computePLCWirePath } from './utils/plcWireRouting';
import { HW_STYLES, PLC_SOLENOID_LABELS, REED_LIGHT_OFFSET_Y } from './config/plcBoardLayout';
import { GOTT_TRAINER_PORTS, type PlcPortConfig } from './config/plcPinConfiguration';
import { PlcPanelBackground, PlcPanelText, PlcHardwareJack } from './components/plcBoardUI';

// IMPORT THE GUIDE
import TutorialGuide, { type TutorialStep } from '../components/TutorialGuide';

interface Connection { id: string; fromPin: string; toPin: string; color: string; points: number[]; }
interface PLCSimulationAppProps { routeId?: string; onNavigateBack?: () => void; }

export default function PLCSimulationApp({ routeId, onNavigateBack }: PLCSimulationAppProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true);
    const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

    const [isCanvasReady, setIsCanvasReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsCanvasReady(true), 700);
        return () => clearTimeout(timer);
    }, []);

    const [isAcPowerOn, setIsAcPowerOn] = useState<boolean>(false);
    const [isStartPressed, setIsStartPressed] = useState<boolean>(false);
    const [isStopPressed, setIsStopPressed] = useState<boolean>(false);
    const [activeKnob, setActiveKnob] = useState<'selector' | 'emo' | `input-${number}` | null>(null);
    const [selectorAngle, setSelectorAngle] = useState<number>(0);
    const [emoAngle, setEmoAngle] = useState<number>(0);
    const [inputKnobAngles, setInputKnobAngles] = useState<number[]>(Array.from({ length: 12 }, () => 0));

    const [wires, setWires] = useState<Connection[]>([]);
    const [wireColor, setWireColor] = useState<string>('#e74c3c');
    const [activePin, setActivePin] = useState<string | null>(null);
    const [selectedWireId, setSelectedWireId] = useState<string | null>(null);

    // IMPERATIVE REFS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ghostWireRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hoverRingRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tooltipRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tooltipTextRef = useRef<any>(null);

    const mousePosRef = useRef<{ x: number; y: number } | null>(null);
    const rafRef = useRef<number | null>(null);

    const [historyPast, setHistoryPast] = useState<Connection[][]>([]);
    const [historyFuture, setHistoryFuture] = useState<Connection[][]>([]);

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
    const BUZZER_VISUAL_X = 530;
    const BUZZER_VISUAL_Y = 630;
    const START_BUTTON_X = 670;
    const START_BUTTON_Y = 645;
    const START_TEXT_X = -20;
    const START_TEXT_Y = 20;
    const STOP_BUTTON_X = 820;
    const STOP_BUTTON_Y = 645;
    const STOP_TEXT_X = -15;
    const STOP_TEXT_Y = 20;
    const SELECTOR_KNOB_X = 970;
    const SELECTOR_KNOB_Y = 645;
    const EMO_KNOB_X = 1120;
    const EMO_KNOB_Y = 645;
    const KNOB_MIN_ANGLE = -45;
    const KNOB_MAX_ANGLE = 45;

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

    const handleBackNavigation = () => {
        if (onNavigateBack) {
            onNavigateBack();
        } else {
            window.history.back();
        }
    };

    const showTooltip = useCallback((x: number, y: number, desc: string) => {
        if (tooltipRef.current && tooltipTextRef.current) {
            tooltipTextRef.current.text(desc);
            tooltipRef.current.position({ x: x + 20, y: y - 30 });
            tooltipRef.current.visible(true);
            tooltipRef.current.getLayer()?.batchDraw();
        }
    }, []);

    const hideTooltip = useCallback(() => {
        if (tooltipRef.current) {
            tooltipRef.current.visible(false);
            tooltipRef.current.getLayer()?.batchDraw();
        }
    }, []);

    const getPinWireCount = useCallback(
        (pinId: string) => wires.filter((wire) => wire.fromPin === pinId || wire.toPin === pinId).length,
        [wires],
    );
    const isPinAtCapacity = useCallback((pinId: string) => getPinWireCount(pinId) >= 2, [getPinWireCount]);

    const handlePortMouseDown = useCallback((portId: string) => {
        if (selectedWireId) { setSelectedWireId(null); return; }
        if (isPinAtCapacity(portId)) return;
        setActivePin(portId);
        hideTooltip();

        if (hoverRingRef.current) {
            hoverRingRef.current.visible(false);
        }

        if (ghostWireRef.current) {
            const start = GOTT_TRAINER_PORTS[portId];
            ghostWireRef.current.points([start.x, start.y, start.x, start.y]);
            ghostWireRef.current.visible(true);
            ghostWireRef.current.getLayer().batchDraw();
        }
    }, [hideTooltip, isPinAtCapacity, selectedWireId]);

    const handlePortMouseEnter = useCallback((e: KonvaEventObject<MouseEvent>, portId: string, config: PlcPortConfig) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'crosshair';

        // Keep the next target jack inspectable while a wire start pin is already selected.
        const shouldPreviewPin = activePin !== portId;

        if (hoverRingRef.current && shouldPreviewPin) {
            hoverRingRef.current.position({ x: config.x, y: config.y });
            hoverRingRef.current.visible(true);
            hoverRingRef.current.getLayer()?.batchDraw();
        }

        if (shouldPreviewPin) showTooltip(config.x, config.y, config.desc);
    }, [activePin, showTooltip]);

    const handlePortMouseLeave = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';

        if (hoverRingRef.current) {
            hoverRingRef.current.visible(false);
            hoverRingRef.current.getLayer()?.batchDraw();
        }

        hideTooltip();
    }, [hideTooltip]);

    const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;

        if (activePin && ghostWireRef.current) {
            mousePosRef.current = { x: pos.x / canvasScale, y: pos.y / canvasScale };
            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(() => {
                    const currentPos = mousePosRef.current;
                    if (currentPos) {
                        const points = computePLCWirePath(activePin, currentPos, GOTT_TRAINER_PORTS, wires.length);
                        ghostWireRef.current.points(points);
                        ghostWireRef.current.getLayer().batchDraw();
                    }
                    rafRef.current = null;
                });
            }
        }

        if (activeKnob) {
            const pointerX = pos.x / canvasScale;
            const pointerY = pos.y / canvasScale;
            let centerX = 0;
            let centerY = 0;

            if (activeKnob === 'selector') { centerX = SELECTOR_KNOB_X; centerY = SELECTOR_KNOB_Y; }
            else if (activeKnob === 'emo') { centerX = EMO_KNOB_X; centerY = EMO_KNOB_Y; }
            else {
                const inputIndex = Number(activeKnob.replace('input-', ''));
                const column = inputIndex % 6;
                centerX = MIDDLE_ROW_START_X + column * MIDDLE_ROW_SPACING;
                centerY = inputIndex < 6 ? MIDDLE_ROW_Y : SECOND_ROW_Y;
            }

            let rawAngle = (Math.atan2(pointerY - centerY, pointerX - centerX) * 180) / Math.PI + 90;
            if (rawAngle > 180) rawAngle -= 360;
            const clampedAngle = Math.max(KNOB_MIN_ANGLE, Math.min(KNOB_MAX_ANGLE, rawAngle));

            if (activeKnob === 'selector') setSelectorAngle(clampedAngle);
            else if (activeKnob === 'emo') setEmoAngle(clampedAngle);
            else {
                const inputIndex = Number(activeKnob.replace('input-', ''));
                setInputKnobAngles((prev) => {
                    const next = [...prev];
                    next[inputIndex] = clampedAngle;
                    return next;
                });
            }
        }
    };

    const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
        if (activePin) {
            const targetPin = (e.target as { attrs?: { id?: string } }).attrs?.id;
            if (targetPin && targetPin !== activePin && GOTT_TRAINER_PORTS[targetPin]) {
                const isDuplicate = wires.some(w => (w.fromPin === activePin && w.toPin === targetPin) || (w.fromPin === targetPin && w.toPin === activePin));
                const isTargetAtCapacity = isPinAtCapacity(targetPin);
                if (!isDuplicate && !isTargetAtCapacity && !isPinAtCapacity(activePin)) {
                    setWires(prev => {
                        const points = computePLCWirePath(activePin, targetPin, GOTT_TRAINER_PORTS, prev.length);

                        const next = [...prev, {
                            id: crypto.randomUUID(),
                            fromPin: activePin,
                            toPin: targetPin,
                            color: wireColor,
                            points: points
                        }];
                        setHistoryPast(hp => [...hp, prev].slice(-50));
                        setHistoryFuture([]);
                        return next;
                    });
                }
            }
            setActivePin(null);
            if (ghostWireRef.current) {
                ghostWireRef.current.visible(false);
                ghostWireRef.current.getLayer().batchDraw();
            }
        }
        setActiveKnob(null);
    };

    const handleStageMouseLeave = () => {
        if (activePin) {
            setActivePin(null);
            if (ghostWireRef.current) {
                ghostWireRef.current.visible(false);
                ghostWireRef.current.getLayer().batchDraw();
            }
        }
        setActiveKnob(null);
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

    const handleWireColorChange = useCallback((nextColor: string) => {
        setWireColor(nextColor);
        if (!selectedWireId) return;

        setWires((prevWires) => {
            const targetWire = prevWires.find((wire) => wire.id === selectedWireId);
            if (!targetWire || targetWire.color === nextColor) {
                return prevWires;
            }

            setHistoryPast((hp) => [...hp, prevWires].slice(-50));
            setHistoryFuture([]);
            return prevWires.map((wire) =>
                wire.id === selectedWireId ? { ...wire, color: nextColor } : wire,
            );
        });
    }, [selectedWireId]);

    const handleUndo = () => { if (!historyPast.length) return; const previous = historyPast[historyPast.length - 1]; setHistoryPast((prev) => prev.slice(0, -1)); setHistoryFuture((prev) => [wires, ...prev]); setWires(previous); };
    const handleRedo = () => { if (!historyFuture.length) return; const next = historyFuture[0]; setHistoryFuture((prev) => prev.slice(1)); setHistoryPast((prev) => [...prev, wires]); setWires(next); };
    const handleResetBoard = () => { setHistoryPast(prev => [...prev, wires].slice(-50)); setHistoryFuture([]); setWires([]); setSelectedWireId(null); setActivePin(null); setIsAcPowerOn(false); };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedWire(); } };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [deleteSelectedWire]);

    // TUTORIAL STEPS
    const tutorialSteps: TutorialStep[] = [
        { message: "Welcome to the GOTT PLC Trainer. Here you will simulate physical hardware wiring for PLC controllers." },
        { targetId: "tour-plc-guide", message: "Your Hardware Guide dictates the specific wiring tasks you must complete to power and configure the system." },
        { targetId: "tour-plc-workspace", message: "This is your main interface. Click the terminal jacks to route wires between the power supply, PLC inputs/outputs, and relays." },
        { targetId: "tour-plc-toolbar", message: "Use these tools to change your wire colors, delete incorrect routes, or clear the board." },
        { message: "Be careful not to cross-wire the 24V and 0V lines. Good luck, Cadet." }
    ];

    return (
        <PortraitGuard>
            <CyberTransition>
                <div className={`flex flex-col h-screen w-screen text-slate-800 dark:text-slate-200 font-sans overflow-hidden select-none transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0B1120]' : 'bg-slate-50'}`}>

                    <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shadow-md relative">
                        <div className="flex items-center gap-4">
                            <button onClick={handleBackNavigation} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-cyan-400 rounded-lg transition-colors shadow-sm" title="Abort Sequence"><ArrowLeft size={20} /></button>
                            <div>
                                <h1 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><Play size={16} className="text-cyan-600 dark:text-cyan-500" /> Laboratory Sequence</h1>
                                <p className="text-[10px] text-slate-500 dark:text-cyan-500/70 font-mono tracking-widest uppercase">Target: GOTT PLC Trainer • Task: {routeId || 'Default'}</p>
                            </div>
                        </div>
                        {/* TOOLBAR - ADD ID HERE */}
                        <div id="tour-plc-toolbar" className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-inner">
                                <button onClick={deleteSelectedWire} disabled={!selectedWireId} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 disabled:opacity-30 rounded-lg" title="Delete Selected Wire"><Trash2 size={16} /></button>
                                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                                <button onClick={handleUndo} disabled={!historyPast.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 rounded-lg" title="Undo"><Undo2 size={16} /></button>
                                <button onClick={handleRedo} disabled={!historyFuture.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 rounded-lg" title="Redo"><Redo2 size={16} /></button>
                                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                                <div className="px-2 flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shadow-inner border border-slate-400" style={{ backgroundColor: wireColor }} />
                                    <select value={wireColor} onChange={(e) => handleWireColorChange(e.target.value)} className="bg-transparent text-xs text-slate-900 dark:text-white font-bold outline-none border-none cursor-pointer py-1">
                                        <option value="#e74c3c" className="bg-white dark:bg-slate-900">24V Red</option>
                                        <option value="#111827" className="bg-white dark:bg-slate-900">0V Black</option>
                                        <option value="#3498db" className="bg-white dark:bg-slate-900">Signal Blue</option>
                                        <option value="#f1c40f" className="bg-white dark:bg-slate-900">Signal Yellow</option>
                                        <option value="#27ae60" className="bg-white dark:bg-slate-900">Earth Green</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" onClick={handleResetBoard} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 transition-colors shadow-sm">
                                <RefreshCw size={16} strokeWidth={2.5} /> <span className="hidden sm:inline-block">Clear Board</span>
                            </button>
                            <button type="button" onClick={toggleTheme} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-cyan-400 rounded-xl border border-slate-300 dark:border-slate-700 transition-all shadow-sm">
                                {isDarkMode ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
                            </button>
                        </div>
                    </header>

                    <main className="flex-1 flex flex-row w-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-950" ref={containerRef}>

                        {/* HARDWARE GUIDE - ADD ID HERE */}
                        <aside id="tour-plc-guide" className="w-[360px] flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg transition-colors duration-300">
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

                            {/* MAIN CANVAS - ADD ID HERE */}
                            <div id="tour-plc-workspace" className="relative shadow-2xl rounded-lg border-4 border-slate-400 dark:border-slate-800 bg-[#e2e8f0] overflow-hidden flex items-center justify-center" style={{ width: BASE_CANVAS_WIDTH * canvasScale, height: BASE_CANVAS_HEIGHT * canvasScale }}>

                                {!isCanvasReady ? (
                                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                                        <div className="w-10 h-10 border-4 border-slate-300 border-t-cyan-500 rounded-full animate-spin"></div>
                                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase animate-pulse">
                                            Mounting Hardware Environment...
                                        </p>
                                    </div>
                                ) : (
                                    <Stage width={BASE_CANVAS_WIDTH * canvasScale} height={BASE_CANVAS_HEIGHT * canvasScale} onMouseMove={handleMouseMove} onMouseUp={handleStageMouseUp} onMouseLeave={handleStageMouseLeave}>

                                        {/* LAYER 1: STATIC BACKGROUND PANELS (BOTTOM) */}
                                        <Layer scaleX={canvasScale} scaleY={canvasScale} id="static-bg-layer" listening={false}>
                                            <Rect width={BASE_CANVAS_WIDTH} height={BASE_CANVAS_HEIGHT} fill="#e2e8f0" id="enclosure-base" />

                                            <PlcPanelBackground id="ac-power" x={30} y={30} width={160} height={220} />
                                            <PlcPanelBackground id="plc" x={210} y={30} width={470} height={220} />
                                            <PlcPanelBackground id="inputs" x={30} y={270} width={420} height={180} />
                                            <PlcPanelBackground id="reeds" x={470} y={270} width={210} height={180} />
                                            <PlcPanelBackground id="relays" x={30} y={470} width={300} height={220} />
                                            <PlcPanelBackground id="power" x={345} y={470} width={105} height={220} />
                                            <PlcPanelBackground id="solenoids" x={460} y={470} width={790} height={90} />
                                            <PlcPanelBackground id="buzzer" x={460} y={575} width={140} height={115} />
                                            <PlcPanelBackground id="manual" x={615} y={575} width={635} height={115} />

                                            <Group x={690} y={30}>
                                                <Rect width={560} height={420} fill="#e2e8f0" cornerRadius={6} />
                                                <Rect width={560} height={24} fill="#cbd5e1" cornerRadius={6} />
                                                <Rect x={50} y={80} width={200} height={40} fill="#94a3b8" cornerRadius={4} />
                                                <Rect x={250} y={90} width={120} height={20} fill="#cbd5e1" cornerRadius={4} />
                                                <Rect x={50} y={200} width={200} height={40} fill="#94a3b8" cornerRadius={4} />
                                                <Rect x={180} y={210} width={190} height={20} fill="#cbd5e1" cornerRadius={4} />
                                            </Group>
                                        </Layer>

                                        {/* LAYER 2: WIRES (MIDDLE - Drawn OVER backgrounds, but UNDER text and ports!) */}
                                        <Layer scaleX={canvasScale} scaleY={canvasScale} id="interactive-wiring-layer">
                                            {wires.map((wire) => {
                                                const isSelected = selectedWireId === wire.id;
                                                return (
                                                    <Line
                                                        key={`wire-${wire.id}`}
                                                        points={wire.points}
                                                        stroke={wire.color}
                                                        strokeWidth={isSelected ? 10 : 8}
                                                        opacity={isSelected ? 1 : 0.85}
                                                        hitStrokeWidth={20}
                                                        lineCap="round"
                                                        lineJoin="round"
                                                        shadowColor={isSelected ? '#f1c40f' : 'rgba(0,0,0,0.5)'}
                                                        shadowBlur={isSelected ? 15 : 6}
                                                        shadowOffsetY={isSelected ? 0 : 8}
                                                        onMouseDown={(e) => { e.cancelBubble = true; setSelectedWireId(wire.id); setWireColor(wire.color); }}
                                                        onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                                                        onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                                    />
                                                );
                                            })}
                                        </Layer>

                                        {/* LAYER 3: HARDWARE COMPONENTS & TEXT (TOP - Drawn OVER Wires!) */}
                                        <Layer scaleX={canvasScale} scaleY={canvasScale} id="hardware-components-layer">

                                            {/* Panel Texts */}
                                            <PlcPanelText id="ac-power" x={30} y={30} title="INPUT AC220V-240V" />
                                            <PlcPanelText id="plc" x={210} y={30} title="OMRON SYSMAC CP1E" />
                                            <PlcPanelText id="inputs" x={30} y={270} title="INPUT (00CH)" />
                                            <PlcPanelText id="reeds" x={470} y={270} title="REED SWITCH" />
                                            <PlcPanelText id="relays" x={30} y={470} title="RELAY TYPE OUTPUT (10CH)" />
                                            <PlcPanelText id="power" x={345} y={470} title="POWER SUPPLY" />
                                            <PlcPanelText id="solenoids" x={460} y={470} title="SOLENOID VALVES" />
                                            <PlcPanelText id="buzzer" x={460} y={575} title="BUZZER" />
                                            <PlcPanelText id="manual" x={615} y={575} title="MANUAL INPUTS" />
                                            <Text text="PNEUMATIC ACTUATORS (HARDWARE MODULE)" x={700} y={38} fill="#475569" fontSize={12} fontStyle="bold" listening={false} />

                                            {/* Solenoid Text Labels */}
                                            {PLC_SOLENOID_LABELS.map((pair, i) => (
                                                <Text key={`sol-pair-label-${i}`} text={pair.label} x={pair.x - 40 / 2} y={535 - 28} fontSize={14} fontStyle="bold" fill="#1e293b" align="center" width={40} listening={false} />
                                            ))}

                                            {/* Switch Group */}
                                            <Group x={65} y={70} id="ac-switch-group"
                                                onClick={() => setIsAcPowerOn(prev => !prev)}
                                                onTap={() => setIsAcPowerOn(prev => !prev)}
                                                onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                                                onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                            >
                                                <Rect width={90} height={130} fill="#1e293b" cornerRadius={8} shadowColor="rgba(0,0,0,0.4)" shadowBlur={4} shadowOffsetY={2} />
                                                <Rect width={50} height={35} x={20} y={15} fill="#0f172a" cornerRadius={4} />
                                                <Rect width={10} height={4} x={30} y={25} fill="#cbd5e1" />
                                                <Rect width={10} height={4} x={50} y={25} fill="#cbd5e1" />
                                                <Rect width={10} height={4} x={40} y={35} fill="#cbd5e1" />
                                                <Rect width={44} height={54} x={23} y={60} fill="#000000" cornerRadius={4} />
                                                <Rect width={36} height={23} x={27} y={64} fill={isAcPowerOn ? HW_STYLES.switchRedOn : HW_STYLES.switchRedOff} cornerRadius={2} shadowColor={isAcPowerOn ? HW_STYLES.switchRedOn : 'transparent'} shadowBlur={10} />
                                                <Rect width={36} height={23} x={27} y={87} fill={isAcPowerOn ? HW_STYLES.switchRedOff : HW_STYLES.switchRedOn} cornerRadius={2} />
                                                <Text text="I" x={42} y={70} fontSize={12} fill="#ffffff" fontStyle="bold" listening={false} />
                                                <Text text="O" x={40} y={92} fontSize={12} fill="#ffffff" fontStyle="bold" listening={false} />
                                                <Text text="POWER" x={25} y={142} fontSize={12} fontStyle="bold" fill="#1e293b" listening={false} />
                                            </Group>

                                            {/* PLC Faceplate */}
                                            <Group x={240} y={80} id="plc-faceplate" listening={false}>
                                                <Rect width={410} height={140} fill={HW_STYLES.omronBody} cornerRadius={4} shadowColor="rgba(0,0,0,0.6)" shadowBlur={12} shadowOffsetY={6} />
                                                <Text text="OMRON" x={15} y={15} fill="#ffffff" fontSize={12} fontStyle="bold" fontFamily={HW_STYLES.technicalSans} />
                                                <Text text="SYSMAC" x={15} y={30} fill="#cbd5e1" fontSize={12} fontStyle="bold" fontFamily={HW_STYLES.technicalSans} />
                                                <Text text="CP1E" x={15} y={45} fill="#cbd5e1" fontSize={16} fontStyle="bold" fontFamily={HW_STYLES.technicalSans} />
                                                <Text text="PERIPHERAL" x={15} y={115} fill="#cbd5e1" fontSize={8} fontFamily={HW_STYLES.technicalSans} />
                                                <Rect x={15} y={90} width={40} height={20} fill="#0f172a" cornerRadius={2} />

                                                <Group x={110} y={15} id="status-leds">
                                                    <Circle x={10} y={10} radius={4} fill={isAcPowerOn ? HW_STYLES.ledOn : HW_STYLES.ledOff} shadowColor={HW_STYLES.ledOn} shadowBlur={isAcPowerOn ? 5 : 0} />
                                                    <Text text="POWER" x={20} y={6} fontSize={8} fill="#cbd5e1" />
                                                    <Circle x={10} y={25} radius={4} fill={isAcPowerOn ? HW_STYLES.ledOn : HW_STYLES.ledOff} shadowColor={HW_STYLES.ledOn} shadowBlur={isAcPowerOn ? 3 : 0} />
                                                    <Text text="RUN" x={20} y={21} fontSize={8} fill="#cbd5e1" />
                                                    <Circle x={10} y={40} radius={4} fill={HW_STYLES.ledOff} />
                                                    <Text text="ERR/ALM" x={20} y={36} fontSize={8} fill="#cbd5e1" />
                                                    <Circle x={10} y={55} radius={4} fill={HW_STYLES.ledOff} />
                                                    <Text text="INH" x={20} y={51} fontSize={8} fill="#cbd5e1" />
                                                    <Circle x={10} y={70} radius={4} fill={HW_STYLES.ledOff} />
                                                    <Text text="PRPHL" x={20} y={66} fontSize={8} fill="#cbd5e1" />
                                                    <Circle x={10} y={85} radius={4} fill={HW_STYLES.ledOff} />
                                                    <Text text="BKUP" x={20} y={81} fontSize={8} fill="#cbd5e1" />
                                                </Group>

                                                <Group x={190} y={15} id="input-led-grid">
                                                    <Rect width={205} height={50} fill="#0f172a" cornerRadius={4} opacity={0.3} />
                                                    <Text text="IN  CH00" x={5} y={5} fontSize={10} fontStyle="bold" fill="#ffffff" />
                                                    {[...Array(12)].map((_, i) => (
                                                        <Group key={`in-led-group-${i}`} x={10 + (i % 6) * 32} y={20 + Math.floor(i / 6) * 18}>
                                                            <Circle radius={3} fill={HW_STYLES.ledOff} />
                                                            <Text text={(i).toString().padStart(2, '0')} x={-5} y={6} fontSize={8} fill="#cbd5e1" />
                                                        </Group>
                                                    ))}
                                                </Group>

                                                <Group x={190} y={75} id="output-led-grid">
                                                    <Rect width={205} height={50} fill="#0f172a" cornerRadius={4} opacity={0.3} />
                                                    <Text text="OUT CH10" x={5} y={5} fontSize={10} fontStyle="bold" fill="#ffffff" />
                                                    {[...Array(8)].map((_, i) => (
                                                        <Group key={`out-led-group-${i}`} x={10 + (i % 6) * 32} y={20 + Math.floor(i / 6) * 18}>
                                                            <Circle radius={3} fill={HW_STYLES.ledOff} />
                                                            <Text text={(i).toString().padStart(2, '0')} x={-5} y={6} fontSize={8} fill="#cbd5e1" />
                                                        </Group>
                                                    ))}
                                                </Group>
                                            </Group>

                                            {/* Knobs */}
                                            {[...Array(6)].map((_, i) => (
                                                <Group key={`knob-${i}`} x={MIDDLE_ROW_START_X + i * MIDDLE_ROW_SPACING} y={MIDDLE_ROW_Y}
                                                    onMouseDown={() => setActiveKnob(`input-${i}`)} onMouseUp={() => setActiveKnob(null)}
                                                    onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'grab'; }}
                                                    onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                                >
                                                    <Circle radius={14} fill="#1e293b" stroke="#cbd5e1" strokeWidth={2} />
                                                    <Group rotation={inputKnobAngles[i]} listening={false}>
                                                        <Line points={[0, 0, 0, -9]} stroke="#cbd5e1" strokeWidth={2} lineCap="round" />
                                                        <Circle y={-9} radius={2.5} fill="#cbd5e1" />
                                                    </Group>
                                                </Group>
                                            ))}

                                            {[...Array(6)].map((_, i) => (
                                                <Group key={`knob-second-${i}`} x={MIDDLE_ROW_START_X + i * MIDDLE_ROW_SPACING} y={SECOND_ROW_Y}
                                                    onMouseDown={() => setActiveKnob(`input-${i + 6}`)} onMouseUp={() => setActiveKnob(null)}
                                                    onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'grab'; }}
                                                    onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                                >
                                                    <Circle radius={14} fill="#1e293b" stroke="#cbd5e1" strokeWidth={2} />
                                                    <Group rotation={inputKnobAngles[i + 6]} listening={false}>
                                                        <Line points={[0, 0, 0, -9]} stroke="#cbd5e1" strokeWidth={2} lineCap="round" />
                                                        <Circle y={-9} radius={2.5} fill="#cbd5e1" />
                                                    </Group>
                                                </Group>
                                            ))}

                                            {/* Buzzer Visual */}
                                            <Group x={BUZZER_VISUAL_X} y={BUZZER_VISUAL_Y} listening={false}>
                                                <Circle radius={18} fill="#1e293b" stroke="#cbd5e1" strokeWidth={2} />
                                                <Circle radius={5} fill="#ef4444" />
                                            </Group>

                                            {/* Reed Lights (No Rect outline) */}
                                            {[
                                                ['reed_ret_1.1', 'reed_ext_1.2'],
                                                ['reed_ret_2.1', 'reed_ext_2.2'],
                                                ['reed_ret_3.1', 'reed_ext_3.2'],
                                            ].map((pair, i) => {
                                                const ret = GOTT_TRAINER_PORTS[pair[0]];
                                                const ext = GOTT_TRAINER_PORTS[pair[1]];
                                                if (!ret || !ext) return null;
                                                const lightRadius = 16;
                                                const lightStroke = 4;
                                                return (
                                                    <Group key={`reed-pair-border-${i}`} listening={false}>
                                                        {[0, 1].map(j => (
                                                            <Circle key={`reed-light-${pair[j]}`} x={GOTT_TRAINER_PORTS[pair[j]].x} y={GOTT_TRAINER_PORTS[pair[j]].y + REED_LIGHT_OFFSET_Y} radius={lightRadius} fill={HW_STYLES.switchRedOff} stroke="#cbd5e1" strokeWidth={lightStroke} />
                                                        ))}
                                                    </Group>
                                                );
                                            })}

                                            {/* Relay Lights */}
                                            {[...Array(4)].map((_, i) => (
                                                <Circle key={`relay-light-${i}`} x={UPPER_RELAY_LIGHT_START_X + i * UPPER_RELAY_LIGHT_SPACING} y={UPPER_RELAY_LIGHT_Y} radius={16} fill={HW_STYLES.switchRedOff} stroke="#cbd5e1" strokeWidth={4} listening={false} />
                                            ))}
                                            {[...Array(4)].map((_, i) => (
                                                <Circle key={`relay-light-bottom-${i}`} x={BOTTOM_RELAY_LIGHT_START_X + i * BOTTOM_RELAY_LIGHT_SPACING} y={BOTTOM_RELAY_LIGHT_Y} radius={16} fill={HW_STYLES.switchRedOff} stroke="#cbd5e1" strokeWidth={4} listening={false} />
                                            ))}

                                            {/* Start Button */}
                                            <Group x={START_BUTTON_X} y={START_BUTTON_Y}
                                                onMouseDown={() => setIsStartPressed(true)} onMouseUp={() => setIsStartPressed(false)} onMouseLeave={() => setIsStartPressed(false)}
                                                onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                                            >
                                                <Group y={isStartPressed ? 2 : 0}>
                                                    <Circle radius={16} fill={isStartPressed ? '#0f766e' : '#10b981'} shadowColor="rgba(0,0,0,0.4)" shadowBlur={6} shadowOffsetY={3} />
                                                    <Circle radius={11} fill={isStartPressed ? '#10b981' : '#34d399'} />
                                                </Group>
                                                <Text text="START" x={START_TEXT_X} y={START_TEXT_Y} fontSize={11} fontStyle="bold" fill="#1e293b" listening={false} />
                                            </Group>

                                            {/* Stop Button */}
                                            <Group x={STOP_BUTTON_X} y={STOP_BUTTON_Y}
                                                onMouseDown={() => setIsStopPressed(true)} onMouseUp={() => setIsStopPressed(false)} onMouseLeave={() => setIsStopPressed(false)}
                                                onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                                            >
                                                <Group y={isStopPressed ? 2 : 0}>
                                                    <Circle radius={16} fill={isStopPressed ? '#b91c1c' : '#ef4444'} shadowColor="rgba(0,0,0,0.4)" shadowBlur={6} shadowOffsetY={3} />
                                                    <Circle radius={11} fill={isStopPressed ? '#ef4444' : '#f87171'} />
                                                </Group>
                                                <Text text="STOP" x={STOP_TEXT_X} y={STOP_TEXT_Y} fontSize={11} fontStyle="bold" fill="#1e293b" listening={false} />
                                            </Group>

                                            {/* Selector Knob */}
                                            <Group x={SELECTOR_KNOB_X} y={SELECTOR_KNOB_Y}
                                                onMouseDown={() => setActiveKnob('selector')} onMouseUp={() => setActiveKnob(null)}
                                                onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'grab'; }}
                                                onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                            >
                                                <Circle radius={15} fill="#1e293b" stroke="#cbd5e1" strokeWidth={2} />
                                                <Group rotation={selectorAngle} listening={false}>
                                                    <Line points={[0, 0, 0, -9]} stroke="#cbd5e1" strokeWidth={2} lineCap="round" />
                                                    <Circle y={-9} radius={2.5} fill="#cbd5e1" />
                                                </Group>
                                                <Text text="SELECTOR" x={-26} y={22} fontSize={10} fontStyle="bold" fill="#1e293b" listening={false} />
                                            </Group>

                                            {/* EMO Knob */}
                                            <Group x={EMO_KNOB_X} y={EMO_KNOB_Y}
                                                onMouseDown={() => setActiveKnob('emo')} onMouseUp={() => setActiveKnob(null)}
                                                onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'grab'; }}
                                                onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                                            >
                                                <Circle radius={15} fill="#b91c1c" stroke="#cbd5e1" strokeWidth={2} />
                                                <Group rotation={emoAngle} listening={false}>
                                                    <Line points={[0, 0, 0, -9]} stroke="#fca5a5" strokeWidth={2} lineCap="round" />
                                                    <Circle y={-9} radius={2.5} fill="#fca5a5" />
                                                </Group>
                                                <Text text="EMO" x={-12} y={22} fontSize={10} fontStyle="bold" fill="#7f1d1d" listening={false} />
                                            </Group>

                                            {/* ALL PORTS (Drawn LAST so they sit perfectly on top of wires) */}
                                            {Object.entries(GOTT_TRAINER_PORTS).map(([id]) => (
                                                <PlcHardwareJack
                                                    key={id}
                                                    portId={id}
                                                    isActive={activePin === id}
                                                    config={GOTT_TRAINER_PORTS[id]}
                                                    onPointerDown={handlePortMouseDown}
                                                    onPointerEnter={handlePortMouseEnter}
                                                    onPointerLeave={handlePortMouseLeave}
                                                />
                                            ))}
                                        </Layer>

                                        {/* LAYER 4: Fast Overlay for Ghost Wire & Imperative Tooltips */}
                                        <Layer scaleX={canvasScale} scaleY={canvasScale} id="overlay-layer" listening={false}>
                                            <Line ref={ghostWireRef} stroke={wireColor} strokeWidth={6} dash={[10, 8]} opacity={0.7} lineJoin="round" visible={false} />
                                            <Circle ref={hoverRingRef} radius={9} stroke="#ffffff" strokeWidth={2} visible={false} />

                                            <Group ref={tooltipRef} visible={false}>
                                                <Rect height={24} width={140} fill="#1e293b" cornerRadius={4} />
                                                <Text ref={tooltipTextRef} fill="#ffffff" fontSize={11} fontFamily={HW_STYLES.technicalMono} padding={6} />
                                            </Group>
                                        </Layer>
                                    </Stage>
                                )}
                            </div>
                        </div>
                    </main>

                    {/* THE SELF MANAGED GUIDE! */}
                    <TutorialGuide
                        steps={tutorialSteps}
                        storageKey="creosim_tutorial_simulation_plc"
                    />
                </div>
            </CyberTransition>
        </PortraitGuard>
    );
}