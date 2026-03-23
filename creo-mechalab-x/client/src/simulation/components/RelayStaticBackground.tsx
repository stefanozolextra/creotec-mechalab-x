import React from 'react';
import { Layer, Group, Rect, Text, Circle, Line } from 'react-konva';
import { HW_STYLES } from '../constants/relayBoard';

export type ManualRelayButtonId = 'start-1' | 'start-2' | 'stop-1' | 'stop-2' | 'emergency-stop';

interface RelayStaticBackgroundProps {
    BASE_CANVAS_WIDTH: number;
    BASE_CANVAS_HEIGHT: number;
    canvasScale: number;
    isDarkMode: boolean;
    isMainSwitchOn: boolean;
    isGreenLampOn: boolean;
    manualButtonState: Record<ManualRelayButtonId, boolean>;
    onToggleSwitch: () => void;
    onManualButtonPressChange: (buttonId: ManualRelayButtonId, isPressed: boolean) => void;
}

export const RelayStaticBackground = React.memo(({
    BASE_CANVAS_WIDTH,
    BASE_CANVAS_HEIGHT,
    canvasScale,
    isDarkMode,
    isMainSwitchOn,
    isGreenLampOn,
    manualButtonState,
    onToggleSwitch,
    onManualButtonPressChange
}: RelayStaticBackgroundProps) => {

    const panelFill = isDarkMode ? '#1e293b' : '#ffffff';
    const panelStroke = isDarkMode ? '#334155' : '#e2e8f0';
    const textFill = isDarkMode ? '#94a3b8' : '#cbd5e1';
    const dashStroke = isDarkMode ? '#475569' : '#94a3b8';
    const holeFill = isDarkMode ? '#0f172a' : '#cbd5e1';
    const holeStroke = isDarkMode ? '#334155' : '#94a3b8';
    const MANUAL_BUTTONS: Array<{ id: ManualRelayButtonId; label: string; x: number; y: number; kind: 'start' | 'stop' | 'emergency' }> = [
        { id: 'start-1', label: 'START', x: 92, y: 560, kind: 'start' },
        { id: 'start-2', label: 'START', x: 128, y: 560, kind: 'start' },
        { id: 'stop-1', label: 'STOP', x: 164, y: 560, kind: 'stop' },
        { id: 'stop-2', label: 'STOP', x: 200, y: 560, kind: 'stop' },
        { id: 'emergency-stop', label: 'EMERGENCY\nSTOP', x: 244, y: 560, kind: 'emergency' },
    ];

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
            <Rect x={180} y={14} width={85} height={8} fill="#bdc3c7" stroke="#7f8c8d" strokeWidth={1} />
        </Group>
    );

    const renderMicroSwitch = (x: number, y: number, rotation = 0) => (
        <Group x={x} y={y} listening={false}>
            <Group x={20} y={13} offsetX={20} offsetY={13} rotation={rotation}>
                {/* Panel Hole for Wires */}
                <Circle x={40} y={10} radius={4} fill={holeFill} stroke={holeStroke} strokeWidth={1} shadowColor="rgba(0,0,0,0.3)" shadowBlur={2} />
                {/* Hardwired red electrical wires disappearing into panel */}
                <Line points={[24, 6, 32, 6, 40, 10]} stroke="#ef4444" strokeWidth={1.5} tension={0.3} />
                <Line points={[24, 10, 34, 10, 39, 10]} stroke="#ef4444" strokeWidth={1.5} tension={0.3} />

                {/* Simulated Wooden Mount */}
                <Rect x={-4} y={-4} width={36} height={26} fill="#8b5a2b" cornerRadius={2} opacity={isDarkMode ? 0.6 : 0.8} />
                {/* Switch Body */}
                <Rect width={28} height={18} fill="#111827" cornerRadius={2} shadowColor="rgba(0,0,0,0.3)" shadowBlur={2} shadowOffsetY={1} />
                <Circle x={6} y={6} radius={2} fill="#374151" />
                <Circle x={22} y={12} radius={2} fill="#374151" />
                {/* Angled Metal Lever */}
                <Line points={[2, 18, 16, 28]} stroke="#cbd5e1" strokeWidth={1.5} lineCap="round" />
                <Circle x={16} y={28} radius={2.5} fill="#f8fafc" stroke="#475569" strokeWidth={1} />
            </Group>
        </Group>
    );

    const render52Valve = (x: number, y: number, cylX: number, cylY: number) => (
        <Group listening={false}>
            {/* Orange Pneumatic Tubes connecting to Cylinder */}
            <Line points={[x + 25, y, x + 25, y - 25, cylX + 20, y - 25, cylX + 20, cylY + 36]} stroke="#f97316" strokeWidth={3.5} lineJoin="round" />
            <Line points={[x + 55, y, x + 55, y - 15, cylX + 160, y - 15, cylX + 160, cylY + 36]} stroke="#f97316" strokeWidth={3.5} lineJoin="round" />

            {/* Supply Air Tube (Bottom) routing cleanly into the panel hole */}
            <Circle x={x + 40} y={y + 50} radius={5} fill={holeFill} stroke={holeStroke} strokeWidth={1} shadowColor="rgba(0,0,0,0.3)" shadowBlur={2} />
            <Line points={[x + 40, y + 36, x + 40, y + 50]} stroke="#f97316" strokeWidth={3.5} />

            <Group x={x} y={y}>
                {/* Main Silver Valve Body */}
                <Rect width={80} height={36} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={1} shadowColor="rgba(0,0,0,0.2)" shadowBlur={4} shadowOffsetY={2} />

                {/* AIGYAD Logo/Text */}
                <Text text="AIGYAD" x={22} y={8} fontSize={9} fontStyle="bold" fill="#0369a1" />
                <Text text="Model: 4V220-08" x={9} y={20} fontSize={6} fontStyle="bold" fill="#334155" />
                <Text text="VALVE" x={52} y={10} fontSize={5} fill="#475569" />

                {/* Panel Hole for Left Wires */}
                <Circle x={-42} y={6} radius={4} fill={holeFill} stroke={holeStroke} strokeWidth={1} shadowColor="rgba(0,0,0,0.3)" shadowBlur={2} />

                {/* Left Solenoid Coil (Black) */}
                <Rect x={-36} y={0} width={36} height={36} fill="#111827" cornerRadius={[4, 0, 0, 4]} />
                <Rect x={-36} y={10} width={8} height={16} fill="#334155" />

                {/* Left Translucent Connector */}
                <Rect x={-30} y={-16} width={24} height={16} fill="rgba(69, 26, 3, 0.85)" stroke="#000000" strokeWidth={1} />

                {/* Left Electrical Wires routing into panel hole */}
                <Line points={[-18, -10, -35, -10, -42, 6]} stroke="#ef4444" strokeWidth={1.5} tension={0.3} />
                <Line points={[-18, -14, -30, -14, -40, 4]} stroke="#111827" strokeWidth={1.5} tension={0.3} />

                {/* Panel Hole for Right Wires */}
                <Circle x={122} y={6} radius={4} fill={holeFill} stroke={holeStroke} strokeWidth={1} shadowColor="rgba(0,0,0,0.3)" shadowBlur={2} />

                {/* Right Solenoid Coil (Black) */}
                <Rect x={80} y={0} width={36} height={36} fill="#111827" cornerRadius={[0, 4, 4, 0]} />
                <Rect x={108} y={10} width={8} height={16} fill="#334155" />

                {/* Right Translucent Connector */}
                <Rect x={86} y={-16} width={24} height={16} fill="rgba(69, 26, 3, 0.85)" stroke="#000000" strokeWidth={1} />

                {/* Right Electrical Wires routing into panel hole */}
                <Line points={[98, -10, 115, -10, 122, 6]} stroke="#ef4444" strokeWidth={1.5} tension={0.3} />
                <Line points={[98, -14, 110, -14, 120, 4]} stroke="#111827" strokeWidth={1.5} tension={0.3} />

                {/* Pneumatic Fittings (Gold Bases & Blue Push-in Rings) */}
                {/* Top A & B */}
                <Rect x={20} y={-6} width={10} height={6} fill="#d4af37" />
                <Rect x={21} y={-8} width={8} height={2} fill="#3b82f6" />
                <Rect x={50} y={-6} width={10} height={6} fill="#d4af37" />
                <Rect x={51} y={-8} width={8} height={2} fill="#3b82f6" />
                {/* Bottom R, P, S */}
                <Rect x={10} y={36} width={8} height={6} fill="#d4af37" />
                <Rect x={36} y={36} width={8} height={6} fill="#d4af37" />
                <Rect x={37} y={42} width={6} height={2} fill="#3b82f6" />
                <Rect x={62} y={36} width={8} height={6} fill="#d4af37" />
            </Group>
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

    const renderManualButton = (button: (typeof MANUAL_BUTTONS)[number]) => {
        const isPressed = manualButtonState[button.id];
        const isEmergency = button.kind === 'emergency';
        const containerOffsetY = isPressed ? 2 : 0;

        return (
            <Group
                key={button.id}
                x={button.x}
                y={button.y}
                onMouseDown={() => onManualButtonPressChange(button.id, true)}
                onMouseUp={() => onManualButtonPressChange(button.id, false)}
                onTouchStart={() => onManualButtonPressChange(button.id, true)}
                onTouchEnd={() => onManualButtonPressChange(button.id, false)}
                onMouseLeave={(e) => {
                    onManualButtonPressChange(button.id, false);
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'default';
                }}
                onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'pointer';
                }}
            >
                {isEmergency ? (
                    <>
                        <Group y={containerOffsetY}>
                            <Circle radius={15} fill={isPressed ? '#ca8a04' : '#facc15'} shadowColor="rgba(0,0,0,0.4)" shadowBlur={6} shadowOffsetY={3} />
                            <Circle radius={10} fill={isPressed ? '#dc2626' : '#ef4444'} />
                        </Group>
                        <Text text={button.label} x={-34} y={19} width={68} fontSize={7} fontStyle="bold" fill="#1e293b" align="center" listening={false} />
                    </>
                ) : (
                    <>
                        <Group y={containerOffsetY}>
                            <Circle
                                radius={12}
                                fill={button.kind === 'start'
                                    ? (isPressed ? '#0f766e' : '#10b981')
                                    : (isPressed ? '#b91c1c' : '#ef4444')}
                                shadowColor="rgba(0,0,0,0.4)"
                                shadowBlur={6}
                                shadowOffsetY={3}
                            />
                            <Circle
                                radius={8}
                                fill={button.kind === 'start'
                                    ? (isPressed ? '#10b981' : '#34d399')
                                    : (isPressed ? '#ef4444' : '#f87171')}
                            />
                        </Group>
                        <Text text={button.label} x={-18} y={18} width={36} fontSize={7.5} fontStyle="bold" fill="#1e293b" align="center" listening={false} />
                    </>
                )}
            </Group>
        );
    };

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

                <Rect x={320} y={495} width={460} height={30} fill={isDarkMode ? '#334155' : '#e2e8f0'} stroke={isDarkMode ? '#475569' : '#cbd5e1'} strokeWidth={1} cornerRadius={2} />
                <Line points={[320, 510, 780, 510]} stroke={isDarkMode ? '#1e293b' : '#94a3b8'} strokeWidth={2} dash={[10, 10]} />

                {/* FIXED ALIGNMENT: 14-pin blocks redistributed evenly */}
                <Rect x={48} y={380} width={240} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TERMINALS (RELAY 1)" x={48} y={365} fontSize={10} fontStyle="bold" fill={textFill} />

                <Rect x={296} y={380} width={240} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TERMINALS (RELAY 2)" x={296} y={365} fontSize={10} fontStyle="bold" fill={textFill} />

                <Rect x={544} y={380} width={240} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TERMINALS (RELAY 3)" x={544} y={365} fontSize={10} fontStyle="bold" fill={textFill} />

                {/* FIXED ALIGNMENT: 12-pin blocks centered beneath the 14-pin blocks */}
                <Rect x={60} y={604} width={216} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="BUTTON" x={60} y={589} fontSize={10} fontStyle="bold" fill={textFill} />

                <Rect x={308} y={604} width={216} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="COUNTER" x={308} y={589} fontSize={10} fontStyle="bold" fill={textFill} />

                <Rect x={556} y={604} width={216} height={45} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="TIMER" x={556} y={589} fontSize={10} fontStyle="bold" fill={textFill} />

                <Rect x={830} y={100} width={45} height={220} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="SOLENOID 1" x={830} y={85} fontSize={11} fontStyle="bold" fill={textFill} />
                <Rect x={830} y={400} width={45} height={220} stroke={dashStroke} strokeWidth={1.5} dash={[4, 4]} cornerRadius={4} />
                <Text text="SOLENOID 2" x={830} y={385} fontSize={11} fontStyle="bold" fill={textFill} />

                {/* Labels for the Limit Switches */}
                <Text text="LS1" x={1082} y={120} fontSize={11} fontStyle="bold" fill={textFill} />
                <Text text="LS2" x={1142} y={120} fontSize={11} fontStyle="bold" fill={textFill} />
                <Text text="LS3" x={1082} y={420} fontSize={11} fontStyle="bold" fill={textFill} />
                <Text text="LS4" x={1142} y={420} fontSize={11} fontStyle="bold" fill={textFill} />
            </Group>

            {/* Middle Hardware Components */}
            <Group listening={false}>
                <Group x={430} y={465}>
                    <Rect width={60} height={90} fill="#1e293b" cornerRadius={4} shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffsetY={2} />
                    <Rect x={5} y={5} width={50} height={80} fill="#334155" cornerRadius={2} />
                    <Text text="RY-1" x={16} y={40} fill="#94a3b8" fontStyle="bold" />
                </Group>
                <Group x={555} y={465}>
                    <Rect width={60} height={90} fill="#1e293b" cornerRadius={4} shadowColor="rgba(0,0,0,0.3)" shadowBlur={4} shadowOffsetY={2} />
                    <Rect x={5} y={5} width={50} height={80} fill="#334155" cornerRadius={2} />
                    <Text text="RY-2" x={16} y={40} fill="#94a3b8" fontStyle="bold" />
                </Group>
                <Group x={675} y={465}>
                    <Rect width={80} height={90} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={2} cornerRadius={4} shadowColor="rgba(0,0,0,0.2)" shadowBlur={4} shadowOffsetY={2} />
                    <Rect x={10} y={10} width={60} height={30} fill="#0f172a" cornerRadius={2} />
                    <Text text="00.00" x={18} y={16} fill="#ef4444" fontSize={18} fontFamily={HW_STYLES.technicalMono} />
                    <Text text="TIMER/CTR" x={12} y={60} fill="#64748b" fontSize={10} fontStyle="bold" />
                </Group>

                {/* Cylinders */}
                {renderPneumaticCylinder(920, 190, "CYLINDER A")}
                {renderPneumaticCylinder(920, 490, "CYLINDER B")}

                {/* Limit Switch Mounts & Bodies */}
                {renderMicroSwitch(1105, 172, 180)}
                {renderMicroSwitch(1165, 172)}
                {renderMicroSwitch(1105, 472, 180)}
                {renderMicroSwitch(1165, 472)}

                {/* 5/2-Way Valves */}
                {render52Valve(970, 275, 920, 190)}
                {render52Valve(970, 575, 920, 490)}
            </Group>

            {/* Manual Input Buttons */}
            {MANUAL_BUTTONS.map(renderManualButton)}

            {/* Terminal Bases (Untouched) */}
            {renderTerminalStripBase('vplus', 82, 252, 12, false)}
            {renderTerminalStripBase('vminus', 327, 252, 12, false)}
            {renderTerminalStripBase('signals', 572, 252, 12, false)}

            {/* FIXED ALIGNMENT: 14-pin blocks */}
            {renderTerminalStripBase('relay1_top', 66, 402, 14, false)}
            {renderTerminalStripBase('relay2_top', 314, 402, 14, false)}
            {renderTerminalStripBase('timer_top', 562, 402, 14, false)}

            {/* FIXED Y-AXIS: Moved up from 638 to 626 */}
            {renderTerminalStripBase('relay1_bot', 82, 626, 12, false)}
            {renderTerminalStripBase('relay2_bot', 330, 626, 12, false)}
            {renderTerminalStripBase('timer_bot', 578, 626, 12, false)}

            {renderTerminalStripBase('solenoid1', 852, 122, 12, true)}
            {renderTerminalStripBase('solenoid2', 852, 422, 12, true)}

        </Layer>
    );
});