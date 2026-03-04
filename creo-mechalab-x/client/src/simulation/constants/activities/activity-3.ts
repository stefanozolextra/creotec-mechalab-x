import type { SimulationActivity } from './types';

export const activity3: SimulationActivity = {
  id: 'activity-3',
  title: 'Dual Output LED',
  instructionImageSrc: '/activities/activity-3.png',
  instructions: [
    'Input Device must include a Switch.',
    'Output Device must include 2 LEDs.',
    'Build with 1 Battery, 1 Switch, 1 Resistor, and 2 LEDs.',
    'Add at least 4 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 1 },
    requiredOutputDevices: { led: 2 },
    requiredComponents: { battery: 1, switch: 1, resistor: 1, led: 2 },
    minWires: 4,
  },
};
