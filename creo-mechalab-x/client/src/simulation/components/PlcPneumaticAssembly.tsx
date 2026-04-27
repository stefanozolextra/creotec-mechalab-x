import { Circle, Group, Line, Rect } from 'react-konva';

import { HW_STYLES } from '../config/plcBoardLayout';

export type PlcCylinderId = 'A' | 'B' | 'C';
export type PlcCylinderPosition = 'retracted' | 'extended';
export type PlcCylinderPositions = Record<PlcCylinderId, PlcCylinderPosition>;

interface PlcPneumaticAssemblyProps {
    x: number;
    y: number;
    width: number;
    height: number;
    cylinderPositions?: Partial<PlcCylinderPositions>;
}

type AssemblySpec = {
    id: PlcCylinderId;
    cylinderY: number;
    valveY: number;
};

const HEADER_HEIGHT = 24;
const INNER_PADDING = 18;

const CYLINDER_STACK_X = 220;
const CYLINDER_BODY_WIDTH = 138;
const CYLINDER_BODY_HEIGHT = 34;
const CYLINDER_ROD_WIDTH = 56;
const CYLINDER_RETRACTED_ROD_WIDTH = 14;

const VALVE_STACK_X = 112;
const VALVE_OUTER_NOZZLE_WIDTH = 18;
const VALVE_MODULE_WIDTH = 34;
const VALVE_BODY_WIDTH = 108;
const VALVE_BODY_HEIGHT = 40;
const VALVE_TOTAL_WIDTH = VALVE_OUTER_NOZZLE_WIDTH + VALVE_MODULE_WIDTH + VALVE_BODY_WIDTH + VALVE_MODULE_WIDTH + VALVE_OUTER_NOZZLE_WIDTH;

const TUBE_STROKE = '#f97316';
const PORT_FILL = '#d4af37';
const PORT_STROKE = '#64748b';
const BODY_FILL = '#d9e0e6';
const BODY_STROKE = '#98a4b3';
const BODY_HIGHLIGHT = 'rgba(255,255,255,0.45)';
const BODY_LINE = 'rgba(107,114,128,0.12)';
const MODULE_FILL = '#23272d';
const MODULE_HIGHLIGHT = '#3b4048';
const NOZZLE_FILL = '#111827';
const LABEL_FILL = '#f8fafc';
const LABEL_STROKE = '#cbd5e1';
const LABEL_ACCENT = '#2563eb';
const ASSEMBLY_OFFSET_Y = 12;
const ASSEMBLIES: readonly AssemblySpec[] = [
    { id: 'A', cylinderY: 44 + ASSEMBLY_OFFSET_Y, valveY: 234 + ASSEMBLY_OFFSET_Y },
    { id: 'B', cylinderY: 102 + ASSEMBLY_OFFSET_Y, valveY: 284 + ASSEMBLY_OFFSET_Y },
    { id: 'C', cylinderY: 160 + ASSEMBLY_OFFSET_Y, valveY: 334 + ASSEMBLY_OFFSET_Y },
] as const;

const DEFAULT_CYLINDER_POSITIONS: PlcCylinderPositions = {
    A: 'retracted',
    B: 'retracted',
    C: 'retracted',
};

