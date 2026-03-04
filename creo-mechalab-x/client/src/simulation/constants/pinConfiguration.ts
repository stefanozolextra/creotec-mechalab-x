// Pin configuration and helpers for custom terminal-strip devices

export type LampColor = 'red' | 'yellow' | 'green' | 'no-connection';
export type LampSet = 'X1' | 'X2';

export const LIGHT_INDICATOR_PINOUT: {
  red: Record<LampSet, string[]>;
  yellow: Record<LampSet, string[]>;
  green: Record<LampSet, string[]>;
  noConnect: string[];
} = {
  red: {
    X1: ['pin_15', 'pin_3'], // X1 pair
    X2: ['pin_14', 'pin_2'], // X2 pair
  },
  yellow: {
    X1: ['pin_18', 'pin_6'],
    X2: ['pin_17', 'pin_5'],
  },
  green: {
    X1: ['pin_22', 'pin_10'],
    X2: ['pin_21', 'pin_9'],
  },
  noConnect: [
    'pin_1', 'pin_4', 'pin_7', 'pin_8', 'pin_11', 'pin_12',
    'pin_13', 'pin_16', 'pin_19', 'pin_20', 'pin_23', 'pin_24',
  ],
};

// Accepts either a full pin id like "lightIndicator-1-pin_14" or a bare pin name "pin_14"
export function normalizePinName(pinId: string): string {
  const parts = pinId.split('-');
  return parts[parts.length - 1];
}

export function getLampColorForPin(pinId: string): LampColor | null {
  const pin = normalizePinName(pinId);

  if (LIGHT_INDICATOR_PINOUT.red.X1.includes(pin) || LIGHT_INDICATOR_PINOUT.red.X2.includes(pin)) {
    return 'red';
  }

  if (LIGHT_INDICATOR_PINOUT.yellow.X1.includes(pin) || LIGHT_INDICATOR_PINOUT.yellow.X2.includes(pin)) {
    return 'yellow';
  }

  if (LIGHT_INDICATOR_PINOUT.green.X1.includes(pin) || LIGHT_INDICATOR_PINOUT.green.X2.includes(pin)) {
    return 'green';
  }

  if (LIGHT_INDICATOR_PINOUT.noConnect.includes(pin)) {
    return 'no-connection';
  }

  return null;
}

export function getPinsForLamp(color: 'red' | 'yellow' | 'green', set?: LampSet): string[] {
  if (color === 'red') {
    return set ? LIGHT_INDICATOR_PINOUT.red[set] : [...LIGHT_INDICATOR_PINOUT.red.X1, ...LIGHT_INDICATOR_PINOUT.red.X2];
  }

  if (color === 'yellow') {
    return set ? LIGHT_INDICATOR_PINOUT.yellow[set] : [...LIGHT_INDICATOR_PINOUT.yellow.X1, ...LIGHT_INDICATOR_PINOUT.yellow.X2];
  }

  if (color === 'green') {
    return set ? LIGHT_INDICATOR_PINOUT.green[set] : [...LIGHT_INDICATOR_PINOUT.green.X1, ...LIGHT_INDICATOR_PINOUT.green.X2];
  }

  return [];
}

// Battery power pinout for the same 24-pin connector. Grouped for high-current rails.
export type BatteryRail = 'positive' | 'negative' | 'unassigned';

export const BATTERY_POWER_PINOUT: {
  positive: string[];
  negative: string[];
  unassigned: string[];
} = {
  // Positive (+) Pins: 1-5 and 13-17
  positive: [
    'pin_1', 'pin_2', 'pin_3', 'pin_4', 'pin_5',
    'pin_13', 'pin_14', 'pin_15', 'pin_16', 'pin_17',
  ],
  // Negative (-) Pins: 8-12 and 20-24
  negative: [
    'pin_8', 'pin_9', 'pin_10', 'pin_11', 'pin_12',
    'pin_20', 'pin_21', 'pin_22', 'pin_23', 'pin_24',
  ],
  // Unassigned / unused for power: 6,7,18,19
  unassigned: ['pin_6', 'pin_7', 'pin_18', 'pin_19'],
};

export function getBatteryRailForPin(pinId: string): BatteryRail | null {
  const pin = normalizePinName(pinId);
  if (BATTERY_POWER_PINOUT.positive.includes(pin)) return 'positive';
  if (BATTERY_POWER_PINOUT.negative.includes(pin)) return 'negative';
  if (BATTERY_POWER_PINOUT.unassigned.includes(pin)) return 'unassigned';
  return null;
}

export function getPinsForBatteryRail(rail: BatteryRail): string[] {
  return BATTERY_POWER_PINOUT[rail];
}
