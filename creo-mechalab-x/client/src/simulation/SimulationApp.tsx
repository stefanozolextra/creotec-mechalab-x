import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Circle, Line, Rect, Group, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { motion } from 'framer-motion';

// Lucide Icons for the unified HUD
import {
  ArrowLeft, Play, Copy, ClipboardPaste, Trash2,
  Undo2, Redo2, RotateCw, FlipHorizontal, Sun, Moon, RefreshCw,
  Lock, Unlock, ChevronRight, ChevronLeft
} from 'lucide-react';

import { SIMULATION_ACTIVITIES, evaluateActivity } from './constants/activities';
import { CUSTOM_NODE_ASSETS, TOP_ROW_PINS, BOTTOM_ROW_PINS } from './constants/customNodes';
import buttonDeviceImageSrc from './assets/devices/button.png';
import buzzerDeviceImageSrc from './assets/devices/buzzer.png';
import counterDeviceImageSrc from './assets/devices/counter.png';
import lightIndicatorDeviceImageSrc from './assets/devices/light-indicator.png';
import { getBatteryRailForPin } from './constants/pinConfiguration';
import magneticContactorDeviceImageSrc from './assets/devices/magnetic-motor-contactor.png';
import relayModuleDeviceImageSrc from './assets/devices/relay-module.png';
import rollerLeverDeviceImageSrc from './assets/devices/roller-lever.png';
import solenoidValveDeviceImageSrc from './assets/devices/solenoid-valve.png';
import './SimulationApp.css';
import CircuitComponent from './components/CircuitComponent';
import AssetComponent from './components/AssetComponent';
import { getOrthogonalElbow, getSnappedIntermediatePoint, getDistanceSquaredToSegment } from './utils/geometry';
import { computeWireDuctIntermediatePoints } from './utils/wireRouting';
import { getPinMeta as getPinMetaHelper, inferPaletteTypeFromComponentId as inferPaletteTypeHelper } from './utils/simulationHelpers';
import { resolveTerminalStripTooltip } from './constants/pinTooltips';

const NODE_SIZE = 3;
const NAVBAR_HEIGHT = 64;
const COMPONENTS_MOVABLE = false;
const BATTERY_NODE = CUSTOM_NODE_ASSETS.terminalStrip;
void BATTERY_NODE;
const GENERAL_TERMINAL_STRIP_ASSET = CUSTOM_NODE_ASSETS.terminalStrip;

type SimulationComponentType =
  | 'battery' | 'switch' | 'button' | 'buzzer' | 'counter' | 'lightIndicator'
  | 'timer' | 'magneticMotorContactor' | 'relayModule' | 'rollerLever' | 'solenoidValve';
type PaletteComponentType = Exclude<SimulationComponentType, 'battery' | 'switch' | 'timer'>;

const SIMULATION_COMPONENT_TYPES: SimulationComponentType[] = [
  'battery', 'switch', 'button', 'buzzer', 'counter', 'timer', 'lightIndicator',
  'magneticMotorContactor', 'relayModule', 'rollerLever', 'solenoidValve',
];

const PALETTE_COMPONENT_TYPES: PaletteComponentType[] = [
  'button', 'buzzer', 'counter', 'lightIndicator', 'magneticMotorContactor',
  'relayModule', 'rollerLever', 'solenoidValve',
];

const PALETTE_DEVICE_META: Record<PaletteComponentType, { name: string; imageSrc: string }> = {
  button: { name: 'Push Button', imageSrc: buttonDeviceImageSrc },
  buzzer: { name: 'Buzzer', imageSrc: buzzerDeviceImageSrc },
  counter: { name: 'Counter', imageSrc: counterDeviceImageSrc },
  lightIndicator: { name: 'Light Indicator', imageSrc: lightIndicatorDeviceImageSrc },
  magneticMotorContactor: { name: 'Magnetic Contactor', imageSrc: magneticContactorDeviceImageSrc },
  relayModule: { name: 'Relay Module', imageSrc: relayModuleDeviceImageSrc },
  rollerLever: { name: 'Roller Lever', imageSrc: rollerLeverDeviceImageSrc },
  solenoidValve: { name: 'Solenoid Valve', imageSrc: solenoidValveDeviceImageSrc },
};

const COMPONENT_PALETTE = PALETTE_COMPONENT_TYPES.map((type) => {
  const device = PALETTE_DEVICE_META[type];
  return { type, name: device.name, imageSrc: device.imageSrc };
});

const TERMINAL_STRIP_PLACEMENTS: Partial<Record<SimulationComponentType, ShapePos>> = {
  battery: { x: 120, y: 280 },
  switch: { x: 215, y: 420 },
  button: { x: 400, y: 420 },
  buzzer: { x: 370, y: 640 },
  counter: { x: 185, y: 640 },
  timer: { x: 309, y: 640 },
  lightIndicator: { x: 440, y: 130 },
  magneticMotorContactor: { x: 558, y: 335 },
  relayModule: { x: 558, y: 150 },
  rollerLever: { x: 700, y: 640 },
  solenoidValve: { x: 885, y: 640 },
};

// --- SHIFTED DOWN & RIGHT COORDINATES ---
// We use NEW ID keys here ('battery-vplus-2') to bypass the browser's cache. 
// This forces the terminal blocks to spawn exactly at the new, shifted positions!
const INITIAL_COMPONENTS: Record<string, ShapePos> = {
  'battery-vplus-2': { x: 90, y: 268 },      // V+ Block
  'battery-vminus-2': { x: 330, y: 268 },    // V- Block
  'battery-signals-2': { x: 570, y: 268 },   // Signals Block

  // Standard placements for the rest of the canvas
  'relayModule-1': { x: 124, y: 420 },
  'relayModule-2': { x: 309, y: 420 },
  'relayModule-3': { x: 450, y: 420 },
  'counter-1': TERMINAL_STRIP_PLACEMENTS.counter ?? { x: 309, y: 640 },
  'timer-1': TERMINAL_STRIP_PLACEMENTS.timer ?? { x: 450, y: 640 },

  // Shifted slightly right to make room for the expanded left panel
  'magneticMotor-1': { x: 840, y: 515 },
  'rollerLever-1': { x: 840, y: 335 },
  'solenoidValve-1': { x: 840, y: 150 },
  'rollerLever-2': { x: 1040, y: 640 },
  'solenoidValve-2': { x: 1225, y: 640 }
};