const renderCylinder = (id: AssemblySpec['id'], y: number, position: PlcCylinderPosition) => {
    const rodY = y + (CYLINDER_BODY_HEIGHT / 2) - 4;
    const rodWidth = position === 'extended' ? CYLINDER_ROD_WIDTH : CYLINDER_RETRACTED_ROD_WIDTH;

    return (
        <Group key={`cylinder-${id}`} listening={false}>
            <Rect
                x={CYLINDER_STACK_X + 4}
                y={y + 4}
                width={CYLINDER_BODY_WIDTH + rodWidth}
                height={CYLINDER_BODY_HEIGHT}
                fill="rgba(148,163,184,0.15)"
                cornerRadius={8}
            />
            <Rect
                x={CYLINDER_STACK_X}
                y={y}
                width={CYLINDER_BODY_WIDTH}
                height={CYLINDER_BODY_HEIGHT}
                fill="#e2e8f0"
                stroke={BODY_STROKE}
                strokeWidth={2}
                cornerRadius={4}
                shadowColor="rgba(0,0,0,0.16)"
                shadowBlur={5}
                shadowOffsetY={3}
            />
            <Rect x={CYLINDER_STACK_X + 12} y={y} width={20} height={CYLINDER_BODY_HEIGHT} fill="#3498db" cornerRadius={2} />
            <Rect x={CYLINDER_STACK_X + CYLINDER_BODY_WIDTH - 32} y={y} width={20} height={CYLINDER_BODY_HEIGHT} fill="#3498db" cornerRadius={2} />
            <Rect
                x={CYLINDER_STACK_X + CYLINDER_BODY_WIDTH}
                y={rodY}
                width={rodWidth}
                height={8}
                fill="#bdc3c7"
                stroke="#7f8c8d"
                strokeWidth={1}
            />
            <Rect
                x={CYLINDER_STACK_X + CYLINDER_BODY_WIDTH + rodWidth - 6}
                y={rodY - 3}
                width={6}
                height={14}
                fill="#94a3b8"
                stroke={PORT_STROKE}
                strokeWidth={1}
            />
            <Circle x={CYLINDER_STACK_X + 28} y={y + CYLINDER_BODY_HEIGHT + 2} radius={4} fill={PORT_FILL} stroke={PORT_STROKE} strokeWidth={1} />
            <Circle x={CYLINDER_STACK_X + CYLINDER_BODY_WIDTH - 28} y={y + CYLINDER_BODY_HEIGHT + 2} radius={4} fill={PORT_FILL} stroke={PORT_STROKE} strokeWidth={1} />
            <Line
                points={[
                    CYLINDER_STACK_X + 28, y + CYLINDER_BODY_HEIGHT + 4,
                    CYLINDER_STACK_X + CYLINDER_BODY_WIDTH - 28, y + CYLINDER_BODY_HEIGHT + 4,
                ]}
                stroke="#cbd5e1"
                strokeWidth={2}
                lineCap="round"
            />
        </Group>
    );
};

