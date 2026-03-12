import terminalStripImageSrc from '../assets/simulation-components/terminal-strip.png';

// Customize terminal-strip size here for the simulation canvas.
export const TERMINAL_STRIP_WIDTH = 200;
export const TERMINAL_STRIP_HEIGHT = 30;

const buildTerminalStripPins = (pinPositions: Record<string, NodeOffset> = {}): Record<string, NodeOffset> => {
  return {
    ...pinPositions,
  };
};

export interface NodeOffset {
  x: number;
  y: number;
}

export interface CustomNodeAssetConfig {
  label: string;
  imageSrc: string;
  onImageSrc?: string;
  width: number;
  height: number;
  pins: Record<string, NodeOffset>;
}

// Single terminal-strip pin configuration (edit here).
const TERMINAL_STRIP_PIN_CONFIG: Record<string, NodeOffset> = {
  // Edit with direct x/y values, e.g. pin_1: { x: 26, y: 15 }
  pin_1: { x: 26, y: 8 },
  pin_2: { x: 40, y: 8 },
  pin_3: { x: 53, y: 8 },
  pin_4: { x: 67, y: 8 },
  pin_5: { x: 80, y: 8 },
  pin_6: { x: 94, y: 8 },
  pin_7: { x: 107, y: 8 },
  pin_8: { x: 120, y: 8 },
  pin_9: { x: 134, y: 8 },
  pin_10: { x: 147, y: 8 },
  pin_11: { x: 161, y: 8 },
  pin_12: { x: 175, y: 8 },
  // pin_13: { x: 26, y: 22 },
  // pin_14: { x: 40, y: 22 },
  // pin_15: { x: 53, y: 22 },
  // pin_16: { x: 67, y: 22 },
  // pin_17: { x: 80, y: 22 },
  // pin_18: { x: 94, y: 22 },
  // pin_19: { x: 107, y: 22 },
  // pin_20: { x: 120, y: 22 },
  // pin_21: { x: 134, y: 22 },
  // pin_22: { x: 147, y: 22 },
  // pin_23: { x: 161, y: 22 },
  // pin_24: { x: 175, y: 22 },
};

const createTerminalStripAsset = (label: string, pinConfig: Record<string, NodeOffset>): CustomNodeAssetConfig => ({
  label,
  imageSrc: terminalStripImageSrc,
  onImageSrc: terminalStripImageSrc,
  width: TERMINAL_STRIP_WIDTH,
  height: TERMINAL_STRIP_HEIGHT,
  pins: buildTerminalStripPins(pinConfig),
});

export const CUSTOM_NODE_ASSETS: Record<string, CustomNodeAssetConfig> = {
  terminalStrip: createTerminalStripAsset('Terminal Strip', TERMINAL_STRIP_PIN_CONFIG),
};

// Convenience arrays for grouping pin rows
export const TOP_ROW_PINS: string[] = [
  'pin_1','pin_2','pin_3','pin_4','pin_5','pin_6','pin_7','pin_8','pin_9','pin_10','pin_11','pin_12',
];

export const BOTTOM_ROW_PINS: string[] = [
  'pin_13','pin_14','pin_15','pin_16','pin_17','pin_18','pin_19','pin_20','pin_21','pin_22','pin_23','pin_24',
];
