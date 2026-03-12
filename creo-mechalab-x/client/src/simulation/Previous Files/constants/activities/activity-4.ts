import type { SimulationActivity } from './types';

export const activity4: SimulationActivity = {
  id: 'activity-4',
  title: 'Two Input Switches',
  instructionImageSrc: '/activities/activity-4.png',
  instructions: [
    'Input Device must include 2 Switches.',
    'Output Device must include an LED.',
    'Build with 1 Battery, 2 Switches, and 1 LED.',
    'Add at least 4 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 2 },
    requiredOutputDevices: { led: 1 },
    requiredComponents: { battery: 1, switch: 2, led: 1 },
    minWires: 4,
  },
};