const renderValveAssembly = (id: AssemblySpec['id'], y: number) => {
    const leftModuleX = VALVE_STACK_X + VALVE_OUTER_NOZZLE_WIDTH;
    const bodyX = leftModuleX + VALVE_MODULE_WIDTH;
    const rightModuleX = bodyX + VALVE_BODY_WIDTH;
    const rightNozzleX = rightModuleX + VALVE_MODULE_WIDTH;
    const labelY = y + 18;

    return (
        <Group key={`valve-${id}`} listening={false}>
            <Rect
                x={VALVE_STACK_X + 6}
                y={y + 5}
                width={VALVE_TOTAL_WIDTH - 12}
                height={VALVE_BODY_HEIGHT}
                fill="rgba(148,163,184,0.18)"
                cornerRadius={9}
            />

            <Rect
                x={bodyX}
                y={y}
                width={VALVE_BODY_WIDTH}
                height={VALVE_BODY_HEIGHT}
                fill={BODY_FILL}
                stroke={BODY_STROKE}
                strokeWidth={1.2}
                cornerRadius={3}
                shadowColor="rgba(0,0,0,0.18)"
                shadowBlur={4}
                shadowOffsetY={2}
            />
            <Rect x={bodyX + 4} y={y + 3} width={VALVE_BODY_WIDTH - 8} height={6} fill={BODY_HIGHLIGHT} opacity={0.7} cornerRadius={2} />
            {[8, 13, 18, 23, 28, 33].map((lineY) => (
                <Line
                    key={`body-line-${id}-${lineY}`}
                    points={[bodyX + 6, y + lineY, bodyX + VALVE_BODY_WIDTH - 6, y + lineY]}
                    stroke={BODY_LINE}
                    strokeWidth={1}
                    lineCap="round"
                />
            ))}

            <Rect
                x={leftModuleX}
                y={y + 1}
                width={VALVE_MODULE_WIDTH}
                height={VALVE_BODY_HEIGHT - 2}
                fill={MODULE_FILL}
                cornerRadius={[4, 0, 0, 4]}
            />
            <Rect x={leftModuleX + 2} y={y + 3} width={VALVE_MODULE_WIDTH - 6} height={4} fill={MODULE_HIGHLIGHT} opacity={0.45} cornerRadius={2} />

            <Rect
                x={rightModuleX}
                y={y + 1}
                width={VALVE_MODULE_WIDTH}
                height={VALVE_BODY_HEIGHT - 2}
                fill={MODULE_FILL}
                cornerRadius={[0, 4, 4, 0]}
            />
            <Rect x={rightModuleX + 4} y={y + 3} width={VALVE_MODULE_WIDTH - 6} height={4} fill={MODULE_HIGHLIGHT} opacity={0.45} cornerRadius={2} />

            <Rect
                x={VALVE_STACK_X}
                y={y + 13}
                width={VALVE_OUTER_NOZZLE_WIDTH}
                height={14}
                fill={NOZZLE_FILL}
                cornerRadius={7}
            />
            <Circle x={VALVE_STACK_X + 5} y={y + 20} radius={8} fill={NOZZLE_FILL} stroke="#374151" strokeWidth={1} />

            <Rect
                x={rightNozzleX}
                y={y + 13}
                width={VALVE_OUTER_NOZZLE_WIDTH}
                height={14}
                fill={NOZZLE_FILL}
                cornerRadius={7}
            />
            <Circle x={rightNozzleX + VALVE_OUTER_NOZZLE_WIDTH - 5} y={y + 20} radius={8} fill={NOZZLE_FILL} stroke="#374151" strokeWidth={1} />

            <Rect x={leftModuleX + 6} y={labelY} width={18} height={12} fill={LABEL_FILL} stroke={LABEL_STROKE} strokeWidth={0.8} cornerRadius={2} />
            <Rect x={leftModuleX + 8} y={labelY + 2} width={2} height={8} fill={LABEL_ACCENT} cornerRadius={1} />
            {[3, 6, 9].map((dy) => (
                <Line
                    key={`left-label-${id}-${dy}`}
                    points={[leftModuleX + 12, labelY + dy, leftModuleX + 21, labelY + dy]}
                    stroke="#64748b"
                    strokeWidth={0.8}
                    lineCap="round"
                />
            ))}

            <Rect x={rightModuleX + 8} y={labelY} width={18} height={12} fill={LABEL_FILL} stroke={LABEL_STROKE} strokeWidth={0.8} cornerRadius={2} />
            <Rect x={rightModuleX + 10} y={labelY + 2} width={2} height={8} fill={LABEL_ACCENT} cornerRadius={1} />
            {[3, 6, 9].map((dy) => (
                <Line
                    key={`right-label-${id}-${dy}`}
                    points={[rightModuleX + 14, labelY + dy, rightModuleX + 23, labelY + dy]}
                    stroke="#64748b"
                    strokeWidth={0.8}
                    lineCap="round"
                />
            ))}

            <Circle x={bodyX + 30} y={y + 6} radius={6.5} fill="#cfd5dc" stroke="#7b8794" strokeWidth={1.1} />
            <Circle x={bodyX + 30} y={y + 6} radius={3.4} fill="#677381" />
            <Circle x={bodyX + 78} y={y + 6} radius={6.5} fill="#cfd5dc" stroke="#7b8794" strokeWidth={1.1} />
            <Circle x={bodyX + 78} y={y + 6} radius={3.4} fill="#677381" />
            <Circle x={bodyX + 54} y={y + 24} radius={3.2} fill="#cfd5dc" stroke="#7b8794" strokeWidth={1} />
            <Circle x={bodyX + 12} y={y + 23} radius={2.2} fill="#64748b" />
            <Circle x={bodyX + VALVE_BODY_WIDTH - 12} y={y + 23} radius={2.2} fill="#64748b" />

        </Group>
    );
};

