import activity1Diagram from '../../../../assets/ladder-diagrams/M1/activity-1.png';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';
import { RELAY_PIN_IDS } from '../../pinConfiguration';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
  targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activity1Answer: ActivityAnswerDefinition = {
  routeId: '1',
  title: 'Start-Stop Control Unit',
  instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the start-stop control circuit. With the main switch on, pressing START-1 should turn the green light on and keep it on until STOP-1 is pressed.',
  diagram: activity1Diagram,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
    requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
    minWires: 7,


    // These are the expected connections from the diagram.
    // Button mapping: PB1/PB2 = START-1/START-2, PB3/PB4 = STOP-1/STOP-2.
    customConnections: [
      // This connects relay output to the green lamp.
      [RELAY_PIN_IDS.lights.greenX2, RELAY_PIN_IDS.relay1.terminal5],


      // This gives the green lamp a return path to 0V.
      connectToAny(RELAY_PIN_IDS.lights.greenX1, VMINUS_PINS),


      // This returns relay 1 terminal 13 to 0V.
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),


      // This feeds relay 1 terminal 9 from 24V+.
      connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),


      // This supplies START-1 (PB1) from 24V+.
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),


      // This joins START-1 output (PB1-24) with STOP-1 input side (PB3-11).
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],


      // This sends the STOP-1 path to relay 1 terminal 14.
      [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
    ],
  },
};
