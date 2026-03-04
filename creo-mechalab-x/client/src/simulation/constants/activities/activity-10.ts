import type { SimulationActivity } from './types';

export const activity10: SimulationActivity = {
  id: 'activity-10',
  title: 'Final Multi-Load Challenge',
  instructionImageSrc: '/activities/activity-10.png',
  instructions: [
    'Input Device must include 2 Switches.',
    'Output Device must include 3 LEDs.',
    'Build with 2 Batteries, 2 Switches, 3 Resistors, and 3 LEDs.',
    'Turn ON at least 2 switches.',
    'Light at least 1 LED and add at least 9 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 2 },
    requiredOutputDevices: { led: 3 },
    requiredComponents: { battery: 2, switch: 2, resistor: 3, led: 3 },
    minWires: 9,
    minSwitchOn: 2,
    minLitLed: 1,
  },
};
