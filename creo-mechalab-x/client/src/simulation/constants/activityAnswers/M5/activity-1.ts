import activity1Diagram from '../../../../assets/ladder-diagrams/M5activity-5.1.png';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';
import { RELAY_PIN_IDS } from '../../pinConfiguration';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
  targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activityAnswer: ActivityAnswerDefinition = {
  routeId: '1',
  title: 'Start-Stop Control Unit',
  instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the start-stop control circuit. With the main switch on, pressing START-1 should turn the green light on and keep it on until STOP-1 is pressed.',
  diagram: activity1Diagram,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, solenoidValve: 1 },
    requiredComponents: { battery: 1, relayModule: 1, solenoidValve: 1 },
    minWires: 7,
    // different combination of connections can work, but these are the ones expected based on the diagram
    customConnections: [
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
      [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),
      [
        (RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal5),
        (RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5),
      ],
      connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
      [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.solenoid1.aPlusPositive],
      connectToAny(RELAY_PIN_IDS.solenoid1.aPlusNegative, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal11, VPLUS_PINS),
      [RELAY_PIN_IDS.relay1.terminal3, RELAY_PIN_IDS.solenoid1.aMinusPositive],
      connectToAny(RELAY_PIN_IDS.solenoid1.aMinusNegative, VMINUS_PINS),
    ],
  },
};
