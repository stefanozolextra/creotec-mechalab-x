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
generateTerminalStrip('lights', 572, 252, 12, false, HW_STYLES.jackBlue, 'Signal I/O');

// 2. Bottom-Left Relay & Timer Terminals (Horizontal)
// FIXED ALIGNMENT: 14-pin blocks redistributed evenly
generateTerminalStrip('relay1', 66, 402, 14, false, HW_STYLES.jackYellow, 'Relay 1 (Top)');
generateTerminalStrip('relay2', 314, 402, 14, false, HW_STYLES.jackYellow, 'Relay 2 (Top)');
generateTerminalStrip('relay3', 562, 402, 14, false, HW_STYLES.jackYellow, 'Timer/Ctr (Top)');

generateTerminalStrip('button', 84, 638, 12, false, HW_STYLES.jackYellow, 'Relay 1 (Bot)');
generateTerminalStrip('counter', 329, 638, 12, false, HW_STYLES.jackYellow, 'Relay 2 (Bot)');
generateTerminalStrip('timer', 574, 638, 12, false, HW_STYLES.jackYellow, 'Timer/Ctr (Bot)');

// 3. Right-Side Solenoid Terminals (Vertical)
generateTerminalStrip('solenoid1', 852, 122, 12, true, HW_STYLES.jackBlue, 'Solenoid 1');
generateTerminalStrip('solenoid2', 852, 422, 12, true, HW_STYLES.jackBlue, 'Solenoid 2');

// Per-pin tooltip overrides for direct editing.
RELAY_PORTS['vplus_1'].desc = '24V+ Supply 1';
RELAY_PORTS['vplus_2'].desc = '24V+ Supply 2';
RELAY_PORTS['vplus_3'].desc = '24V+ Supply 3';
RELAY_PORTS['vplus_4'].desc = '24V+ Supply 4';
RELAY_PORTS['vplus_5'].desc = '24V+ Supply 5';
RELAY_PORTS['vplus_6'].desc = '24V+ Supply 6';
RELAY_PORTS['vplus_7'].desc = '24V+ Supply 7';
RELAY_PORTS['vplus_8'].desc = '24V+ Supply 8';
RELAY_PORTS['vplus_9'].desc = '24V+ Supply 9';
RELAY_PORTS['vplus_10'].desc = '24V+ Supply 10';
RELAY_PORTS['vplus_11'].desc = '24V+ Supply 11';
RELAY_PORTS['vplus_12'].desc = '24V+ Supply 12';

RELAY_PORTS['vminus_1'].desc = '0V- Ground 1';
RELAY_PORTS['vminus_2'].desc = '0V- Ground 2';
RELAY_PORTS['vminus_3'].desc = '0V- Ground 3';
RELAY_PORTS['vminus_4'].desc = '0V- Ground 4';
RELAY_PORTS['vminus_5'].desc = '0V- Ground 5';
RELAY_PORTS['vminus_6'].desc = '0V- Ground 6';
RELAY_PORTS['vminus_7'].desc = '0V- Ground 7';
RELAY_PORTS['vminus_8'].desc = '0V- Ground 8';
RELAY_PORTS['vminus_9'].desc = '0V- Ground 9';
RELAY_PORTS['vminus_10'].desc = '0V- Ground 10';
RELAY_PORTS['vminus_11'].desc = '0V- Ground 11';
RELAY_PORTS['vminus_12'].desc = '0V- Ground 12';

RELAY_PORTS['lights_1'].desc = 'G - X1';
RELAY_PORTS['lights_2'].desc = 'G - X2';
RELAY_PORTS['lights_3'].desc = 'Y - X1';
RELAY_PORTS['lights_4'].desc = 'Y - X2';
RELAY_PORTS['lights_5'].desc = 'R - X1';
RELAY_PORTS['lights_6'].desc = 'R - X2';
RELAY_PORTS['lights_7'].desc = 'Buzzer +';
RELAY_PORTS['lights_8'].desc = 'Buzzer -';
RELAY_PORTS['lights_9'].desc = '';
RELAY_PORTS['lights_10'].desc = '';
RELAY_PORTS['lights_11'].desc = '';
RELAY_PORTS['lights_12'].desc = '';