const renderTubeRuns = (id: AssemblySpec['id'], cylinderY: number, valveY: number) => {
    const leftCylinderPortX = CYLINDER_STACK_X + 28;
    const rightCylinderPortX = CYLINDER_STACK_X + CYLINDER_BODY_WIDTH - 28;
    const cylinderPortY = cylinderY + CYLINDER_BODY_HEIGHT + 2;
    const bodyX = VALVE_STACK_X + VALVE_OUTER_NOZZLE_WIDTH + VALVE_MODULE_WIDTH;
    const leftValvePortX = bodyX + 30;
    const rightValvePortX = bodyX + 78;
    const valvePortY = valveY + 6;
    const leftRouteY = valvePortY - 34;
    const rightRouteY = valvePortY - 18;
    const leftColumnX = leftCylinderPortX - 8;
    const rightColumnX = rightCylinderPortX - 16;

    return (
        <Group key={`tubes-${id}`} listening={false}>
            <Line
                points={[
                    leftCylinderPortX, cylinderPortY,
                    leftColumnX, cylinderPortY,
                    leftColumnX, leftRouteY,
                    leftValvePortX, leftRouteY,
                    leftValvePortX, valvePortY,
                ]}
                stroke={TUBE_STROKE}
                strokeWidth={3.25}
                lineCap="round"
                lineJoin="round"
                opacity={0.9}
            />
            <Line
                points={[
                    rightCylinderPortX, cylinderPortY,
                    rightColumnX, cylinderPortY,
                    rightColumnX, rightRouteY,
                    rightValvePortX, rightRouteY,
                    rightValvePortX, valvePortY,
                ]}
                stroke={TUBE_STROKE}
                strokeWidth={3.25}
                lineCap="round"
                lineJoin="round"
                opacity={0.9}
            />
        </Group>
    );
};

export const PlcPneumaticAssembly = ({ x, y, width, height, cylinderPositions = DEFAULT_CYLINDER_POSITIONS }: PlcPneumaticAssemblyProps) => {
    const resolvedCylinderPositions: PlcCylinderPositions = {
        ...DEFAULT_CYLINDER_POSITIONS,
        ...cylinderPositions,
    };

    return (
        <Group x={x} y={y} listening={false}>
            <Rect
                width={width}
                height={height}
                fill="#e2e8f0"
                stroke={HW_STYLES.panelBorder}
                strokeWidth={2}
                cornerRadius={6}
            />
            <Rect width={width} height={HEADER_HEIGHT} fill="#cbd5e1" stroke={HW_STYLES.panelBorder} strokeWidth={1} cornerRadius={6} />
            <Rect
                x={INNER_PADDING}
                y={HEADER_HEIGHT + INNER_PADDING}
                width={width - INNER_PADDING * 2}
                height={height - HEADER_HEIGHT - INNER_PADDING * 1.6}
                fill="#edf3f8"
                stroke="#d6dee7"
                strokeWidth={1.5}
                cornerRadius={12}
            />

            {ASSEMBLIES.map((assembly) => renderTubeRuns(assembly.id, assembly.cylinderY, assembly.valveY))}
            {ASSEMBLIES.map((assembly) => renderCylinder(assembly.id, assembly.cylinderY, resolvedCylinderPositions[assembly.id]))}
            {ASSEMBLIES.map((assembly) => renderValveAssembly(assembly.id, assembly.valveY))}
        </Group>
    );
};
