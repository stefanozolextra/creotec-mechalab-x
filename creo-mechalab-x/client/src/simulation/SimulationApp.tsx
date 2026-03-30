import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stage, Layer, Circle, Line, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';

import { ArrowLeft, Play, Trash2, Undo2, Redo2, Sun, Moon, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import './SimulationApp.css';

import { RELAY_PORTS, HW_STYLES } from './constants/relayBoard';
import { RelayStaticBackground, type ManualRelayButtonId } from './components/RelayStaticBackground';
import { computeOrthogonalPath, type WireRoutingPoint } from './utils/wireRouting';
import { evaluateActivityAnswer, type ActivityEvaluationResult } from './utils/evaluateActivityAnswer';
import PortraitGuard from '../components/PortraitGuard';
import CyberTransition from '../components/CyberTransition';
import buttonDevice from '../assets/devices/button.png';
import buzzerDevice from '../assets/devices/buzzer.png';
import counterDevice from '../assets/devices/counter.png';
import lightIndicatorDevice from '../assets/devices/light-indicator.png';
import magneticContactorDevice from '../assets/devices/magnetic-motor-contactor.png';
import relayModuleDevice from '../assets/devices/relay-module.png';
import rollerLeverDevice from '../assets/devices/roller-lever.png';
import solenoidValveDevice from '../assets/devices/solenoid-valve.png';
import timerDevice from '../assets/devices/timer.jpg';
import { getActivityAnswerByRouteId, ACTIVITY_ANSWERS } from './constants/activityAnswers';

// M.A.X. DEPENDENCIES
import TutorialGuide, { type TutorialStep } from '../components/TutorialGuide';
import { getAuthRole } from '../utils/auth'; // <-- IMPORTED GOD MODE UTILITY

interface Connection { id: string; fromPin: string; toPin: string; color: string; points: number[]; }
interface SimulationAppProps { routeId?: string; simulationId?: number; initialCompletedRoutes?: string[]; onNavigateBack?: () => void; }
type Activity2LampMode = 'off' | 'green' | 'red';
type Activity3LampMode = 'off' | 'green' | 'yellow';
type Activity4LampMode = 'off' | 'green' | 'yellow';
type Activity5TimerStatus = 'idle' | 'timing' | 'done';

const flattenWirePath = (points: WireRoutingPoint[]) => points.flatMap(({ x, y }) => [x, y]);

const routeConnections = (connections: Connection[]) => {
  const occupiedPaths: WireRoutingPoint[][] = [];

  return connections.map((connection) => {
    const path = computeOrthogonalPath(connection.fromPin, connection.toPin, RELAY_PORTS, occupiedPaths);
    occupiedPaths.push(path);

    return {
      ...connection,
      points: flattenWirePath(path),
    };
  });
};

const DEFAULT_ACTIVITY5_TIMER_DELAY_SECONDS = 2;
const TIMER_WIDGET_BOUNDS = { x: 675, y: 455, width: 85, height: 95 };

const formatActivity5TimerDisplay = (seconds: number) => Math.max(0, seconds).toFixed(2).padStart(5, '0');

const DEVICE_LIBRARY = [
  { id: 'push-button', name: 'Push Button', image: buttonDevice },
  { id: 'buzzer', name: 'Buzzer', image: buzzerDevice },
  { id: 'counter', name: 'Counter', image: counterDevice },
  { id: 'light-indicator', name: 'Light Indicator', image: lightIndicatorDevice },
  { id: 'magnetic-contactor', name: 'Magnetic Contactor', image: magneticContactorDevice },
  { id: 'relay-module', name: 'Relay Module', image: relayModuleDevice },
  { id: 'roller-lever', name: 'Roller Lever', image: rollerLeverDevice },
  { id: 'solenoid-valve', name: 'Solenoid Valve', image: solenoidValveDevice },
  { id: 'timer', name: 'Timer', image: timerDevice },
] as const;

type DeviceId = (typeof DEVICE_LIBRARY)[number]['id'];
type DeviceZone = 'input' | 'output';
type DeviceDragState = { deviceId: DeviceId; source: DeviceZone | 'library' } | null;

const isDeviceId = (value: string): value is DeviceId => DEVICE_LIBRARY.some((device) => device.id === value);
const getDeviceById = (deviceId: DeviceId) => DEVICE_LIBRARY.find((device) => device.id === deviceId) ?? DEVICE_LIBRARY[0];
const toWireKey = (fromPin: string, toPin: string) => [fromPin, toPin].sort().join('|');
const isWireIssue = (issue: string) => issue.startsWith('Add at least ') || issue.startsWith('Missing required connection:') || issue.startsWith('Missing one required connection option:');

const INITIAL_MANUAL_RELAY_BUTTON_STATE: Record<ManualRelayButtonId, boolean> = {
  'start-1': false, 'start-2': false, 'stop-1': false, 'stop-2': false, 'emergency-stop': false,
};

const STORAGE_KEY = 'creosim_simulation_states';

export default function SimulationApp({ routeId, simulationId, initialCompletedRoutes = [], onNavigateBack }: SimulationAppProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const activityPreset = getActivityAnswerByRouteId(routeId);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isDeviceDrawerOpen, setIsDeviceDrawerOpen] = useState(true);

  const [savedStates, setSavedStates] = useState<Record<string, { wires: Connection[], assignedDevices: Record<DeviceZone, DeviceId[]> }>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [assignedDevices, setAssignedDevices] = useState<Record<DeviceZone, DeviceId[]>>(() => {
    const saved = savedStates[activityPreset.routeId];
    return saved ? saved.assignedDevices : { input: [], output: [] };
  });

  const [dragState, setDragState] = useState<DeviceDragState>(null);
  const [activeDropZone, setActiveDropZone] = useState<DeviceZone | null>(null);

  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [dbCompletedRoutes] = useState<Set<string>>(new Set(initialCompletedRoutes));

  useEffect(() => {
    const timer = setTimeout(() => setIsCanvasReady(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const [isMainSwitchOn, setIsMainSwitchOn] = useState(false);
  const [pressedManualButtons, setPressedManualButtons] = useState<Record<ManualRelayButtonId, boolean>>(INITIAL_MANUAL_RELAY_BUTTON_STATE);
  const [isActivity1GreenLampLatched, setIsActivity1GreenLampLatched] = useState(false);
  const [activity2LampMode, setActivity2LampMode] = useState<Activity2LampMode>('off');
  const [activity3LampMode, setActivity3LampMode] = useState<Activity3LampMode>('off');
  const [activity4LampMode, setActivity4LampMode] = useState<Activity4LampMode>('off');
  const [activity5RelayEnergized, setActivity5RelayEnergized] = useState(false);
  const [activity5TimerStatus, setActivity5TimerStatus] = useState<Activity5TimerStatus>('idle');
  const [activity5TimerDelayInput, setActivity5TimerDelayInput] = useState(String(DEFAULT_ACTIVITY5_TIMER_DELAY_SECONDS));
  const [activity5TimerRemainingMs, setActivity5TimerRemainingMs] = useState<number | null>(null);
  const [isActivity5TimerPopupOpen, setIsActivity5TimerPopupOpen] = useState(false);
  const [wires, setWires] = useState<Connection[]>(() => {
    const saved = savedStates[activityPreset.routeId];
    return saved ? routeConnections(saved.wires) : [];
  });
  const [wireColor, setWireColor] = useState<string>('#e74c3c');
  const [activePin, setActivePin] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [answerFeedbackState, setAnswerFeedbackState] = useState<{ signature: string; result: ActivityEvaluationResult; } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedStates));
  }, [savedStates]);

  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  const ghostWireRef = useRef<Konva.Line>(null);
  const hoverRingRef = useRef<Konva.Circle>(null);
  const tooltipRef = useRef<Konva.Group>(null);
  const tooltipBgRef = useRef<Konva.Rect>(null);
  const tooltipTextRef = useRef<Konva.Text>(null);

  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const activity5TimerTimeoutRef = useRef<number | null>(null);
  const activity5TimerIntervalRef = useRef<number | null>(null);
  const activity5TimerTriggerRef = useRef<HTMLButtonElement>(null);
  const activity5TimerPopupRef = useRef<HTMLDivElement>(null);

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
  const activity5TimerDelaySeconds = useMemo(() => {
    const parsedValue = Number.parseFloat(activity5TimerDelayInput);
    return Number.isFinite(parsedValue) && parsedValue >= 0
      ? parsedValue
      : DEFAULT_ACTIVITY5_TIMER_DELAY_SECONDS;
  }, [activity5TimerDelayInput]);

  const routeKeys = Object.keys(ACTIVITY_ANSWERS);
  const currentIndex = routeKeys.indexOf(activityPreset.routeId);
  const nextRouteId = currentIndex !== -1 && currentIndex < routeKeys.length - 1 ? routeKeys[currentIndex + 1] : null;

  // 🌟 GOD MODE OVERRIDE 🌟
  // Instead of strictly locking the board when a saved state exists, 
  // we check if the user is a developer. If they are, the board NEVER locks!
  const isSessionCompleted = getAuthRole() === 'developer' ? false : !!savedStates[activityPreset.routeId];

  const clearActivity5TimerTimeout = useCallback(() => {
    if (activity5TimerTimeoutRef.current !== null) {
      window.clearTimeout(activity5TimerTimeoutRef.current);
      activity5TimerTimeoutRef.current = null;
    }
  }, []);

  const clearActivity5TimerInterval = useCallback(() => {
    if (activity5TimerIntervalRef.current !== null) {
      window.clearInterval(activity5TimerIntervalRef.current);
      activity5TimerIntervalRef.current = null;
    }
  }, []);

  const resetActivity5Runtime = useCallback(() => {
    clearActivity5TimerTimeout();
    clearActivity5TimerInterval();
    setActivity5RelayEnergized(false);
    setActivity5TimerStatus('idle');
    setActivity5TimerRemainingMs(null);
  }, [clearActivity5TimerInterval, clearActivity5TimerTimeout]);

  useEffect(() => () => {
    clearActivity5TimerTimeout();
    clearActivity5TimerInterval();
  }, [clearActivity5TimerInterval, clearActivity5TimerTimeout]);

  useEffect(() => {
    const handleResize = () => { if (containerRef.current) setViewport({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => { const newMode = !isDarkMode; setIsDarkMode(newMode); document.documentElement.classList.toggle('dark', newMode); };

  const handleToggleSwitch = useCallback(() => {
    const nextIsMainSwitchOn = !isMainSwitchOn;
    setIsMainSwitchOn(nextIsMainSwitchOn);
    if (!nextIsMainSwitchOn) {
      setIsActivity1GreenLampLatched(false);
      setActivity2LampMode('off');
      setActivity3LampMode('off');
      setActivity4LampMode('off');
      resetActivity5Runtime();
      return;
    }

    if (activityPreset.routeId === '3') {
      setActivity3LampMode('yellow');
    }
  }, [activityPreset.routeId, isMainSwitchOn, resetActivity5Runtime]);

  const handleActivity5TimerDelayChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setActivity5TimerDelayInput(event.target.value);
  }, []);

  const handleActivity5TimerDelayBlur = useCallback(() => {
    const parsedValue = Number.parseFloat(activity5TimerDelayInput);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      setActivity5TimerDelayInput(String(DEFAULT_ACTIVITY5_TIMER_DELAY_SECONDS));
      return;
    }

    setActivity5TimerDelayInput(String(parsedValue));
  }, [activity5TimerDelayInput]);

  const handleManualButtonPressChange = useCallback((buttonId: ManualRelayButtonId, isPressed: boolean) => {
    setPressedManualButtons((prev) => (
      prev[buttonId] === isPressed ? prev : { ...prev, [buttonId]: isPressed }
    ));

    if (!isPressed) return;

    const isCurrentSetupValid = evaluateActivityAnswer(activityPreset, {
      inputDeviceIds: assignedDevices.input,
      outputDeviceIds: assignedDevices.output,
      wires: wires.map(({ fromPin, toPin }) => ({ fromPin, toPin })),
    }).passed;

    if (activityPreset.routeId === '1' && (buttonId === 'stop-1' || buttonId === 'emergency-stop')) {
      setIsActivity1GreenLampLatched(false);
      return;
    }

    if (activityPreset.routeId === '2') {
      if (buttonId === 'stop-1' || buttonId === 'emergency-stop') {
        setActivity2LampMode(isMainSwitchOn && isCurrentSetupValid ? 'red' : 'off');
        return;
      }
      if (buttonId === 'start-1' && isMainSwitchOn && isCurrentSetupValid) {
        setActivity2LampMode('green');
      }
      return;
    }

    if (activityPreset.routeId === '3') {
      if (buttonId === 'stop-1' || buttonId === 'stop-2' || buttonId === 'emergency-stop') {
        setActivity3LampMode('off');
        return;
      }

      if (!isMainSwitchOn || !isCurrentSetupValid) return;

      if (buttonId === 'start-1') {
        setActivity3LampMode('green');
        return;
      }

      if (buttonId === 'start-2') {
        setActivity3LampMode('yellow');
      }
      return;
    }

    if (activityPreset.routeId === '4') {
      if (buttonId === 'stop-1' || buttonId === 'emergency-stop') {
        setActivity4LampMode(isMainSwitchOn && isCurrentSetupValid ? 'yellow' : 'off');
        return;
      }

      if ((buttonId === 'start-1' || buttonId === 'start-2') && isMainSwitchOn && isCurrentSetupValid) {
        setActivity4LampMode('green');
      }
      return;
    }

    if (activityPreset.routeId === '5') {
      if (buttonId === 'stop-1' || buttonId === 'emergency-stop') {
        resetActivity5Runtime();
        return;
      }

      if (buttonId === 'start-1' && isMainSwitchOn && isCurrentSetupValid) {
        setActivity5RelayEnergized(true);

        if (activity5TimerStatus !== 'idle') {
          return;
        }

        clearActivity5TimerTimeout();
        clearActivity5TimerInterval();
        const delayMs = Math.max(0, activity5TimerDelaySeconds * 1000);

        if (delayMs === 0) {
          setActivity5TimerRemainingMs(0);
          setActivity5TimerStatus('done');
          return;
        }

        setActivity5TimerRemainingMs(delayMs);
        setActivity5TimerStatus('timing');
        const deadlineMs = Date.now() + delayMs;
        activity5TimerIntervalRef.current = window.setInterval(() => {
          const remainingMs = Math.max(0, deadlineMs - Date.now());
          setActivity5TimerRemainingMs(remainingMs);

          if (remainingMs === 0) {
            clearActivity5TimerInterval();
          }
        }, 50);
        activity5TimerTimeoutRef.current = window.setTimeout(() => {
          clearActivity5TimerInterval();
          activity5TimerTimeoutRef.current = null;
          setActivity5TimerRemainingMs(0);
          setActivity5TimerStatus('done');
        }, delayMs);
      }
      return;
    }

    if (buttonId !== 'start-1' || !isMainSwitchOn) return;

    if (activityPreset.routeId === '1' && isCurrentSetupValid) {
      setIsActivity1GreenLampLatched(true);
    }
  }, [activity5TimerDelaySeconds, activity5TimerStatus, activityPreset, assignedDevices.input, assignedDevices.output, clearActivity5TimerInterval, clearActivity5TimerTimeout, isMainSwitchOn, resetActivity5Runtime, wires]);

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

  const getPinWireCount = useCallback(
    (pinId: string) => wires.filter((wire) => wire.fromPin === pinId || wire.toPin === pinId).length,
    [wires],
  );
  const isPinAtCapacity = useCallback((pinId: string) => getPinWireCount(pinId) >= 2, [getPinWireCount]);

  const handlePortMouseDown = (portId: string) => {
    if (isSessionCompleted) return;
    if (selectedWireId) { setSelectedWireId(null); return; }
    if (isPinAtCapacity(portId)) return;
    setActivePin(portId);
    hideTooltip();

    if (hoverRingRef.current) {
      hoverRingRef.current.visible(false);
    }

    if (ghostWireRef.current) {
      const start = RELAY_PORTS[portId];
      ghostWireRef.current.points([start.x, start.y, start.x, start.y]);
      ghostWireRef.current.visible(true);
      ghostWireRef.current.getLayer()?.batchDraw();
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
        if (currentPos && ghostWireRef.current) {
          const startPos = RELAY_PORTS[activePin];
          ghostWireRef.current.points([startPos.x, startPos.y, currentPos.x, currentPos.y]);
          ghostWireRef.current.getLayer()?.batchDraw();
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
        const isTargetAtCapacity = isPinAtCapacity(targetPin);
        if (!isDuplicate && !isTargetAtCapacity && !isPinAtCapacity(activePin)) {
          setWires(prev => {
            const next = routeConnections([
              ...prev,
              { id: crypto.randomUUID(), fromPin: activePin, toPin: targetPin, color: wireColor, points: [] },
            ]);
            setHistoryPast(hp => [...hp, prev].slice(-50));
            setHistoryFuture([]);
            return next;
          });
        }
      }
      setActivePin(null);
      if (ghostWireRef.current) {
        ghostWireRef.current.visible(false);
        ghostWireRef.current.getLayer()?.batchDraw();
      }
    }
  };

  const handleStageMouseLeave = () => {
    if (activePin) {
      setActivePin(null);
      if (ghostWireRef.current) {
        ghostWireRef.current.visible(false);
        ghostWireRef.current.getLayer()?.batchDraw();
      }
    }
  };

  const deleteSelectedWire = useCallback(() => {
    if (isSessionCompleted || !selectedWireId) return;
    setWires((prev) => {
      const next = routeConnections(prev.filter((w) => w.id !== selectedWireId));
      setHistoryPast((hp) => [...hp, prev].slice(-50));
      setHistoryFuture([]);
      return next;
    });
    setSelectedWireId(null);
  }, [selectedWireId, isSessionCompleted]);

  const handleWireColorChange = useCallback((nextColor: string) => {
    if (isSessionCompleted) return;
    setWireColor(nextColor);
    if (!selectedWireId) return;

    setWires((prevWires) => {
      const targetWire = prevWires.find((wire) => wire.id === selectedWireId);
      if (!targetWire || targetWire.color === nextColor) {
        return prevWires;
      }

      setHistoryPast((hp) => [...hp, prevWires].slice(-50));
      setHistoryFuture([]);
      return routeConnections(prevWires.map((wire) =>
        wire.id === selectedWireId ? { ...wire, color: nextColor } : wire,
      ));
    });
  }, [selectedWireId, isSessionCompleted]);

  const handleUndo = () => { if (isSessionCompleted || !historyPast.length) return; const previous = historyPast[historyPast.length - 1]; setHistoryPast((prev) => prev.slice(0, -1)); setHistoryFuture((prev) => [wires, ...prev]); setWires(routeConnections(previous)); };
  const handleRedo = () => { if (isSessionCompleted || !historyFuture.length) return; const next = historyFuture[0]; setHistoryFuture((prev) => prev.slice(1)); setHistoryPast((prev) => [...prev, wires]); setWires(routeConnections(next)); };

  const handleResetBoard = () => {
    if (isSessionCompleted) return;
    setHistoryPast(prev => [...prev, wires].slice(-50));
    setHistoryFuture([]);
    setWires([]);
    setSelectedWireId(null);
    setActivePin(null);
    setIsMainSwitchOn(false);
    setPressedManualButtons(INITIAL_MANUAL_RELAY_BUTTON_STATE);
    setIsActivity1GreenLampLatched(false);
    setActivity2LampMode('off');
    setActivity3LampMode('off');
    setActivity4LampMode('off');
    resetActivity5Runtime();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const eventTarget = e.target;
      if (eventTarget instanceof HTMLElement) {
        const tagName = eventTarget.tagName;
        if (eventTarget.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedWire();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelectedWire]);

  useEffect(() => {
    if (!isActivity5TimerPopupOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const eventTarget = event.target;
      if (!(eventTarget instanceof Node)) {
        return;
      }

      if (activity5TimerPopupRef.current?.contains(eventTarget) || activity5TimerTriggerRef.current?.contains(eventTarget)) {
        return;
      }

      setIsActivity5TimerPopupOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsActivity5TimerPopupOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActivity5TimerPopupOpen]);

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

  const answerFeedback = answerFeedbackState?.signature === answerSignature ? answerFeedbackState.result : null;
  const answerPercent = answerFeedback?.passed ? '100%' : '0%';
  const wrongWireKeySet = useMemo(
    () => new Set((answerFeedback?.wrongConnections ?? []).map(({ fromPin, toPin }) => toWireKey(fromPin, toPin))),
    [answerFeedback],
  );
  const activityEvaluationPreview = useMemo(
    () => evaluateActivityAnswer(activityPreset, {
      inputDeviceIds: assignedDevices.input,
      outputDeviceIds: assignedDevices.output,
      wires: wires.map(({ fromPin, toPin }) => ({ fromPin, toPin })),
    }),
    [activityPreset, assignedDevices, wires],
  );
  const routedWires = useMemo(() => routeConnections(wires), [wires]);

  const isActivity1GreenLampOn = activityPreset.routeId === '1' && isMainSwitchOn && activityEvaluationPreview.passed && isActivity1GreenLampLatched;
  const isActivity2GreenLampOn = activityPreset.routeId === '2' && isMainSwitchOn && activityEvaluationPreview.passed && activity2LampMode === 'green';
  const isActivity2RedLampOn = activityPreset.routeId === '2' && isMainSwitchOn && activityEvaluationPreview.passed && activity2LampMode === 'red';
  const isActivity3GreenLampOn = activityPreset.routeId === '3' && isMainSwitchOn && activityEvaluationPreview.passed && activity3LampMode === 'green';
  const isActivity3YellowLampOn = activityPreset.routeId === '3' && isMainSwitchOn && activityEvaluationPreview.passed && activity3LampMode === 'yellow';
  const isActivity4GreenLampOn = activityPreset.routeId === '4' && isMainSwitchOn && activityEvaluationPreview.passed && activity4LampMode === 'green';
  const isActivity4YellowLampOn = activityPreset.routeId === '4' && isMainSwitchOn && activityEvaluationPreview.passed && activity4LampMode === 'yellow';
  const isActivity5GreenLampOn = activityPreset.routeId === '5' && isMainSwitchOn && activityEvaluationPreview.passed && activity5TimerStatus === 'done';
  const isActivity5YellowLampOn = activityPreset.routeId === '5' && isMainSwitchOn && activityEvaluationPreview.passed && activity5TimerStatus !== 'done';
  const activity5TimerDisplayText = activityPreset.routeId !== '5'
    ? '00.00'
    : activity5TimerStatus === 'done'
      ? '00.00'
      : activity5TimerStatus === 'timing'
        ? formatActivity5TimerDisplay((activity5TimerRemainingMs ?? 0) / 1000)
        : formatActivity5TimerDisplay(activity5TimerDelaySeconds);
  const activity5TimerStatusLabel = activity5TimerStatus === 'idle'
    ? 'Idle / Reset'
    : activity5TimerStatus === 'timing'
      ? 'Timing'
      : 'Delay Complete';

  const hasNoSelectedDevices = !assignedDevices.input.length && !assignedDevices.output.length;
  const shouldShowOnlyNoDeviceMessage = Boolean(answerFeedback && !answerFeedback.passed && hasNoSelectedDevices);
  const shouldShowOnlyWrongWireMessage = Boolean(answerFeedback && !answerFeedback.passed && !shouldShowOnlyNoDeviceMessage && answerFeedback.wrongConnections.length);
  const shouldShowOnlyMissingWireMessage = Boolean(answerFeedback && !answerFeedback.passed && !shouldShowOnlyNoDeviceMessage && !shouldShowOnlyWrongWireMessage && answerFeedback.issues.length && answerFeedback.issues.every(isWireIssue));

  const placeDeviceInZone = useCallback((deviceId: DeviceId, zone: DeviceZone) => {
    setAssignedDevices((previous) => {
      const nextInput = previous.input.filter((entry) => entry !== deviceId);
      const nextOutput = previous.output.filter((entry) => entry !== deviceId);
      if (zone === 'input') return { input: [...nextInput, deviceId], output: nextOutput };
      return { input: nextInput, output: [...nextOutput, deviceId] };
    });
  }, []);

  const removeDeviceFromZones = useCallback((deviceId: DeviceId) => {
    if (isSessionCompleted) return;
    setAssignedDevices((previous) => ({
      input: previous.input.filter((entry) => entry !== deviceId),
      output: previous.output.filter((entry) => entry !== deviceId),
    }));
  }, [isSessionCompleted]);

  const handleCheckAnswer = useCallback(() => {
    const result = evaluateActivityAnswer(activityPreset, {
      inputDeviceIds: assignedDevices.input,
      outputDeviceIds: assignedDevices.output,
      wires: wires.map(({ fromPin, toPin }) => ({ fromPin, toPin })),
    });

    setAnswerFeedbackState({ signature: answerSignature, result });

    if (result.passed) {
      setSavedStates((prev) => ({
        ...prev,
        [activityPreset.routeId]: { wires: routedWires, assignedDevices },
      }));
      setShowSuccessAnim(true);
      setTimeout(() => setShowSuccessAnim(false), 2500);
    }
  }, [activityPreset, answerSignature, assignedDevices, routedWires, wires]);

  const handleDeviceDragStart = useCallback(
    (deviceId: DeviceId, source: DeviceZone | 'library', event: DragEvent<HTMLElement>) => {
      if (isSessionCompleted) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = source === 'library' ? 'copyMove' : 'move';
      event.dataTransfer.setData('text/plain', deviceId);
      setDragState({ deviceId, source });
    },
    [isSessionCompleted],
  );

  const handleDeviceDragEnd = useCallback(() => {
    setDragState(null);
    setActiveDropZone(null);
  }, []);

  const handleDropZoneDragOver = useCallback((zone: DeviceZone, event: DragEvent<HTMLDivElement>) => {
    if (isSessionCompleted) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setActiveDropZone(zone);
  }, [isSessionCompleted]);

  const handleDropZoneLeave = useCallback((zone: DeviceZone) => {
    if (isSessionCompleted) return;
    setActiveDropZone((current) => (current === zone ? null : current));
  }, [isSessionCompleted]);

  const handleDropZoneDrop = useCallback(
    (zone: DeviceZone, event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (isSessionCompleted) return;

      const rawDeviceId = event.dataTransfer.getData('text/plain').trim();
      const deviceId = isDeviceId(rawDeviceId) ? rawDeviceId : dragState?.deviceId;
      if (!deviceId) return;

      placeDeviceInZone(deviceId, zone);
      setDragState(null);
      setActiveDropZone(null);
    },
    [dragState, placeDeviceInZone, isSessionCompleted],
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
            if (stage) stage.container().style.cursor = isSessionCompleted ? 'default' : 'crosshair';

            const shouldPreviewPin = activePin !== portId;

            if (hoverRingRef.current && shouldPreviewPin && !isSessionCompleted) {
              hoverRingRef.current.position({ x: pos.x, y: pos.y });
              hoverRingRef.current.visible(true);
              hoverRingRef.current.getLayer()?.batchDraw();
            }

            if (shouldPreviewPin && pos.desc.trim()) showTooltip(pos.x, pos.y, pos.desc);
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
    const isActive = activeDropZone === zone && !isSessionCompleted;

    return (
      <div
        onDragOver={(event) => handleDropZoneDragOver(zone, event)}
        onDragLeave={() => handleDropZoneLeave(zone)}
        onDrop={(event) => handleDropZoneDrop(zone, event)}
        className={`min-h-[86px] rounded-2xl border border-dashed p-3 transition-colors ${isActive ? 'border-cyan-500 bg-cyan-50/60 dark:border-cyan-400 dark:bg-cyan-500/10' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/60'}`}
      >
        <h5 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h5>

        {devices.length === 0 ? (
          <p className="mt-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">Drag devices here</p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {devices.map((deviceId) => {
              const device = getDeviceById(deviceId);

              return (
                <div
                  key={`${zone}-${device.id}`}
                  draggable={!isSessionCompleted}
                  onDragStart={(event) => handleDeviceDragStart(device.id, zone, event)}
                  onDragEnd={handleDeviceDragEnd}
                  className={`group relative flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800 h-12 w-12 ${isSessionCompleted ? 'cursor-default' : 'cursor-grab hover:border-cyan-400 dark:hover:border-cyan-500'}`}
                  title={device.name}
                >
                  <img src={device.image} alt={device.name} className="h-full w-full object-contain" />

                  {!isSessionCompleted && (
                    <button
                      type="button"
                      onClick={() => removeDeviceFromZones(device.id)}
                      className="absolute -top-1.5 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-black text-slate-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                      aria-label={`Remove ${device.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const isNodeCompletedInDB = dbCompletedRoutes.has(activityPreset.routeId);
  const canProceedToNext = isSessionCompleted || isNodeCompletedInDB || answerFeedback?.passed;

  // TUTORIAL STEPS
  const tutorialSteps: TutorialStep[] = [
    { message: "Welcome to the Electro-Pneumatic Simulation Environment. This is your interactive workbench." },
    { targetId: "tour-sim-controls", message: "This panel contains your active schematic, validation controls, and Drop Zones for placing devices." },
    { targetId: "tour-sim-toolbox", message: "Your Device Library is located here. Drag and drop sensors, relays, and switches into the appropriate Drop Zones." },
    { targetId: "tour-sim-workspace", message: "This is the main routing board. Once devices are placed, click the terminal pins to route electrical wires according to your schematic." },
    { targetId: "tour-sim-hud", message: "Use this HUD to track your progress and navigate between activities. Proceed when ready." }
  ];

  return (
    <PortraitGuard>
      <CyberTransition>
        <div className={`flex flex-col h-screen w-screen text-slate-800 dark:text-slate-200 font-sans overflow-hidden select-none transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0B1120]' : 'bg-slate-50'}`}>
          <style>{`
            @keyframes popIn {
              0% { transform: scale(0.8); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-pop-in {
              animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>

          <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shadow-md relative">
            <div className="flex items-center gap-4">
              <button onClick={handleBackNavigation} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-cyan-400 rounded-lg transition-colors shadow-sm" title="Abort Sequence"><ArrowLeft size={20} /></button>
              <div>
                <h1 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2"><Play size={16} className="text-cyan-600 dark:text-cyan-500" /> Laboratory Sequence</h1>
                <p className="text-[10px] text-slate-500 dark:text-cyan-500/70 font-mono tracking-widest uppercase">Target: Electro-Pneumatic Trainer • Task: {activityPreset.title || routeId || 'Default'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {(canProceedToNext) && nextRouteId && (
                <button
                  type="button"
                  onClick={() => navigate(`/simulation/${nextRouteId}`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-[pulse_2s_infinite] mr-2"
                >
                  Next Activity <ChevronRight size={16} strokeWidth={3} />
                </button>
              )}

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-inner">
                <button onClick={deleteSelectedWire} disabled={!selectedWireId || isSessionCompleted} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 disabled:opacity-30 rounded-lg" title="Delete Selected Wire"><Trash2 size={16} /></button>
                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                <button onClick={handleUndo} disabled={!historyPast.length || isSessionCompleted} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 rounded-lg" title="Undo"><Undo2 size={16} /></button>
                <button onClick={handleRedo} disabled={!historyFuture.length || isSessionCompleted} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 rounded-lg" title="Redo"><Redo2 size={16} /></button>
                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                <div className="px-2 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shadow-inner border border-slate-400" style={{ backgroundColor: wireColor }} />
                  <select value={wireColor} onChange={(e) => handleWireColorChange(e.target.value)} disabled={isSessionCompleted} className="bg-transparent text-xs text-slate-900 dark:text-white font-bold outline-none border-none cursor-pointer py-1 disabled:opacity-50">
                    <option value="#e74c3c" className="bg-white dark:bg-slate-900">24V Red</option>
                    <option value="#111827" className="bg-white dark:bg-slate-900">0V Black</option>
                    <option value="#3498db" className="bg-white dark:bg-slate-900">Signal Blue</option>
                    <option value="#f1c40f" className="bg-white dark:bg-slate-900">Signal Yellow</option>
                    <option value="#27ae60" className="bg-white dark:bg-slate-900">Earth Green</option>
                  </select>
                </div>
              </div>
              <button type="button" onClick={handleResetBoard} disabled={isSessionCompleted} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 transition-colors shadow-sm disabled:opacity-50">
                <RefreshCw size={16} strokeWidth={2.5} /> <span className="hidden xl:inline">Clear Board</span>
              </button>
              <button type="button" onClick={toggleTheme} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-cyan-400 rounded-xl border border-slate-300 dark:border-slate-700 transition-all shadow-sm">
                {isDarkMode ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </header>

          <main className="relative flex-1 flex flex-row w-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-950" ref={containerRef}>

            {/* ADD ID HERE */}
            <aside id="tour-sim-controls" className="w-[360px] flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg transition-colors duration-300">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <h2 className="font-black text-slate-900 dark:text-white text-[1.35rem]">Controls</h2>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
                <section className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                  <h4 className="text-[1.05rem] font-black text-slate-900 dark:text-white">List of Devices to Use</h4>
                  <div className="mt-3 space-y-3">
                    {renderDeviceDropZone('input', 'Input Device')}
                    {renderDeviceDropZone('output', 'Output/Control Device')}
                  </div>
                </section>

                {activityPreset.routeId === '5' && (
                  <section className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-[1.05rem] font-black text-slate-900 dark:text-white">Timer Runtime</h4>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Click the TIMER/CTR device for runtime and setup. T1 runs as an on-delay timer after R1 latches.</p>
                      </div>
                      <div className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${activity5TimerStatus === 'done'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : activity5TimerStatus === 'timing'
                          ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                          : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300'
                        }`}>
                        {activity5TimerStatusLabel}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">R1</p>
                        <p className={`mt-1 text-sm font-black ${activity5RelayEnergized ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {activity5RelayEnergized ? 'ON' : 'OFF'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">T1</p>
                        <p className="mt-1 text-sm font-black text-slate-700 dark:text-slate-200">{activity5TimerStatusLabel}</p>
                        <p className="mt-1 font-mono text-[11px] font-black tracking-[0.18em] text-slate-500 dark:text-slate-400">{activity5TimerDisplayText}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Green</p>
                        <p className={`mt-1 text-sm font-black ${isActivity5GreenLampOn ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {isActivity5GreenLampOn ? 'ON' : 'OFF'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                        <p className="font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Yellow</p>
                        <p className={`mt-1 text-sm font-black ${isActivity5YellowLampOn ? 'text-amber-600 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {isActivity5YellowLampOn ? 'ON' : 'OFF'}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                <section className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 flex flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-[1.05rem] font-black text-slate-900 dark:text-white">Ladder Diagram</h4>
                    <div
                      className={`inline-flex min-w-[56px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-black ${isSessionCompleted || answerFeedback?.passed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                        }`}
                    >
                      {isSessionCompleted ? '100%' : answerPercent}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {isSessionCompleted ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 shadow-sm flex items-center justify-between">
                        <span className="font-black tracking-wide uppercase">Activity Cleared</span>
                        <CheckCircle2 size={20} className="text-emerald-500" strokeWidth={3} />
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleCheckAnswer}
                          className="rounded-xl bg-[#223a5a] px-4 py-3 text-sm font-black tracking-widest uppercase text-white shadow-sm transition-colors hover:bg-[#1a304d] dark:bg-cyan-600 dark:hover:bg-cyan-500 w-full"
                        >
                          Check Answer
                        </button>
                        {answerFeedback && (
                          <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${answerFeedback.passed
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                            }`}>
                            <p className="font-black">
                              {answerFeedback.passed ? 'Answer is correct.' : 'Answer is incorrect.'}
                            </p>
                            {shouldShowOnlyNoDeviceMessage && (
                              <p className="mt-1 text-xs font-semibold text-rose-500 dark:text-rose-300">
                                No input and output devices.
                              </p>
                            )}
                            {!shouldShowOnlyNoDeviceMessage && !answerFeedback.passed && answerFeedback.wrongConnections.length > 0 && (
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 dark:text-rose-300">
                                Red dashed wires are wrong connections.
                              </p>
                            )}
                            {shouldShowOnlyMissingWireMessage && (
                              <p className="mt-1 text-xs font-semibold text-rose-500 dark:text-rose-300">
                                Missing wires.
                              </p>
                            )}
                            {answerFeedback.issues.length > 0 && !shouldShowOnlyWrongWireMessage && !shouldShowOnlyNoDeviceMessage && !shouldShowOnlyMissingWireMessage && (
                              <div className="mt-3 space-y-1.5 text-xs leading-5">
                                {answerFeedback.issues.map((issue) => (
                                  <p key={issue}>{issue}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col">
                    <p className="text-base font-black text-slate-900 dark:text-white">{activityPreset.title}</p>
                    {activityPreset.instruction && (
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {activityPreset.instruction}
                      </p>
                    )}
                    <div className="mt-3 h-[220px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <img src={activityPreset.diagram} alt={activityPreset.title} className="h-full w-full rounded-xl object-contain" />
                    </div>
                  </div>
                </section>
              </div>
            </aside>

            <div className="flex-1 relative flex items-center justify-center p-6">

              {/* TOP NAVIGATION HUD - ADD ID HERE */}
              <div id="tour-sim-hud" className="absolute top-10 left-1/2 -translate-x-1/2 z-30 flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                {routeKeys.map((key, index) => {

                  // SMART NODE PARSING
                  const isNodeCompleted = !!savedStates[key] || dbCompletedRoutes.has(key);
                  const isCurrent = key === activityPreset.routeId;
                  const prevNodeKey = index > 0 ? routeKeys[index - 1] : null;
                  const prevCompleted = prevNodeKey ? (!!savedStates[prevNodeKey] || dbCompletedRoutes.has(prevNodeKey)) : true;

                  const isUnlocked = index === 0 || isNodeCompleted || isCurrent || prevCompleted;

                  const activityTitle = getActivityAnswerByRouteId(key).title;

                  let nodeClasses = "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ";

                  if (isNodeCompleted) {
                    nodeClasses += "bg-emerald-500 text-white ";
                    if (isCurrent) {
                      nodeClasses += "scale-110 shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900 cursor-default ";
                    } else {
                      nodeClasses += "hover:bg-emerald-400 shadow-sm cursor-pointer ";
                    }
                  } else if (isCurrent) {
                    nodeClasses += "bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)] scale-110 cursor-default ";
                  } else if (isUnlocked) {
                    nodeClasses += "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer shadow-sm ";
                  } else {
                    nodeClasses += "bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60 ";
                  }

                  return (
                    <div key={key} className="flex items-center">
                      {index > 0 && (
                        <div className={`w-8 h-1 mx-1 rounded-full ${prevCompleted ? 'bg-emerald-400 dark:bg-emerald-500/80' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      )}
                      <button
                        onClick={() => isUnlocked && !isCurrent && navigate(`/simulation/${key}`)}
                        disabled={!isUnlocked}
                        className={nodeClasses}
                        title={activityTitle}
                      >
                        {isNodeCompleted ? <CheckCircle2 size={16} strokeWidth={3} /> : index + 1}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="relative shadow-2xl rounded-lg border-4 border-slate-400 dark:border-slate-800 bg-[#e2e8f0] overflow-hidden flex items-center justify-center" style={{ width: BASE_CANVAS_WIDTH * canvasScale, height: BASE_CANVAS_HEIGHT * canvasScale }}>
                {isCanvasReady && activityPreset.routeId === '5' && (
                  <>
                    <button
                      ref={activity5TimerTriggerRef}
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={isActivity5TimerPopupOpen}
                      aria-label="Open timer runtime and setup"
                      title="Open timer runtime/setup"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsActivity5TimerPopupOpen((previous) => !previous);
                      }}
                      className={`absolute z-20 rounded-[8px] outline-none transition-all ${isActivity5TimerPopupOpen
                        ? 'bg-cyan-400/10 ring-2 ring-cyan-400/70'
                        : 'hover:bg-cyan-400/5'
                        }`}
                      style={{
                        left: TIMER_WIDGET_BOUNDS.x * canvasScale,
                        top: TIMER_WIDGET_BOUNDS.y * canvasScale,
                        width: TIMER_WIDGET_BOUNDS.width * canvasScale,
                        height: TIMER_WIDGET_BOUNDS.height * canvasScale,
                      }}
                    />

                {isActivity5TimerPopupOpen && (
                      <div
                        ref={activity5TimerPopupRef}
                        role="dialog"
                        aria-modal="false"
                        aria-label="Timer runtime and setup"
                        // Theme-aware container sizing and styling
                        className="absolute z-30 w-[240px] -translate-x-1/2 -translate-y-full rounded-xl border border-slate-300 bg-white/95 p-4 shadow-xl backdrop-blur-xl dark:border-cyan-500/30 dark:bg-slate-900/95 dark:shadow-[0_15px_40px_-15px_rgba(6,182,212,0.4)]"
                        style={{
                          left: (TIMER_WIDGET_BOUNDS.x + (TIMER_WIDGET_BOUNDS.width / 2)) * canvasScale,
                          top: Math.max(24, (TIMER_WIDGET_BOUNDS.y - 12) * canvasScale),
                        }}
                      >
                        {/* Caret pointing down to the hardware */}
                        <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-slate-300 bg-white/95 dark:border-cyan-500/30 dark:bg-slate-900/95" />
                        
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 dark:border-slate-700">
                          <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-800 dark:text-cyan-400">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-800 dark:bg-cyan-400" />
                            T1 Config
                          </h4>
                          <button
                            type="button"
                            onClick={() => setIsActivity5TimerPopupOpen(false)}
                            className="text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-cyan-400"
                            title="Close"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>

                        {/* Module Faceplate */}
                        <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 shadow-inner dark:border-slate-800 dark:bg-slate-950">
                            {/* Current Value Display (ET) */}
                            <div className="mb-4">
                                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Elapsed Time (ET)</p>
                                <div className="flex items-center justify-center rounded border border-slate-300 bg-white px-3 py-2 shadow-inner dark:border-slate-800 dark:bg-black">
                                    <span className="font-mono text-3xl font-black tracking-wider text-rose-600 dark:text-rose-500 dark:drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                                        {activity5TimerDisplayText}
                                    </span>
                                </div>
                            </div>
                            {/* Preset Value Input (PT) */}
                            <div className="mb-4">
                                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Preset Time (PT)</p>
                                <div className="flex items-center gap-3">
                                    <input
                                      id="activity-5-delay-popup"
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      inputMode="decimal"
                                      value={activity5TimerDelayInput}
                                      onChange={handleActivity5TimerDelayChange}
                                      onBlur={handleActivity5TimerDelayBlur}
                                      disabled={activity5RelayEnergized || isSessionCompleted}
                                      // FIX: Replaced flex-1 with w-24 to keep it properly sized
                                      className="w-24 rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-cyan-300"
                                    />
                                    {/* FIX: Added shrink-0 so it never gets crushed */}
                                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-500">Sec</span>
                                </div>
                            </div>
                            {/* LED Status Indicators */}
                            <div className="flex items-center justify-between border-t border-slate-300 pt-3 dark:border-slate-800/80">
                                <div className="flex items-center gap-2">
                                    <div className={`h-2.5 w-2.5 rounded-full ${activity5RelayEnergized ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'border border-slate-400 bg-slate-300 dark:border-slate-700 dark:bg-slate-800'}`} />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">Coil (R1)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`h-2.5 w-2.5 rounded-full ${activity5TimerStatus === 'done' ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'border border-slate-400 bg-slate-300 dark:border-slate-700 dark:bg-slate-800'}`} />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">Out (T1)</span>
                                </div>
                            </div>
                        </div>

                        {/* Status / Instructions */}
                        <div className="mt-3 text-center">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                              {activity5RelayEnergized
                                ? 'Timer Active • PT Locked'
                                : isSessionCompleted
                                  ? 'Activity Cleared • PT Locked'
                                  : 'Set PT & Actuate Start'}
                            </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!isCanvasReady ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <div className="w-10 h-10 border-4 border-slate-300 border-t-cyan-500 rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase animate-pulse">
                      Mounting Hardware Environment...
                    </p>
                  </div>
                ) : (
                  <Stage width={BASE_CANVAS_WIDTH * canvasScale} height={BASE_CANVAS_HEIGHT * canvasScale} onMouseMove={handleMouseMove} onMouseUp={handleStageMouseUp} onMouseLeave={handleStageMouseLeave}>
                    <RelayStaticBackground
                      BASE_CANVAS_WIDTH={BASE_CANVAS_WIDTH}
                      BASE_CANVAS_HEIGHT={BASE_CANVAS_HEIGHT}
                      canvasScale={canvasScale}
                      isDarkMode={isDarkMode}
                      isMainSwitchOn={isMainSwitchOn}
                      isGreenLampOn={isActivity1GreenLampOn || isActivity2GreenLampOn || isActivity3GreenLampOn || isActivity4GreenLampOn || isActivity5GreenLampOn}
                      isYellowLampOn={isActivity3YellowLampOn || isActivity4YellowLampOn || isActivity5YellowLampOn}
                      isRedLampOn={isActivity2RedLampOn}
                      timerDisplayText={activity5TimerDisplayText}
                      manualButtonState={pressedManualButtons}
                      onToggleSwitch={handleToggleSwitch}
                      onManualButtonPressChange={handleManualButtonPressChange}
                    />

                    <Layer scaleX={canvasScale} scaleY={canvasScale} id="interactive-wiring-layer">
                      {routedWires.map((wire) => {
                        const isSelected = selectedWireId === wire.id;
                        const isWrong = wrongWireKeySet.has(toWireKey(wire.fromPin, wire.toPin));
                        return (
                          <Line
                            key={`wire-${wire.id}`}
                            points={wire.points}
                            stroke={isWrong ? '#ef4444' : wire.color}
                            strokeWidth={isSelected ? 8 : isWrong ? 6 : 5}
                            hitStrokeWidth={20}
                            lineCap="round"
                            lineJoin="round"
                            dash={isWrong ? [14, 8] : undefined}
                            shadowColor={isSelected ? '#f1c40f' : isWrong ? 'rgba(239,68,68,0.8)' : 'rgba(0,0,0,0.4)'}
                            shadowBlur={isSelected ? 8 : isWrong ? 10 : 4}
                            shadowOffsetY={isSelected ? 0 : 4}
                            onMouseDown={(e) => {
                              if (isSessionCompleted) return;
                              e.cancelBubble = true;
                              setSelectedWireId(wire.id);
                              setWireColor(wire.color);
                            }}
                            onMouseEnter={(e) => {
                              if (isSessionCompleted) return;
                              const container = e.target.getStage()?.container();
                              if (container) container.style.cursor = 'pointer';
                            }}
                            onMouseLeave={(e) => {
                              if (isSessionCompleted) return;
                              const container = e.target.getStage()?.container();
                              if (container) container.style.cursor = 'default';
                            }}
                          />
                        );
                      })}

                      {Object.entries(RELAY_PORTS).map(([id]) => renderHardwareJack(id, activePin === id))}
                    </Layer>

                    <Layer scaleX={canvasScale} scaleY={canvasScale} id="overlay-layer" listening={false}>
                      <Line ref={ghostWireRef} stroke={wireColor} strokeWidth={4} dash={[10, 8]} opacity={0.6} tension={0.4} visible={false} />

                      <Circle ref={hoverRingRef} radius={9} stroke="#ffffff" strokeWidth={2} visible={false} />

                      <Group ref={tooltipRef} visible={false}>
                        <Rect ref={tooltipBgRef} height={0} width={0} fill="#1e293b" cornerRadius={4} />
                        <Text ref={tooltipTextRef} fill="#ffffff" fontSize={11} fontFamily={HW_STYLES.technicalMono} padding={6} />
                      </Group>
                    </Layer>
                  </Stage>
                )}
              </div>

              {showSuccessAnim && (
                <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-emerald-500/10 backdrop-blur-[2px] transition-opacity duration-500">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.3)] border-2 border-emerald-400 flex flex-col items-center animate-pop-in">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 size={48} className="text-emerald-500" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-widest">Activity Cleared</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-semibold">Configuration saved successfully.</p>
                  </div>
                </div>
              )}
            </div>

            {/* DEVICE DRAWER - ADD ID HERE */}
            <aside
              id="tour-sim-toolbox"
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
                          draggable={!isSessionCompleted}
                          onDragStart={(event) => handleDeviceDragStart(device.id, 'library', event)}
                          onDragEnd={handleDeviceDragEnd}
                          className={`group relative flex h-[124px] flex-col items-center justify-start rounded-2xl border bg-white px-2 pt-3 pb-2 text-center shadow-sm transition-all dark:bg-slate-900/70 ${isSessionCompleted ? 'cursor-default opacity-80 border-slate-200 dark:border-slate-700' : 'hover:-translate-y-0.5 hover:shadow-md'
                            } ${assignedDeviceIds.has(device.id)
                              ? 'border-emerald-400 dark:border-emerald-500/50'
                              : 'border-slate-200 hover:border-cyan-400 dark:border-slate-700 dark:hover:border-cyan-500/70'
                            }`}
                        >
                          <div className="flex shrink-0 h-12 w-12 items-center justify-center rounded-xl bg-slate-50 p-2 dark:bg-slate-800/80">
                            <img src={device.image} alt={device.name} className={`h-full w-full object-contain ${isSessionCompleted ? 'grayscale' : ''}`} />
                          </div>

                          <span className="mt-2 text-[10px] font-bold leading-[1.15] text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white line-clamp-2">
                            {device.name}
                          </span>

                          {assignedDeviceIds.has(device.id) && (
                            <div className="absolute bottom-2 left-1/2 w-10/12 -translate-x-1/2 rounded-full bg-emerald-50 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
                              In Use
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center py-4 relative">
                  <button
                    type="button"
                    onClick={() => setIsDeviceDrawerOpen(true)}
                    className="inline-flex shrink-0 h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    aria-label="Expand device drawer"
                    title="Expand device drawer"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex-1 flex items-center justify-center">
                    <div
                      className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-cyan-500/50"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      Device Library
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </main>

          {/* THE SELF MANAGED GUIDE! */}
          <TutorialGuide
            steps={tutorialSteps}
            storageKey="creosim_tutorial_simulation_ep"
          />
        </div>
      </CyberTransition>
    </PortraitGuard>
  );
}
