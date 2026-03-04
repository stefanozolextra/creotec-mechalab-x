import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Circle, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
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
const NAVBAR_HEIGHT = 56;
// Terminal-strip customization: keep simulation components as fixed strips and show per-component labels.
const COMPONENTS_MOVABLE = false;
const BATTERY_NODE = CUSTOM_NODE_ASSETS.terminalStrip;
// keep reference to BATTERY_NODE for now (rendering removed but types/state retained)
void BATTERY_NODE;
const GENERAL_TERMINAL_STRIP_ASSET = CUSTOM_NODE_ASSETS.terminalStrip;
type SimulationComponentType =
  | 'battery'
  | 'switch'
  | 'button'
  | 'buzzer'
  | 'counter'
  | 'lightIndicator'
  | 'magneticMotorContactor'
  | 'relayModule'
  | 'rollerLever'
  | 'solenoidValve';
type PaletteComponentType = Exclude<SimulationComponentType, 'battery' | 'switch'>;
const SIMULATION_COMPONENT_TYPES: SimulationComponentType[] = [
  'battery',
  'switch',
  'button',
  'buzzer',
  'counter',
  'lightIndicator',
  'magneticMotorContactor',
  'relayModule',
  'rollerLever',
  'solenoidValve',
];
const PALETTE_COMPONENT_TYPES: PaletteComponentType[] = [
  'button',
  'buzzer',
  'counter',
  'lightIndicator',
  'magneticMotorContactor',
  'relayModule',
  'rollerLever',
  'solenoidValve',
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
  return {
    type,
    name: device.name,
    imageSrc: device.imageSrc,
  };
});

// Terminal-strip placement customization:
// Edit each `x` / `y` pair below to position each strip type on the canvas.
const TERMINAL_STRIP_PLACEMENTS: Partial<Record<SimulationComponentType, ShapePos>> = {
  battery: { x: 120, y: 280 },
  switch: { x: 215, y: 420 },
  button: { x: 400, y: 420 },
  buzzer: { x: 370, y: 640 },
  counter: { x: 185, y: 640 },
  lightIndicator: { x: 440, y: 130 },
  magneticMotorContactor: { x: 558, y: 335 },
  relayModule: { x: 558, y: 150 },
  rollerLever: { x: 700, y: 640 },
  solenoidValve: { x: 885, y: 640 },
};

// Retain only selected terminal strips on initial canvas load.

const INITIAL_COMPONENTS: Record<string, ShapePos> = {
  'battery-1': TERMINAL_STRIP_PLACEMENTS.battery!,
  'lightIndicator-1': TERMINAL_STRIP_PLACEMENTS.lightIndicator!,
  'relayModule-1': { x: 124, y: 420 },
  'relayModule-2': { x: 309, y: 420 },
  'relayModule-3': { x: 500, y: 420 },
  'counter-1': { x: 309, y: 640 },
  'counter-2': { x: 500, y: 640 },
  'magneticMotor-1': { x: 800, y: 515 },
  'rollerLever-1': { x: 800, y: 335 },
  'solenoidValve-1': { x: 800, y: 150 },
  'rollerLever-2': { x: 1000, y: 640 },
  'solenoidValve-2': { x: 1185, y: 640 }
};

// Initial terminal-strip transforms (customize per strip if needed).
const INITIAL_COMPONENT_TRANSFORMS: Record<string, { rotation: number; flipX: boolean }> = {
  'battery-1': { rotation: 180, flipX: false },
  'lightIndicator-1': { rotation: 90, flipX: false },
  'relayModule-1': { rotation: 0, flipX: false },
  'relayModule-2': { rotation: 0, flipX: false },
  'relayModule-3': { rotation: 0, flipX: false },
  'counter-1': { rotation: 180, flipX: false },
  'counter-2': { rotation: 180, flipX: false },
  'magneticMotor-1': { rotation: 270, flipX: false },
  'rollerLever-1': { rotation: 270, flipX: false },
  'solenoidValve-1': { rotation: 270, flipX: false },
  'rollerLever-2': { rotation: 180, flipX: false },
  'solenoidValve-2': { rotation: 180, flipX: false }
};

const WIRE_COLOR_OPTIONS = [
  { label: 'Green', value: '#27ae60' },
  { label: 'Red', value: '#e74c3c' },
  { label: 'Blue', value: '#3498db' },
  { label: 'Orange', value: '#e67e22' },
  { label: 'Purple', value: '#9b59b6' },
  { label: 'Black', value: '#2c3e50' },
];

