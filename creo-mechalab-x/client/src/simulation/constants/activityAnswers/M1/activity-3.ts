import activity3Diagram from '../../../../assets/ladder-diagrams/M1/activity-4.png';
import type { ActivityAnswerDefinition } from '../types';

export const activity3Answer: ActivityAnswerDefinition = {
    routeId: '3',
    title: 'Series Start',
    instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the latching start-stop circuit before checking your answer.',
    diagram: activity3Diagram,
    rule: {
        requiredInputDevices: { button: 1 },
        requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
        requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
        minWires: 7,
        customConnections: [
            ['vplus_1', 'button_2'],
            ['button_2', 'button_4'],
            ['button_1', 'button_3'],
            ['button_3', 'relay1_2'],

        ],
    }
};