RELAY_PORTS['relay1_1'].desc = '14';
RELAY_PORTS['relay1_2'].desc = '13';
RELAY_PORTS['relay1_3'].desc = '1';
RELAY_PORTS['relay1_4'].desc = '2';
RELAY_PORTS['relay1_5'].desc = '3';
RELAY_PORTS['relay1_6'].desc = '5';
RELAY_PORTS['relay1_7'].desc = '6';
RELAY_PORTS['relay1_8'].desc = '7';
RELAY_PORTS['relay1_9'].desc = '9';
RELAY_PORTS['relay1_10'].desc = '10';
RELAY_PORTS['relay1_11'].desc = '11';
RELAY_PORTS['relay1_12'].desc = '';

RELAY_PORTS['relay2_1'].desc = '14';
RELAY_PORTS['relay2_2'].desc = '13';
RELAY_PORTS['relay2_3'].desc = '1';
RELAY_PORTS['relay2_4'].desc = '2';
RELAY_PORTS['relay2_5'].desc = '3';
RELAY_PORTS['relay2_6'].desc = '5';
RELAY_PORTS['relay2_7'].desc = '6';
RELAY_PORTS['relay2_8'].desc = '7';
RELAY_PORTS['relay2_9'].desc = '9';
RELAY_PORTS['relay2_10'].desc = '10';
RELAY_PORTS['relay2_11'].desc = '11';
RELAY_PORTS['relay2_12'].desc = '';

RELAY_PORTS['relay3_1'].desc = '14';
RELAY_PORTS['relay3_2'].desc = '13';
RELAY_PORTS['relay3_3'].desc = '1';
RELAY_PORTS['relay3_4'].desc = '2';
RELAY_PORTS['relay3_5'].desc = '3';
RELAY_PORTS['relay3_6'].desc = '5';
RELAY_PORTS['relay3_7'].desc = '6';
RELAY_PORTS['relay3_8'].desc = '7';
RELAY_PORTS['relay3_9'].desc = '9';
RELAY_PORTS['relay3_10'].desc = '10';
RELAY_PORTS['relay3_11'].desc = '11';
RELAY_PORTS['relay3_12'].desc = '';

RELAY_PORTS['button_1'].desc = 'Relay 1 (Bot) 1';
RELAY_PORTS['button_2'].desc = 'Relay 1 (Bot) 2';
RELAY_PORTS['button_3'].desc = 'Relay 1 (Bot) 3';
RELAY_PORTS['button_4'].desc = 'Relay 1 (Bot) 4';
RELAY_PORTS['button_5'].desc = 'Relay 1 (Bot) 5';
RELAY_PORTS['button_6'].desc = 'Relay 1 (Bot) 6';
RELAY_PORTS['button_7'].desc = 'Relay 1 (Bot) 7';
RELAY_PORTS['button_8'].desc = 'Relay 1 (Bot) 8';
RELAY_PORTS['button_9'].desc = 'Relay 1 (Bot) 9';
RELAY_PORTS['button_10'].desc = 'Relay 1 (Bot) 10';
RELAY_PORTS['button_11'].desc = 'Relay 1 (Bot) 11';
RELAY_PORTS['button_12'].desc = 'Relay 1 (Bot) 12';

