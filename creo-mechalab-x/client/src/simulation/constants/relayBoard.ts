import { applyRelayPinConfiguration } from './pinConfiguration';

export const HW_STYLES = {
    panelBg: '#f8fafc',
    panelBorder: '#cbd5e1',
    frameSilver: '#94a3b8',
    jackRed: '#e74c3c',
    jackBlack: '#111827',
    jackBlue: '#3498db',
    jackYellow: '#f1c40f',
    labelYellow: '#f1c40f',
    switchRedOff: '#7f1d1d',
    switchRedOn: '#ef4444',
    ledOff: '#475569',
    ledOn: '#22c55e',
    technicalMono: 'Consolas, monaco, monospace',
    technicalSans: 'Inter, system-ui, sans-serif'
};

export const RELAY_PORTS: Record<string, { x: number; y: number; color: string; label: string; desc: string }> = {};

const generateTerminalStrip = (prefix: string, startX: number, startY: number, count: number, isVertical: boolean, color: string, labelPrefix: string) => {
    const spacing = 16;
    for (let i = 0; i < count; i++) {
        const x = isVertical ? startX : startX + (i * spacing);
        const y = isVertical ? startY + (i * spacing) : startY;
        RELAY_PORTS[`${prefix}_${i + 1}`] = {
            x, y, color, label: `${i + 1}`, desc: `${labelPrefix} ${i + 1}`
        };
    }
};

// 1. Top Control Panel Terminals 
generateTerminalStrip('vplus', 82, 252, 12, false, HW_STYLES.jackRed, '24V+ Supply');
generateTerminalStrip('vminus', 327, 252, 12, false, HW_STYLES.jackBlack, '0V- Ground');
generateTerminalStrip('lights', 572, 252, 12, false, HW_STYLES.jackBlue, 'Signal I/O');

// 2. Middle Relay Terminals 
generateTerminalStrip('relay1', 66, 402, 14, false, HW_STYLES.jackYellow, 'Relay 1');
generateTerminalStrip('relay2', 314, 402, 14, false, HW_STYLES.jackYellow, 'Relay 2');
generateTerminalStrip('relay3', 562, 402, 14, false, HW_STYLES.jackYellow, 'Relay 3');
generateTerminalStrip('relay4', 810, 402, 14, false, HW_STYLES.jackYellow, 'Relay 4');

// 3. Bottom Terminals
generateTerminalStrip('button', 82, 626, 12, false, HW_STYLES.jackYellow, 'Buttons');
generateTerminalStrip('counter', 330, 626, 12, false, HW_STYLES.jackYellow, 'Counter');
generateTerminalStrip('timer', 578, 626, 12, false, HW_STYLES.jackYellow, 'Timer');

// 4. Solenoid Terminals 
generateTerminalStrip('solenoid1', 852, 122, 12, true, HW_STYLES.jackBlue, 'Solenoid 1');
generateTerminalStrip('solenoid2', 852, 422, 12, true, HW_STYLES.jackBlue, 'Solenoid 2');

applyRelayPinConfiguration(RELAY_PORTS);
