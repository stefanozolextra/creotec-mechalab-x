import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Stage, Layer, Circle, Line, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

// Lucide Icons for Taskbar
import { ArrowLeft, Play, Trash2, Undo2, Redo2, Sun, Moon, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import './SimulationApp.css';

import { RELAY_PORTS, HW_STYLES } from './constants/relayBoard';
import { RelayStaticBackground } from './components/RelayStaticBackground';
import { computeOrthogonalPath } from './utils/wireRouting';
import { evaluateActivityAnswer, type ActivityEvaluationResult } from './utils/evaluateActivityAnswer';
import PortraitGuard from '../components/PortraitGuard';
import CyberTransition from '../components/CyberTransition'; // <-- Added import
import buttonDevice from '../assets/devices/button.png';
import buzzerDevice from '../assets/devices/buzzer.png';
import counterDevice from '../assets/devices/counter.png';
import lightIndicatorDevice from '../assets/devices/light-indicator.png';
import magneticContactorDevice from '../assets/devices/magnetic-motor-contactor.png';
import relayModuleDevice from '../assets/devices/relay-module.png';
import rollerLeverDevice from '../assets/devices/roller-lever.png';
import solenoidValveDevice from '../assets/devices/solenoid-valve.png';
import { getActivityAnswerByRouteId } from './constants/activityAnswers';

interface Connection { id: string; fromPin: string; toPin: string; color: string; points: number[]; }
interface SimulationAppProps { routeId?: string; onNavigateBack?: () => void; }

const DEVICE_LIBRARY = [
  { id: 'push-button', name: 'Push Button', image: buttonDevice },
  { id: 'buzzer', name: 'Buzzer', image: buzzerDevice },
  { id: 'counter', name: 'Counter', image: counterDevice },
  { id: 'light-indicator', name: 'Light Indicator', image: lightIndicatorDevice },
  { id: 'magnetic-contactor', name: 'Magnetic Contactor', image: magneticContactorDevice },
  { id: 'relay-module', name: 'Relay Module', image: relayModuleDevice },
  { id: 'roller-lever', name: 'Roller Lever', image: rollerLeverDevice },
  { id: 'solenoid-valve', name: 'Solenoid Valve', image: solenoidValveDevice },
] as const;

type DeviceId = (typeof DEVICE_LIBRARY)[number]['id'];
type DeviceZone = 'input' | 'output';
type DeviceDragState = { deviceId: DeviceId; source: DeviceZone | 'library' } | null;

const isDeviceId = (value: string): value is DeviceId =>
  DEVICE_LIBRARY.some((device) => device.id === value);

const getDeviceById = (deviceId: DeviceId) =>
  DEVICE_LIBRARY.find((device) => device.id === deviceId) ?? DEVICE_LIBRARY[0];

export default function SimulationApp({ routeId, onNavigateBack }: SimulationAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isDeviceDrawerOpen, setIsDeviceDrawerOpen] = useState(true);
  const [assignedDevices, setAssignedDevices] = useState<Record<DeviceZone, DeviceId[]>>({ input: [], output: [] });
  const [dragState, setDragState] = useState<DeviceDragState>(null);
  const [activeDropZone, setActiveDropZone] = useState<DeviceZone | null>(null);

  const [isCanvasReady, setIsCanvasReady] = useState(false);

  useEffect(() => {
    // Wait 700ms for the CyberTransition to finish before locking CPU with Konva
    const timer = setTimeout(() => setIsCanvasReady(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const [isMainSwitchOn, setIsMainSwitchOn] = useState(false);
  const [wires, setWires] = useState<Connection[]>([]);
  const [wireColor, setWireColor] = useState<string>('#e74c3c');
  const [activePin, setActivePin] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [answerFeedbackState, setAnswerFeedbackState] = useState<{
    signature: string;
    result: ActivityEvaluationResult;
  } | null>(null);

  // IMPERATIVE REFS: 0 React Renders for high-frequency actions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ghostWireRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoverRingRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipBgRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipTextRef = useRef<any>(null);

  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const [historyPast, setHistoryPast] = useState<Connection[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<Connection[][]>([]);

  const GUIDE_PANEL_WIDTH = 360;
  const DEVICE_DRAWER_OPEN_WIDTH = 320;
  const DEVICE_DRAWER_COLLAPSED_WIDTH = 60;
  const PADDING = 24;
  const BASE_CANVAS_WIDTH = 1280;
  const BASE_CANVAS_HEIGHT = 720;

  const availableCanvasWidth = viewport.width - GUIDE_PANEL_WIDTH - PADDING * 2;
  const availableCanvasHeight = viewport.height - PADDING * 2;
  const canvasScale = Math.max(0.1, Math.min(availableCanvasWidth / BASE_CANVAS_WIDTH, availableCanvasHeight / BASE_CANVAS_HEIGHT));

  useEffect(() => {
    const handleResize = () => { if (containerRef.current) setViewport({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => { const newMode = !isDarkMode; setIsDarkMode(newMode); document.documentElement.classList.toggle('dark', newMode); };
  const handleToggleSwitch = useCallback(() => setIsMainSwitchOn(prev => !prev), []);

  const handleBackNavigation = () => {
    if (onNavigateBack) {
      onNavigateBack();
    } else {
      window.history.back();
    }
  };

  const showTooltip = useCallback((x: number, y: number, desc: string) => {
    const normalizedDesc = desc.trim();
    if (!normalizedDesc) {
      if (tooltipRef.current) {
        tooltipRef.current.visible(false);
        tooltipRef.current.getLayer()?.batchDraw();
      }
      return;
    }

    if (tooltipRef.current && tooltipTextRef.current && tooltipBgRef.current) {
      tooltipTextRef.current.text(normalizedDesc);
      const textBounds = tooltipTextRef.current.getClientRect({ skipTransform: true });
      tooltipBgRef.current.width(textBounds.width);
      tooltipBgRef.current.height(textBounds.height);
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

  const handlePortMouseDown = (portId: string) => {
    if (selectedWireId) { setSelectedWireId(null); return; }
    setActivePin(portId);
    hideTooltip();

    if (hoverRingRef.current) {
      hoverRingRef.current.visible(false);
    }

    if (ghostWireRef.current) {
      const start = RELAY_PORTS[portId];
      ghostWireRef.current.points([start.x, start.y, start.x, start.y]);
      ghostWireRef.current.visible(true);
      ghostWireRef.current.getLayer().batchDraw();
    }
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!activePin || !ghostWireRef.current) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    mousePosRef.current = { x: pos.x / canvasScale, y: pos.y / canvasScale };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        const currentPos = mousePosRef.current;
        if (currentPos) {
          const startPos = RELAY_PORTS[activePin];
          ghostWireRef.current.points([startPos.x, startPos.y, currentPos.x, currentPos.y]);
          ghostWireRef.current.getLayer().batchDraw();
        }
        rafRef.current = null;
      });
    }
  };

  const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (activePin) {
      const targetPin = (e.target as { attrs?: { id?: string } }).attrs?.id;
      if (targetPin && targetPin !== activePin && RELAY_PORTS[targetPin]) {
        const isDuplicate = wires.some(w => (w.fromPin === activePin && w.toPin === targetPin) || (w.fromPin === targetPin && w.toPin === activePin));
        if (!isDuplicate) {
          setWires(prev => {
            const pathPoints = computeOrthogonalPath(activePin, targetPin, RELAY_PORTS, prev.length);
            const flatPoints = pathPoints.flatMap(p => [p.x, p.y]);
            const next = [...prev, { id: crypto.randomUUID(), fromPin: activePin, toPin: targetPin, color: wireColor, points: flatPoints }];
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
  };

  const handleStageMouseLeave = () => {
    if (activePin) {
      setActivePin(null);
      if (ghostWireRef.current) {
        ghostWireRef.current.visible(false);
        ghostWireRef.current.getLayer().batchDraw();
      }
    }
  };

  const deleteSelectedWire = useCallback(() => {
    if (!selectedWireId) return;
    setWires((prev) => {
      const next = prev.filter((w) => w.id !== selectedWireId);
      setHistoryPast((hp) => [...hp, prev].slice(-50));
      setHistoryFuture([]);
      return next;
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

  const activityPreset = getActivityAnswerByRouteId(routeId);
  const assignedDeviceIds = useMemo(
    () => new Set([...assignedDevices.input, ...assignedDevices.output]),
    [assignedDevices],
  );
  const answerSignature = useMemo(
    () => JSON.stringify({
      routeId: activityPreset.routeId,
      input: assignedDevices.input,
      output: assignedDevices.output,
      wires: wires.map(({ fromPin, toPin }) => [fromPin, toPin]),
    }),
    [activityPreset.routeId, assignedDevices, wires],
  );
  const answerFeedback =
    answerFeedbackState?.signature === answerSignature ? answerFeedbackState.result : null;
  const answerPercent = answerFeedback?.passed ? '100%' : '0%';

  const placeDeviceInZone = useCallback((deviceId: DeviceId, zone: DeviceZone) => {
    setAssignedDevices((previous) => {
      const nextInput = previous.input.filter((entry) => entry !== deviceId);
      const nextOutput = previous.output.filter((entry) => entry !== deviceId);

      if (zone === 'input') {
        return { input: [...nextInput, deviceId], output: nextOutput };
      }

      return { input: nextInput, output: [...nextOutput, deviceId] };
    });
  }, []);

  const removeDeviceFromZones = useCallback((deviceId: DeviceId) => {
    setAssignedDevices((previous) => ({
      input: previous.input.filter((entry) => entry !== deviceId),
      output: previous.output.filter((entry) => entry !== deviceId),
    }));
  }, []);

  const handleCheckAnswer = useCallback(() => {
    setAnswerFeedbackState({
      signature: answerSignature,
      result: evaluateActivityAnswer(activityPreset, {
        inputDeviceIds: assignedDevices.input,
        outputDeviceIds: assignedDevices.output,
        wires: wires.map(({ fromPin, toPin }) => ({ fromPin, toPin })),
      }),
    });
  }, [activityPreset, answerSignature, assignedDevices, wires]);

  const handleDeviceDragStart = useCallback(
    (deviceId: DeviceId, source: DeviceZone | 'library', event: DragEvent<HTMLElement>) => {
      event.dataTransfer.effectAllowed = source === 'library' ? 'copyMove' : 'move';
      event.dataTransfer.setData('text/plain', deviceId);
      setDragState({ deviceId, source });
    },
    [],
  );

  const handleDeviceDragEnd = useCallback(() => {
    setDragState(null);
    setActiveDropZone(null);
  }, []);

  const handleDropZoneDragOver = useCallback((zone: DeviceZone, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setActiveDropZone(zone);
  }, []);

  const handleDropZoneLeave = useCallback((zone: DeviceZone) => {
    setActiveDropZone((current) => (current === zone ? null : current));
  }, []);

  const handleDropZoneDrop = useCallback(
    (zone: DeviceZone, event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const rawDeviceId = event.dataTransfer.getData('text/plain').trim();
      const deviceId = isDeviceId(rawDeviceId) ? rawDeviceId : dragState?.deviceId;
      if (!deviceId) return;

      placeDeviceInZone(deviceId, zone);
      setDragState(null);
      setActiveDropZone(null);
    },
    [dragState, placeDeviceInZone],
  );

  const renderHardwareJack = (portId: string, isActive: boolean) => {
    const pos = RELAY_PORTS[portId];
    return (
      <Group key={`jack-${portId}`} x={pos.x} y={pos.y}>
        <Circle radius={7} fill="#bdc3c7" stroke="#34495e" strokeWidth={1} listening={false} />
        <Circle
          id={portId}
          radius={8}
          fill={pos.color}
          stroke={isActive ? '#ffffff' : '#000000'}
          strokeWidth={isActive ? 2 : 1}
          shadowColor="rgba(0,0,0,0.4)" shadowBlur={3} shadowOffsetY={2}
          onMouseDown={() => handlePortMouseDown(portId)}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'crosshair';

            if (hoverRingRef.current && !activePin) {
              hoverRingRef.current.position({ x: pos.x, y: pos.y });
              hoverRingRef.current.visible(true);
              hoverRingRef.current.getLayer()?.batchDraw();
            }

            if (!activePin && pos.desc.trim()) showTooltip(pos.x, pos.y, pos.desc);
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'default';

            if (hoverRingRef.current) {
              hoverRingRef.current.visible(false);
              hoverRingRef.current.getLayer()?.batchDraw();
            }

            hideTooltip();
          }}
        />
        <Circle radius={4} fill="#000000" listening={false} />
      </Group>
    );
  };

  const renderDeviceDropZone = (zone: DeviceZone, title: string) => {
    const devices = assignedDevices[zone];
    const isActive = activeDropZone === zone;

    return (
      <div
        onDragOver={(event) => handleDropZoneDragOver(zone, event)}
        onDragLeave={() => handleDropZoneLeave(zone)}
        onDrop={(event) => handleDropZoneDrop(zone, event)}
        className={`min-h-[140px] rounded-2xl border border-dashed p-4 transition-colors ${isActive ? 'border-cyan-500 bg-cyan-50/60 dark:border-cyan-400 dark:bg-cyan-500/10' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/60'}`}
      >
        <h5 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h5>

        {devices.length === 0 ? (
          <p className="mt-4 text-[12px] font-medium text-slate-500 dark:text-slate-400">Drag devices here</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {devices.map((deviceId) => {
              const device = getDeviceById(deviceId);

              return (
                <div
                  key={`${zone}-${device.id}`}
                  draggable
                  onDragStart={(event) => handleDeviceDragStart(device.id, zone, event)}
                  onDragEnd={handleDeviceDragEnd}
                  className="group flex cursor-grab items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 shadow-sm transition-colors hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-800/90"
                >
                  <img src={device.image} alt={device.name} className="h-9 w-9 rounded-lg bg-white p-1.5 object-contain dark:bg-slate-900" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold leading-4 text-slate-700 dark:text-slate-200">{device.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDeviceFromZones(device.id)}
                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-500 transition-colors hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-red-500/40 dark:hover:text-red-400"
                    aria-label={`Remove ${device.name}`}
                    title={`Remove ${device.name}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <PortraitGuard>
      <CyberTransition>
        <div className={`flex flex-col h-screen w-screen text-slate-800 dark:text-slate-200 font-sans overflow-hidden select-none transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0B1120]' : 'bg-slate-50'}`}>
          <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shadow-md relative">
            <div className="flex items-center gap-4">
              <button onClick={handleBackNavigation} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-cyan-400 rounded-lg transition-colors shadow-sm" title="Abort Sequence"><ArrowLeft size={20} /></button>
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
                  <select value={wireColor} onChange={(e) => setWireColor(e.target.value)} className="bg-transparent text-xs text-slate-900 dark:text-white font-bold outline-none border-none cursor-pointer py-1">
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

          <main className="relative flex-1 flex flex-row w-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-950" ref={containerRef}>
            <aside className="w-[360px] flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg transition-colors duration-300">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <h2 className="font-black text-slate-900 dark:text-white text-[1.35rem]">Controls</h2>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
                <section className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                  <h4 className="text-[1.05rem] font-black text-slate-900 dark:text-white">List of Devices to Use</h4>
                  <div className="mt-4 space-y-3">
                    {renderDeviceDropZone('input', 'Input Device')}
                    {renderDeviceDropZone('output', 'Output/Control Device')}
                  </div>
                </section>

                <section className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 flex flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-[1.05rem] font-black text-slate-900 dark:text-white">Ladder Diagram</h4>
                    <div
                      className={`inline-flex min-w-[56px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-black ${answerFeedback?.passed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                        }`}
                    >
                      {answerPercent}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col">
                    <p className="text-base font-black text-slate-900 dark:text-white">{activityPreset.title}</p>
                    <div className="mt-3 h-[220px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <img src={activityPreset.diagram} alt={activityPreset.title} className="h-full w-full rounded-xl object-contain" />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCheckAnswer}
                        className="rounded-xl bg-[#223a5a] px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#1a304d] dark:bg-cyan-600 dark:hover:bg-cyan-500"
                      >
                        Check Answer
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </aside>

            <div className="flex-1 relative flex items-center justify-center p-6">
              <div className="relative shadow-2xl rounded-lg border-4 border-slate-400 dark:border-slate-800 bg-[#e2e8f0] overflow-hidden flex items-center justify-center" style={{ width: BASE_CANVAS_WIDTH * canvasScale, height: BASE_CANVAS_HEIGHT * canvasScale }}>

                {!isCanvasReady ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <div className="w-10 h-10 border-4 border-slate-300 border-t-cyan-500 rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase animate-pulse">
                      Mounting Hardware Environment...
                    </p>
                  </div>
                ) : (
                  <Stage width={BASE_CANVAS_WIDTH * canvasScale} height={BASE_CANVAS_HEIGHT * canvasScale} onMouseMove={handleMouseMove} onMouseUp={handleStageMouseUp} onMouseLeave={handleStageMouseLeave}>
                    <RelayStaticBackground BASE_CANVAS_WIDTH={BASE_CANVAS_WIDTH} BASE_CANVAS_HEIGHT={BASE_CANVAS_HEIGHT} canvasScale={canvasScale} isDarkMode={isDarkMode} isMainSwitchOn={isMainSwitchOn} onToggleSwitch={handleToggleSwitch} />

                    <Layer scaleX={canvasScale} scaleY={canvasScale} id="interactive-wiring-layer">
                      {Object.entries(RELAY_PORTS).map(([id]) => renderHardwareJack(id, activePin === id))}

                      {wires.map((wire) => {
                        const isSelected = selectedWireId === wire.id;
                        return (
                          <Line
                            key={`wire-${wire.id}`}
                            points={wire.points}
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
                    </Layer>

                    {/* LAYER 3: Fast Overlay for Ghost Wire & Imperative Tooltips */}
                    <Layer scaleX={canvasScale} scaleY={canvasScale} id="overlay-layer" listening={false}>
                      <Line ref={ghostWireRef} stroke={wireColor} strokeWidth={4} dash={[10, 8]} opacity={0.6} tension={0.4} visible={false} />

                      {/* The Hover Ring trick! Never redraws the heavy layer! */}
                      <Circle ref={hoverRingRef} radius={9} stroke="#ffffff" strokeWidth={2} visible={false} />

                      <Group ref={tooltipRef} visible={false}>
                        <Rect ref={tooltipBgRef} height={0} width={0} fill="#1e293b" cornerRadius={4} />
                        <Text ref={tooltipTextRef} fill="#ffffff" fontSize={11} fontFamily={HW_STYLES.technicalMono} padding={6} />
                      </Group>
                    </Layer>
                  </Stage>
                )}
              </div>
            </div>

            <aside
              className="absolute inset-y-0 right-0 z-20 border-l border-slate-200 bg-white shadow-[-18px_0_30px_-22px_rgba(15,23,42,0.6)] transition-[width] duration-300 dark:border-slate-800 dark:bg-slate-900"
              style={{ width: isDeviceDrawerOpen ? DEVICE_DRAWER_OPEN_WIDTH : DEVICE_DRAWER_COLLAPSED_WIDTH }}
            >
              {isDeviceDrawerOpen ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-500 dark:text-cyan-500/70">Device Dock</p>
                      <h3 className="mt-1 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">List of Devices</h3>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Quick access to the installed trainer devices.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDeviceDrawerOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Collapse device drawer"
                      title="Collapse device drawer"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-3 gap-3">
                      {DEVICE_LIBRARY.map((device) => (
                        <button
                          key={device.name}
                          type="button"
                          draggable
                          onDragStart={(event) => handleDeviceDragStart(device.id, 'library', event)}
                          onDragEnd={handleDeviceDragEnd}
                          className="group flex min-h-[108px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-2 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-cyan-500/70"
                        >
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 p-2.5 dark:bg-slate-800/80">
                            <img src={device.image} alt={device.name} className="h-full w-full object-contain" />
                          </div>
                          <span className="mt-2.5 text-[10px] font-bold leading-4 text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white">
                            {device.name}
                          </span>
                          {assignedDeviceIds.has(device.id) ? (
                            <span className="mt-2 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                              In Use
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-between py-4">
                  <button
                    type="button"
                    onClick={() => setIsDeviceDrawerOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    aria-label="Expand device drawer"
                    title="Expand device drawer"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div
                    className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-500 dark:text-cyan-500/70"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    Devices
                  </div>

                  <div className="flex flex-col gap-2">
                    {DEVICE_LIBRARY.slice(0, 3).map((device) => (
                      <div key={device.name} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/80">
                        <img src={device.image} alt={device.name} className="h-full w-full object-contain" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </main>
        </div>
      </CyberTransition>
    </PortraitGuard>
  );
}
