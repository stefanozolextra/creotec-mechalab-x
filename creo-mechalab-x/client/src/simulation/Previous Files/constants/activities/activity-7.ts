import type { SimulationActivity } from './types';

export const activity7: SimulationActivity = {
  id: 'activity-7',
  title: 'Dual Supply Check',
  instructionImageSrc: '/activities/activity-7.png',
  instructions: [
    'Input Device must include a Switch.',
    'Output Device must include an LED.',
    'Build with 2 Batteries, 1 Switch, 1 Resistor, and 1 LED.',
    'Add at least 5 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 1 },
    requiredOutputDevices: { led: 1 },
    requiredComponents: { battery: 2, switch: 1, resistor: 1, led: 1 },
    minWires: 5,
  },
};
