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
    instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the series start circuit. With the main switch on, the yellow lamp should turn on. Pressing START-1 should switch the green lamp on, pressing START-2 should switch the yellow lamp on, and pressing STOP should turn both lamps off.',
    diagram: activity3Diagram,
    rule: {
        requiredInputDevices: { button: 1 },
        requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
        requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
        minWires: 7,


        // These are the expected connections from the diagram.
        // Button mapping: PB1/PB2 = START-1/START-2, PB3/PB4 = STOP-1/STOP-2.
        customConnections: [
            // These lines provide 24V supply to the button and relay points.
            connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
            connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),
            connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),


            // These are return options for the yellow and green lamps.
            [
                ...connectToAny(RELAY_PIN_IDS.lights.yellowX2, VMINUS_PINS),
                [RELAY_PIN_IDS.lights.yellowX2, RELAY_PIN_IDS.lights.greenX2],
            ],


            [
                ...connectToAny(RELAY_PIN_IDS.lights.greenX2, VMINUS_PINS),
                [RELAY_PIN_IDS.lights.greenX2, RELAY_PIN_IDS.lights.yellowX2],
            ],


            // Relay 1 terminal 13 returns to 0V.
            connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),


            // This is the series start path (START-1 PB1 with START-2 PB2).
            [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb2Terminal23],
            [
                [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal5],
                [RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5],
            ],

            [RELAY_PIN_IDS.button.pb2Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],


            // These connect relay outputs to lamp inputs.
            [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.lights.greenX1],
            [RELAY_PIN_IDS.relay1.terminal2, RELAY_PIN_IDS.lights.yellowX1],


            // This line sends the STOP side path to relay 1 terminal 14.
            [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
        ],
    },
};
