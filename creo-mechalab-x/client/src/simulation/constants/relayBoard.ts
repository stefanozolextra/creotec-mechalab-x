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

// 1. Top-Left Control Panel Terminals (Horizontal)
generateTerminalStrip('vplus', 82, 252, 12, false, HW_STYLES.jackRed, '24V+ Supply');
generateTerminalStrip('vminus', 327, 252, 12, false, HW_STYLES.jackBlack, '0V- Ground');
generateTerminalStrip('signals', 572, 252, 12, false, HW_STYLES.jackBlue, 'Signal I/O');

// 2. Bottom-Left Relay & Timer Terminals (Horizontal)
generateTerminalStrip('relay1_top', 82, 402, 12, false, HW_STYLES.jackYellow, 'Relay 1 (Top)');
generateTerminalStrip('relay2_top', 327, 402, 12, false, HW_STYLES.jackYellow, 'Relay 2 (Top)');
generateTerminalStrip('timer_top', 572, 402, 12, false, HW_STYLES.jackYellow, 'Timer/Ctr (Top)');

generateTerminalStrip('relay1_bot', 82, 632, 12, false, HW_STYLES.jackYellow, 'Relay 1 (Bot)');
generateTerminalStrip('relay2_bot', 327, 632, 12, false, HW_STYLES.jackYellow, 'Relay 2 (Bot)');
generateTerminalStrip('timer_bot', 572, 632, 12, false, HW_STYLES.jackYellow, 'Timer/Ctr (Bot)');

// 3. Right-Side Solenoid Terminals (Vertical)
generateTerminalStrip('solenoid1', 852, 122, 12, true, HW_STYLES.jackBlue, 'Solenoid 1');
generateTerminalStrip('solenoid2', 852, 422, 12, true, HW_STYLES.jackBlue, 'Solenoid 2');