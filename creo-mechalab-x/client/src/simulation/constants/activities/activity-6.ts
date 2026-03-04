import type { SimulationActivity } from './types';

export const activity6: SimulationActivity = {
  id: 'activity-6',
  title: 'Output With Load Pair',
  instructionImageSrc: '/activities/activity-6.png',
  instructions: [
    'Input Device must include a Switch.',
    'Output Device must include 1 LED and 1 Resistor.',
    'Build with 1 Battery, 1 Switch, 2 Resistors, and 1 LED.',
    'Add at least 5 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 1 },
    requiredOutputDevices: { led: 1, resistor: 1 },
    requiredComponents: { battery: 1, switch: 1, resistor: 2, led: 1 },
    minWires: 5,
  },
};
