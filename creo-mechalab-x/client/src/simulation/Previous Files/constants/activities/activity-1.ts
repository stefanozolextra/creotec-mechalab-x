import type { SimulationActivity } from './types';
import activity1InstructionImage from '../../assets/ladder-diagrams/activity-1.png';

export const activity1: SimulationActivity = {
  id: 'activity-1',
  title: 'Start-Stop Control Unit',
  instructionImageSrc: activity1InstructionImage,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
    requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1},
    minWires: 7,
    // different combination of connections can work, but these are the ones expected based on the diagram
    customConnections: [
      ['lightIndicator-1-pin_9', 'relayModule-1-pin_6'],
      [
        ['lightIndicator-1-pin_10', 'battery-1-pin_1'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_2'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_3'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_4'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_5'],
      ],
      [
        ['relayModule-1-pin_2', 'battery-1-pin_12'],
        ['relayModule-1-pin_2', 'battery-1-pin_11'],
        ['relayModule-1-pin_2', 'battery-1-pin_10'],
        ['relayModule-1-pin_2', 'battery-1-pin_9'],
        ['relayModule-1-pin_2', 'battery-1-pin_8'],
      ],
      ['battery-1-pin_10', 'relayModule-1-pin_9'],
      [
        ['counter-1-pin_10', 'battery-1-pin_12'],
        ['counter-1-pin_10', 'battery-1-pin_11'],
        ['counter-1-pin_10', 'battery-1-pin_10'],
        ['counter-1-pin_10', 'battery-1-pin_9'],
        ['counter-1-pin_10', 'battery-1-pin_8'],
      ],
      ['relayModule-1-pin_1', 'counter-1-pin_7'],
      ['counter-1-pin_9', 'counter-1-pin_8'],
    ],
  },
};
