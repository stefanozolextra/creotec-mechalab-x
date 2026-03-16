import activity2Diagram from '../../../assets/ladder-diagrams/activity-2.png';
import { activity2CustomConnections } from './customConnections';
import type { ActivityAnswerDefinition } from './types';

export const activity2Answer: ActivityAnswerDefinition = {
  routeId: '2',
  title: 'Start-Stop Latching Control Unit',
  diagram: activity2Diagram,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
    requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
    minWires: 11,
    customConnections: activity2CustomConnections,
  },
};
