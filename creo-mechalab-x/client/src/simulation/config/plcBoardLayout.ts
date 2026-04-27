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
    ledRed: '#ef4444',
    omronBody: '#1e293b',
    technicalMono: 'Consolas, monaco, monospace',
    technicalSans: 'Inter, system-ui, sans-serif'
};

export const SOL_PAIR_START_X = 535;
export const SOL_PAIR_Y = 535;
export const SOL_PAIR_INNER_SPACING = 40;
export const SOL_PAIR_OUTER_SPACING = 150;
export const solPairX = (pairIdx: number, isPlus: boolean) =>
    SOL_PAIR_START_X + pairIdx * SOL_PAIR_OUTER_SPACING + (isPlus ? 0 : SOL_PAIR_INNER_SPACING);

export const REED_LIGHT_OFFSET_Y = -38;

// Fixed: Exported so the main app can read it, with inferred types
export const PLC_SOLENOID_LABELS = [
    { label: '3/2 A', x: solPairX(0, true) + SOL_PAIR_INNER_SPACING / 2 },
    { label: '4/2 A-', x: solPairX(1, true) + SOL_PAIR_INNER_SPACING / 2 },
    { label: '4/2A+', x: solPairX(2, true) + SOL_PAIR_INNER_SPACING / 2 },
    { label: '4/3 B-', x: solPairX(3, true) + SOL_PAIR_INNER_SPACING / 2 },
    { label: '4/3B+', x: solPairX(4, true) + SOL_PAIR_INNER_SPACING / 2 },
];