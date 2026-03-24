import activity3Diagram from '../../../../assets/ladder-diagrams/M1/activity-3.png';
import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
    targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activity3Answer: ActivityAnswerDefinition = {
    routeId: '3',
    title: 'Series Start',
    instruction: 'Placeholder activity. The ladder diagram is available here, but answer validation and device behavior for this activity are not implemented yet.',
    diagram: activity3Diagram,
    isPlaceholder: true,
    rule: {
        requiredInputDevices: { button: 1 },
        requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
        requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
        minWires: 7,
        // different combination of connections can work, but these are the ones expected based on the diagram
        customConnections: [
            connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
            connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),
            connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
            connectToAny(RELAY_PIN_IDS.lights.yellowX2, VMINUS_PINS),
            connectToAny(RELAY_PIN_IDS.lights.greenX2, VMINUS_PINS),
            connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),

            [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb2Terminal23],
            [RELAY_PIN_IDS.relay1.terminal5, RELAY_PIN_IDS.button.pb2Terminal24],
            [RELAY_PIN_IDS.button.pb2Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],

            [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.lights.greenX1],
            [RELAY_PIN_IDS.relay1.terminal2, RELAY_PIN_IDS.lights.yellowX1],
            [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
        ],
    },
};