const INITIAL_COMPONENT_TRANSFORMS: Record<string, { rotation: number; flipX: boolean }> = {
  'battery-vplus-2': { rotation: 180, flipX: false },
  'battery-vminus-2': { rotation: 180, flipX: false },
  'battery-signals-2': { rotation: 180, flipX: false },

  // Unchanged standard transforms
  'relayModule-1': { rotation: 0, flipX: false },
  'relayModule-2': { rotation: 0, flipX: false },
  'relayModule-3': { rotation: 0, flipX: false },
  'counter-1': { rotation: 180, flipX: false },
  'timer-1': { rotation: 180, flipX: false },
  'magneticMotor-1': { rotation: 270, flipX: false },
  'rollerLever-1': { rotation: 270, flipX: false },
  'solenoidValve-1': { rotation: 270, flipX: false },
  'rollerLever-2': { rotation: 180, flipX: false },
  'solenoidValve-2': { rotation: 180, flipX: false }
};

const WIRE_COLOR_OPTIONS = [
  { label: 'Green', value: '#27ae60' }, { label: 'Red', value: '#e74c3c' },
  { label: 'Blue', value: '#3498db' }, { label: 'Orange', value: '#e67e22' },
  { label: 'Purple', value: '#9b59b6' }, { label: 'Black', value: '#2c3e50' },
];

const createEmptyTypeCount = () => ({
  battery: 0, switch: 0, button: 0, buzzer: 0, counter: 0, timer: 0, led: 0,
  resistor: 0, lightIndicator: 0, magneticMotorContactor: 0, relayModule: 0,
  rollerLever: 0, solenoidValve: 0,
});

const countPaletteTypes = (items: PaletteComponentType[]) => items.reduce((acc, type) => {
  if (Object.prototype.hasOwnProperty.call(acc, type)) acc[type as keyof typeof acc] += 1;
  return acc;
}, createEmptyTypeCount());

const countCanvasComponentTypes = (componentIds: string[]) => componentIds.reduce((acc, id) => {
  const inferredType = inferPaletteTypeFromComponentId(id);
  if (inferredType) acc[inferredType] += 1;
  return acc;
}, createEmptyTypeCount());

const getPinMeta = (pinId: string) => getPinMetaHelper(pinId);
const inferPaletteTypeFromComponentId = (componentId: string): SimulationComponentType | null => {
  return inferPaletteTypeHelper(componentId, SIMULATION_COMPONENT_TYPES) as SimulationComponentType | null;
};

const TERMINAL_COLORS = { positive: '#e74c3c', negative: '#2c3e50' } as const;

const getEnforcedWireColor = (fromPin: string, toPin: string) => {
  const fromRail = getBatteryRailForPin(fromPin);
  const toRail = getBatteryRailForPin(toPin);
  if (fromRail === 'positive' || toRail === 'positive') return TERMINAL_COLORS.positive;
  if (fromRail === 'negative' || toRail === 'negative') return TERMINAL_COLORS.negative;
  return null;
};

interface ShapePos { x: number; y: number; }
interface ComponentTransform { rotation: number; flipX: boolean; }
interface Connection { id: string; fromPin: string; toPin: string; color: string; intermediatePoints: Array<{ x: number; y: number }>; }
interface CircuitSnapshot { components: Record<string, ShapePos>; wires: Connection[]; componentTransforms: Record<string, ComponentTransform>; switchStates: Record<string, boolean>; }
interface ClipboardComponent { type: SimulationComponentType; sourcePosition: ShapePos; transform: ComponentTransform; switchOn?: boolean; }
interface SelectedIntermediatePoint { wireId: string; index: number; }

const DEFAULT_PIN_OFFSETS = { in: { x: 40, y: 0 }, out: { x: 40, y: 120 } } as const;
const DEFAULT_TRANSFORM: ComponentTransform = { rotation: 0, flipX: false };

interface SimulationAppProps {
  routeId?: string;
  onNavigateBack?: () => void;
}

