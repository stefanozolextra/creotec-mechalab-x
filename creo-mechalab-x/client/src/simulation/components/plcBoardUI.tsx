import { Group, Rect, Text, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { HW_STYLES } from '../config/plcBoardLayout';
import type { PlcPortConfig } from '../config/plcPinConfiguration';

interface PlcPanelBgProps {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export const PlcPanelBackground = ({ id, x, y, width, height }: PlcPanelBgProps) => (
    <Group key={`panel-bg-${id}`} x={x} y={y} listening={false}>
        <Rect width={width} height={height} fill={HW_STYLES.panelBg} stroke={HW_STYLES.panelBorder} strokeWidth={2} cornerRadius={4} shadowColor="rgba(0,0,0,0.15)" shadowBlur={6} shadowOffsetY={3} />
        <Rect width={width} height={28} fill="#e2e8f0" stroke={HW_STYLES.panelBorder} strokeWidth={1} cornerRadius={4} />
    </Group>
);

export const PlcPanelText = ({ id, x, y, title }: { id: string, x: number, y: number, title: string }) => (
    <Text key={`panel-text-${id}`} text={title} x={x + 10} y={y + 8} fontSize={13} fontStyle="bold" fill="#1e293b" listening={false} />
);

interface PlcHardwareJackProps {
    portId: string;
    isActive: boolean;
    config: PlcPortConfig;
    onPointerDown: (id: string) => void;
    onPointerEnter: (e: KonvaEventObject<MouseEvent>, id: string, config: PlcPortConfig) => void;
    onPointerLeave: (e: KonvaEventObject<MouseEvent>) => void;
}

export const PlcHardwareJack = ({ portId, isActive, config, onPointerDown, onPointerEnter, onPointerLeave }: PlcHardwareJackProps) => {
    const isReed = portId.startsWith('reed_ret_') || portId.startsWith('reed_ext_');
    return (
        <Group key={`jack-${portId}`} x={config.x} y={config.y}>
            {isReed && <Text text={config.label} x={-15} y={-18} width={30} fontSize={9} fontFamily={HW_STYLES.technicalMono} fontStyle="bold" align="center" fill="#000000" listening={false} />}
            <Circle radius={11} fill={HW_STYLES.labelYellow} listening={false} />
            {!isReed && <Text text={config.label} x={-15} y={11} width={30} fontSize={9} fontFamily={HW_STYLES.technicalMono} fontStyle="bold" align="center" fill="#000000" listening={false} />}
            <Circle radius={7} fill="#bdc3c7" stroke="#34495e" strokeWidth={1} listening={false} />
            <Circle
                id={portId}
                radius={8}
                fill={config.color}
                stroke={isActive ? '#ffffff' : '#000000'}
                strokeWidth={isActive ? 2 : 1}
                shadowColor="rgba(0,0,0,0.4)" shadowBlur={3} shadowOffsetY={2}
                onMouseDown={() => onPointerDown(portId)}
                onMouseEnter={(e) => onPointerEnter(e, portId, config)}
                onMouseLeave={onPointerLeave}
            />
            <Circle radius={4} fill="#000000" listening={false} />
        </Group>
    );
};