const createEmptyTypeCount = () => ({
  battery: 0,
  switch: 0,
  button: 0,
  buzzer: 0,
  counter: 0,
  led: 0,
  resistor: 0,
  lightIndicator: 0,
  magneticMotorContactor: 0,
  relayModule: 0,
  rollerLever: 0,
  solenoidValve: 0,
});

const countPaletteTypes = (items: PaletteComponentType[]) => items.reduce((acc, type) => {
  if (Object.prototype.hasOwnProperty.call(acc, type)) {
    acc[type as keyof typeof acc] += 1;
  }
  return acc;
}, createEmptyTypeCount());

const countCanvasComponentTypes = (componentIds: string[]) => componentIds.reduce((acc, id) => {
  const inferredType = inferPaletteTypeFromComponentId(id);

  if (inferredType) {
    acc[inferredType] += 1;
  }

  return acc;
}, createEmptyTypeCount());

const getPinMeta = (pinId: string) => getPinMetaHelper(pinId);

const inferPaletteTypeFromComponentId = (componentId: string): SimulationComponentType | null => {
  return inferPaletteTypeHelper(componentId, SIMULATION_COMPONENT_TYPES) as SimulationComponentType | null;
};

const TERMINAL_COLORS = {
  positive: '#e74c3c',
  negative: '#2c3e50',
} as const;

// Lamp color mapping moved to AssetComponent

const getEnforcedWireColor = (fromPin: string, toPin: string) => {
  const fromRail = getBatteryRailForPin(fromPin);
  const toRail = getBatteryRailForPin(toPin);

  if (fromRail === 'positive' || toRail === 'positive') {
    return TERMINAL_COLORS.positive;
  }

  if (fromRail === 'negative' || toRail === 'negative') {
    return TERMINAL_COLORS.negative;
  }

  return null;
};

// --- 1. Strict Type Definitions ---
interface ShapePos {
  x: number;
  y: number;
}

interface ComponentTransform {
  rotation: number;
  flipX: boolean;
}

interface Connection {
  id: string;
  fromPin: string;
  toPin: string;
  color: string;
  intermediatePoints: Array<{ x: number; y: number }>;
}

interface CircuitSnapshot {
  components: Record<string, ShapePos>;
  wires: Connection[];
  componentTransforms: Record<string, ComponentTransform>;
  switchStates: Record<string, boolean>;
}

interface ClipboardComponent {
  type: SimulationComponentType;
  sourcePosition: ShapePos;
  transform: ComponentTransform;
  switchOn?: boolean;
}

interface SelectedIntermediatePoint {
  wireId: string;
  index: number;
}

// AssetComponent moved to src/components/AssetComponent.tsx

const DEFAULT_PIN_OFFSETS = {
  in: { x: 40, y: 0 },
  out: { x: 40, y: 120 },
} as const;

const DEFAULT_TRANSFORM: ComponentTransform = {
  rotation: 0,
  flipX: false,
};

