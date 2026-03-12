import type { SimulationActivity } from './types';

export const activity5: SimulationActivity = {
  id: 'activity-5',
  title: 'Switches ON Validation',
  instructionImageSrc: '/activities/activity-5.png',
  instructions: [
    'Input Device must include 2 Switches.',
    'Output Device must include an LED.',
    'Build with 1 Battery, 2 Switches, 1 Resistor, and 1 LED.',
    'Turn ON at least 2 switches.',
    'Add at least 5 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 2 },
    requiredOutputDevices: { led: 1 },
    requiredComponents: { battery: 1, switch: 2, resistor: 1, led: 1 },
    minWires: 5,
    minSwitchOn: 2,
  },
};