// =========================================================================
// MAIN SIMULATION ENGINE COMPONENT
// =========================================================================
export default function SimulationApp({ routeId, onNavigateBack }: SimulationAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark');
    return true;
  });

  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  // === OVERLAY STATES ===
  const [isControlsPinned, setIsControlsPinned] = useState(true);
  const [isControlsHovered, setIsControlsHovered] = useState(false);
  const [isDevicePinned, setIsDevicePinned] = useState(true);
  const [isDeviceHovered, setIsDeviceHovered] = useState(false);

  const showControls = isControlsPinned || isControlsHovered;
  const showDevice = isDevicePinned || isDeviceHovered;

  const [components, setComponents] = useState<Record<string, ShapePos>>(INITIAL_COMPONENTS);
  const [wires, setWires] = useState<Connection[]>([]);
  const [wireColor, setWireColor] = useState<string>('#27ae60');
  const [activePin, setActivePin] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<ShapePos | null>(null);
  const [pinTooltip, setPinTooltip] = useState<{ text: string; pos: ShapePos } | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedIntermediatePoint, setSelectedIntermediatePoint] = useState<SelectedIntermediatePoint | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [clipboardComponent, setClipboardComponent] = useState<ClipboardComponent | null>(null);
  const [historyPast, setHistoryPast] = useState<CircuitSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<CircuitSnapshot[]>([]);
  const [componentTransforms, setComponentTransforms] = useState<Record<string, ComponentTransform>>(INITIAL_COMPONENT_TRANSFORMS);
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});
  const [inputDeviceTypes, setInputDeviceTypes] = useState<PaletteComponentType[]>([]);
  const [outputDeviceTypes, setOutputDeviceTypes] = useState<PaletteComponentType[]>([]);
  const [activeActivityIndex] = useState(0);
  const [activityFeedback, setActivityFeedback] = useState('%');
  const [, setIsActivityPassed] = useState(false);
  const [, setCompletedActivityIds] = useState<string[]>([]);
  const [instructionImageFailures, setInstructionImageFailures] = useState<Record<string, boolean>>({});
  const isApplyingHistoryRef = useRef(false);
  const previousSnapshotRef = useRef<CircuitSnapshot>({
    components: INITIAL_COMPONENTS, wires: [], componentTransforms: INITIAL_COMPONENT_TRANSFORMS, switchStates: {},
  });

  const sidebarWidth = Math.max(180, Math.min(280, Math.round(viewport.width * 0.2)));
  const deviceSidebarWidth = sidebarWidth;
  const controlsPanelWidth = Math.max(280, Math.min(360, Math.round(viewport.width * 0.28)));
  const stageWidth = Math.max(320, viewport.width);
  const stageHeight = Math.max(260, viewport.height - NAVBAR_HEIGHT);

  useEffect(() => {
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
  };

  const createComponentId = (prefix: string) => {
    const nextIndex = Object.keys(components).filter((id) => id.startsWith(`${prefix}-`)).length + 1;
    return `${prefix}-${nextIndex}`;
  };

  const addComponent = (type: SimulationComponentType) => {
    const id = createComponentId(type);
    const index = Object.keys(components).length;
    setComponents((prev) => ({
      ...prev,
      [id]: { x: 40 + (index % 3) * 140, y: 80 + (index % 4) * 90 },
    }));
    setComponentTransforms((prev) => ({ ...prev, [id]: { rotation: 0, flipX: false } }));
    if (type === 'switch') setSwitchStates((prev) => ({ ...prev, [id]: false }));
    return id;
  };

  const inferComponentType = (componentId: string): ClipboardComponent['type'] => (
    inferPaletteTypeFromComponentId(componentId) ?? 'button'
  );

  const getPaletteItem = (type: PaletteComponentType) => COMPONENT_PALETTE.find((item) => item.type === type);

  const getPinTooltipText = useCallback((fullPinId: string): string | undefined => {
    return resolveTerminalStripTooltip(fullPinId, inferPaletteTypeFromComponentId);
  }, []);

  const handlePaletteDragStart = (event: React.DragEvent<HTMLButtonElement>, type: PaletteComponentType) => {
    event.dataTransfer.setData('application/x-device-type', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleDeviceCanvasDrop = (event: React.DragEvent<HTMLDivElement>, target: 'input' | 'output') => {
    event.preventDefault();
    const droppedType = event.dataTransfer.getData('application/x-device-type') as PaletteComponentType;
    if (!COMPONENT_PALETTE.some((item) => item.type === droppedType)) return;

    if (target === 'input') setInputDeviceTypes((prev) => [...prev, droppedType]);
    else setOutputDeviceTypes((prev) => [...prev, droppedType]);
  };

  const allowDeviceCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const removeInputDevice = (indexToRemove: number) => {
    setInputDeviceTypes((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const removeOutputDevice = (indexToRemove: number) => {
    setOutputDeviceTypes((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const getCurrentSnapshot = useCallback(
    (): CircuitSnapshot => ({ components, wires, componentTransforms, switchStates }),
    [components, wires, componentTransforms, switchStates],
  );

  const activeActivity = SIMULATION_ACTIVITIES[activeActivityIndex];
  const shouldShowInstructionImage = Boolean(activeActivity.instructionImageSrc) && !instructionImageFailures[activeActivity.id];

  const componentTypeCounts = useMemo(() => countCanvasComponentTypes(Object.keys(components)), [components]);
  const inputTypeCounts = useMemo(() => countPaletteTypes(inputDeviceTypes), [inputDeviceTypes]);
  const outputTypeCounts = useMemo(() => countPaletteTypes(outputDeviceTypes), [outputDeviceTypes]);
  const switchOnCount = useMemo(() => Object.entries(switchStates).filter(([id, isOn]) => id.startsWith('switch') && Boolean(isOn)).length, [switchStates]);

  const runActivityValidation = () => {
    const result = evaluateActivity(activeActivity, {
      componentCounts: componentTypeCounts,
      inputDeviceCounts: inputTypeCounts,
      outputDeviceCounts: outputTypeCounts,
      wireCount: wires.length,
      switchOnCount,
      litLedCount: 0,
    });
    setActivityFeedback(result.passed ? '100%' : '0%');
    setIsActivityPassed(result.passed);
    if (result.passed) setCompletedActivityIds((prev) => (prev.includes(activeActivity.id) ? prev : [...prev, activeActivity.id]));
  };

  const applySnapshot = (snapshot: CircuitSnapshot) => {
    isApplyingHistoryRef.current = true;
    setComponents(snapshot.components);
    setWires(snapshot.wires);
    setComponentTransforms(snapshot.componentTransforms);
    setSwitchStates(snapshot.switchStates);
    setActivePin(null);
    setMousePos(null);
    setSelectedWireId(null);
    setSelectedIntermediatePoint(null);
    setSelectedComponentId(null);
  };

  const getComponentNodeConfig = useCallback((componentId: string) => {
    const inferredType = inferPaletteTypeFromComponentId(componentId);
    if (inferredType) return { width: GENERAL_TERMINAL_STRIP_ASSET.width, height: GENERAL_TERMINAL_STRIP_ASSET.height, pins: GENERAL_TERMINAL_STRIP_ASSET.pins };
    return { width: 80, height: 120, pins: DEFAULT_PIN_OFFSETS };
  }, []);

  const getPinWireColor = (pinId: string): string | undefined => {
    if (selectedWireId) {
      const selected = wires.find((w) => w.id === selectedWireId);
      if (selected && (selected.fromPin === pinId || selected.toPin === pinId)) return selected.color;
    }
    const connected = wires.filter((w) => w.fromPin === pinId || w.toPin === pinId);
    if (connected.length > 0) return connected[connected.length - 1].color;
    return undefined;
  };

  const getPinPos = useCallback((pinId: string) => {
    const parts = pinId.split('-');
    const side = parts.pop() as string;
    const compId = parts.join('-');
    const pos = components[compId];
    if (!pos) return { x: 0, y: 0 };
    const config = getComponentNodeConfig(compId);
    const pinMap = config.pins as Record<string, { x: number; y: number }>;
    const localPin = pinMap[side] ?? { x: 0, y: 0 };
    const transform = componentTransforms[compId] ?? DEFAULT_TRANSFORM;
    const rotatedDegrees = ((transform.rotation % 360) + 360) % 360;
    const theta = (rotatedDegrees * Math.PI) / 180;
    const flippedX = transform.flipX ? config.width - localPin.x : localPin.x;
    const centerX = config.width / 2;
    const centerY = config.height / 2;
    const dx = flippedX - centerX;
    const dy = localPin.y - centerY;
    const transformedX = centerX + (dx * Math.cos(theta) - dy * Math.sin(theta));
    const transformedY = centerY + (dx * Math.sin(theta) + dy * Math.cos(theta));
    return { x: pos.x + transformedX, y: pos.y + transformedY };
  }, [components, componentTransforms, getComponentNodeConfig]);

  const getWireDuctIntermediatePoints = useCallback((fromPin: string, toPin: string) => (
    computeWireDuctIntermediatePoints({
      fromPin, toPin, getPinPos, stageWidth, stageHeight, wires, getPinMeta,
      getComponentNodeConfig, componentTransforms, defaultTransform: DEFAULT_TRANSFORM,
      inferPaletteTypeFromComponentId, terminalStripPlacements: TERMINAL_STRIP_PLACEMENTS,
      topRowPins: TOP_ROW_PINS, bottomRowPins: BOTTOM_ROW_PINS,
    })
  ), [getPinPos, stageWidth, stageHeight, wires, getComponentNodeConfig, componentTransforms]);

  const rotateSelectedComponent = () => {
    if (!selectedComponentId) return;
    setComponentTransforms((prev) => {
      const current = prev[selectedComponentId] ?? DEFAULT_TRANSFORM;
      return { ...prev, [selectedComponentId]: { ...current, rotation: (current.rotation + 90) % 360 } };
    });
  };

  const flipSelectedComponent = () => {
    if (!selectedComponentId) return;
    setComponentTransforms((prev) => {
      const current = prev[selectedComponentId] ?? DEFAULT_TRANSFORM;
      return { ...prev, [selectedComponentId]: { ...current, flipX: !current.flipX } };
    });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => { if (activePin) { const pos = e.target.getStage()?.getPointerPosition(); if (pos) setMousePos(pos); } };

  const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (activePin) {
      const targetPin = (e.target as { attrs?: { pinId?: string } }).attrs?.pinId;
      if (targetPin && targetPin !== activePin) {
        const isDuplicate = wires.some((wire) => (wire.fromPin === activePin && wire.toPin === targetPin) || (wire.fromPin === targetPin && wire.toPin === activePin));
        if (!isDuplicate) {
          const ductIntermediatePoints = getWireDuctIntermediatePoints(activePin, targetPin);
          const enforcedColor = getEnforcedWireColor(activePin, targetPin);
          setWires(prev => [...prev, {
            id: crypto.randomUUID(), fromPin: activePin, toPin: targetPin, color: enforcedColor ?? wireColor, intermediatePoints: ductIntermediatePoints,
          }]);
        }
      }
      setActivePin(null); setMousePos(null); setSelectedWireId(null); setSelectedIntermediatePoint(null);
    }
  };

  const handlePinMouseDown = (pinId: string) => {
    setPinTooltip(null);
    if (selectedWireId) {
      const selectedWire = wires.find((wire) => wire.id === selectedWireId);
      if (selectedWire && (selectedWire.fromPin === pinId || selectedWire.toPin === pinId)) {
        setWires(prev => prev.filter((wire) => wire.id !== selectedWireId));
      }
      setSelectedWireId(null); setSelectedIntermediatePoint(null); setActivePin(null); setMousePos(null);
      return;
    }
    setActivePin(pinId); setSelectedIntermediatePoint(null); setSelectedComponentId(null); setMousePos(getPinPos(pinId));
  };

  const handleShowPinTooltip = useCallback((text: string, pos: ShapePos) => setPinTooltip({ text, pos }), []);
  const handleHidePinTooltip = useCallback(() => setPinTooltip(null), []);

  const handleWireColorChange = (color: string) => {
    setWireColor(color);
    if (selectedWireId) setWires((prev) => prev.map((wire) => (wire.id === selectedWireId ? { ...wire, color } : wire)));
    if (selectedComponentId) {
      setWires((prev) => prev.map((wire) => {
        const fromComp = wire.fromPin.split('-').slice(0, -1).join('-');
        const toComp = wire.toPin.split('-').slice(0, -1).join('-');
        if (fromComp === selectedComponentId || toComp === selectedComponentId) return { ...wire, color };
        return wire;
      }));
    }
  };

  const deleteSelected = useCallback(() => {
    if (selectedIntermediatePoint) {
      setWires((prev) => prev.map((wire) => {
        if (wire.id !== selectedIntermediatePoint.wireId) return wire;
        return { ...wire, intermediatePoints: (wire.intermediatePoints ?? []).filter((_, index) => index !== selectedIntermediatePoint.index) };
      }));
      setSelectedIntermediatePoint(null);
      return;
    }
    if (selectedWireId) {
      setWires((prev) => prev.filter((wire) => wire.id !== selectedWireId));
      setSelectedWireId(null); setSelectedIntermediatePoint(null);
      return;
    }
    if (selectedComponentId) {
      setComponents((prev) => { const next = { ...prev }; delete next[selectedComponentId]; return next; });
      setComponentTransforms((prev) => { const next = { ...prev }; delete next[selectedComponentId]; return next; });
      setSwitchStates((prev) => { const next = { ...prev }; delete next[selectedComponentId]; return next; });
      setWires((prev) => prev.filter((wire) => {
        const fromComponent = wire.fromPin.split('-').slice(0, -1).join('-');
        const toComponent = wire.toPin.split('-').slice(0, -1).join('-');
        return fromComponent !== selectedComponentId && toComponent !== selectedComponentId;
      }));
      if (activePin?.startsWith(`${selectedComponentId}-`)) { setActivePin(null); setMousePos(null); }
      setSelectedComponentId(null);
    }
  }, [activePin, selectedComponentId, selectedWireId, selectedIntermediatePoint]);

  useEffect(() => {
    let raf = 0;
    raf = requestAnimationFrame(() => {
      setWires((prev) => {
        let changed = false;
        const next = prev.map((wire) => {
          try {
            const newPoints = getWireDuctIntermediatePoints(wire.fromPin, wire.toPin);
            const oldPoints = wire.intermediatePoints ?? [];
            if (JSON.stringify(oldPoints) === JSON.stringify(newPoints)) return wire;
            changed = true;
            return { ...wire, intermediatePoints: newPoints };
          } catch { return wire; }
        });
        return changed ? next : prev;
      });
    });
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [componentTransforms, components, stageWidth, stageHeight, getWireDuctIntermediatePoints]);

  const handleCopy = () => {
    if (!selectedComponentId) return;
    const selectedPos = components[selectedComponentId];
    if (!selectedPos) return;
    setClipboardComponent({
      type: inferComponentType(selectedComponentId),
      sourcePosition: selectedPos,
      transform: componentTransforms[selectedComponentId] ?? DEFAULT_TRANSFORM,
      switchOn: switchStates[selectedComponentId],
    });
  };

  const handlePaste = () => {
    if (!clipboardComponent) return;
    const newId = createComponentId(clipboardComponent.type);
    const pastedPos = { x: clipboardComponent.sourcePosition.x + 28, y: clipboardComponent.sourcePosition.y + 28 };
    setComponents((prev) => ({ ...prev, [newId]: pastedPos }));
    setComponentTransforms((prev) => ({ ...prev, [newId]: clipboardComponent.transform }));
    if (clipboardComponent.type === 'switch') setSwitchStates((prev) => ({ ...prev, [newId]: Boolean(clipboardComponent.switchOn) }));
    setSelectedComponentId(newId); setSelectedWireId(null);
  };

  const handleUndo = () => {
    if (!historyPast.length) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [getCurrentSnapshot(), ...prev].slice(0, 50));
    applySnapshot(previous);
  };

  const handleRedo = () => {
    if (!historyFuture.length) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev, getCurrentSnapshot()].slice(-50));
    applySnapshot(next);
  };

  const handleResetBoard = () => {
    setHistoryPast(prev => [...prev, getCurrentSnapshot()].slice(-50));
    setHistoryFuture([]);
    setComponents(INITIAL_COMPONENTS);
    setComponentTransforms(INITIAL_COMPONENT_TRANSFORMS);
    setWires([]);
    setSwitchStates({});
    setSelectedComponentId(null); setSelectedWireId(null); setSelectedIntermediatePoint(null); setActivePin(null); setMousePos(null);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId || selectedComponentId || selectedIntermediatePoint) { e.preventDefault(); deleteSelected(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedWireId, selectedComponentId, selectedIntermediatePoint, deleteSelected]);

  useEffect(() => {
    const currentSnapshot = getCurrentSnapshot();
    if (isApplyingHistoryRef.current) {
      previousSnapshotRef.current = currentSnapshot;
      isApplyingHistoryRef.current = false;
      return;
    }
    if (JSON.stringify(previousSnapshotRef.current) !== JSON.stringify(currentSnapshot)) {
      setHistoryPast((prev) => [...prev, previousSnapshotRef.current].slice(-50));
      setHistoryFuture([]);
      previousSnapshotRef.current = currentSnapshot;
    }
  }, [components, wires, componentTransforms, switchStates, getCurrentSnapshot]);

  return (
    <div className={`flex flex-col h-screen w-screen text-slate-800 dark:text-slate-200 font-sans overflow-hidden select-none transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0B1120]' : 'bg-slate-50'}`}>

      {/* HEADER */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0B1120] border-b border-slate-200 dark:border-cyan-900/50 z-[60] shadow-md relative">
        <div className="flex items-center gap-4">
          <button onClick={onNavigateBack} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-cyan-400 rounded-lg transition-colors shadow-sm" title="Abort Sequence">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Play size={16} className="text-cyan-600 dark:text-cyan-500" /> Simulation Environment
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-cyan-500/70 font-mono tracking-widest uppercase">Active Sequence: {routeId || 'UNKNOWN'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-300 dark:border-slate-800 shadow-inner transition-colors">
            <button type="button" onClick={handleCopy} disabled={!selectedComponentId} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Copy"><Copy size={16} strokeWidth={2.5} /></button>
            <button type="button" onClick={handlePaste} disabled={!clipboardComponent} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Paste"><ClipboardPaste size={16} strokeWidth={2.5} /></button>
            <button type="button" onClick={deleteSelected} disabled={!selectedWireId && !selectedComponentId && !selectedIntermediatePoint} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 rounded-lg transition-colors" title="Delete"><Trash2 size={16} strokeWidth={2.5} /></button>

            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

            <button type="button" onClick={handleUndo} disabled={!historyPast.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Undo"><Undo2 size={16} strokeWidth={2.5} /></button>
            <button type="button" onClick={handleRedo} disabled={!historyFuture.length} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Redo"><Redo2 size={16} strokeWidth={2.5} /></button>

            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

            <button type="button" onClick={rotateSelectedComponent} disabled={!selectedComponentId} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Rotate"><RotateCw size={16} strokeWidth={2.5} /></button>
            <button type="button" onClick={flipSelectedComponent} disabled={!selectedComponentId} className="p-2 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-30 rounded-lg transition-colors" title="Flip"><FlipHorizontal size={16} strokeWidth={2.5} /></button>

            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />

            <div className="px-2">
              <select value={wireColor} onChange={(e) => handleWireColorChange(e.target.value)} className="bg-transparent text-xs text-slate-900 dark:text-white font-bold outline-none border-none cursor-pointer py-1" title="Wire Color">
                {WIRE_COLOR_OPTIONS.map((option) => (<option key={option.value} value={option.value} className="bg-white dark:bg-slate-900">{option.label}</option>))}
              </select>
            </div>
          </div>

          <button type="button" onClick={handleResetBoard} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 transition-colors shadow-sm">
            <RefreshCw size={16} strokeWidth={2.5} /> <span className="hidden xl:inline">Reset</span>
          </button>

          <button type="button" onClick={toggleTheme} className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-cyan-400 rounded-xl border border-slate-300 dark:border-slate-700 transition-all shadow-sm" title="Toggle Theme">
            {isDarkMode ? <Sun size={18} strokeWidth={2.5} /> : <Moon size={18} strokeWidth={2.5} />}
          </button>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-300 dark:border-slate-700 h-8">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black tracking-widest uppercase">Sys.Online</span>
          </div>
        </div>
      </header>

      {/* MAIN CANVAS & OVERLAYS */}
      <main className="flex-1 relative w-full h-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-900" ref={containerRef}>

        {/* Left Edge Indicator (Controls Panel) */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-16 z-40 flex items-center justify-start group transition-opacity duration-300 ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100 cursor-e-resize'}`}
          onMouseEnter={() => setIsControlsHovered(true)}
        >
          <div className="h-32 w-2 bg-slate-400/20 dark:bg-cyan-500/20 group-hover:w-4 group-hover:bg-cyan-500/50 backdrop-blur-sm border-y border-r border-slate-400/30 dark:border-cyan-400/30 rounded-r-lg flex items-center justify-center relative transition-all duration-300 shadow-[2px_0_10px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_15px_rgba(6,182,212,0.2)] group-hover:shadow-[4px_0_20px_rgba(6,182,212,0.6)]">
            <ChevronRight className="absolute left-0.5 text-slate-500 dark:text-cyan-400/50 group-hover:text-white dark:group-hover:text-cyan-200 group-hover:translate-x-1 group-hover:scale-125 transition-all duration-300" size={20} strokeWidth={2.5} />
          </div>
        </div>

        {/* Right Edge Indicator (Devices Panel) */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-16 z-40 flex items-center justify-end group transition-opacity duration-300 ${showDevice ? 'opacity-0 pointer-events-none' : 'opacity-100 cursor-w-resize'}`}
          onMouseEnter={() => setIsDeviceHovered(true)}
        >
          <div className="h-32 w-2 bg-slate-400/20 dark:bg-cyan-500/20 group-hover:w-4 group-hover:bg-cyan-500/50 backdrop-blur-sm border-y border-l border-slate-400/30 dark:border-cyan-400/30 rounded-l-lg flex items-center justify-center relative transition-all duration-300 shadow-[-2px_0_10px_rgba(0,0,0,0.1)] dark:shadow-[-2px_0_15px_rgba(6,182,212,0.2)] group-hover:shadow-[-4px_0_20px_rgba(6,182,212,0.6)]">
            <ChevronLeft className="absolute right-0.5 text-slate-500 dark:text-cyan-400/50 group-hover:text-white dark:group-hover:text-cyan-200 group-hover:-translate-x-1 group-hover:scale-125 transition-all duration-300" size={20} strokeWidth={2.5} />
          </div>
        </div>

        {/* 100% SCALE KONVA STAGE */}
        <div className="app-layout" style={{ position: 'absolute', inset: 0 }}>
          <div className="simulation-canvas-frame" style={{ width: stageWidth, height: stageHeight }}>
            <Stage
              width={stageWidth}
              height={stageHeight}
              onMouseMove={handleMouseMove}
              onMouseUp={handleStageMouseUp}
              onMouseDown={() => { setPinTooltip(null); if (!activePin) { setSelectedWireId(null); setSelectedIntermediatePoint(null); setSelectedComponentId(null); } }}
            >
              <Layer>

                {/* --- TOP-LEFT COMPONENTS (Shifted Down and Right) --- */}
                <Group x={0} y={0} listening={false}>
                  {/* Panel Base */}
                  <Rect x={40} y={40} width={792} height={296} fill={isDarkMode ? '#1e293b' : '#ffffff'} stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth={2} shadowColor="rgba(0,0,0,0.05)" shadowBlur={10} shadowOffsetY={4} />
                  <Text text="CONTROL & INDICATOR PANEL" x={70} y={60} fontSize={12} fontStyle="bold" fill={isDarkMode ? '#94a3b8' : '#cbd5e1'} />

                  {/* Switch Indicator */}
                  <Group x={90} y={100}>
                    <Rect width={70} height={80} fill={isDarkMode ? "#0f172a" : "#f8fafc"} cornerRadius={6} stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} />
                    <Rect x={15} y={15} width={40} height={50} fill={isDarkMode ? "#334155" : "#e2e8f0"} cornerRadius={4} stroke="#cbd5e1" strokeWidth={1} />
                    <Rect x={15} y={15} width={40} height={25} fill={isDarkMode ? "#475569" : "#f1f5f9"} cornerRadius={[4, 4, 0, 0]} />
                    <Text text="MAIN SWITCH" x={0} y={90} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" />
                  </Group>

                  {/* Green Lamp */}
                  <Group x={260} y={140}>
                    <Circle radius={24} fill={isDarkMode ? "#0f172a" : "#f1f5f9"} stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} />
                    <Circle radius={16} fill="#22c55e" stroke="#16a34a" strokeWidth={1} />
                    <Text text="LAMP 1 (G)" x={-26} y={35} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" />
                  </Group>

                  {/* Yellow Lamp */}
                  <Group x={390} y={140}>
                    <Circle radius={24} fill={isDarkMode ? "#0f172a" : "#f1f5f9"} stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} />
                    <Circle radius={16} fill="#eab308" stroke="#ca8a04" strokeWidth={1} />
                    <Text text="LAMP 2 (Y)" x={-26} y={35} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" />
                  </Group>

                  {/* Red Lamp */}
                  <Group x={520} y={140}>
                    <Circle radius={24} fill={isDarkMode ? "#0f172a" : "#f1f5f9"} stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} />
                    <Circle radius={16} fill="#ef4444" stroke="#dc2626" strokeWidth={1} />
                    <Text text="LAMP 3 (R)" x={-26} y={35} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" />
                  </Group>

                  {/* Buzzer */}
                  <Group x={650} y={140}>
                    <Circle radius={24} fill="#0f172a" stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} />
                    <Circle radius={6} fill="#000000" />
                    <Circle radius={14} stroke="#1e293b" strokeWidth={2} />
                    <Text text="BUZZER" x={-20} y={35} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" />
                  </Group>

                  {/* Dashed drop zones perfectly hugging the terminal strips */}
                  <Rect x={80} y={260} width={220} height={45} stroke={isDarkMode ? '#475569' : '#94a3b8'} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                  <Text text="V+ (24VDC)" x={80} y={240} fontSize={11} fill={isDarkMode ? '#cbd5e1' : '#64748b'} fontStyle="bold" />

                  <Rect x={320} y={260} width={220} height={45} stroke={isDarkMode ? '#475569' : '#94a3b8'} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                  <Text text="V- (0VDC)" x={320} y={240} fontSize={11} fill={isDarkMode ? '#cbd5e1' : '#64748b'} fontStyle="bold" />

                  <Rect x={560} y={260} width={220} height={45} stroke={isDarkMode ? '#475569' : '#94a3b8'} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                  <Text text="SIGNALS (X1/X2)" x={560} y={240} fontSize={11} fill={isDarkMode ? '#cbd5e1' : '#64748b'} fontStyle="bold" />
                </Group>


                {wires.map((wire) => {
                  const start = getPinPos(wire.fromPin);
                  const end = getPinPos(wire.toPin);
                  const intermediatePoints = wire.intermediatePoints ?? [];
                  const polylinePoints = [start, ...intermediatePoints, end];
                  const flattenedPoints = polylinePoints.flatMap((point) => [point.x, point.y]);
                  const isSelected = selectedWireId === wire.id;
                  return (
                    <Line
                      key={wire.id} points={flattenedPoints} stroke={wire.color} strokeWidth={isSelected ? 6 : 4} hitStrokeWidth={14} lineCap="round" lineJoin="round" tension={0}
                      shadowColor={isSelected ? '#f39c12' : undefined} shadowBlur={isSelected ? 12 : 0}
                      onMouseDown={(e) => { e.cancelBubble = true; setSelectedWireId(wire.id); setSelectedIntermediatePoint(null); setSelectedComponentId(null); setActivePin(null); setMousePos(null); }}
                      onDblClick={(e) => {
                        e.cancelBubble = true; const stagePointer = e.target.getStage()?.getPointerPosition(); if (!stagePointer) return;
                        let nearestSegmentIndex = 0; let nearestDistanceSquared = Number.POSITIVE_INFINITY;
                        for (let i = 0; i < polylinePoints.length - 1; i += 1) {
                          const distanceSquared = getDistanceSquaredToSegment(stagePointer, polylinePoints[i], polylinePoints[i + 1]);
                          if (distanceSquared < nearestDistanceSquared) { nearestDistanceSquared = distanceSquared; nearestSegmentIndex = i; }
                        }
                        setWires((prev) => prev.map((currentWire) => {
                          if (currentWire.id !== wire.id) return currentWire;
                          const nextIntermediatePoints = [...(currentWire.intermediatePoints ?? [])];
                          const elbow = getOrthogonalElbow(stagePointer, polylinePoints[nearestSegmentIndex], polylinePoints[nearestSegmentIndex + 1]);
                          nextIntermediatePoints.splice(nearestSegmentIndex, 0, elbow);
                          return { ...currentWire, intermediatePoints: nextIntermediatePoints };
                        }));
                        setSelectedWireId(wire.id); setSelectedIntermediatePoint({ wireId: wire.id, index: nearestSegmentIndex }); setSelectedComponentId(null); setActivePin(null); setMousePos(null);
                      }}
                    />
                  );
                })}

                {wires.flatMap((wire) => {
                  if (selectedWireId !== wire.id) return [];
                  const points = wire.intermediatePoints ?? [];
                  return points.map((point, index) => {
                    const isPointSelected = selectedIntermediatePoint?.wireId === wire.id && selectedIntermediatePoint.index === index && selectedWireId === wire.id;
                    return (
                      <Circle
                        key={`${wire.id}-point-${index}`} x={point.x} y={point.y} radius={isPointSelected ? 7 : 6} fill={isPointSelected ? '#f39c12' : '#ffffff'} stroke="#2c3e50" strokeWidth={2} draggable={!activePin}
                        onMouseDown={(e) => { e.cancelBubble = true; setSelectedWireId(wire.id); setSelectedIntermediatePoint({ wireId: wire.id, index }); setSelectedComponentId(null); setActivePin(null); setMousePos(null); }}
                        onDragMove={(e) => {
                          const wireStart = getPinPos(wire.fromPin); const wireEnd = getPinPos(wire.toPin);
                          const pointer = { x: e.target.x(), y: e.target.y() };
                          const previousPoint = index === 0 ? wireStart : points[index - 1];
                          const nextPoint = index === points.length - 1 ? wireEnd : points[index + 1];
                          const snappedPoint = getSnappedIntermediatePoint(pointer, previousPoint, nextPoint);
                          e.target.x(snappedPoint.x); e.target.y(snappedPoint.y);
                          setWires((prev) => prev.map((currentWire) => {
                            if (currentWire.id !== wire.id) return currentWire;
                            const nextIntermediatePoints = [...(currentWire.intermediatePoints ?? [])];
                            nextIntermediatePoints[index] = snappedPoint;
                            return { ...currentWire, intermediatePoints: nextIntermediatePoints };
                          }));
                        }}
                        onDblClick={(e) => {
                          e.cancelBubble = true;
                          setWires((prev) => prev.map((currentWire) => {
                            if (currentWire.id !== wire.id) return currentWire;
                            return { ...currentWire, intermediatePoints: (currentWire.intermediatePoints ?? []).filter((_, pointIndex) => pointIndex !== index) };
                          }));
                          setSelectedIntermediatePoint(null);
                        }}
                      />
                    );
                  });
                })}

                {activePin && mousePos && (
                  <Line points={[getPinPos(activePin).x, getPinPos(activePin).y, mousePos.x, mousePos.y]} stroke="#e67e22" strokeWidth={2} dash={[10, 5]} />
                )}

                {Object.entries(components).map(([id, pos]) => {
                  const componentType = inferPaletteTypeFromComponentId(id);
                  return componentType ? (
                    (() => {
                      const asset = GENERAL_TERMINAL_STRIP_ASSET;
                      const pinKeys = Object.keys(asset.pins).filter((key) => /^pin_\d+$/.test(key)).sort((a, b) => Number(a.replace('pin_', '')) - Number(b.replace('pin_', '')));
                      const pinAKey = pinKeys[0] ?? 'in'; const pinBKey = pinKeys[1] ?? 'out';
                      const pinAOffset = asset.pins[pinAKey] ?? { x: 8, y: asset.height / 2 };
                      const pinBOffset = asset.pins[pinBKey] ?? { x: asset.width - 8, y: asset.height / 2 };
                      const pinOffsets = Object.fromEntries(pinKeys.map((key) => [key, asset.pins[key]]));
                      return (
                        <AssetComponent
                          key={id} id={id} x={pos.x} y={pos.y} rotation={componentTransforms[id]?.rotation ?? 0} flipX={componentTransforms[id]?.flipX ?? false}
                          isWiring={Boolean(activePin)} isSelected={selectedComponentId === id} imageSrc={asset.imageSrc} width={asset.width} height={asset.height} nodeSize={NODE_SIZE} isLocked={!COMPONENTS_MOVABLE}
                          pinAId={pinAKey} pinBId={pinBKey} pinAOffset={pinAOffset} pinBOffset={pinBOffset} pinOffsets={pinOffsets}
                          onPinMouseDown={handlePinMouseDown} pinWireColorForPin={getPinWireColor} pinTooltipForPin={getPinTooltipText} onShowPinTooltip={handleShowPinTooltip} onHidePinTooltip={handleHidePinTooltip}
                          onSelect={(componentId) => { setSelectedComponentId(componentId); setSelectedWireId(null); setActivePin(null); setMousePos(null); }}
                          onDrag={(compId, x, y) => setComponents(prev => ({ ...prev, [compId]: { x, y } }))}
                        />
                      );
                    })()
                  ) : (
                    <CircuitComponent
                      key={id} id={id} x={pos.x} y={pos.y} rotation={componentTransforms[id]?.rotation ?? 0} flipX={componentTransforms[id]?.flipX ?? false} label={id.toUpperCase()} color="#e74c3c" nodeSize={NODE_SIZE}
                      isWiring={Boolean(activePin)} isLocked={!COMPONENTS_MOVABLE} isSelected={selectedComponentId === id}
                      onPinMouseDown={handlePinMouseDown} pinWireColorForPin={getPinWireColor} onShowPinTooltip={handleShowPinTooltip} onHidePinTooltip={handleHidePinTooltip}
                      onSelect={(componentId) => { setSelectedComponentId(componentId); setSelectedWireId(null); setActivePin(null); setMousePos(null); }}
                      onDrag={(compId, x, y) => setComponents(prev => ({ ...prev, [compId]: { x, y } }))}
                    />
                  );
                })}
              </Layer>
            </Stage>
            {pinTooltip && (
              <div className="pin-tooltip-popup" style={{ left: pinTooltip.pos.x + 12, top: pinTooltip.pos.y - 10 }}>{pinTooltip.text}</div>
            )}
          </div>
        </div>

        {/* LEFT OVERLAY: Controls & Ladder Diagram */}
        <motion.aside
          className="absolute left-0 top-0 bottom-0 z-50 flex flex-col bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-cyan-900/50 shadow-[4px_0_24px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_24px_rgba(6,182,212,0.15)] transition-colors duration-300"
          style={{ width: controlsPanelWidth }}
          initial={{ x: '-100%' }}
          animate={{ x: showControls ? 0 : '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onMouseEnter={() => setIsControlsHovered(true)}
          onMouseLeave={() => setIsControlsHovered(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-black text-slate-800 dark:text-cyan-400 uppercase tracking-widest text-sm">Controls</h3>
            <button
              type="button"
              onClick={() => setIsControlsPinned(!isControlsPinned)}
              className={`p-1.5 rounded-lg transition-colors ${isControlsPinned ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400 shadow-inner' : 'bg-slate-200 text-slate-500 hover:text-cyan-500 dark:bg-slate-800 dark:hover:text-cyan-400 shadow-sm'}`}
              title={isControlsPinned ? "Unlock Overlay" : "Lock Overlay"}
            >
              {isControlsPinned ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Devices to Use</h3>
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700" onDragOver={allowDeviceCanvasDrop} onDrop={(event) => handleDeviceCanvasDrop(event, 'input')}>
                  <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2">Input Device</h4>
                  <div className="flex flex-wrap gap-2">
                    {inputDeviceTypes.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-600 font-mono">Drag devices here</p>}
                    {inputDeviceTypes.map((type, index) => {
                      const item = getPaletteItem(type);
                      if (!item) return null;
                      return (
                        <div key={`input-${type}-${index}`} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-200">
                          <img src={item.imageSrc} alt={item.name} className="w-5 h-5 object-contain" />
                          <span>{item.name}</span>
                          <button type="button" className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 ml-1" onClick={() => removeInputDevice(index)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700" onDragOver={allowDeviceCanvasDrop} onDrop={(event) => handleDeviceCanvasDrop(event, 'output')}>
                  <h4 className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2">Output Device</h4>
                  <div className="flex flex-wrap gap-2">
                    {outputDeviceTypes.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-600 font-mono">Drag devices here</p>}
                    {outputDeviceTypes.map((type, index) => {
                      const item = getPaletteItem(type);
                      if (!item) return null;
                      return (
                        <div key={`output-${type}-${index}`} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-200">
                          <img src={item.imageSrc} alt={item.name} className="w-5 h-5 object-contain" />
                          <span>{item.name}</span>
                          <button type="button" className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 ml-1" onClick={() => removeOutputDevice(index)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ladder Diagram</h3>
                <span className={`text-xs font-black px-2 py-0.5 rounded ${activityFeedback === '100%' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                  {activityFeedback}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3">{activeActivity.title}</h4>
                {shouldShowInstructionImage ? (
                  <img src={activeActivity.instructionImageSrc} alt={`${activeActivity.title} instructions`} className="w-full rounded bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700" onError={() => setInstructionImageFailures((prev) => ({ ...prev, [activeActivity.id]: true }))} />
                ) : activeActivity.instructions?.length ? (
                  <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                    {activeActivity.instructions.map((instruction, index) => (
                      <li key={index}>{instruction}</li>
                    ))}
                  </ul>
                ) : null}

                <button type="button" onClick={runActivityValidation} className="mt-4 w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-md">
                  Verify Circuit
                </button>
              </div>
            </div>

          </div>
        </motion.aside>

        {/* RIGHT OVERLAY: Device Palette */}
        <motion.aside
          className="absolute right-0 top-0 bottom-0 z-50 flex flex-col bg-white dark:bg-[#0B1120] border-l border-slate-200 dark:border-cyan-900/50 shadow-[-4px_0_24px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_24px_rgba(6,182,212,0.15)] transition-colors duration-300"
          style={{ width: deviceSidebarWidth }}
          initial={{ x: '100%' }}
          animate={{ x: showDevice ? 0 : '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onMouseEnter={() => setIsDeviceHovered(true)}
          onMouseLeave={() => setIsDeviceHovered(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={() => setIsDevicePinned(!isDevicePinned)}
              className={`p-1.5 rounded-lg transition-colors ${isDevicePinned ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400 shadow-inner' : 'bg-slate-200 text-slate-500 hover:text-cyan-500 dark:bg-slate-800 dark:hover:text-cyan-400 shadow-sm'}`}
              title={isDevicePinned ? "Unlock Overlay" : "Lock Overlay"}
            >
              {isDevicePinned ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
            <h3 className="font-black text-slate-800 dark:text-cyan-400 uppercase tracking-widest text-sm">Devices</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="grid grid-cols-2 gap-3">
              {COMPONENT_PALETTE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addComponent(item.type)}
                  className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-400 hover:shadow-md dark:hover:bg-slate-800 transition-all group"
                  draggable
                  onDragStart={(event) => handlePaletteDragStart(event, item.type)}
                >
                  <img src={item.imageSrc} alt={item.name} className="h-10 w-10 object-contain mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 text-center leading-tight">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.aside>

      </main>
    </div>
  );
}