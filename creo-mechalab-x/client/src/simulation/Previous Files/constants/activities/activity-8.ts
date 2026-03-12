import type { SimulationActivity } from './types';

export const activity8: SimulationActivity = {
  id: 'activity-8',
  title: 'Alarm Output Pair',
  instructionImageSrc: '/activities/activity-8.png',
  instructions: [
    'Input Device must include a Switch.',
    'Output Device must include 2 LEDs.',
    'Build with 1 Battery, 1 Switch, 2 Resistors, and 2 LEDs.',
    'Add at least 6 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 1 },
    requiredOutputDevices: { led: 2 },
    requiredComponents: { battery: 1, switch: 1, resistor: 2, led: 2 },
    minWires: 6,
  },
};
