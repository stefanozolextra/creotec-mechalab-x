import activity3Diagram from '../../../../assets/ladder-diagrams/M1/activity-4.png';
import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
    targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activity4Answer: ActivityAnswerDefinition = {
    routeId: '4',
    title: 'Parallel Start',
    instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the parallel start circuit. With the main switch on, pressing START-1 or START-2 should switch the green lamp on while the yellow lamp turns off. Pressing STOP should switch the green lamp off and the yellow lamp on.',
    diagram: activity3Diagram,
    rule: {
        requiredInputDevices: { button: 1 },
        requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
        requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
        minWires: 7,
        // different combination of connections can work, but these are the ones expected based on the diagram
        customConnections: [
            connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
            [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
            [RELAY_PIN_IDS.button.pb2Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
            [
                [RELAY_PIN_IDS.button.pb2Terminal24, RELAY_PIN_IDS.relay1.terminal5],
                [RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5],
            ],
            [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
            connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),
            connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
            [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.lights.greenX1],
            [RELAY_PIN_IDS.relay1.terminal2, RELAY_PIN_IDS.lights.yellowX1],

            [
                ...connectToAny(RELAY_PIN_IDS.lights.greenX2, VMINUS_PINS),
                [RELAY_PIN_IDS.lights.greenX2, RELAY_PIN_IDS.lights.yellowX2],
            ],
            [
                ...connectToAny(RELAY_PIN_IDS.lights.yellowX2, VMINUS_PINS),
                [RELAY_PIN_IDS.lights.yellowX2, RELAY_PIN_IDS.lights.greenX2],
            ],
            connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
            connectToAny(RELAY_PIN_IDS.button.pb2Terminal23, VPLUS_PINS),
        ],
    },
};
