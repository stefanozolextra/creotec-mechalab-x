import activity3Diagram from '../../../../assets/ladder-diagrams/M2/activity-5.png';
import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
    targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activity5Answer: ActivityAnswerDefinition = {
    routeId: '5',
    title: 'On-Delay Timer Circuit',
    instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the on-delay timer circuit. With the main switch on, the yellow lamp should remain on while T1 is timing after START-1 is pressed. When the user-set delay finishes, the green lamp should turn on and the yellow lamp should turn off. Pressing STOP should reset the timer immediately, turn the green lamp off, and switch the yellow lamp back on.',
    diagram: activity3Diagram,
    rule: {
        requiredInputDevices: { button: 1 },
        requiredOutputDevices: { relayModule: 1, lightIndicator: 1, timer: 1 },
        requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1, timer: 1 },
        minWires: 7,


        // These are the expected connections from the diagram.
        // Button mapping: PB1/PB2 = START-1/START-2, PB3/PB4 = STOP-1/STOP-2.
        customConnections: [
            // These lines are the START path for relay 1.
            connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
            [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
            [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
            connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
            connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),


            // Relay 1 terminal 5 can receive power from either of these button points.
            [
                [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal5],
                [RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5],
            ],


            // These lines power the timer section.
            connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
            [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.timer1.terminal7],
            connectToAny(RELAY_PIN_IDS.timer1.terminal2, VMINUS_PINS),
            connectToAny(RELAY_PIN_IDS.timer1.terminal8, VPLUS_PINS),


            // Timer outputs connect to green and yellow lamps.
            [RELAY_PIN_IDS.timer1.terminal6, RELAY_PIN_IDS.lights.greenX1],
            [RELAY_PIN_IDS.timer1.terminal5, RELAY_PIN_IDS.lights.yellowX1],


            // Lamp return lines can be tied together or sent to 0V.
            [
                ...connectToAny(RELAY_PIN_IDS.lights.greenX2, VMINUS_PINS),
                [RELAY_PIN_IDS.lights.greenX2, RELAY_PIN_IDS.lights.yellowX2],
            ],


            [
                ...connectToAny(RELAY_PIN_IDS.lights.yellowX2, VMINUS_PINS),
                [RELAY_PIN_IDS.lights.yellowX2, RELAY_PIN_IDS.lights.greenX2],
            ],
        ],
    },
};
