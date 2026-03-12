import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Circle, Line, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

// Lucide Icons for Taskbar
import { ArrowLeft, Play, Trash2, Undo2, Redo2, Sun, Moon, RefreshCw } from 'lucide-react';
import './SimulationApp.css';

import { RELAY_PORTS, HW_STYLES } from './constants/relayBoard';
import { RelayStaticBackground } from './components/RelayStaticBackground';
import { computeOrthogonalPath } from './utils/wireRouting';

// Notice we added `points: number[]` to store the calculated path!
interface Connection { id: string; fromPin: string; toPin: string; color: string; points: number[]; }
interface SimulationAppProps { routeId?: string; onNavigateBack?: () => void; }

export default function SimulationApp({ routeId, onNavigateBack }: SimulationAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Interactive States
  const [isMainSwitchOn, setIsMainSwitchOn] = useState(false);

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

  const handleToggleSwitch = useCallback(() => {
    setIsMainSwitchOn(prev => !prev);
  }, []);

  // WIRING LOGIC
  const handlePortMouseDown = (portId: string) => { if (selectedWireId) { setSelectedWireId(null); return; } setActivePin(portId); setMousePos(RELAY_PORTS[portId]); };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos && activePin) {
      setMousePos({ x: pos.x / canvasScale, y: pos.y / canvasScale });
    }
  };

  const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (activePin) {
      const targetPin = (e.target as { attrs?: { id?: string } }).attrs?.id;
      if (targetPin && targetPin !== activePin && RELAY_PORTS[targetPin]) {
        const isDuplicate = wires.some(w => (w.fromPin === activePin && w.toPin === targetPin) || (w.fromPin === targetPin && w.toPin === activePin));
        if (!isDuplicate) {
          setWires(prev => {
            // FIX: We compute the path exactly ONCE right here when the connection is made.
            const pathPoints = computeOrthogonalPath(activePin, targetPin, RELAY_PORTS, prev.length);
            const flatPoints = pathPoints.flatMap(p => [p.x, p.y]);

            const next = [...prev, {
              id: crypto.randomUUID(),
              fromPin: activePin,
              toPin: targetPin,
              color: wireColor,
              points: flatPoints // Save the points directly into state!
            }];
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
  const handleResetBoard = () => { setHistoryPast(prev => [...prev, wires].slice(-50)); setHistoryFuture([]); setWires([]); setSelectedWireId(null); setActivePin(null); setIsMainSwitchOn(false); };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedWire(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelectedWire]);

  const renderHardwareJack = (portId: string, isHovered: boolean, isActive: boolean) => {
    const pos = RELAY_PORTS[portId];
    return (
      <Group key={`jack-${portId}`} x={pos.x} y={pos.y}>
        <Circle radius={7} fill="#bdc3c7" stroke="#34495e" strokeWidth={1} listening={false} />
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

  return (
    <div className={`flex flex-col h-screen w-screen text-slate-800 dark:text-slate-200 font-sans overflow-hidden select-none transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0B1120]' : 'bg-slate-50'}`}>

      {/* --- HEADER TOOLBAR --- */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shadow-md relative">
        <div className="flex items-center gap-4">
          <button onClick={onNavigateBack} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-cyan-400 rounded-lg transition-colors shadow-sm" title="Abort Sequence"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><Play size={16} className="text-cyan-600 dark:text-cyan-500" /> Laboratory Sequence</h1>
            <p className="text-[10px] text-slate-500 dark:text-cyan-500/70 font-mono tracking-widest uppercase">Target: Electro-Pneumatic Trainer • Task: {routeId || 'Default'}</p>
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
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Electro-Pneumatic Relay Trainer</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-mono">Use the patch cables to route 24V power and logic directly to the terminal strips on the board.</p>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>Toggle the Main Switch to energize the V+ rail.</li>
                <li>Connect logic from the Control Panel to the Relays/Timers.</li>
                <li>Wire the outputs of the Relays directly to the Solenoid terminal blocks to actuate the pneumatic cylinders.</li>
                <li>Click a placed wire and hit <kbd className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Delete</kbd> to remove it.</li>
              </ul>
              <button type="button" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-md">Evaluate Circuit</button>
            </div>
          </div>
        </aside>

        <div className="flex-1 relative flex items-center justify-center p-6">
          <div className="relative shadow-2xl rounded-lg border-4 border-slate-400 dark:border-slate-800 bg-[#e2e8f0] overflow-hidden" style={{ width: BASE_CANVAS_WIDTH * canvasScale, height: BASE_CANVAS_HEIGHT * canvasScale }}>
            <Stage width={BASE_CANVAS_WIDTH * canvasScale} height={BASE_CANVAS_HEIGHT * canvasScale} onMouseMove={handleMouseMove} onMouseUp={handleStageMouseUp}>

              {/* LAYER 1: MEMOIZED STATIC HARDWARE (Lightning Fast) */}
              <RelayStaticBackground
                BASE_CANVAS_WIDTH={BASE_CANVAS_WIDTH}
                BASE_CANVAS_HEIGHT={BASE_CANVAS_HEIGHT}
                canvasScale={canvasScale}
                isDarkMode={isDarkMode}
                isMainSwitchOn={isMainSwitchOn}
                onToggleSwitch={handleToggleSwitch}
              />

              {/* LAYER 2: INTERACTIVE ELEMENTS & WIRES */}
              <Layer scaleX={canvasScale} scaleY={canvasScale} id="interactive-wiring-layer">

                {/* RENDER INTERACTIVE PORTS */}
                {Object.entries(RELAY_PORTS).map(([id]) => {
                  const isHovered = hoveredPin === id;
                  const isActive = activePin === id;
                  return renderHardwareJack(id, isHovered, isActive);
                })}

                {/* RENDER COMPLETED WIRES (FIX: Read from State, No compute inside render loop!) */}
                {wires.map((wire) => {
                  const isSelected = selectedWireId === wire.id;
                  return (
                    <Line
                      key={`wire-${wire.id}`}
                      points={wire.points} // Uses the pre-calculated Dijkstra grid path!
                      stroke={wire.color}
                      strokeWidth={isSelected ? 8 : 5}
                      hitStrokeWidth={20}
                      lineCap="round"
                      lineJoin="round"
                      shadowColor={isSelected ? '#f1c40f' : 'rgba(0,0,0,0.4)'}
                      shadowBlur={isSelected ? 8 : 4}
                      shadowOffsetY={isSelected ? 0 : 4}
                      onMouseDown={(e) => { e.cancelBubble = true; setSelectedWireId(wire.id); }}
                      onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                      onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
                    />
                  );
                })}

                {/* LIVE GHOST WIRE (Dashed Direct Line while dragging) */}
                {activePin && mousePos && (
                  <Line
                    points={[RELAY_PORTS[activePin].x, RELAY_PORTS[activePin].y, mousePos.x, mousePos.y]}
                    stroke={wireColor}
                    strokeWidth={4}
                    dash={[10, 8]}
                    opacity={0.6}
                    listening={false}
                  />
                )}

                {/* PORT HOVER TOOLTIP */}
                {hoveredPin && !activePin && (
                  <Group x={RELAY_PORTS[hoveredPin].x + 20} y={RELAY_PORTS[hoveredPin].y - 30} listening={false}>
                    <Rect height={24} width={140} fill="#1e293b" cornerRadius={4} />
                    <Text text={RELAY_PORTS[hoveredPin].desc} fill="#ffffff" fontSize={11} fontFamily={HW_STYLES.technicalMono} padding={6} />
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