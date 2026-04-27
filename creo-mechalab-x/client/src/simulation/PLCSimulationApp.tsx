import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stage, Layer, Circle, Line, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

import { ArrowLeft, Play, Trash2, Undo2, Redo2, Sun, Moon, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import './SimulationApp.css';
import PortraitGuard from '../components/PortraitGuard';
import CyberTransition from '../components/CyberTransition';
import { completeSimulation } from '../api/trainees';
import { getActivityAnswerByRouteId, getActivityRouteIds } from './constants/activityAnswers';
import { PLC_DEVICE_LIBRARY, type PlcDeviceId, type PlcDeviceZone } from './constants/plcDeviceLibrary';
import {
    SIMULATION_STATE_STORAGE_KEY,
    buildActivityStateKey,
    buildSimulationPath,
    getStoredActivityState,
    getStoredSimulationStates,
    normalizeActivityModuleId,
} from './utils/activityState';

import { computePLCWirePath } from './utils/plcWireRouting';
import { HW_STYLES, PLC_SOLENOID_LABELS, REED_LIGHT_OFFSET_Y } from './config/plcBoardLayout';
import { GOTT_TRAINER_PORTS, type PlcPortConfig } from './config/plcPinConfiguration';
import { PlcPanelBackground, PlcPanelText, PlcHardwareJack } from './components/plcBoardUI';
import { PlcPneumaticAssembly, type PlcCylinderId, type PlcCylinderPositions } from './components/PlcPneumaticAssembly';

// IMPORT THE GUIDE
import TutorialGuide, { type TutorialStep } from '../components/TutorialGuide';

interface Connection { id: string; fromPin: string; toPin: string; color: string; points: number[]; }
interface SavedPlcActivityState {
    wires: Array<Pick<Connection, 'id' | 'fromPin' | 'toPin' | 'color'>>;
    verifiedAt?: string;
}

interface PlcSimulationRouteEntry {
    simulationId?: number;
    routeId: string;
    activityModuleId?: number | null;
    orderNo?: number | null;
    title?: string;
}

interface PlcValidationResult {
    passed: boolean;
    message: string;
    issues: string[];
    displayIssues: string[];
    diagnosticIssues: string[];
    wrongConnections: Array<{ fromPin: string; toPin: string }>;
}

interface PLCSimulationAppProps {
    routeId?: string;
    moduleId?: number;
    activityModuleId?: number;
    simulationId?: number;
    activityEntries?: PlcSimulationRouteEntry[];
    initialCompletedRoutes?: string[];
    onNavigateBack?: () => void;
}

const routePlcConnections = (
    connections: Array<Pick<Connection, 'id' | 'fromPin' | 'toPin' | 'color'>>,
): Connection[] => connections.map((connection, index) => ({
    ...connection,
    points: computePLCWirePath(connection.fromPin, connection.toPin, GOTT_TRAINER_PORTS, index),
}));

const toWireKey = (fromPin: string, toPin: string) => [fromPin, toPin].sort().join('|');

const PLC_DEVICE_USE_ZONES = [
    {
        id: 'input',
        title: 'Input Device',
    },
    {
        id: 'output',
        title: 'Output/Control Device',
    },
] as const;

interface AssignedPlcDevice {
    deviceId: PlcDeviceId;
    quantity: number;
}

type AssignedPlcDevices = Record<PlcDeviceZone, AssignedPlcDevice[]>;
type PlcDeviceDragState = { deviceId: PlcDeviceId; source: PlcDeviceZone | 'library' } | null;

const PLC_DEVICE_QUANTITY_LIMITS: Partial<Record<PlcDeviceId, number>> = {
    'solenoid-valve': 3,
    'limit-switch': 4,
    'magnetic-reed-switch-sensor': 6,
};

type Activity61OutputCommand = 'extend' | 'retract' | null;

const ACTIVITY_61_ROUTE_ID = '6.1';
const ACTIVITY_61_REQUIRED_INPUT_DEVICE_COUNTS: Partial<Record<PlcDeviceId, number>> = {
    'push-button': 1,
};
const ACTIVITY_61_REQUIRED_OUTPUT_DEVICE_COUNTS: Partial<Record<PlcDeviceId, number>> = {
    'plc-module': 1,
    'solenoid-valve': 1,
};
const createRetractedPlcCylinderPositions = (): PlcCylinderPositions => ({
    A: 'retracted',
    B: 'retracted',
    C: 'retracted',
});
const ACTIVITY_61_REED_LIGHT_PAIRS: Array<{ cylinderId: PlcCylinderId; retPortId: string; extPortId: string }> = [
    { cylinderId: 'A', retPortId: 'reed_ret_1.1', extPortId: 'reed_ext_1.2' },
    { cylinderId: 'B', retPortId: 'reed_ret_2.1', extPortId: 'reed_ext_2.2' },
    { cylinderId: 'C', retPortId: 'reed_ret_3.1', extPortId: 'reed_ext_3.2' },
];

const createEmptyAssignedPlcDevices = (): AssignedPlcDevices => ({ input: [], output: [] });
const isPlcDeviceId = (value: string): value is PlcDeviceId =>
    PLC_DEVICE_LIBRARY.some((device) => device.id === value);
const getPlcDeviceById = (deviceId: PlcDeviceId) =>
    PLC_DEVICE_LIBRARY.find((device) => device.id === deviceId) ?? PLC_DEVICE_LIBRARY[0];
const getPlcDeviceQuantityLimit = (deviceId: PlcDeviceId) => PLC_DEVICE_QUANTITY_LIMITS[deviceId] ?? 1;
const getAssignedPlcDeviceCounts = (devices: AssignedPlcDevice[]) =>
    devices.reduce<Partial<Record<PlcDeviceId, number>>>((counts, device) => {
        counts[device.deviceId] = (counts[device.deviceId] ?? 0) + device.quantity;
        return counts;
    }, {});
const hasExactAssignedPlcDeviceCounts = (
    devices: AssignedPlcDevice[],
    requiredCounts: Partial<Record<PlcDeviceId, number>>,
) => {
    const actualCounts = getAssignedPlcDeviceCounts(devices);
    const comparedDeviceIds = new Set<PlcDeviceId>([
        ...(Object.keys(requiredCounts) as PlcDeviceId[]),
        ...(Object.keys(actualCounts) as PlcDeviceId[]),
    ]);

    return Array.from(comparedDeviceIds).every((deviceId) =>
        (actualCounts[deviceId] ?? 0) === (requiredCounts[deviceId] ?? 0),
    );
};
const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const createPassingPlcValidationResult = (message: string): PlcValidationResult => ({
    passed: true,
    message,
    issues: [],
    displayIssues: [],
    diagnosticIssues: [],
    wrongConnections: [],
});
const createFailingPlcValidationResult = (
    message: string,
    displayIssues: string[],
    diagnosticIssues: string[] = displayIssues,
    wrongConnections: Array<{ fromPin: string; toPin: string }> = [],
): PlcValidationResult => ({
    passed: false,
    message,
    issues: uniqueStrings(displayIssues),
    displayIssues: uniqueStrings(displayIssues),
    diagnosticIssues: uniqueStrings(diagnosticIssues),
    wrongConnections,
});

const getPlcConnectionOptions = (
    requirement: NonNullable<ReturnType<typeof getActivityAnswerByRouteId>['rule']['customConnections']>[number],
) => Array.isArray(requirement[0]) ? requirement : [requirement];

const getValidPlcWireKeys = (activity: ReturnType<typeof getActivityAnswerByRouteId>) => {
    const validWireKeys = new Set<string>();

    for (const requirement of activity.rule.customConnections ?? []) {
        for (const [fromPin, toPin] of getPlcConnectionOptions(requirement)) {
            validWireKeys.add(toWireKey(fromPin, toPin));
        }
    }

    return validWireKeys;
};

const getWrongPlcConnectionsForActivity = (
    activity: ReturnType<typeof getActivityAnswerByRouteId>,
    wires: Connection[],
) => {
    if (activity.routeId !== ACTIVITY_61_ROUTE_ID) return [];

    const validWireKeys = getValidPlcWireKeys(activity);
    if (!validWireKeys.size) return [];

    return wires
        .filter((wire) => !validWireKeys.has(toWireKey(wire.fromPin, wire.toPin)))
        .map(({ fromPin, toPin }) => ({ fromPin, toPin }));
};

const validateActivity61RequiredDevices = (
    routeId: string,
    assignedDevices: AssignedPlcDevices,
): PlcValidationResult => {
    if (routeId !== ACTIVITY_61_ROUTE_ID) {
        return createPassingPlcValidationResult('Required devices verified.');
    }

    const hasRequiredInputDevices = hasExactAssignedPlcDeviceCounts(
        assignedDevices.input,
        ACTIVITY_61_REQUIRED_INPUT_DEVICE_COUNTS,
    );
    const hasRequiredOutputDevices = hasExactAssignedPlcDeviceCounts(
        assignedDevices.output,
        ACTIVITY_61_REQUIRED_OUTPUT_DEVICE_COUNTS,
    );

    if (hasRequiredInputDevices && hasRequiredOutputDevices) {
        return createPassingPlcValidationResult('Required devices verified.');
    }

    return createFailingPlcValidationResult(
        'Required devices are missing or placed incorrectly.',
        ['Required devices are missing or placed incorrectly.'],
        [
            `Input devices exact count valid: ${hasRequiredInputDevices}`,
            `Output/control devices exact count valid: ${hasRequiredOutputDevices}`,
        ],
    );
};

const evaluatePlcActivity = (
    activity: ReturnType<typeof getActivityAnswerByRouteId>,
    wires: Connection[],
): PlcValidationResult => {
    if (activity.isPlaceholder) {
        return createFailingPlcValidationResult(
            'Verification is not configured for this PLC activity yet.',
            ['Verification is not configured for this PLC activity yet.'],
            ['Final wiring requirements for this route are still pending.'],
        );
    }

    const displayIssues: string[] = [];
    const diagnosticIssues: string[] = [];
    if (activity.rule.minWires && wires.length < activity.rule.minWires) {
        displayIssues.push('PLC wiring validation failed.');
        diagnosticIssues.push(`Add at least ${activity.rule.minWires} wire connection(s).`);
    }

    const wireSet = new Set(wires.map((wire) => toWireKey(wire.fromPin, wire.toPin)));
    for (const [requirementIndex, requirement] of (activity.rule.customConnections ?? []).entries()) {
        const options = getPlcConnectionOptions(requirement);
        const matched = options.some(([fromPin, toPin]) => wireSet.has(toWireKey(fromPin, toPin)));
        if (matched) continue;

        const optionLabel = options
            .map(([fromPin, toPin]) => `${fromPin} ↔ ${toPin}`)
            .join(' or ');
        diagnosticIssues.push(`Missing required connection: ${optionLabel}`);
        displayIssues.push('PLC wiring validation failed.');

        if (activity.routeId === ACTIVITY_61_ROUTE_ID) {
            displayIssues.push(requirementIndex <= 4
                ? 'Check the required input wiring.'
                : 'Check the required output/control wiring.');
        }
    }

    if (diagnosticIssues.length > 0) {
        return createFailingPlcValidationResult(
            'PLC wiring validation failed.',
            displayIssues,
            diagnosticIssues,
        );
    }

    return createPassingPlcValidationResult(`Verified ${activity.title}.`);
};

export default function PLCSimulationApp({
    routeId,
    moduleId,
    activityModuleId,
    simulationId,
    activityEntries = [],
    initialCompletedRoutes = [],
    onNavigateBack,
}: PLCSimulationAppProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true);
    const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [isPlcDeviceDrawerOpen, setIsPlcDeviceDrawerOpen] = useState(false);
    const [assignedPlcDevices, setAssignedPlcDevices] = useState<AssignedPlcDevices>(() => createEmptyAssignedPlcDevices());
    const [plcDeviceDragState, setPlcDeviceDragState] = useState<PlcDeviceDragState>(null);
    const [activePlcDropZone, setActivePlcDropZone] = useState<PlcDeviceZone | null>(null);
    const completionRequestRef = useRef<Set<number>>(new Set());

    const resolvedRouteId = useMemo(() => {
        const normalizedRouteId = routeId?.trim();
        return normalizedRouteId || '6.1';
    }, [routeId]);
    const resolvedModuleId = useMemo(() => normalizeActivityModuleId(moduleId) ?? 6, [moduleId]);
    const resolvedActivityModuleId = useMemo(
        () => normalizeActivityModuleId(activityModuleId)
            ?? (resolvedRouteId.startsWith('6.') ? 6 : resolvedModuleId),
        [activityModuleId, resolvedModuleId, resolvedRouteId],
    );
    const activityPreset = useMemo(
        () => getActivityAnswerByRouteId(resolvedRouteId, resolvedActivityModuleId),
        [resolvedActivityModuleId, resolvedRouteId],
    );
    const activityStateKey = useMemo(
        () => buildActivityStateKey(activityPreset.routeId, resolvedModuleId) ?? activityPreset.routeId,
        [activityPreset.routeId, resolvedModuleId],
    );
    const completedRouteSet = useMemo(() => new Set(initialCompletedRoutes), [initialCompletedRoutes]);

    const routeEntries = useMemo<PlcSimulationRouteEntry[]>(() => {
        if (activityEntries.length > 0) {
            return [...activityEntries].sort((left, right) => {
                const leftOrder = left.orderNo ?? Number.MAX_SAFE_INTEGER;
                const rightOrder = right.orderNo ?? Number.MAX_SAFE_INTEGER;
                if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                if ((left.simulationId ?? 0) !== (right.simulationId ?? 0)) {
                    return (left.simulationId ?? 0) - (right.simulationId ?? 0);
                }
                return left.routeId.localeCompare(right.routeId);
            });
        }

        return getActivityRouteIds(6).map((entryRouteId, index) => {
            const fallbackActivity = getActivityAnswerByRouteId(entryRouteId, 6);
            return {
                routeId: entryRouteId,
                activityModuleId: 6,
                orderNo: index + 1,
                title: fallbackActivity.title,
            };
        });
    }, [activityEntries]);

    const currentIndex = useMemo(() => {
        if (simulationId) {
            const matchBySimulation = routeEntries.findIndex((entry) => entry.simulationId === simulationId);
            if (matchBySimulation !== -1) return matchBySimulation;
        }

        return routeEntries.findIndex((entry) => entry.routeId === activityPreset.routeId);
    }, [activityPreset.routeId, routeEntries, simulationId]);

    const currentRouteEntry = currentIndex >= 0 ? routeEntries[currentIndex] : null;
    const nextRouteEntry = currentIndex >= 0 && currentIndex < routeEntries.length - 1
        ? routeEntries[currentIndex + 1]
        : null;

    const [isCanvasReady, setIsCanvasReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsCanvasReady(true), 700);
        return () => clearTimeout(timer);
    }, []);

    const [isAcPowerOn, setIsAcPowerOn] = useState<boolean>(false);
    const [isStartPressed, setIsStartPressed] = useState<boolean>(false);
    const [isStopPressed, setIsStopPressed] = useState<boolean>(false);
    const [plcCylinderPositions, setPlcCylinderPositions] = useState<PlcCylinderPositions>(() => createRetractedPlcCylinderPositions());
    const [activity61OutputCommand, setActivity61OutputCommand] = useState<Activity61OutputCommand>(null);
    const [activeKnob, setActiveKnob] = useState<'selector' | 'emo' | `input-${number}` | null>(null);
    const [selectorAngle, setSelectorAngle] = useState<number>(0);
    const [emoAngle, setEmoAngle] = useState<number>(0);
    const [inputKnobAngles, setInputKnobAngles] = useState<number[]>(Array.from({ length: 12 }, () => 0));

    const [savedStates, setSavedStates] = useState<Record<string, SavedPlcActivityState>>(
        () => getStoredSimulationStates<SavedPlcActivityState>(SIMULATION_STATE_STORAGE_KEY),
    );
    const [wires, setWires] = useState<Connection[]>(() => {
        const saved = getStoredActivityState(
            getStoredSimulationStates<SavedPlcActivityState>(SIMULATION_STATE_STORAGE_KEY),
            activityPreset.routeId,
            resolvedModuleId,
        );
        return saved ? routePlcConnections(saved.wires) : [];
    });
    const [wireColor, setWireColor] = useState<string>('#e74c3c');
    const [activePin, setActivePin] = useState<string | null>(null);
    const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
    const [verificationResult, setVerificationResult] = useState<PlcValidationResult | null>(null);
    const [isPersistingCompletion, setIsPersistingCompletion] = useState(false);

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
    const isPlcRouteCompleted = useCallback((candidateRouteId: string) => {
        const completionKey = buildActivityStateKey(candidateRouteId, resolvedModuleId) ?? candidateRouteId;
        return getStoredActivityState(savedStates, candidateRouteId, resolvedModuleId) !== null
            || completedRouteSet.has(completionKey);
    }, [completedRouteSet, resolvedModuleId, savedStates]);

    const SIDEBAR_WIDTH = 360;
    const DEVICE_DRAWER_OPEN_WIDTH = 320;
    const DEVICE_DRAWER_COLLAPSED_WIDTH = 60;
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
    const plcOutputIndicatorLights: Array<{
        id: string;
        x: number;
        y: number;
        command?: Exclude<Activity61OutputCommand, null>;
    }> = [
        { id: 'com1-out00', x: UPPER_RELAY_LIGHT_START_X, y: UPPER_RELAY_LIGHT_Y, command: 'extend' },
        { id: 'com2-out01', x: UPPER_RELAY_LIGHT_START_X + UPPER_RELAY_LIGHT_SPACING, y: UPPER_RELAY_LIGHT_Y, command: 'retract' },
        { id: 'com3-out02', x: UPPER_RELAY_LIGHT_START_X + UPPER_RELAY_LIGHT_SPACING * 2, y: UPPER_RELAY_LIGHT_Y },
        { id: 'out03', x: UPPER_RELAY_LIGHT_START_X + UPPER_RELAY_LIGHT_SPACING * 3, y: UPPER_RELAY_LIGHT_Y },
        { id: 'com4-out04', x: BOTTOM_RELAY_LIGHT_START_X, y: BOTTOM_RELAY_LIGHT_Y },
        { id: 'out05', x: BOTTOM_RELAY_LIGHT_START_X + BOTTOM_RELAY_LIGHT_SPACING, y: BOTTOM_RELAY_LIGHT_Y },
        { id: 'out06', x: BOTTOM_RELAY_LIGHT_START_X + BOTTOM_RELAY_LIGHT_SPACING * 2, y: BOTTOM_RELAY_LIGHT_Y },
        { id: 'out07', x: BOTTOM_RELAY_LIGHT_START_X + BOTTOM_RELAY_LIGHT_SPACING * 3, y: BOTTOM_RELAY_LIGHT_Y },
    ];

    const plcDeviceDrawerWidth = isPlcDeviceDrawerOpen ? DEVICE_DRAWER_OPEN_WIDTH : DEVICE_DRAWER_COLLAPSED_WIDTH;
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

    const navigateToPlcRouteEntry = useCallback((entry: PlcSimulationRouteEntry) => {
        navigate(buildSimulationPath({
            routeId: entry.routeId,
            moduleId: resolvedModuleId,
            activityModuleId: entry.activityModuleId ?? resolvedActivityModuleId,
            simulationId: entry.simulationId,
        }));
    }, [navigate, resolvedActivityModuleId, resolvedModuleId]);

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

    const resetActivity61Runtime = useCallback(() => {
        setPlcCylinderPositions(createRetractedPlcCylinderPositions());
        setActivity61OutputCommand(null);
    }, []);

    const handleUndo = () => { if (!historyPast.length) return; const previous = historyPast[historyPast.length - 1]; setHistoryPast((prev) => prev.slice(0, -1)); setHistoryFuture((prev) => [wires, ...prev]); setWires(previous); };
    const handleRedo = () => { if (!historyFuture.length) return; const next = historyFuture[0]; setHistoryFuture((prev) => prev.slice(1)); setHistoryPast((prev) => [...prev, wires]); setWires(next); };
    const handleResetBoard = () => { setHistoryPast(prev => [...prev, wires].slice(-50)); setHistoryFuture([]); setWires([]); setSelectedWireId(null); setActivePin(null); setIsAcPowerOn(false); setVerificationResult(null); resetActivity61Runtime(); };

    useEffect(() => {
        localStorage.setItem(SIMULATION_STATE_STORAGE_KEY, JSON.stringify(savedStates));
    }, [savedStates]);

    useEffect(() => {
        setVerificationResult(null);
    }, [activityStateKey, assignedPlcDevices, wires]);

    const handleVerifyConfiguration = useCallback(async () => {
        const wiringResult = evaluatePlcActivity(activityPreset, wires);
        const deviceResult = validateActivity61RequiredDevices(activityPreset.routeId, assignedPlcDevices);
        const wrongConnections = getWrongPlcConnectionsForActivity(activityPreset, wires);
        const wrongConnectionDiagnostics = wrongConnections.map(
            ({ fromPin, toPin }) => `Wrong connection: ${fromPin} ↔ ${toPin}`,
        );
        const result: PlcValidationResult = wiringResult.passed && deviceResult.passed
            ? {
                ...wiringResult,
                diagnosticIssues: uniqueStrings([
                    ...wiringResult.diagnosticIssues,
                    ...wrongConnectionDiagnostics,
                ]),
                wrongConnections,
            }
            : createFailingPlcValidationResult(
                wiringResult.passed ? deviceResult.message : wiringResult.message,
                [
                    ...(!wiringResult.passed ? wiringResult.displayIssues : []),
                    ...(!deviceResult.passed ? deviceResult.displayIssues : []),
                ],
                [
                    ...(!wiringResult.passed ? wiringResult.diagnosticIssues : []),
                    ...(!deviceResult.passed ? deviceResult.diagnosticIssues : []),
                    ...wrongConnectionDiagnostics,
                ],
                wrongConnections,
            );

        setVerificationResult(result);
        if (!result.passed) return;

        const savedWireSnapshot = wires.map(({ id, fromPin, toPin, color }) => ({
            id,
            fromPin,
            toPin,
            color,
        }));

        setSavedStates((prev) => ({
            ...prev,
            [activityStateKey]: {
                wires: savedWireSnapshot,
                verifiedAt: new Date().toISOString(),
            },
        }));

        if (
            !simulationId
            || completedRouteSet.has(activityStateKey)
            || completionRequestRef.current.has(simulationId)
        ) {
            return;
        }

        completionRequestRef.current.add(simulationId);
        setIsPersistingCompletion(true);

        try {
            await completeSimulation(simulationId, { bestScore: 100 });
            setVerificationResult(createPassingPlcValidationResult(`${activityPreset.title} verified and saved.`));
        } catch (error) {
            console.error('Failed to persist PLC simulation completion', error);
            setVerificationResult(createPassingPlcValidationResult(`${activityPreset.title} verified locally, but server progress sync failed.`));
        } finally {
            completionRequestRef.current.delete(simulationId);
            setIsPersistingCompletion(false);
        }
    }, [activityPreset, activityStateKey, assignedPlcDevices, completedRouteSet, simulationId, wires]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedWire(); } };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [deleteSelectedWire]);

    const hasLadderDiagram = Boolean(activityPreset.diagram?.trim());
    const isPlcRouteCompleteForProgress = useCallback((candidateRouteId: string) => {
        return (candidateRouteId === activityPreset.routeId && verificationResult?.passed === true)
            || isPlcRouteCompleted(candidateRouteId);
    }, [activityPreset.routeId, isPlcRouteCompleted, verificationResult]);
    const canProceedToNextActivity = isPlcRouteCompleteForProgress(activityPreset.routeId);
    const isCurrentSessionVerified = verificationResult?.passed === true;
    const isActivity61Route = activityPreset.routeId === ACTIVITY_61_ROUTE_ID;
    const isActivity61PowerOn = isActivity61Route && isAcPowerOn;
    const isActivity61RuntimeEnabled = isActivity61PowerOn && isCurrentSessionVerified;
    const shouldShowWrongWireHighlights = verificationResult !== null && !verificationResult.passed;
    const plcAnswerPercent = isCurrentSessionVerified ? '100%' : '0%';
    const nextActivityTitle = nextRouteEntry?.title
        ?? (nextRouteEntry ? getActivityAnswerByRouteId(nextRouteEntry.routeId, nextRouteEntry.activityModuleId ?? 6).title : '');
    const visiblePlcFeedbackIssues = useMemo(() => {
        if (!verificationResult || verificationResult.passed) {
            return [];
        }

        return uniqueStrings(verificationResult.displayIssues.length
            ? verificationResult.displayIssues
            : verificationResult.issues);
    }, [verificationResult]);
    const wrongWireKeySet = useMemo(() => {
        if (!shouldShowWrongWireHighlights) {
            return new Set<string>();
        }

        return new Set(getWrongPlcConnectionsForActivity(activityPreset, wires).map(({ fromPin, toPin }) => toWireKey(fromPin, toPin)));
    }, [activityPreset, shouldShowWrongWireHighlights, wires]);

    useEffect(() => {
        if (!isActivity61RuntimeEnabled) {
            resetActivity61Runtime();
        }
    }, [isActivity61RuntimeEnabled, resetActivity61Runtime]);

    const handleAcPowerToggle = useCallback(() => {
        resetActivity61Runtime();
        setIsAcPowerOn((previous) => !previous);
    }, [resetActivity61Runtime]);

    const handleStartButtonDown = useCallback(() => {
        setIsStartPressed(true);

        if (!isActivity61RuntimeEnabled) {
            return;
        }

        setPlcCylinderPositions((previous) => ({
            ...previous,
            B: 'extended',
        }));
        setActivity61OutputCommand('extend');
    }, [isActivity61RuntimeEnabled]);

    const handleStopButtonDown = useCallback(() => {
        setIsStopPressed(true);

        if (!isActivity61RuntimeEnabled) {
            return;
        }

        setPlcCylinderPositions((previous) => ({
            ...previous,
            B: 'retracted',
        }));
        setActivity61OutputCommand('retract');
    }, [isActivity61RuntimeEnabled]);

    const handleStartButtonRelease = useCallback(() => {
        setIsStartPressed(false);
    }, []);

    const handleStopButtonRelease = useCallback(() => {
        setIsStopPressed(false);
    }, []);

    const selectedPlcDeviceCounts = useMemo(() => {
        const counts: Partial<Record<PlcDeviceId, number>> = {};

        for (const { deviceId, quantity } of [...assignedPlcDevices.input, ...assignedPlcDevices.output]) {
            counts[deviceId] = (counts[deviceId] ?? 0) + quantity;
        }

        return counts;
    }, [assignedPlcDevices]);

    const placePlcDeviceInZone = useCallback((deviceId: PlcDeviceId, zone: PlcDeviceZone) => {
        setAssignedPlcDevices((previous) => {
            const existingDevice = previous[zone].find((entry) => entry.deviceId === deviceId);
            const quantityLimit = getPlcDeviceQuantityLimit(deviceId);

            if (!existingDevice) {
                return {
                    ...previous,
                    [zone]: [...previous[zone], { deviceId, quantity: 1 }],
                };
            }

            if (existingDevice.quantity >= quantityLimit) {
                return previous;
            }

            return {
                ...previous,
                [zone]: previous[zone].map((entry) =>
                    entry.deviceId === deviceId
                        ? { ...entry, quantity: Math.min(quantityLimit, entry.quantity + 1) }
                        : entry,
                ),
            };
        });
    }, []);

    const removePlcDeviceFromZone = useCallback((zone: PlcDeviceZone, deviceId: PlcDeviceId) => {
        setAssignedPlcDevices((previous) => ({
            ...previous,
            [zone]: previous[zone].filter((entry) => entry.deviceId !== deviceId),
        }));
    }, []);

    const adjustPlcDeviceQuantity = useCallback((zone: PlcDeviceZone, deviceId: PlcDeviceId, delta: -1 | 1) => {
        setAssignedPlcDevices((previous) => ({
            ...previous,
            [zone]: previous[zone].map((entry) => {
                if (entry.deviceId !== deviceId) {
                    return entry;
                }

                const quantityLimit = getPlcDeviceQuantityLimit(deviceId);
                const nextQuantity = Math.max(1, Math.min(quantityLimit, entry.quantity + delta));
                return { ...entry, quantity: nextQuantity };
            }),
        }));
    }, []);

    const handlePlcDeviceDragStart = useCallback(
        (deviceId: PlcDeviceId, source: PlcDeviceZone | 'library', event: DragEvent<HTMLElement>) => {
            event.dataTransfer.effectAllowed = source === 'library' ? 'copyMove' : 'move';
            event.dataTransfer.setData('text/plain', deviceId);
            setPlcDeviceDragState({ deviceId, source });
        },
        [],
    );

    const handlePlcDeviceDragEnd = useCallback(() => {
        setPlcDeviceDragState(null);
        setActivePlcDropZone(null);
    }, []);

    const handlePlcDropZoneDragOver = useCallback((zone: PlcDeviceZone, event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setActivePlcDropZone(zone);
    }, []);

    const handlePlcDropZoneLeave = useCallback((zone: PlcDeviceZone) => {
        setActivePlcDropZone((current) => (current === zone ? null : current));
    }, []);

    const handlePlcDropZoneDrop = useCallback(
        (zone: PlcDeviceZone, event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            const rawDeviceId = event.dataTransfer.getData('text/plain').trim();
            const deviceId = isPlcDeviceId(rawDeviceId) ? rawDeviceId : plcDeviceDragState?.deviceId;

            if (deviceId) {
                placePlcDeviceInZone(deviceId, zone);
            }

            setPlcDeviceDragState(null);
            setActivePlcDropZone(null);
        },
        [placePlcDeviceInZone, plcDeviceDragState],
    );

    const renderPlcDeviceDropZone = (zone: PlcDeviceZone, title: string) => {
        const devices = assignedPlcDevices[zone];
        const isActive = activePlcDropZone === zone;

        return (
            <div
                onDragOver={(event) => handlePlcDropZoneDragOver(zone, event)}
                onDragLeave={() => handlePlcDropZoneLeave(zone)}
                onDrop={(event) => handlePlcDropZoneDrop(zone, event)}
                className={`min-h-[86px] rounded-2xl border border-dashed p-3 transition-colors ${
                    isActive
                        ? 'border-cyan-500 bg-cyan-50/60 dark:border-cyan-400 dark:bg-cyan-500/10'
                        : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/60'
                }`}
            >
                <h5 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h5>

                {devices.length === 0 ? (
                    <p className="mt-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">Drag device here.</p>
                ) : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        {devices.map(({ deviceId, quantity }) => {
                            const device = getPlcDeviceById(deviceId);
                            const quantityLimit = getPlcDeviceQuantityLimit(deviceId);
                            const supportsQuantity = quantityLimit > 1;

                            return (
                                <div
                                    key={`${zone}-${device.id}`}
                                    draggable
                                    onDragStart={(event) => handlePlcDeviceDragStart(device.id, zone, event)}
                                    onDragEnd={handlePlcDeviceDragEnd}
                                    className="group relative flex min-h-[76px] min-w-[142px] cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition-colors hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-cyan-500"
                                    title={device.label}
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-2 dark:bg-slate-900/80">
                                        <img src={device.image} alt={device.label} className="h-full w-full object-contain" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 dark:text-slate-100">
                                            {device.label}
                                        </p>
                                        {supportsQuantity ? (
                                            <div className="mt-2">
                                                <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustPlcDeviceQuantity(zone, device.id, -1)}
                                                        disabled={quantity <= 1}
                                                        className="flex h-6 w-6 items-center justify-center text-sm font-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-slate-800"
                                                        aria-label={`Decrease ${device.label} quantity`}
                                                    >
                                                        -
                                                    </button>
                                                    <span className="min-w-[30px] border-x border-slate-200 px-2 text-center text-[10px] font-black dark:border-slate-700">
                                                        x{quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustPlcDeviceQuantity(zone, device.id, 1)}
                                                        disabled={quantity >= quantityLimit}
                                                        className="flex h-6 w-6 items-center justify-center text-sm font-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-slate-800"
                                                        aria-label={`Increase ${device.label} quantity`}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                                    Max {quantityLimit}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                                Selected
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => removePlcDeviceFromZone(zone, device.id)}
                                        className="absolute -top-1.5 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-black text-slate-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                                        aria-label={`Remove ${device.label}`}
                                    >
                                        x
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // TUTORIAL STEPS
    const tutorialSteps: TutorialStep[] = [
        { message: "Welcome to the GOTT PLC Trainer. Here you will simulate physical hardware wiring for PLC controllers." },
        { targetId: "tour-plc-guide", message: "This panel contains your active PLC reference, validation controls, and device-use zones." },
        { targetId: "tour-plc-toolbox", message: "Your PLC Device Library is located here. Device selection will be connected to validation in a later phase." },
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
                                <p className="text-[10px] text-slate-500 dark:text-cyan-500/70 font-mono tracking-widest uppercase">Target: GOTT PLC Trainer • Task: {currentRouteEntry?.title || activityPreset.title || resolvedRouteId}</p>
                            </div>
                        </div>
                        {/* TOOLBAR - ADD ID HERE */}
                        <div id="tour-plc-toolbar" className="flex items-center gap-3">
                            {nextRouteEntry ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!canProceedToNextActivity) return;
                                        navigateToPlcRouteEntry(nextRouteEntry);
                                    }}
                                    disabled={!canProceedToNextActivity}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                    title={canProceedToNextActivity ? `Next: ${nextActivityTitle}` : 'Complete the current PLC activity to unlock the next activity.'}
                                >
                                    Next Activity <ChevronRight size={16} strokeWidth={3} />
                                </button>
                            ) : (
                                <div className="hidden sm:flex items-center px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                    Final Activity
                                </div>
                            )}
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

                    <main className="relative flex-1 flex flex-row w-full min-h-0 overflow-hidden bg-slate-200 dark:bg-slate-950" ref={containerRef}>

                        {/* PLC CONTROL SIDEBAR - mirrors SimulationApp left sidebar structure */}
                        <aside id="tour-plc-guide" className="w-[360px] flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg transition-colors duration-300">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/50">
                                <h2 className="font-black text-slate-900 dark:text-white text-[1.35rem]">Controls</h2>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                                <section className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                                    <h4 className="text-[1.05rem] font-black text-slate-900 dark:text-white">List of Devices to Use</h4>
                                    <div className="mt-3 space-y-3">
                                        {PLC_DEVICE_USE_ZONES.map((zone) => (
                                            <div key={zone.id}>
                                                {renderPlcDeviceDropZone(zone.id, zone.title)}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 flex flex-col">
                                    <div className="flex items-start justify-between gap-4">
                                        <h4 className="text-[1.05rem] font-black text-slate-900 dark:text-white">Ladder Program</h4>
                                        <div
                                            className={`inline-flex min-w-[56px] items-center justify-center rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                                                isCurrentSessionVerified
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300'
                                            }`}
                                        >
                                            {plcAnswerPercent}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3">
                                        <button
                                            type="button"
                                            onClick={() => void handleVerifyConfiguration()}
                                            className="rounded-xl bg-[#223a5a] px-4 py-3 text-sm font-black tracking-widest uppercase text-white shadow-sm transition-colors hover:bg-[#1a304d] disabled:opacity-60 disabled:cursor-not-allowed dark:bg-cyan-600 dark:hover:bg-cyan-500 w-full"
                                            disabled={isPersistingCompletion}
                                        >
                                            {isPersistingCompletion
                                                ? 'Saving Progress...'
                                                : 'Verify Configuration'}
                                        </button>

                                        {verificationResult ? (
                                            <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
                                                verificationResult.passed
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                                            }`}>
                                                <p className="font-black">
                                                    {verificationResult.passed ? 'Answer is correct.' : 'Answer is incorrect.'}
                                                </p>
                                                {verificationResult.passed ? (
                                                    <p className="mt-1 text-xs font-semibold">
                                                        {verificationResult.message}
                                                    </p>
                                                ) : null}
                                                {visiblePlcFeedbackIssues.length > 0 ? (
                                                    <div className="mt-3 space-y-1.5 text-xs leading-5">
                                                        {visiblePlcFeedbackIssues.map((issue) => (
                                                            <p key={issue}>{issue}</p>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="mt-5 flex flex-col">
                                        <p className="text-base font-black text-slate-900 dark:text-white">{activityPreset.title}</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                            {activityPreset.instruction || 'Follow the assigned PLC trainer wiring task and verify the current route.'}
                                        </p>
                                        <div className="mt-3 h-[220px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                            {hasLadderDiagram ? (
                                                <img src={activityPreset.diagram} alt={activityPreset.title} className="h-full w-full rounded-xl object-contain" />
                                            ) : (
                                                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center dark:border-slate-700 dark:bg-slate-950/60">
                                                    <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                                                        No ladder program available yet for this PLC activity.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </aside>

                        <div className="flex-1 relative flex items-center justify-center p-6">

                            {/* PLC ACTIVITY PROGRESS HUD */}
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
                                {routeEntries.map((entry, index) => {
                                    const isNodeCompleted = isPlcRouteCompleteForProgress(entry.routeId);
                                    const isCurrent = index === currentIndex;
                                    const prevNodeEntry = index > 0 ? routeEntries[index - 1] : null;
                                    const prevCompleted = prevNodeEntry ? isPlcRouteCompleteForProgress(prevNodeEntry.routeId) : true;
                                    const isUnlocked = index === 0 || isNodeCompleted || isCurrent || prevCompleted;
                                    const activityTitle = entry.title || getActivityAnswerByRouteId(
                                        entry.routeId,
                                        entry.activityModuleId ?? resolvedActivityModuleId,
                                    ).title;

                                    let nodeClasses = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ';

                                    if (isNodeCompleted) {
                                        nodeClasses += 'bg-emerald-500 text-white ';
                                        if (isCurrent) {
                                            nodeClasses += 'scale-110 shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900 cursor-default ';
                                        } else {
                                            nodeClasses += 'hover:bg-emerald-400 shadow-sm cursor-pointer ';
                                        }
                                    } else if (isCurrent) {
                                        nodeClasses += 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)] scale-110 cursor-default ';
                                    } else if (isUnlocked) {
                                        nodeClasses += 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer shadow-sm ';
                                    } else {
                                        nodeClasses += 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60 ';
                                    }

                                    return (
                                        <div key={entry.routeId} className="flex items-center">
                                            {index > 0 && (
                                                <div className={`w-8 h-1 mx-1 rounded-full ${prevCompleted ? 'bg-emerald-400 dark:bg-emerald-500/80' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isUnlocked || isCurrent) return;
                                                    navigateToPlcRouteEntry(entry);
                                                }}
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

                                            <PlcPneumaticAssembly x={690} y={30} width={560} height={420} cylinderPositions={plcCylinderPositions} />
                                        </Layer>

                                        {/* LAYER 2: WIRES (MIDDLE - Drawn OVER backgrounds, but UNDER text and ports!) */}
                                        <Layer scaleX={canvasScale} scaleY={canvasScale} id="interactive-wiring-layer">
                                            {wires.map((wire) => {
                                                const isSelected = selectedWireId === wire.id;
                                                const isWrong = wrongWireKeySet.has(toWireKey(wire.fromPin, wire.toPin));
                                                return (
                                                    <Line
                                                        key={`wire-${wire.id}`}
                                                        points={wire.points}
                                                        stroke={isWrong ? '#ef4444' : wire.color}
                                                        strokeWidth={isSelected ? 10 : 8}
                                                        opacity={isSelected ? 1 : isWrong ? 0.95 : 0.85}
                                                        hitStrokeWidth={20}
                                                        lineCap="round"
                                                        lineJoin="round"
                                                        dash={isWrong ? [14, 8] : undefined}
                                                        shadowColor={isSelected ? '#f1c40f' : isWrong ? 'rgba(239,68,68,0.8)' : 'rgba(0,0,0,0.5)'}
                                                        shadowBlur={isSelected ? 15 : isWrong ? 10 : 6}
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
                                                onClick={handleAcPowerToggle}
                                                onTap={handleAcPowerToggle}
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
                                            {ACTIVITY_61_REED_LIGHT_PAIRS.map((pair, i) => {
                                                const ret = GOTT_TRAINER_PORTS[pair.retPortId];
                                                const ext = GOTT_TRAINER_PORTS[pair.extPortId];
                                                if (!ret || !ext) return null;
                                                const lightRadius = 16;
                                                const lightStroke = 4;
                                                const cylinderPosition = plcCylinderPositions[pair.cylinderId];
                                                const lights = [
                                                    {
                                                        portId: pair.retPortId,
                                                        isOn: isActivity61PowerOn && cylinderPosition === 'retracted',
                                                    },
                                                    {
                                                        portId: pair.extPortId,
                                                        isOn: isActivity61PowerOn && cylinderPosition === 'extended',
                                                    },
                                                ];

                                                return (
                                                    <Group key={`reed-pair-border-${i}`} listening={false}>
                                                        {lights.map(({ portId, isOn }) => {
                                                            const port = GOTT_TRAINER_PORTS[portId];
                                                            return (
                                                                <Circle
                                                                    key={`reed-light-${portId}`}
                                                                    x={port.x}
                                                                    y={port.y + REED_LIGHT_OFFSET_Y}
                                                                    radius={lightRadius}
                                                                    fill={isOn ? HW_STYLES.switchRedOn : HW_STYLES.switchRedOff}
                                                                    stroke="#cbd5e1"
                                                                    strokeWidth={lightStroke}
                                                                    shadowColor={HW_STYLES.switchRedOn}
                                                                    shadowBlur={isOn ? 10 : 0}
                                                                />
                                                            );
                                                        })}
                                                    </Group>
                                                );
                                            })}

                                            {/* Output Indicator Lights */}
                                            {plcOutputIndicatorLights.map(({ id, x, y, command }) => {
                                                const isOn = Boolean(command) && isActivity61RuntimeEnabled && activity61OutputCommand === command;
                                                return (
                                                    <Circle
                                                        key={`output-indicator-light-${id}`}
                                                        x={x}
                                                        y={y}
                                                        radius={16}
                                                        fill={isOn ? HW_STYLES.switchRedOn : HW_STYLES.switchRedOff}
                                                        stroke="#cbd5e1"
                                                        strokeWidth={4}
                                                        shadowColor={HW_STYLES.switchRedOn}
                                                        shadowBlur={isOn ? 10 : 0}
                                                        listening={false}
                                                    />
                                                );
                                            })}

                                            {/* Start Button */}
                                            <Group x={START_BUTTON_X} y={START_BUTTON_Y}
                                                onMouseDown={handleStartButtonDown} onMouseUp={handleStartButtonRelease} onMouseLeave={handleStartButtonRelease}
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
                                                onMouseDown={handleStopButtonDown} onMouseUp={handleStopButtonRelease} onMouseLeave={handleStopButtonRelease}
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

                        {/* PLC DEVICE LIBRARY SIDEBAR - mirrors SimulationApp right drawer structure */}
                        <aside
                            id="tour-plc-toolbox"
                            className="absolute inset-y-0 right-0 z-20 overflow-hidden border-l border-slate-200 bg-white shadow-[-18px_0_30px_-22px_rgba(15,23,42,0.6)] transition-[width] duration-300 dark:border-slate-800 dark:bg-slate-900"
                            style={{ width: plcDeviceDrawerWidth }}
                        >
                            {isPlcDeviceDrawerOpen ? (
                                <div className="flex h-full flex-col">
                                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-500 dark:text-cyan-500/70">Device Dock</p>
                                            <h3 className="mt-1 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">List of Devices</h3>
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Quick access to the installed trainer devices.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsPlcDeviceDrawerOpen(false)}
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                            aria-label="Collapse device drawer"
                                            title="Collapse device drawer"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        <div className="grid grid-cols-3 gap-3">
                                            {PLC_DEVICE_LIBRARY.map((device) => {
                                                const selectedCount = selectedPlcDeviceCounts[device.id] ?? 0;

                                                return (
                                                    <button
                                                        key={device.id}
                                                        type="button"
                                                        draggable
                                                        onDragStart={(event) => handlePlcDeviceDragStart(device.id, 'library', event)}
                                                        onDragEnd={handlePlcDeviceDragEnd}
                                                        className={`group relative flex h-[124px] flex-col items-center justify-start rounded-2xl border bg-white px-2 pt-3 pb-2 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/70 ${
                                                            selectedCount > 0
                                                                ? 'border-emerald-400 dark:border-emerald-500/50'
                                                                : 'border-slate-200 hover:border-cyan-400 dark:border-slate-700 dark:hover:border-cyan-500/70'
                                                        }`}
                                                        title={`${device.label}: ${device.description}`}
                                                    >
                                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-2 dark:bg-slate-800/80">
                                                            <img src={device.image} alt={device.label} className="h-full w-full object-contain" />
                                                        </div>

                                                        <span className="mt-2 text-[10px] font-bold leading-[1.15] text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white line-clamp-2">
                                                            {device.label}
                                                        </span>

                                                        {selectedCount > 0 && (
                                                            <div className="absolute bottom-2 left-1/2 w-10/12 -translate-x-1/2 rounded-full bg-emerald-50 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
                                                                Selected x{selectedCount}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center py-4 relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsPlcDeviceDrawerOpen(true)}
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
                        storageKey="creosim_tutorial_simulation_plc"
                    />
                </div>
            </CyberTransition>
        </PortraitGuard>
    );
}
