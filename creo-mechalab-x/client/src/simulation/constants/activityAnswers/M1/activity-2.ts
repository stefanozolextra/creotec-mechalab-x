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
  instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the latching start-stop circuit before checking your answer.',
  diagram: activity1Diagram,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
    requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
    minWires: 7,
    customConnections: [
      [RELAY_PIN_IDS.lights.redX1, RELAY_PIN_IDS.lights.greenX1],

      connectToAny(RELAY_PIN_IDS.lights.greenX1, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal7, VPLUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal8, VPLUS_PINS),
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),

      [RELAY_PIN_IDS.lights.greenX2, RELAY_PIN_IDS.relay1.terminal5],
      [RELAY_PIN_IDS.lights.redX2, RELAY_PIN_IDS.relay1.terminal2],
      [RELAY_PIN_IDS.relay1.terminal4, RELAY_PIN_IDS.button.pb1Terminal24],

      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
      [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
    ],
  },
};
