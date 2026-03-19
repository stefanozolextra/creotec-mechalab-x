import React from 'react';
import { Layer, Group, Rect, Text, Circle, Line } from 'react-konva';
import { HW_STYLES } from '../constants/relayBoard';

interface RelayStaticBackgroundProps {
    BASE_CANVAS_WIDTH: number;
    BASE_CANVAS_HEIGHT: number;
    canvasScale: number;
    isDarkMode: boolean;
    isMainSwitchOn: boolean;
    isGreenLampOn: boolean;
    onToggleSwitch: () => void;
}

export const RelayStaticBackground = React.memo(({
    BASE_CANVAS_WIDTH,
    BASE_CANVAS_HEIGHT,
    canvasScale,
    isDarkMode,
    isMainSwitchOn,
    isGreenLampOn,
    onToggleSwitch
}: RelayStaticBackgroundProps) => {

    const panelFill = isDarkMode ? '#1e293b' : '#ffffff';
    const panelStroke = isDarkMode ? '#334155' : '#e2e8f0';
    const textFill = isDarkMode ? '#94a3b8' : '#cbd5e1';
    const dashStroke = isDarkMode ? '#475569' : '#94a3b8';

    const renderTechnicalPanel = (id: string, x: number, y: number, width: number, height: number, title: string) => (
        <Group key={`panel-${id}`} x={x} y={y} listening={false}>
            <Rect width={width} height={height} fill={panelFill} cornerRadius={8} stroke={panelStroke} strokeWidth={2} shadowColor="rgba(0,0,0,0.05)" shadowBlur={10} shadowOffsetY={4} />
            <Text text={title} x={20} y={15} fontSize={12} fontStyle="bold" fill={textFill} />
        </Group>
    );

    const renderTerminalStripBase = (id: string, startX: number, startY: number, count: number, isVertical: boolean) => {
        const spacing = 16;
        const width = isVertical ? 34 : count * spacing + 14;
        const height = isVertical ? count * spacing + 14 : 34;
        return (
            <Group key={`base-${id}`} x={startX - 17} y={startY - 17} listening={false}>
                <Rect width={width} height={height} fill="#111827" cornerRadius={4} shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffsetY={2} />
                <Rect x={isVertical ? 7 : 0} y={isVertical ? 0 : 7} width={isVertical ? 20 : width} height={isVertical ? height : 20} fill="#374151" />
            </Group>
        );
    };

    const renderPneumaticCylinder = (x: number, y: number, label: string) => (
        <Group x={x} y={y} listening={false}>
            <Rect width={180} height={36} fill="#e2e8f0" cornerRadius={4} stroke="#94a3b8" strokeWidth={2} shadowColor="rgba(0,0,0,0.2)" shadowBlur={5} shadowOffsetY={3} />
            <Rect x={10} y={0} width={20} height={36} fill="#3498db" />
            <Rect x={150} y={0} width={20} height={36} fill="#3498db" />
            <Text text={label} x={40} y={12} fontSize={12} fontStyle="bold" fill="#475569" width={100} align="center" />
            <Rect x={180} y={14} width={60} height={8} fill="#bdc3c7" stroke="#7f8c8d" strokeWidth={1} />
        </Group>
    );

    const renderMicroSwitch = (x: number, y: number) => (
        <Group x={x} y={y} listening={false}>
            {/* Simulated Wooden Mount */}
            <Rect x={-4} y={-4} width={36} height={26} fill="#8b5a2b" cornerRadius={2} opacity={isDarkMode ? 0.6 : 0.8} />
            {/* Switch Body */}
            <Rect width={28} height={18} fill="#111827" cornerRadius={2} shadowColor="rgba(0,0,0,0.3)" shadowBlur={2} shadowOffsetY={1} />
            <Circle x={6} y={6} radius={2} fill="#374151" />
            <Circle x={22} y={12} radius={2} fill="#374151" />
            {/* Angled Metal Lever */}
            <Line points={[2, 18, 16, 28]} stroke="#cbd5e1" strokeWidth={1.5} lineCap="round" />
            {/* Roller resting on the rod plane */}
            <Circle x={16} y={28} radius={2.5} fill="#f8fafc" stroke="#475569" strokeWidth={1} />
        </Group>
    );

    const renderIndicatorLamp = (
        x: number,
        label: string,
        activeFill: string,
        activeStroke: string,
        isLit: boolean,
    ) => (
        <Group x={x} y={130} listening={false}>
            <Circle radius={26} fill={isDarkMode ? "#0f172a" : "#f1f5f9"} stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} />
            <Circle
                radius={18}
                fill={isLit ? activeFill : HW_STYLES.ledOff}
                stroke={isLit ? activeStroke : "#334155"}
                strokeWidth={1}
                shadowColor={isLit ? activeFill : "transparent"}
                shadowBlur={isLit ? 16 : 0}
            />
            <Text text={label} x={-28} y={35} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" />
        </Group>
    );

    return (
        <Layer scaleX={canvasScale} scaleY={canvasScale} id="static-hardware-layer">
            <Rect width={BASE_CANVAS_WIDTH} height={BASE_CANVAS_HEIGHT} fill="#cbd5e1" listening={false} />

            {/* Panels */}
            {renderTechnicalPanel("control-panel", 40, 40, 750, 270, "CONTROL & INDICATOR PANEL")}
            {renderTechnicalPanel("relay-panel", 40, 330, 750, 350, "RELAYS & TIMERS")}
            {renderTechnicalPanel("actuator-panel", 810, 40, 430, 640, "ACTUATORS & SENSORS")}

            {/* Interactive Switch */}
            <Group x={100} y={90}
                onClick={onToggleSwitch}
                onTap={onToggleSwitch}
                onMouseEnter={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'pointer'; }}
                onMouseLeave={(e) => { const container = e.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
            >
                <Rect width={80} height={80} fill={isDarkMode ? "#0f172a" : "#f8fafc"} cornerRadius={6} stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} shadowColor="rgba(0,0,0,0.1)" shadowBlur={4} />
                <Rect x={20} y={20} width={40} height={40} fill={isDarkMode ? "#334155" : "#e2e8f0"} cornerRadius={4} stroke="#cbd5e1" strokeWidth={1} />
                <Rect x={20} y={20} width={40} height={20} fill={isMainSwitchOn ? "#22c55e" : "#f1f5f9"} cornerRadius={[4, 4, 0, 0]} listening={false} />
                <Text text="MAIN SWITCH" x={5} y={95} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" listening={false} />
            </Group>

            {/* Static Indicators */}
            {renderIndicatorLamp(280, "LAMP 1 (G)", HW_STYLES.ledOn, "#16a34a", isGreenLampOn)}
            {renderIndicatorLamp(425, "LAMP 2 (Y)", "#eab308", "#ca8a04", false)}
            {renderIndicatorLamp(570, "LAMP 3 (R)", "#ef4444", "#dc2626", false)}
            <Group x={715} y={130} listening={false}>
                <Circle radius={26} fill={isDarkMode ? "#0f172a" : "#f1f5f9"} stroke={isDarkMode ? "#334155" : "#cbd5e1"} strokeWidth={2} />
                <Circle radius={18} fill="#1e293b" />
                <Circle radius={6} fill="#000000" />
                <Text text="BUZZER" x={-20} y={35} fontSize={10} fill={isDarkMode ? '#94a3b8' : '#64748b'} fontStyle="bold" />
            </Group>

            {/* Dashed Areas */}
            <Group listening={false}>
                <Rect x={60} y={230} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="V+ (24VDC)" x={60} y={215} fontSize={11} fill={textFill} fontStyle="bold" />
                <Rect x={305} y={230} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="V- (0VDC)" x={305} y={215} fontSize={11} fill={textFill} fontStyle="bold" />
                <Rect x={550} y={230} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="LIGHTS AND BUZZER (X1/X2)" x={550} y={215} fontSize={11} fill={textFill} fontStyle="bold" />

                <Rect x={50} y={495} width={730} height={30} fill={isDarkMode ? '#334155' : '#e2e8f0'} stroke={isDarkMode ? '#475569' : '#cbd5e1'} strokeWidth={1} cornerRadius={2} />
                <Line points={[50, 510, 780, 510]} stroke={isDarkMode ? '#1e293b' : '#94a3b8'} strokeWidth={2} dash={[10, 10]} />

                <Rect x={60} y={380} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TERMINALS (RELAY 1)" x={60} y={365} fontSize={10} fontStyle="bold" fill={textFill} />
                <Rect x={305} y={380} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TERMINALS (RELAY 2)" x={305} y={365} fontSize={10} fontStyle="bold" fill={textFill} />
                <Rect x={550} y={380} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TERMINALS (RELAY 3)" x={550} y={365} fontSize={10} fontStyle="bold" fill={textFill} />

                <Rect x={60} y={610} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="BUTTON" x={60} y={595} fontSize={10} fontStyle="bold" fill={textFill} />
                <Rect x={305} y={610} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="COUNTER" x={305} y={595} fontSize={10} fontStyle="bold" fill={textFill} />
                <Rect x={550} y={610} width={220} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TIMER" x={550} y={595} fontSize={10} fontStyle="bold" fill={textFill} />

                <Rect x={830} y={100} width={45} height={220} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="SOLENOID 1" x={830} y={85} fontSize={11} fontStyle="bold" fill={textFill} />
                <Rect x={830} y={400} width={45} height={220} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="SOLENOID 2" x={830} y={385} fontSize={11} fontStyle="bold" fill={textFill} />

                {/* Labels for the Limit Switches */}
                <Text text="1S1" x={1082} y={120} fontSize={11} fontStyle="bold" fill={textFill} />
                <Text text="1S2" x={1142} y={120} fontSize={11} fontStyle="bold" fill={textFill} />
                <Text text="2S1" x={1082} y={420} fontSize={11} fontStyle="bold" fill={textFill} />
                <Text text="2S2" x={1142} y={420} fontSize={11} fontStyle="bold" fill={textFill} />
            </Group>

            {/* Middle Hardware Components */}
            <Group listening={false}>
                <Group x={140} y={465}>
                    <Rect width={60} height={90} fill="#1e293b" cornerRadius={4} shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffsetY={2} />
                    <Rect x={5} y={5} width={50} height={80} fill="#334155" cornerRadius={2} />
                    <Text text="RY-1" x={16} y={40} fill="#94a3b8" fontStyle="bold" />
                </Group>
                <Group x={385} y={465}>
                    <Rect width={60} height={90} fill="#1e293b" cornerRadius={4} shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffsetY={2} />
                    <Rect x={5} y={5} width={50} height={80} fill="#334155" cornerRadius={2} />
                    <Text text="RY-2" x={16} y={40} fill="#94a3b8" fontStyle="bold" />
                </Group>
                <Group x={620} y={465}>
                    <Rect width={80} height={90} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={2} cornerRadius={4} shadowColor="rgba(0,0,0,0.2)" shadowBlur={4} shadowOffsetY={2} />
                    <Rect x={10} y={10} width={60} height={30} fill="#0f172a" cornerRadius={2} />
                    <Text text="00.00" x={18} y={16} fill="#ef4444" fontSize={18} fontFamily={HW_STYLES.technicalMono} />
                    <Text text="TIMER/CTR" x={12} y={60} fill="#64748b" fontSize={10} fontStyle="bold" />
                </Group>
                {renderPneumaticCylinder(920, 190, "CYLINDER A")}
                {renderPneumaticCylinder(920, 490, "CYLINDER B")}

                {/* Limit Switch Mounts & Bodies */}
                {renderMicroSwitch(1085, 172)}
                {renderMicroSwitch(1145, 172)}
                {renderMicroSwitch(1085, 472)}
                {renderMicroSwitch(1145, 472)}
            </Group>

            {/* Terminal Bases */}
            {renderTerminalStripBase('vplus', 82, 252, 12, false)}
            {renderTerminalStripBase('vminus', 327, 252, 12, false)}
            {renderTerminalStripBase('signals', 572, 252, 12, false)}
            {renderTerminalStripBase('relay1_top', 82, 402, 12, false)}
            {renderTerminalStripBase('relay2_top', 327, 402, 12, false)}
            {renderTerminalStripBase('timer_top', 572, 402, 12, false)}
            {renderTerminalStripBase('relay1_bot', 82, 632, 12, false)}
            {renderTerminalStripBase('relay2_bot', 327, 632, 12, false)}
            {renderTerminalStripBase('timer_bot', 572, 632, 12, false)}
            {renderTerminalStripBase('solenoid1', 852, 122, 12, true)}
            {renderTerminalStripBase('solenoid2', 852, 422, 12, true)}
        </Layer>
    );
});