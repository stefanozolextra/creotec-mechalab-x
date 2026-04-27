import type { SimulationActivity } from './types';

export const activity9: SimulationActivity = {
  id: 'activity-9',
  title: 'Mixed Inputs and Outputs',
  instructionImageSrc: '/activities/activity-9.png',
  instructions: [
    'Input Device must include 2 Switches.',
    'Output Device must include 2 LEDs.',
    'Build with 1 Battery, 2 Switches, 2 Resistors, and 2 LEDs.',
    'Turn ON at least 1 switch.',
    'Add at least 7 wires.',
  ],
  rule: {
    requiredInputDevices: { switch: 2 },
    requiredOutputDevices: { led: 2 },
    requiredComponents: { battery: 1, switch: 2, resistor: 2, led: 2 },
    minWires: 7,
    minSwitchOn: 1,
  },
};