RELAY_PORTS['counter_1'].desc = 'Relay 2 (Bot) 1';
RELAY_PORTS['counter_2'].desc = 'Relay 2 (Bot) 2';
RELAY_PORTS['counter_3'].desc = 'Relay 2 (Bot) 3';
RELAY_PORTS['counter_4'].desc = 'Relay 2 (Bot) 4';
RELAY_PORTS['counter_5'].desc = 'Relay 2 (Bot) 5';
RELAY_PORTS['counter_6'].desc = 'Relay 2 (Bot) 6';
RELAY_PORTS['counter_7'].desc = 'Relay 2 (Bot) 7';
RELAY_PORTS['counter_8'].desc = 'Relay 2 (Bot) 8';
RELAY_PORTS['counter_9'].desc = 'Relay 2 (Bot) 9';
RELAY_PORTS['counter_10'].desc = 'Relay 2 (Bot) 10';
RELAY_PORTS['counter_11'].desc = 'Relay 2 (Bot) 11';
RELAY_PORTS['counter_12'].desc = 'Relay 2 (Bot) 12';

RELAY_PORTS['timer_1'].desc = 'Timer/Ctr (Bot) 1';
RELAY_PORTS['timer_2'].desc = 'Timer/Ctr (Bot) 2';
RELAY_PORTS['timer_3'].desc = 'Timer/Ctr (Bot) 3';
RELAY_PORTS['timer_4'].desc = 'Timer/Ctr (Bot) 4';
RELAY_PORTS['timer_5'].desc = 'Timer/Ctr (Bot) 5';
RELAY_PORTS['timer_6'].desc = 'Timer/Ctr (Bot) 6';
RELAY_PORTS['timer_7'].desc = 'Timer/Ctr (Bot) 7';
RELAY_PORTS['timer_8'].desc = 'Timer/Ctr (Bot) 8';
RELAY_PORTS['timer_9'].desc = 'Timer/Ctr (Bot) 9';
RELAY_PORTS['timer_10'].desc = 'Timer/Ctr (Bot) 10';
RELAY_PORTS['timer_11'].desc = 'Timer/Ctr (Bot) 11';
RELAY_PORTS['timer_12'].desc = 'Timer/Ctr (Bot) 12';

RELAY_PORTS['solenoid1_1'].desc = 'Solenoid 1 1';
RELAY_PORTS['solenoid1_2'].desc = 'Solenoid 1 2';
RELAY_PORTS['solenoid1_3'].desc = 'Solenoid 1 3';
RELAY_PORTS['solenoid1_4'].desc = 'Solenoid 1 4';
RELAY_PORTS['solenoid1_5'].desc = 'Solenoid 1 5';
RELAY_PORTS['solenoid1_6'].desc = 'Solenoid 1 6';
RELAY_PORTS['solenoid1_7'].desc = 'Solenoid 1 7';
RELAY_PORTS['solenoid1_8'].desc = 'Solenoid 1 8';
RELAY_PORTS['solenoid1_9'].desc = 'Solenoid 1 9';
RELAY_PORTS['solenoid1_10'].desc = 'Solenoid 1 10';
RELAY_PORTS['solenoid1_11'].desc = 'Solenoid 1 11';
RELAY_PORTS['solenoid1_12'].desc = 'Solenoid 1 12';

RELAY_PORTS['solenoid2_1'].desc = 'Solenoid 2 1';
RELAY_PORTS['solenoid2_2'].desc = 'Solenoid 2 2';
RELAY_PORTS['solenoid2_3'].desc = 'Solenoid 2 3';
RELAY_PORTS['solenoid2_4'].desc = 'Solenoid 2 4';
RELAY_PORTS['solenoid2_5'].desc = 'Solenoid 2 5';
RELAY_PORTS['solenoid2_6'].desc = 'Solenoid 2 6';
RELAY_PORTS['solenoid2_7'].desc = 'Solenoid 2 7';
RELAY_PORTS['solenoid2_8'].desc = 'Solenoid 2 8';
RELAY_PORTS['solenoid2_9'].desc = 'Solenoid 2 9';
RELAY_PORTS['solenoid2_10'].desc = 'Solenoid 2 10';
RELAY_PORTS['solenoid2_11'].desc = 'Solenoid 2 11';
RELAY_PORTS['solenoid2_12'].desc = 'Solenoid 2 12';