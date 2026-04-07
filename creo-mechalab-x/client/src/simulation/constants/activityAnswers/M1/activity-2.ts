import activity1Diagram from '../../../../assets/ladder-diagrams/M1/activity-2.png';
import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
  targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activity2Answer: ActivityAnswerDefinition = {
  routeId: '2',
  title: 'Start-Stop Latching Conrtol Unit',
  instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the latching start-stop circuit. With the main switch on, pressing START-1 should light the green lamp, and pressing STOP-1 should switch the red lamp on while the green lamp turns off.',
  diagram: activity1Diagram,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
    requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
    minWires: 7,
    customConnections: [


      // Button mapping: PB1/PB2 = START-1/START-2, PB3/PB4 = STOP-1/STOP-2.
      // Red and green lamp return points can be connected together or sent to 0V.
      [
        [RELAY_PIN_IDS.lights.redX1, RELAY_PIN_IDS.lights.greenX1],
        ...connectToAny(RELAY_PIN_IDS.lights.redX1, VMINUS_PINS),
        ...connectToAny(RELAY_PIN_IDS.lights.greenX1, VMINUS_PINS),
      ],


      // Relay 1 terminal 13 returns to 0V.
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),


      // These lines connect relay outputs to the red and green lamps.
      [RELAY_PIN_IDS.lights.redX2, RELAY_PIN_IDS.relay1.terminal2],
      [RELAY_PIN_IDS.lights.greenX2, RELAY_PIN_IDS.relay1.terminal6],


      // This line sends START-1 output (PB1-24) to relay 1 terminal 14.
      [RELAY_PIN_IDS.relay1.terminal14, RELAY_PIN_IDS.button.pb1Terminal24],


      // This line sends the STOP-1 path to relay 1 terminal 14.
      [RELAY_PIN_IDS.relay1.terminal14, RELAY_PIN_IDS.button.pb3Terminal12],

      // This jumper links START-1 output (PB1-24) and STOP-1 input side (PB3-11).
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],

      [
        [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal5],
        [RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5],
      ],


      // These are 24V supply lines for the button and relay terminals.
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
    ],
  },
};
