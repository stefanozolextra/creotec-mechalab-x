import type { SimulationActivity } from './types';
import activity2InstructionImage from '../../assets/ladder-diagrams/activity-2.png';

export const activity2: SimulationActivity = {
  id: 'activity-2',
  title: 'Start-Stop Latching Control Unit',
  instructionImageSrc: activity2InstructionImage,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
    requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1},
    minWires: 11,
    customConnections: [
      ['lightIndicator-1-pin_2', 'lightIndicator-1-pin_10'],
      [
        ['lightIndicator-1-pin_10', 'battery-1-pin_1'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_2'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_3'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_4'],
        ['lightIndicator-1-pin_10', 'battery-1-pin_5'],
      ],
      ['lightIndicator-1-pin_3', 'relayModule-1-pin_9'],
      ['lightIndicator-1-pin_11', 'relayModule-1-pin_6'],
      [
        ['relayModule-1-pin_3', 'battery-1-pin_12'],
        ['relayModule-1-pin_3', 'battery-1-pin_11'],
        ['relayModule-1-pin_3', 'battery-1-pin_10'],
        ['relayModule-1-pin_3', 'battery-1-pin_9'],
        ['relayModule-1-pin_3', 'battery-1-pin_8'],
      ],
      [
        ['relayModule-1-pin_4', 'battery-1-pin_12'],
        ['relayModule-1-pin_4', 'battery-1-pin_11'],
        ['relayModule-1-pin_4', 'battery-1-pin_10'],
        ['relayModule-1-pin_4', 'battery-1-pin_9'],
        ['relayModule-1-pin_4', 'battery-1-pin_8'],
      ],
      [
        ['counter-1-pin_10', 'battery-1-pin_12'],
        ['counter-1-pin_10', 'battery-1-pin_11'],
        ['counter-1-pin_10', 'battery-1-pin_10'],
        ['counter-1-pin_10', 'battery-1-pin_9'],
        ['counter-1-pin_10', 'battery-1-pin_8'],
      ],
      ['counter-1-pin_9', 'counter-1-pin_8'],
      ['counter-1-pin_9', 'relayModule-1-pin_7'],
      ['relayModule-1-pin_12', 'counter-1-pin_7'],
      [
        ['counter-1-pin_11', 'battery-1-pin_1'],
        ['counter-1-pin_11', 'battery-1-pin_2'],
        ['counter-1-pin_11', 'battery-1-pin_3'],
        ['counter-1-pin_11', 'battery-1-pin_4'],
        ['counter-1-pin_11', 'battery-1-pin_5'],
      ],
    ]
  },
};