// --- 4. Main Application Engine ---
export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });
  const [components, setComponents] = useState<Record<string, ShapePos>>(INITIAL_COMPONENTS);
  const [isDeviceSidebarCollapsed, setIsDeviceSidebarCollapsed] = useState(true);
  const [isControlsPanelCollapsed, setIsControlsPanelCollapsed] = useState(false);

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
    components: INITIAL_COMPONENTS,
    wires: [],
    componentTransforms: INITIAL_COMPONENT_TRANSFORMS,
    switchStates: {},
  });

  const sidebarWidth = Math.max(180, Math.min(280, Math.round(viewport.width * 0.2)));
  const deviceSidebarWidth = sidebarWidth;
  // Ladder sidebar size customization: adjust min/max/ratio values below.
  const controlsPanelWidth = Math.max(280, Math.min(360, Math.round(viewport.width * 0.28)));
  const stageWidth = Math.max(320, viewport.width);
  const stageHeight = Math.max(260, viewport.height - NAVBAR_HEIGHT);
  const controlsToggleLeft = isControlsPanelCollapsed ? 12 : controlsPanelWidth + 20;
  const deviceListToggleRight = isDeviceSidebarCollapsed ? 12 : deviceSidebarWidth + 20;

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
    setComponentTransforms((prev) => ({
      ...prev,
      [id]: { rotation: 0, flipX: false },
    }));
    if (type === 'switch') {
      setSwitchStates((prev) => ({
        ...prev,
        [id]: false,
      }));
    }

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

  const handleDeviceCanvasDrop = (
    event: React.DragEvent<HTMLDivElement>,
    target: 'input' | 'output',
  ) => {
    event.preventDefault();
    const droppedType = event.dataTransfer.getData('application/x-device-type') as PaletteComponentType;
    if (!COMPONENT_PALETTE.some((item) => item.type === droppedType)) {
      return;
    }

    if (target === 'input') {
      setInputDeviceTypes((prev) => [...prev, droppedType]);
    } else {
      setOutputDeviceTypes((prev) => [...prev, droppedType]);
    }
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
    (): CircuitSnapshot => ({
      components,
      wires,
      componentTransforms,
      switchStates,
    }),
    [components, wires, componentTransforms, switchStates],
  );

  const activeActivity = SIMULATION_ACTIVITIES[activeActivityIndex];
  const shouldShowInstructionImage = Boolean(activeActivity.instructionImageSrc)
    && !instructionImageFailures[activeActivity.id];

  const componentTypeCounts = useMemo(
    () => countCanvasComponentTypes(Object.keys(components)),
    [components],
  );

  const inputTypeCounts = useMemo(
    () => countPaletteTypes(inputDeviceTypes),
    [inputDeviceTypes],
  );

  const outputTypeCounts = useMemo(
    () => countPaletteTypes(outputDeviceTypes),
    [outputDeviceTypes],
  );

  const switchOnCount = useMemo(
    () => Object.entries(switchStates).filter(([id, isOn]) => id.startsWith('switch') && Boolean(isOn)).length,
    [switchStates],
  );

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

    if (result.passed) {
      setCompletedActivityIds((prev) => (
        prev.includes(activeActivity.id)
          ? prev
          : [...prev, activeActivity.id]
      ));
    }
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
    if (inferredType) {
      const asset = GENERAL_TERMINAL_STRIP_ASSET;
      return { width: asset.width, height: asset.height, pins: asset.pins };
    }
    return { width: 80, height: 120, pins: DEFAULT_PIN_OFFSETS };
  }, []);

  const getPinWireColor = (pinId: string): string | undefined => {
    if (selectedWireId) {
      const selected = wires.find((w) => w.id === selectedWireId);
      if (selected && (selected.fromPin === pinId || selected.toPin === pinId)) {
        return selected.color;
      }
    }

    const connected = wires.filter((w) => w.fromPin === pinId || w.toPin === pinId);
    if (connected.length > 0) {
      return connected[connected.length - 1].color;
    }

    return undefined;
  };

  const getPinPos = useCallback((pinId: string) => {
    const parts = pinId.split('-');
    const side = parts.pop() as string;
    const compId = parts.join('-');
    const pos = components[compId];

    if (!pos) {
      return { x: 0, y: 0 };
    }

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

    return {
      x: pos.x + transformedX,
      y: pos.y + transformedY,
    };
  }, [components, componentTransforms, getComponentNodeConfig]);

  const getWireDuctIntermediatePoints = useCallback((fromPin: string, toPin: string) => (
    computeWireDuctIntermediatePoints({
      fromPin,
      toPin,
      getPinPos,
      stageWidth,
      stageHeight,
      wires,
      getPinMeta,
      getComponentNodeConfig,
      componentTransforms,
      defaultTransform: DEFAULT_TRANSFORM,
      inferPaletteTypeFromComponentId,
      terminalStripPlacements: TERMINAL_STRIP_PLACEMENTS,
      topRowPins: TOP_ROW_PINS,
      bottomRowPins: BOTTOM_ROW_PINS,
    })
  ), [getPinPos, stageWidth, stageHeight, wires, getComponentNodeConfig, componentTransforms]);

  const rotateSelectedComponent = () => {
    if (!selectedComponentId) {
      return;
    }

    setComponentTransforms((prev) => {
      const current = prev[selectedComponentId] ?? DEFAULT_TRANSFORM;
      return {
        ...prev,
        [selectedComponentId]: {
          ...current,
          rotation: (current.rotation + 90) % 360,
        },
      };
    });
  };

  const flipSelectedComponent = () => {
    if (!selectedComponentId) {
      return;
    }

    setComponentTransforms((prev) => {
      const current = prev[selectedComponentId] ?? DEFAULT_TRANSFORM;
      return {
        ...prev,
        [selectedComponentId]: {
          ...current,
          flipX: !current.flipX,
        },
      };
    });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (activePin) {
      const pos = e.target.getStage()?.getPointerPosition();
      if (pos) setMousePos(pos);
    }
  };

  const handleStageMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (activePin) {
      const targetPin = (e.target as { attrs?: { pinId?: string } }).attrs?.pinId;
      if (targetPin && targetPin !== activePin) {
        const isDuplicate = wires.some((wire) =>
          (wire.fromPin === activePin && wire.toPin === targetPin)
          || (wire.fromPin === targetPin && wire.toPin === activePin)
        );

        if (!isDuplicate) {
          const ductIntermediatePoints = getWireDuctIntermediatePoints(activePin, targetPin);
          const enforcedColor = getEnforcedWireColor(activePin, targetPin);
          setWires(prev => [...prev, {
            id: crypto.randomUUID(),
            fromPin: activePin,
            toPin: targetPin,
            color: enforcedColor ?? wireColor,
            intermediatePoints: ductIntermediatePoints,
          }]);
        }
      }
      setActivePin(null);
      setMousePos(null);
      setSelectedWireId(null);
      setSelectedIntermediatePoint(null);
    }
  };

  const handlePinMouseDown = (pinId: string) => {
    setPinTooltip(null);
    if (selectedWireId) {
      const selectedWire = wires.find((wire) => wire.id === selectedWireId);
      if (selectedWire && (selectedWire.fromPin === pinId || selectedWire.toPin === pinId)) {
        setWires(prev => prev.filter((wire) => wire.id !== selectedWireId));
      }
      setSelectedWireId(null);
      setSelectedIntermediatePoint(null);
      setActivePin(null);
      setMousePos(null);
      return;
    }

    setActivePin(pinId);
    setSelectedIntermediatePoint(null);
    setSelectedComponentId(null);
    setMousePos(getPinPos(pinId));
  };

  const handleShowPinTooltip = useCallback((text: string, pos: ShapePos) => {
    setPinTooltip({ text, pos });
  }, []);

  const handleHidePinTooltip = useCallback(() => {
    setPinTooltip(null);
  }, []);

  const handleWireColorChange = (color: string) => {
    setWireColor(color);
    if (selectedWireId) {
      setWires((prev) => prev.map((wire) => (
        wire.id === selectedWireId
          ? {
            ...wire,
            color,
          }
          : wire
      )));
    }
    if (selectedComponentId) {
      setWires((prev) => prev.map((wire) => {
        const fromComp = wire.fromPin.split('-').slice(0, -1).join('-');
        const toComp = wire.toPin.split('-').slice(0, -1).join('-');
        if (fromComp === selectedComponentId || toComp === selectedComponentId) {
          return { ...wire, color };
        }
        return wire;
      }));
    }
  };

  const deleteSelected = useCallback(() => {
    if (selectedIntermediatePoint) {
      setWires((prev) => prev.map((wire) => {
        if (wire.id !== selectedIntermediatePoint.wireId) {
          return wire;
        }

        return {
          ...wire,
          intermediatePoints: (wire.intermediatePoints ?? []).filter((_, index) => index !== selectedIntermediatePoint.index),
        };
      }));
      setSelectedIntermediatePoint(null);
      return;
    }

    if (selectedWireId) {
      setWires((prev) => prev.filter((wire) => wire.id !== selectedWireId));
      setSelectedWireId(null);
      setSelectedIntermediatePoint(null);
      return;
    }

    if (selectedComponentId) {
      setComponents((prev) => {
        const next = { ...prev };
        delete next[selectedComponentId];
        return next;
      });
      setComponentTransforms((prev) => {
        const next = { ...prev };
        delete next[selectedComponentId];
        return next;
      });
      setSwitchStates((prev) => {
        const next = { ...prev };
        delete next[selectedComponentId];
        return next;
      });
      setWires((prev) => prev.filter((wire) => {
        const fromComponent = wire.fromPin.split('-').slice(0, -1).join('-');
        const toComponent = wire.toPin.split('-').slice(0, -1).join('-');
        return fromComponent !== selectedComponentId && toComponent !== selectedComponentId;
      }));
      if (activePin?.startsWith(`${selectedComponentId}-`)) {
        setActivePin(null);
        setMousePos(null);
      }
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
            const a = JSON.stringify(oldPoints);
            const b = JSON.stringify(newPoints);
            if (a === b) return wire;
            changed = true;
            return { ...wire, intermediatePoints: newPoints };
          } catch {
            return wire;
          }
        });

        return changed ? next : prev;
      });
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [componentTransforms, components, stageWidth, stageHeight, getWireDuctIntermediatePoints]);

  const handleCopy = () => {
    if (!selectedComponentId) {
      return;
    }

    const selectedPos = components[selectedComponentId];
    if (!selectedPos) {
      return;
    }

    const selectedTransform = componentTransforms[selectedComponentId] ?? DEFAULT_TRANSFORM;
    setClipboardComponent({
      type: inferComponentType(selectedComponentId),
      sourcePosition: selectedPos,
      transform: selectedTransform,
      switchOn: switchStates[selectedComponentId],
    });
  };

  const handlePaste = () => {
    if (!clipboardComponent) {
      return;
    }

    const newId = createComponentId(clipboardComponent.type);
    const pastedPos = {
      x: clipboardComponent.sourcePosition.x + 28,
      y: clipboardComponent.sourcePosition.y + 28,
    };

    setComponents((prev) => ({
      ...prev,
      [newId]: pastedPos,
    }));
    setComponentTransforms((prev) => ({
      ...prev,
      [newId]: clipboardComponent.transform,
    }));
    if (clipboardComponent.type === 'switch') {
      setSwitchStates((prev) => ({
        ...prev,
        [newId]: Boolean(clipboardComponent.switchOn),
      }));
    }
    setSelectedComponentId(newId);
    setSelectedWireId(null);
  };

  const handleUndo = () => {
    if (!historyPast.length) {
      return;
    }

    const previous = historyPast[historyPast.length - 1];
    const current = getCurrentSnapshot();
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [current, ...prev].slice(0, 50));
    applySnapshot(previous);
  };

  const handleRedo = () => {
    if (!historyFuture.length) {
      return;
    }

    const next = historyFuture[0];
    const current = getCurrentSnapshot();
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev, current].slice(-50));
    applySnapshot(next);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWireId || selectedComponentId || selectedIntermediatePoint) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedWireId, selectedComponentId, selectedIntermediatePoint, deleteSelected]);

  useEffect(() => {
    const currentSnapshot = getCurrentSnapshot();
    const previousSnapshot = previousSnapshotRef.current;

    if (isApplyingHistoryRef.current) {
      previousSnapshotRef.current = currentSnapshot;
      isApplyingHistoryRef.current = false;
      return;
    }

    const hasChanged = JSON.stringify(previousSnapshot) !== JSON.stringify(currentSnapshot);
    if (hasChanged) {
      setHistoryPast((prev) => [...prev, previousSnapshot].slice(-50));
      setHistoryFuture([]);
      previousSnapshotRef.current = currentSnapshot;
    }
  }, [components, wires, componentTransforms, switchStates, getCurrentSnapshot]);

  // Make the simulation responsive to the container instead of the whole browser window!
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewport({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    // Added the containerRef and set it to width/height 100% so it acts as an embeddable widget
    <div className="app-shell" ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <header className="app-navbar">
        <div className="app-toolbar">
          <button className="toolbar-action" type="button" onClick={handleCopy} disabled={!selectedComponentId} aria-label="Copy" title="Copy">
            <span className="toolbar-icon" aria-hidden>⧉</span>
          </button>
          <button className="toolbar-action" type="button" onClick={handlePaste} disabled={!clipboardComponent} aria-label="Paste" title="Paste">
            <span className="toolbar-icon" aria-hidden>📋</span>
          </button>
          <button className="toolbar-action" type="button" onClick={deleteSelected} disabled={!selectedWireId && !selectedComponentId && !selectedIntermediatePoint} aria-label="Delete" title="Delete">
            <span className="toolbar-icon" aria-hidden>🗑</span>
          </button>
          <button className="toolbar-action" type="button" onClick={handleUndo} disabled={!historyPast.length} aria-label="Undo" title="Undo">
            <span className="toolbar-icon" aria-hidden>↶</span>
          </button>
          <button className="toolbar-action" type="button" onClick={handleRedo} disabled={!historyFuture.length} aria-label="Redo" title="Redo">
            <span className="toolbar-icon" aria-hidden>↷</span>
          </button>
          <button className="toolbar-action" type="button" onClick={rotateSelectedComponent} disabled={!selectedComponentId} aria-label="Rotate" title="Rotate">
            <span className="toolbar-icon" aria-hidden>⟳</span>
          </button>
          <button className="toolbar-action" type="button" onClick={flipSelectedComponent} disabled={!selectedComponentId} aria-label="Flip" title="Flip">
            <span className="toolbar-icon" aria-hidden>⇋</span>
          </button>
          <label className="toolbar-color-control" title="Wire Color" aria-label="Wire Color">
            <select
              className="toolbar-color-select"
              value={wireColor}
              onChange={(e) => handleWireColorChange(e.target.value)}
            >
              {WIRE_COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="app-layout">
        <div className="simulation-canvas-frame" style={{ width: stageWidth, height: stageHeight }}>
          <Stage
            width={stageWidth}
            height={stageHeight}
            onMouseMove={handleMouseMove}
            onMouseUp={handleStageMouseUp}
            onMouseDown={() => {
              setPinTooltip(null);
              if (!activePin) {
                setSelectedWireId(null);
                setSelectedIntermediatePoint(null);
                setSelectedComponentId(null);
              }
            }}
          >
            <Layer>
              {/* Render Established Wires from the Netlist */}
              {wires.map((wire) => {
                const start = getPinPos(wire.fromPin);
                const end = getPinPos(wire.toPin);
                const intermediatePoints = wire.intermediatePoints ?? [];
                const polylinePoints = [start, ...intermediatePoints, end];
                const flattenedPoints = polylinePoints.flatMap((point) => [point.x, point.y]);
                const isSelected = selectedWireId === wire.id;
                return (
                  <Line
                    key={wire.id}
                    points={flattenedPoints}
                    stroke={wire.color}
                    strokeWidth={isSelected ? 6 : 4}
                    hitStrokeWidth={14}
                    lineCap="round"
                    lineJoin="round"
                    tension={0}
                    shadowColor={isSelected ? '#f39c12' : undefined}
                    shadowBlur={isSelected ? 12 : 0}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      setSelectedWireId(wire.id);
                      setSelectedIntermediatePoint(null);
                      setSelectedComponentId(null);
                      setActivePin(null);
                      setMousePos(null);
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      const stagePointer = e.target.getStage()?.getPointerPosition();
                      if (!stagePointer) {
                        return;
                      }

                      let nearestSegmentIndex = 0;
                      let nearestDistanceSquared = Number.POSITIVE_INFINITY;

                      for (let i = 0; i < polylinePoints.length - 1; i += 1) {
                        const distanceSquared = getDistanceSquaredToSegment(
                          stagePointer,
                          polylinePoints[i],
                          polylinePoints[i + 1],
                        );

                        if (distanceSquared < nearestDistanceSquared) {
                          nearestDistanceSquared = distanceSquared;
                          nearestSegmentIndex = i;
                        }
                      }

                      setWires((prev) => prev.map((currentWire) => {
                        if (currentWire.id !== wire.id) {
                          return currentWire;
                        }

                        const nextIntermediatePoints = [...(currentWire.intermediatePoints ?? [])];
                        const elbow = getOrthogonalElbow(
                          stagePointer,
                          polylinePoints[nearestSegmentIndex],
                          polylinePoints[nearestSegmentIndex + 1],
                        );
                        nextIntermediatePoints.splice(nearestSegmentIndex, 0, elbow);

                        return {
                          ...currentWire,
                          intermediatePoints: nextIntermediatePoints,
                        };
                      }));
                      setSelectedWireId(wire.id);
                      setSelectedIntermediatePoint({ wireId: wire.id, index: nearestSegmentIndex });
                      setSelectedComponentId(null);
                      setActivePin(null);
                      setMousePos(null);
                    }}
                  />
                );
              })}

              {wires.flatMap((wire) => {
                if (selectedWireId !== wire.id) {
                  return [];
                }

                const points = wire.intermediatePoints ?? [];
                return points.map((point, index) => {
                  const isPointSelected =
                    selectedIntermediatePoint?.wireId === wire.id
                    && selectedIntermediatePoint.index === index
                    && selectedWireId === wire.id;

                  return (
                    <Circle
                      key={`${wire.id}-point-${index}`}
                      x={point.x}
                      y={point.y}
                      radius={isPointSelected ? 7 : 6}
                      fill={isPointSelected ? '#f39c12' : '#ffffff'}
                      stroke="#2c3e50"
                      strokeWidth={2}
                      draggable={!activePin}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        setSelectedWireId(wire.id);
                        setSelectedIntermediatePoint({ wireId: wire.id, index });
                        setSelectedComponentId(null);
                        setActivePin(null);
                        setMousePos(null);
                      }}
                      onDragMove={(e) => {
                        const wireStart = getPinPos(wire.fromPin);
                        const wireEnd = getPinPos(wire.toPin);
                        const pointer = { x: e.target.x(), y: e.target.y() };
                        const previousPoint = index === 0
                          ? wireStart
                          : points[index - 1];
                        const nextPoint = index === points.length - 1
                          ? wireEnd
                          : points[index + 1];
                        const snappedPoint = getSnappedIntermediatePoint(pointer, previousPoint, nextPoint);

                        e.target.x(snappedPoint.x);
                        e.target.y(snappedPoint.y);

                        setWires((prev) => prev.map((currentWire) => {
                          if (currentWire.id !== wire.id) {
                            return currentWire;
                          }

                          const nextIntermediatePoints = [...(currentWire.intermediatePoints ?? [])];
                          nextIntermediatePoints[index] = snappedPoint;
                          return {
                            ...currentWire,
                            intermediatePoints: nextIntermediatePoints,
                          };
                        }));
                      }}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        setWires((prev) => prev.map((currentWire) => {
                          if (currentWire.id !== wire.id) {
                            return currentWire;
                          }

                          return {
                            ...currentWire,
                            intermediatePoints: (currentWire.intermediatePoints ?? []).filter((_, pointIndex) => pointIndex !== index),
                          };
                        }));
                        setSelectedIntermediatePoint(null);
                      }}
                    />
                  );
                });
              })}

              {/* Live Ghost Wire during dragging */}
              {activePin && mousePos && (
                <Line
                  points={[getPinPos(activePin).x, getPinPos(activePin).y, mousePos.x, mousePos.y]}
                  stroke="#e67e22"
                  strokeWidth={2}
                  dash={[10, 5]}
                />
              )}

              {/* Component Instances */}
              {Object.entries(components).map(([id, pos]) => {
                const componentType = inferPaletteTypeFromComponentId(id);

                return componentType ? (
                  (() => {
                    const asset = GENERAL_TERMINAL_STRIP_ASSET;
                    const pinKeys = Object.keys(asset.pins)
                      .filter((key) => /^pin_\d+$/.test(key))
                      .sort((a, b) => Number(a.replace('pin_', '')) - Number(b.replace('pin_', '')));
                    const pinAKey = pinKeys[0] ?? 'in';
                    const pinBKey = pinKeys[1] ?? 'out';
                    const pinAOffset = asset.pins[pinAKey] ?? { x: 8, y: asset.height / 2 };
                    const pinBOffset = asset.pins[pinBKey] ?? { x: asset.width - 8, y: asset.height / 2 };
                    const pinOffsets = Object.fromEntries(
                      pinKeys.map((key) => [key, asset.pins[key]]),
                    );

                    return (
                      <AssetComponent
                        key={id}
                        id={id}
                        x={pos.x}
                        y={pos.y}
                        rotation={componentTransforms[id]?.rotation ?? 0}
                        flipX={componentTransforms[id]?.flipX ?? false}
                        isWiring={Boolean(activePin)}
                        isSelected={selectedComponentId === id}
                        imageSrc={asset.imageSrc}
                        width={asset.width}
                        height={asset.height}
                        nodeSize={NODE_SIZE}
                        isLocked={!COMPONENTS_MOVABLE}
                        pinAId={pinAKey}
                        pinBId={pinBKey}
                        pinAOffset={pinAOffset}
                        pinBOffset={pinBOffset}
                        pinOffsets={pinOffsets}
                        onPinMouseDown={handlePinMouseDown}
                        pinWireColorForPin={getPinWireColor}
                        pinTooltipForPin={getPinTooltipText}
                        onShowPinTooltip={handleShowPinTooltip}
                        onHidePinTooltip={handleHidePinTooltip}
                        onSelect={(componentId) => {
                          setSelectedComponentId(componentId);
                          setSelectedWireId(null);
                          setActivePin(null);
                          setMousePos(null);
                        }}
                        onDrag={(compId, x, y) => setComponents(prev => ({ ...prev, [compId]: { x, y } }))}
                      />
                    );
                  })()
                ) : (
                  <CircuitComponent
                    key={id}
                    id={id}
                    x={pos.x}
                    y={pos.y}
                    rotation={componentTransforms[id]?.rotation ?? 0}
                    flipX={componentTransforms[id]?.flipX ?? false}
                    label={id.toUpperCase()}
                    color="#e74c3c"
                    nodeSize={NODE_SIZE}
                    isWiring={Boolean(activePin)}
                    isLocked={!COMPONENTS_MOVABLE}
                    isSelected={selectedComponentId === id}
                    onPinMouseDown={handlePinMouseDown}
                    pinWireColorForPin={getPinWireColor}
                    onShowPinTooltip={handleShowPinTooltip}
                    onHidePinTooltip={handleHidePinTooltip}
                    onSelect={(componentId) => {
                      setSelectedComponentId(componentId);
                      setSelectedWireId(null);
                      setActivePin(null);
                      setMousePos(null);
                    }}
                    onDrag={(compId, x, y) => setComponents(prev => ({ ...prev, [compId]: { x, y } }))}
                  />
                )

              })}
            </Layer>
          </Stage>
          {pinTooltip && (
            <div
              className="pin-tooltip-popup"
              style={{
                left: pinTooltip.pos.x + 12,
                top: pinTooltip.pos.y - 10,
              }}
            >
              {pinTooltip.text}
            </div>
          )}
        </div>

        <button
          type="button"
          className="controls-container-toggle"
          style={{ left: controlsToggleLeft }}
          aria-label={isControlsPanelCollapsed ? 'Show controls panel' : 'Hide controls panel'}
          title={isControlsPanelCollapsed ? 'Show controls' : 'Hide controls'}
          onClick={() => setIsControlsPanelCollapsed((prev) => !prev)}
        >
          {isControlsPanelCollapsed ? '⟩' : '⟨'}
        </button>

        <button
          type="button"
          className="controls-container-toggle"
          style={{ right: deviceListToggleRight }}
          aria-label={isDeviceSidebarCollapsed ? 'Expand device list' : 'Collapse device list'}
          title={isDeviceSidebarCollapsed ? 'Expand' : 'Collapse'}
          onClick={() => setIsDeviceSidebarCollapsed((prev) => !prev)}
        >
          {isDeviceSidebarCollapsed ? '⟨' : '⟩'}
        </button>

        {!isControlsPanelCollapsed && (
          <aside className="ladder-sidebar" style={{ width: controlsPanelWidth }}>
            <h3 className="ladder-sidebar-title">Controls</h3>
            <div className="ladder-sidebar-section ladder-sidebar-section-devices">
              <h3 className="ladder-sidebar-title">List of Devices to Use</h3>
              <div className="device-canvas-grid">
                <div
                  className="device-drop-canvas"
                  onDragOver={allowDeviceCanvasDrop}
                  onDrop={(event) => handleDeviceCanvasDrop(event, 'input')}
                >
                  <h4 className="device-canvas-title">Input Device</h4>
                  <div className="device-chip-list">
                    {inputDeviceTypes.length === 0 && <p className="device-empty-text">Drag devices here</p>}
                    {inputDeviceTypes.map((type, index) => {
                      const item = getPaletteItem(type);
                      if (!item) return null;
                      return (
                        <div key={`input-${type}-${index}`} className="device-chip">
                          <img src={item.imageSrc} alt={item.name} className="device-chip-image" />
                          <span className="device-chip-name">{item.name}</span>
                          <button
                            type="button"
                            className="device-chip-remove"
                            aria-label={`Remove ${item.name} from input`}
                            title="Remove"
                            onClick={() => removeInputDevice(index)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="device-drop-canvas"
                  onDragOver={allowDeviceCanvasDrop}
                  onDrop={(event) => handleDeviceCanvasDrop(event, 'output')}
                >
                  <h4 className="device-canvas-title">Output/Control Device</h4>
                  <div className="device-chip-list">
                    {outputDeviceTypes.length === 0 && <p className="device-empty-text">Drag devices here</p>}
                    {outputDeviceTypes.map((type, index) => {
                      const item = getPaletteItem(type);
                      if (!item) return null;
                      return (
                        <div key={`output-${type}-${index}`} className="device-chip">
                          <img src={item.imageSrc} alt={item.name} className="device-chip-image" />
                          <span className="device-chip-name">{item.name}</span>
                          <button
                            type="button"
                            className="device-chip-remove"
                            aria-label={`Remove ${item.name} from output`}
                            title="Remove"
                            onClick={() => removeOutputDevice(index)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="ladder-sidebar-section ladder-sidebar-section-diagram">
              <div className="ladder-diagram-header">
                <h3 className="ladder-sidebar-title">Ladder Diagram</h3>
                <p className={`activity-feedback ${activityFeedback === '100%' ? 'activity-feedback-pass' : 'activity-feedback-fail'}`}>
                  {activityFeedback}
                </p>
              </div>
              <div className="activity-panel">
                <h4 className="activity-title">{activeActivity.title}</h4>
                {shouldShowInstructionImage ? (
                  <img
                    src={activeActivity.instructionImageSrc}
                    alt={`${activeActivity.title} instructions`}
                    className="activity-instruction-image"
                    onError={() => {
                      setInstructionImageFailures((prev) => ({
                        ...prev,
                        [activeActivity.id]: true,
                      }));
                    }}
                  />
                ) : activeActivity.instructions?.length ? (
                  <ul className="activity-instruction-list">
                    {activeActivity.instructions.map((instruction, index) => (
                      <li key={`${activeActivity.id}-instruction-${index}`} className="activity-instruction-item">
                        {instruction}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="activity-actions">
                  <button
                    type="button"
                    className="activity-button activity-button-primary"
                    onClick={runActivityValidation}
                  >
                    Check Answer
                  </button>
                </div>

              </div>
            </div>
          </aside>
        )}

        {!isDeviceSidebarCollapsed && (
          <aside className="sidebar" style={{ width: deviceSidebarWidth }}>
            <div className="sidebar-header">
              <h3 className="sidebar-title">List of Devices</h3>
            </div>
            <div className="palette-grid">
              {COMPONENT_PALETTE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addComponent(item.type)}
                  className="palette-item"
                  draggable
                  onDragStart={(event) => handlePaletteDragStart(event, item.type)}
                >
                  <img
                    src={item.imageSrc}
                    alt={item.name}
                    className="palette-item-image"
                  />
                  <span className="palette-item-name">{item.name}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

      </div>
    </div>
  );
}